/** One private pet conversation coordinates generation, synthesis, recording and a single playback owner. */
import { randomUUID } from 'node:crypto'
import { conversationStore } from './conversation-store.mjs'
import { converse, synthesize, recognize } from './voice-services.mjs'
import { speechCues } from './speech-cues.mjs'
import { speechMask } from './speech-mask.mjs'
import { createProseReader } from './broadcast.mjs'
import { createMouthDiagnostics, cueStatistics, poseStatistics, subtitleCoverage } from './mouth-diagnostics.mjs'
import { createSpeechTextFilter, speechSegmentLength } from './speech-text.mjs'
import { dialoguePrompt, recentTurns, recentEmotionMessages, emotionHistoryText, expandEmotionPrompt, normalizeEmotionOutput } from './satellites.mjs'
import { intimacyState, intimacyPrompt } from './intimacy.mjs'

/**
 * The read-out owner that stands for text the person selected in the interface.
 *
 * A read-out is owned by one control at a time — a message id, or this — so starting either one cancels the
 * other, and the client's single read-out store keys both from the same event.
 */
const SELECTION_OWNER = 'selection'

/**
 * How long past its own model bound a turn may keep the next message out.
 *
 * `converse` bounds every call with `config.timeoutMs`, so a turn older than that plus this slack is not making
 * progress. Refusing on such a turn left the person with an input that never worked again — the button answered
 * nothing, because the host still believed a reply was in flight (reported 2026-09-21).
 */
export const TURN_GRACE_MS = 1000

/**
 * Whether an in-flight turn has outlived every bound its model call had.
 * @param turn - the in-flight turn record, or undefined when nothing is generating.
 * @param now - the clock to judge against.
 * @returns true when the turn may be abandoned in favour of a new message.
 */
export const turnExpired = (turn, now = Date.now()) => Boolean(turn) && now - turn.startedAt > turn.budget + TURN_GRACE_MS

function inputQueue() {
  const queue = []; let waiter, ended = false, bytes = 0
  return {
    push(value) { if (ended) throw new Error('录音已结束'); bytes += value.length; if (bytes > 128000) throw new Error('录音上传过快'); queue.push(value); waiter?.(); waiter = null },
    end() { ended = true; waiter?.(); waiter = null },
    async *[Symbol.asyncIterator]() { for (;;) { if (queue.length) { const b = queue.shift(); bytes -= b.length; yield b } else if (ended) return; else await new Promise(r => { waiter = r }) } },
  }
}
export function createConversationHost(root, defaults = {}, services = { converse, synthesize, recognize }) {
  const store = conversationStore(root, defaults), clients = new Set(), audio = new Map(), tasks = new Set(), checks = new Set()
  // What each read-out actually handed the mouth, and what the player then reported back.
  const diagnostics = createMouthDiagnostics(root)
  let reply, turn, recording, speechController = new AbortController(), speechEpoch = randomUUID(), disposed = false, playback, pagePlayback, speechTail = Promise.resolve(), queued = 0
  // Reading aloud belongs to the plugin rather than to the pet window: the visible pet plays a clip with its mouth,
  // and while the person has the pet hidden the Harness window plays the same clip without one. Whoever is attached
  // owns the audio; with neither attached there is nowhere to play, so nothing is queued (reported 2026-09-21).
  const audioOwner = () => playback ?? pagePlayback
  // The subset of `queued` that belongs to the pet's own conversation, which is the only speech that may drive
  // the pet chat's bubble (`reply.speaking` / `reply.voiced`).
  let chatQueued = 0
  let emotionJob, emotionError = '', broadcastSaturated = false
  // The per-message and selection read-out control: which control asked for a read-out. `undefined` means nothing
  // is being read out by hand.
  let readoutId
  // Playback backpressure: a synthesis job waits for a free slot, and an acknowledgement frees one. The queue
  // therefore holds at most `speechLookahead` clips of audio, however long the answer is.
  let slotWaiters = []
  const awaitSlot = limit => (audio.size < limit ? Promise.resolve() : new Promise(resolve => slotWaiters.push(resolve)))
  const releaseSlot = () => { slotWaiters.shift()?.() }
  const emotionState = () => ({ ...store.session.emotion, generating: Boolean(emotionJob), error: emotionError })
  const snapshot = () => ({ session: { id: store.session.id, messages: store.session.messages }, intimacy: intimacyState(store.session, store.config.intimacyLevels), emotion: emotionState(), generating: Boolean(turn), recording: recording?.id ?? null, ttsEnabled: store.config.ttsEnabled, reply })
  const send = (client, type, value) => { if (disposed || !client) return; const frame = `event: ${type}\ndata: ${JSON.stringify(value)}\n\n`; if (client.res.writableLength > 1024 * 1024) client.res.destroy(); else client.res.write(frame) }
  const emit = (type, value, role) => { if (disposed) return; for (const client of clients) if (!role || client.role === role) send(client, type, value) }
  // One clip has one player: the pet window when it is on screen, otherwise the Harness window. Only the owner is
  // sent the clip, so the other one never plays it as well.
  const emitSpeech = value => send(audioOwner(), 'speech', value)
  const emitToPlayers = (type, value) => { send(playback, type, value); send(pagePlayback, type, value) }
  /**
   * Hand the clips nobody has played yet to whichever window holds the audio now.
   *
   * Hiding the pet, showing it again, or reloading the Harness window changes who owns the audio; those clips are
   * still queued, so the new owner receives them instead of the read-out dying with the window that started it.
   * The seat that lost the audio is told to stop, or both windows would play the same clip at once. With no player
   * left the queue ends here: a clip held for a window that will never play it only leaves the bubble claiming
   * speech.
   * @param from - the seat that held the audio until now, when a window just took it.
   */
  const handOverAudio = from => {
    const owner = audioOwner()
    if (from === owner) return
    if (from) send(from, 'speech-stop', { epoch: speechEpoch })
    if (!owner) { if (queued || audio.size) stopSpeech(); return }
    for (const item of audio.values()) if (item.epoch === speechEpoch && item.frame) send(owner, 'speech', item.frame)
  }
  const track = promise => { tasks.add(promise); promise.finally(() => tasks.delete(promise)).catch(() => {}); return promise }
  const updateEmotion = (config, key, context, sourceReplyId) => {
    emotionJob?.controller.abort()
    const session = store.session, controller = new AbortController(), job = { controller }
    emotionJob = job; emotionError = ''
    const history = emotionHistoryText(context, config.emotionCharacterName)
    const relation = intimacyPrompt('{{亲密情况}}', intimacyState(session, config.intimacyLevels))
    const messages = [{ role: 'system', content: expandEmotionPrompt(config.emotionPrompt, history, relation) }, { role: 'user', content: '请根据以上聊天记录生成当前情绪。' }]
    const request = { id: randomUUID(), kind: 'emotion', model: config.model, messages, sourceReplyId, at: new Date().toISOString(), status: 'streaming' }
    session.requests.push(request); store.persist(); emit('emotion', emotionState())
    return track((async () => {
      let text = ''
      try {
        await services.converse(config, key, messages, delta => { if (!controller.signal.aborted) text += delta }, controller.signal)
        if (controller.signal.aborted || disposed || store.session !== session || emotionJob !== job) { request.status = 'interrupted'; return }
        request.output = text.trim()
        const formatted = normalizeEmotionOutput(text)
        request.status = 'complete'
        session.emotion = { text: formatted, updatedAt: new Date().toISOString(), sourceReplyId }
      } catch (error) {
        request.status = controller.signal.aborted ? 'interrupted' : 'failed'
        if (!controller.signal.aborted && emotionJob === job) emotionError = '情绪更新失败，沿用上一份情绪。'
      } finally {
        if (emotionJob === job) emotionJob = undefined
        if (!disposed && store.session === session) { store.persist(); emit('emotion', emotionState()) }
      }
    })())
  }
  const publishReply = () => {
    if (!reply) return
    reply.generating = Boolean(turn && turn.id === reply.id)
    // Only the pet's own conversation may claim the bubble. `queued` counts every clip in the queue — broadcast and
    // read-outs included — so using it here resurrected the last private reply whenever anything else was spoken,
    // and left it on screen for as long as that speech lasted (reported 2026-09-20).
    reply.speaking = chatQueued > 0
    emit('reply', reply)
  }
  const stopSpeech = () => {
    speechController.abort(); speechController = new AbortController(); speechEpoch = randomUUID(); audio.clear(); queued = 0; chatQueued = 0
    broadcastSaturated = false; speechTail = Promise.resolve()
    const waiting = slotWaiters; slotWaiters = []
    for (const release of waiting) release()
    emitToPlayers('speech-stop', { epoch: speechEpoch })
    // Stopping is also the end of a manual read-out, whatever stopped it.
    if (readoutId !== undefined) { readoutId = undefined; emit('readout', { messageId: null, state: 'idle' }) }
    publishReply()
  }
  const stop = () => { turn?.controller.abort(); emotionJob?.controller.abort(); recording?.controller.abort(); recording?.queue.end(); for (const controller of checks) controller.abort(); stopSpeech() }
  const enqueue = (text, config, key, epoch, asides = [], options = {}) => {
    let accepted = false
    // `allowed` is the caller's own gate: the pet's chat passes its auto-read switch, broadcast passes its own.
    const source = options.source ?? 'chat'
    const allowed = options.allowed ?? store.config.ttsEnabled
    if (!allowed || !/[\p{L}\p{N}]/u.test(text) || epoch !== speechEpoch || !audioOwner()) return false
    if (options.saturate && broadcastSaturated) return false
    if (++queued > (options.cap ?? config.queueSegments)) {
      // A chat reply that outruns its budget stops, which the person sees as "text continues". Broadcast reads
      // whole answers, so it stops ACCEPTING instead and lets what is already queued play out: cancelling it
      // is what silently dropped the middle of a long answer (2026-09-19).
      if (options.saturate) { queued = options.cap ?? config.queueSegments; broadcastSaturated = true; emit('notice', { message: '播报内容较长，已停止接收新的段落；已排队的会继续播放。' }); return false }
      stopSpeech(); emit('notice', { message: '回复较长，已停止朗读，文字继续显示。' }); return false
    }
    // Counted after the gate, so only a clip that really entered the queue can hold the bubble.
    if (source === 'chat') chatQueued++
    const signal = speechController.signal
    publishReply()
    accepted = true
    const job = speechTail.then(async () => {
      if (signal.aborted || epoch !== speechEpoch) return
      await awaitSlot(Math.max(1, config.speechLookahead ?? 3))
      if (signal.aborted || epoch !== speechEpoch) return
      const result = await services.synthesize(config, key, text, signal)
      if (signal.aborted || epoch !== speechEpoch || !audioOwner()) return
      if ([...audio.values()].reduce((n, a) => n + a.pcm.length, 0) + result.pcm.length > 16 * 1024 * 1024) throw new Error('语音播放缓冲已满，请缩短回复')
      const id = randomUUID(), mask = speechMask(result.pcm, result.sampleRate)
      const cues = speechCues(text, result.duration, result.subtitles, mask)
      const statistics = cueStatistics(cues.cues), subtitles = subtitleCoverage(result.subtitles, result.duration)
      const diagnosticsId = diagnostics.record({
        source, messageId: options.messageId ?? null, text,
        duration: Number(result.duration.toFixed(3)), alignment: cues.alignment,
        sentenceChars: config.sentenceChars, subtitleWords: subtitles.words, subtitleCoverage: subtitles.coverage,
        // What the payload proved and what the timeline ended up doing: a rejected numeric span, and the seconds
        // each pose holds. The cue count alone could not tell a moving mouth from a still one.
        collapsedTokens: cues.collapsed, minMsPerSyllable: cues.minMsPerSyllable, unlabelledSeconds: cues.unlabelledSeconds, repaired: cues.repaired,
        speechSeconds: mask.last === null ? null : Number((mask.segments.reduce((sum, [from, to]) => sum + (to - from), 0)).toFixed(3)),
        ...statistics, ...poseStatistics(cues.cues, result.duration, mask),
      })
      const frame = { id, epoch, sampleRate: result.sampleRate, timeline: cues, asides, diagnosticsId, actionKeywords: config.actionKeywords, actionPresets: config.actionPresets, mouthRecipes: config.mouthRecipes }
      audio.set(id, { ...result, epoch, source, frame }); emitSpeech(frame)
    }).catch(error => { if (!signal.aborted && epoch === speechEpoch) { queued = Math.max(0, queued - 1); if (source === 'chat') chatQueued = Math.max(0, chatQueued - 1); publishReply(); emit('notice', { message: error.message }) } })
    speechTail = track(job)
    return accepted
  }
  const start = text => {
    if (recording) throw new Error('请先停止当前回复或结束录音')
    // A turn that outlived its own model bound is abandoned rather than honoured: refusing the next message on it
    // would leave the person pressing a button that can never answer.
    if (turn) {
      if (!turnExpired(turn)) throw new Error('请先停止当前回复或结束录音')
      turn.controller.abort()
      turn = undefined
    }
    if (typeof text !== 'string' || !text.trim() || text.length > 8000) throw new Error('请输入 1–8000 字的消息')
    const config = { ...store.config }, key = store.keys.llm, ttsKey = store.keys.tts
    if (!key || !config.model) throw new Error('请先设置对话 API Key 和模型接入点')
    stopSpeech()
    const epoch = speechEpoch, controller = new AbortController(), id = randomUUID()
    const first = store.session.messages.length === 0
    const history = recentTurns(store.session.messages, config.historyTurns)
    const previousEmotion = store.session.emotion?.text ?? ''
    if (JSON.stringify(history).length + text.length + config.prompt.length + previousEmotion.length > 150000) throw new Error('对话上下文过长，请开始新对话')
    const answer = { id, role: 'assistant', content: '', status: 'streaming' }
    store.session.messages.push({ id: randomUUID(), role: 'user', content: text.trim(), status: 'complete' }, answer)
    store.persist()
    reply = { id, text: '', generating: true, speaking: false, voiced: false }
    turn = { id, controller, startedAt: Date.now(), budget: config.timeoutMs }; publishReply(); emit('state', snapshot())
    const work = (async () => {
      let sentence = '', asides = []
      const speechText = createSpeechTextFilter(text => {
        if (/(?:…|\.{3})$/.test(sentence)) {
          const length = speechSegmentLength(sentence + ' ', config.sentenceChars)
          if (length && length <= sentence.length) { if (config.ttsEnabled) enqueue(sentence.slice(0,length),config,ttsKey,epoch,asides.splice(0),{ source: 'chat' }); sentence = sentence.slice(length) }
        }
        if (config.ttsEnabled && store.config.ttsEnabled && playback) asides.push(text)
        else emit('action-aside', { text, actionKeywords: config.actionKeywords, actionPresets: config.actionPresets, mouthRecipes: config.mouthRecipes }, 'player')
      })
      try {
        if (first) await updateEmotion(config, key, [{ role: 'user', content: text.trim() }], id)
        controller.signal.throwIfAborted()
        const messages = [{ role: 'system', content: dialoguePrompt(config.prompt, first ? store.session.emotion?.text : previousEmotion) }, ...history, { role: 'user', content: text.trim() }]
        store.session.requests.push({ id, kind: 'dialogue', model: config.model, messages, at: new Date().toISOString() }); store.persist()
        await services.converse(config, key, messages, delta => {
          if (controller.signal.aborted || turn?.id !== id) return
          answer.content += delta; reply.text = answer.content; publishReply(); emit('text', { id, delta })
          for (const ch of delta) {
            const spoken = speechText(ch)
            sentence += spoken
            for (;;) { const length = speechSegmentLength(sentence, config.sentenceChars); if (!length) break; if (config.ttsEnabled) enqueue(sentence.slice(0, length), config, ttsKey, epoch, asides.splice(0), { source: 'chat' }); sentence = sentence.slice(length) }
          }
        }, controller.signal)
        answer.status = controller.signal.aborted ? 'interrupted' : 'complete'
        if (!controller.signal.aborted && config.ttsEnabled) {
          if (/[\p{L}\p{N}]/u.test(sentence)) enqueue(sentence, config, ttsKey, epoch, asides, { source: 'chat' })
          else for (const text of asides) emit('action-aside', { text, actionKeywords: config.actionKeywords, actionPresets: config.actionPresets, mouthRecipes: config.mouthRecipes }, 'player')
        }
      } catch (error) { answer.status = controller.signal.aborted ? 'interrupted' : 'failed'; if (!controller.signal.aborted) emit('notice', { message: error.message }) }
      finally {
        if (turn?.id === id) turn = undefined
        store.completeTurn(id)
        store.persist(); publishReply(); emit('state', snapshot())
        if (answer.status === 'complete' && !disposed) void updateEmotion(config, key, recentEmotionMessages(store.session.messages, config.emotionHistoryMessages), id)
      }
    })()
    track(work); return { id }
  }
  const readJson = async req => { let size = 0; const chunks = []; for await (const b of req) { size += b.length; if (size > 8 * 1024 * 1024) throw new Error('请求过大'); chunks.push(b) } return JSON.parse(Buffer.concat(chunks).toString()) }
  /**
   * Read one piece of text through the pet's own voice and prose rules.
   *
   * Both read-outs — a message the person pointed at, and text they selected — go through here, so they share the
   * same sentence splitting, prose filter, voice, queue and mouth timing. The reader is fed the whole text and
   * closed immediately: a finished passage needs no stream.
   *
   * A read-out deliberately does not caption the bubble. The bubble belongs to the pet's own reply and to the main
   * agent's prose while the pet broadcasts it, so text someone asked to hear never overwrites what the character
   * is saying. The reader still calls these handlers, so they stay as no-ops.
   * @param owner - the control this read-out belongs to, so the client can show its own playing state.
   * @param text - the prose to speak.
   * @param source - the diagnostics source this read-out is recorded as.
   * @returns how many clips entered the queue; zero means there was nothing speakable.
   */
  const readAloud = (owner, text, source) => {
    readoutId = owner
    let clips = 0
    const sink = {
      sentenceChars: store.config.sentenceChars,
      sentence: value => { if (enqueue(value, { ...store.config }, store.keys.tts, speechEpoch, [value], { allowed: true, cap: store.config.broadcastQueueSegments, saturate: true, source, messageId: owner })) clips++ },
      bubble: () => {},
      done: () => {},
    }
    const reader = createProseReader(sink)
    reader.push(text)
    reader.end()
    // Announcing "playing" for a clip that was never queued would leave the control waiting on a state change
    // that never comes, so the state follows what actually entered the queue.
    emit('readout', { messageId: owner, state: clips ? 'playing' : 'idle' })
    return clips
  }
  return {
    /**
     * Speak one finished sentence of the main agent's prose through the pet's own voice configuration. The
     * sentence doubles as the action-keyword text, so the character's speaking actions follow its words.
     * @param text - the sentence to synthesize.
     * @returns whether the sentence entered the speech queue.
     */
    speak(text) {
      if (disposed || !store.keys.tts) return false
      return enqueue(text, { ...store.config }, store.keys.tts, speechEpoch, [text], { allowed: true, cap: store.config.broadcastQueueSegments, saturate: true, source: 'broadcast' })
    },
    /**
     * One assistant message, read out on demand: the same voice, queue, caption and prose rules as the
     * automatic broadcast, but owned by the control the person pressed. Pressing it again while it plays
     * cancels; pressing it after that speaks the message from its start.
     * @param messageId - the message being read out.
     * @param text - the message's prose.
     * @returns the state the control should show.
     */
    readout(messageId, text) {
      // `stopSpeech` owns clearing the read-out, so it also publishes the idle state exactly once.
      if (readoutId === messageId) { stopSpeech(); return { state: 'idle' } }
      stopSpeech()
      readAloud(messageId, text, 'readout')
      return { state: 'playing' }
    },
    /**
     * Speak text the person selected in the interface, whatever it came from.
     *
     * This is the read-out path without a message behind it: the selection is not session content, so nothing here
     * touches the log or the model. The plugin owns the voice rather than the pet window, so a hidden pet still
     * reads; a missing voice key, or a run with no window able to play, is reported to the caller rather than
     * swallowed — the person pressed a button and deserves to know why nothing happened.
     * @param text - the selected prose.
     * @returns the state the selection control should show, and how many clips were queued.
     */
    selection(text) {
      if (!store.keys.tts) throw new Error('请先在桌宠设置里配置 TTS Key')
      if (!audioOwner()) throw new Error('没有可用的播放窗口，请打开 Harness 窗口')
      stopSpeech()
      const clips = readAloud(SELECTION_OWNER, text, 'selection')
      if (!clips) throw new Error('这段文字没有可朗读的内容')
      return { state: 'playing', clips }
    },
    /**
     * The recent read-outs, newest last, as the diagnostics route serves them.
     *
     * Every layer of the mouth path was verified in isolation while a report could still say the audio played and
     * the mouth did not move, so the record is the deliverable: it is what a person reads to find out which layer
     * failed. This accessor was missing when the route was first published — the route called a method the host
     * never returned, so `GET /desktop-pet/api/broadcast/diagnostics` threw instead of answering (2026-09-20).
     * @returns the bounded list of recent records.
     */
    diagnostics() { return diagnostics.list() },
    store,
    async handle(req, res, url) {
      if (!url.pathname.startsWith('/desktop-pet/api/conversation')) return false
      const action = url.pathname.slice('/desktop-pet/api/conversation'.length), method = req.method
      const json = (status, data) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(data)) }
      try {
        if (disposed) throw new Error('桌宠已卸载')
        if (action === '/events' && method === 'GET') {
          const requested = url.searchParams.get('role')
          const role = requested === 'player' || requested === 'page' ? requested : 'chat'
          if (role === 'player' && playback) throw new Error('已有桌宠播放窗口')
          if (role === 'page' && pagePlayback) throw new Error('已有 Harness 播放窗口')
          const client = { res, role }; clients.add(client)
          const previous = audioOwner()
          if (role === 'player') playback = client
          else if (role === 'page') pagePlayback = client
          // A window that joins while the other one is already playing takes the audio over: showing the pet after a
          // read-out started must move the clip to the model, not play it twice.
          if (role !== 'chat') handOverAudio(previous)
          res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' }); res.write(`event: state\ndata: ${JSON.stringify(snapshot())}\n\n`)
          const timer = setInterval(() => res.write(': heartbeat\n\n'), 15000)
          res.on('close', () => {
            clearInterval(timer); clients.delete(client)
            // Hiding the pet is not the end of a read-out: the other window takes over whatever has not been played.
            // With no player left there is nowhere to put the audio, so the queue ends rather than leaking clips.
            if (playback === client) { playback = null; handOverAudio() } else if (pagePlayback === client) { pagePlayback = null; handOverAudio() }
          })
          return true
        }
        if (action === '/config' && method === 'GET') { json(200, store.publicConfig()); return true }
        if (action === '' && method === 'GET') { json(200, snapshot()); return true }
        if (action === '/audio' && method === 'GET') { const item = audio.get(url.searchParams.get('id')); if (!item) { json(404, { error: '音频已过期' }); return true } res.writeHead(200, { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' }); res.end(item.pcm); return true }
        if (method !== 'POST' || !req.headers['content-type']?.startsWith('application/json')) { json(405, { error: 'JSON POST required' }); return true }
        const body = await readJson(req)
        if (action === '/config') { const wasEnabled = store.config.ttsEnabled, value = store.save(body); if (wasEnabled && !store.config.ttsEnabled) stopSpeech(); emit('state', snapshot()); json(200, value) }
        else if (action === '/send') json(200, start(body.text))
        else if (action === '/stop') { if (body.speechOnly) stopSpeech(); else stop(); json(200, { ok: true }) }
        else if (action === '/pause') { if (typeof body.paused !== 'boolean') throw new Error('暂停状态无效'); emitToPlayers('speech-pause', { paused: body.paused }); json(200, { ok: true }) }
        else if (action === '/new') { stop(); await Promise.allSettled([...tasks]); store.reset(); reply = undefined; emit('state', snapshot()); json(200, snapshot()) }
        else if (action === '/ack') {
          if (body.diagnosticsId !== undefined) diagnostics.playback(body.diagnosticsId, { played: body.played !== false, silentFrames: Number(body.silentFrames) || 0, actionHits: Number(body.actionHits) || 0 })
          const item = audio.get(body.id)
          if (item?.epoch === body.epoch) {
            audio.delete(body.id); queued = Math.max(0, queued - 1); releaseSlot()
            // `voiced` means "the pet's own reply was really spoken", so a broadcast or read-out clip must not set
            // it: that would clear the chat bubble the moment anything else finished playing.
            if (item.source === 'chat') {
              chatQueued = Math.max(0, chatQueued - 1)
              if (reply && body.played !== false) reply.voiced = true
            }
            publishReply()
            if (readoutId !== undefined && queued === 0) { readoutId = undefined; emit('readout', { messageId: null, state: 'idle' }) }
          }
          json(200, { ok: true })
        }
        else if (action === '/test') {
          let result = ''; const c = { ...store.config, maxTokens: 64 }, controller = new AbortController(); checks.add(controller)
          const messages = [{ role: 'system', content: dialoguePrompt(c.prompt, store.session.emotion?.text) }, { role: 'user', content: '请用一句话打个招呼。' }]
          store.session.requests.push({ id: randomUUID(), kind: 'connection-test', model: c.model, messages, at: new Date().toISOString() }); store.persist()
          try { await track(services.converse(c, store.keys.llm, messages, t => result += t, controller.signal)); json(200, { text: result }) }
          finally { checks.delete(controller) }
        }
        else if (action === '/sample') {
          if (!playback) throw new Error('请先显示桌宠再试听')
          stopSpeech(); const config = { ...store.config }, epoch = speechEpoch, signal = speechController.signal
          const job = services.synthesize(config, store.keys.tts, '你好，我是你的桌面伙伴。今天过得怎么样？', signal).then(result => { if (signal.aborted || epoch !== speechEpoch) return; const id = randomUUID(); const frame = { id, epoch, sampleRate: result.sampleRate, timeline: speechCues('你好，我是你的桌面伙伴。今天过得怎么样？', result.duration, result.subtitles, speechMask(result.pcm, result.sampleRate)) }; audio.set(id, { ...result, epoch, frame }); emitSpeech(frame) })
          await track(job); json(200, { ok: true })
        }
        else if (action === '/record/start') {
          if (recording) throw new Error('已经在录音'); if (!store.keys.asr) throw new Error('请先填写 ASR API Key')
          stop(); const queue = inputQueue(), controller = new AbortController(), id = randomUUID()
          const rec = { id, queue, controller, bytes: 0 }; recording = rec
          controller.signal.addEventListener('abort', () => queue.end(), { once: true })
          rec.done = track(services.recognize(store.config, store.keys.asr, queue, (text, final) => emit('transcript', { id, text, final }), controller.signal).then(text => { if (!controller.signal.aborted) emit('transcript', { id, text, final: true }); return text }).catch(error => { if (!controller.signal.aborted) emit('notice', { message: error.message }); return '' }).finally(() => { queue.end(); if (recording === rec) recording = null; emit('state', snapshot()) }))
          json(200, { id, seconds: store.config.recordingSeconds }); emit('state', snapshot())
        }
        else if (action === '/record/chunk') { if (!recording || body.id !== recording.id) throw new Error('录音已过期'); if (typeof body.pcm !== 'string' || body.pcm.length > 20000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.pcm)) throw new Error('录音分片无效'); const b = Buffer.from(body.pcm, 'base64'); recording.bytes += b.length; if (b.length % 2 || recording.bytes > store.config.recordingSeconds * 32000) { recording.controller.abort(); throw new Error('录音超出限制') } recording.queue.push(b); json(200, { ok: true }) }
        else if (action === '/record/end') { const rec = recording; if (!rec || rec.id !== body.id) throw new Error('录音已过期'); rec.queue.end(); json(200, { text: await rec.done }) }
        else json(404, { error: '未知对话接口' })
      } catch (error) { if (!res.headersSent) json(400, { error: error.name === 'AbortError' ? '已停止' : error.message }); else res.end() }
      return true
    },
    async dispose() { if (disposed) return; disposed = true; stop(); for (const c of clients) c.res.end(); clients.clear(); await Promise.allSettled([...tasks]); audio.clear() },
  }
}
