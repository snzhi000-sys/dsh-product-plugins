/**
 * The broadcast speech budget. A model answer is far longer than a chat reply, and the budget that is right
 * for one is wrong for the other: with the chat's own 24-segment limit, a 26-sentence answer was cut off in
 * the middle — the overflow cancelled every queued clip and left only the opening and the tail audible
 * (reported 2026-09-19). This pins both halves of the fix: broadcast has its own budget, and reaching it
 * stops ACCEPTING new sentences instead of cancelling the ones already waiting.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { conversationDefaults } from '../src/conversation-store.mjs'
import { createConversationHost } from '../src/conversation-host.mjs'

/** Instant synthesis: the test cares about the queue, not the audio. */
const services = {
  async converse(_config, _key, _messages, delta) { delta('不应被调用。') },
  async synthesize() { return { pcm: Buffer.alloc(4800), duration: .1, sampleRate: 24000, subtitles: [] } },
}

/** Collect server-sent frames as `{ event, value }` pairs. */
function collect(response) {
  const frames = []
  let buffer = ''
  void (async () => {
    try {
      for await (const chunk of response.body) {
        buffer += Buffer.from(chunk).toString('utf8')
        for (;;) {
          const at = buffer.indexOf('\n\n')
          if (at < 0) break
          const frame = buffer.slice(0, at); buffer = buffer.slice(at + 2)
          const event = /^event: (.+)$/mu.exec(frame)?.[1]
          const data = /^data: (.+)$/mu.exec(frame)?.[1]
          if (event) frames.push({ event, value: data === undefined ? undefined : JSON.parse(data) })
        }
      }
    } catch { /* The test owns the connection's lifetime. */ }
  })()
  return frames
}

/** Run one broadcast scenario against a real conversation host and a connected player. */
async function withHost(budget, run) {
  const dir = mkdtempSync(join(tmpdir(), 'pet-broadcast-'))
  const host = createConversationHost(dir, {}, services)
  const server = createServer((req, res) => host.handle(req, res, new URL(req.url, 'http://localhost')))
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}/desktop-pet/api/conversation`
  const controller = new AbortController()
  try {
    const player = await fetch(`${base}/events?role=player`, { signal: controller.signal })
    const frames = collect(player)
    host.store.save({ config: { ...conversationDefaults, broadcastQueueSegments: budget }, keys: { tts: 'test' } })
    const post = async (path, body) => { const response = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: response.status, value: await response.json() } }
    await run({ host, frames, post })
  } finally {
    controller.abort(); await host.dispose(); server.closeAllConnections(); await new Promise(resolve => { server.close(resolve) }); rmSync(dir, { recursive: true, force: true })
  }
}

const settle = async frames => { for (let attempt = 0; attempt < 200; attempt++) { if (frames.some(frame => frame.event === 'notice')) return; await new Promise(resolve => setTimeout(resolve, 10)) } }

test('reaching the broadcast budget never cancels what is already queued', async () => {
  await withHost(3, async ({ host, frames }) => {
    const accepted = ['第一句。', '第二句。', '第三句。', '第四句。', '第五句。'].map(sentence => host.speak(sentence))
    assert.deepEqual(accepted, [true, true, true, false, false], 'only the budgeted sentences enter the queue')
    await settle(frames)
    assert.equal(frames.filter(frame => frame.event === 'speech').length, 3, 'the queued sentences still play')
    assert.equal(frames.some(frame => frame.event === 'speech-stop'), false, 'overflow must not cancel the queue')
    const notice = frames.find(frame => frame.event === 'notice')
    assert.match(notice.value.message, /已停止接收新的段落/, 'the person is told the rest is not read')
  })
})

/** Wait until the collected frames satisfy a condition, or fail with what they were. */
async function until(frames, predicate, description) {
  for (let attempt = 0; attempt < 300; attempt++) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error(`timed out waiting for ${description}; frames were ${JSON.stringify(frames.map(frame => frame.event))}`)
}

const clips = frames => frames.filter(frame => frame.event === 'speech')
const readoutStates = frames => frames.filter(frame => frame.event === 'readout').map(frame => frame.value.state)

test('stopping the voice cancels the broadcast sentence already playing', async () => {
  await withHost(400, async ({ host, frames }) => {
    // The header sound switch turns `broadcastEnabled` off, and the host answers that by ending the sentence in
    // flight — the one the previous setting started. Without it the switch did nothing audible while a broadcast
    // was playing, because a hidden pet window shows no per-message strip to stop it (reported 2026-09-23).
    assert.equal(host.speak('主对话正在播报的这一句。'), true, 'the broadcast sentence enters the queue')
    await until(frames, () => clips(frames).length > 0, 'the clip to reach the player')
    host.stopSpeech()
    await until(frames, () => frames.some(frame => frame.event === 'speech-stop'), 'the queue to be cancelled')
    assert.equal(clips(frames).length, 1, 'the cancelled sentence is not handed to the player again')
  })
})

test('a broadcast announces itself as a read-out the strip control can see and stop', async () => {
  await withHost(400, async ({ host, frames }) => {
    // The strip control's two states come from the read-out channel, and a broadcast used to bypass it: the pet
    // spoke while the button stayed a resting speaker, so nothing on screen could stop it (reported 2026-09-23).
    // A broadcast is a read-out too — of the main conversation's prose — so it names an owner like any other, and
    // stopping the voice clears that owner.
    assert.equal(host.speak('主对话正在播报的这一句。'), true)
    await until(frames, () => readoutStates(frames).includes('playing'), 'the broadcast to announce itself as a read-out')
    const owner = frames.filter(frame => frame.event === 'readout').at(-1).value.messageId
    assert.equal(typeof owner, 'string', 'the broadcast names an owner, so the playing state has something to clear')
    assert.notEqual(owner, '', 'the owner is a real key in the client read-out store')
    host.stopSpeech()
    await until(frames, () => readoutStates(frames).at(-1) === 'idle', 'the read-out to go idle with the voice')
  })
})

test('the pet own chat speech is not announced as a read-out', async () => {
  await withHost(400, async ({ host, frames, post }) => {
    // The waveform means "the main conversation is being read aloud", so the pet talking in its own chat must not
    // light it: that state belongs to the pet's own bubble, and lighting the strip would offer a stop control for a
    // conversation the person is not reading (confirmed 2026-09-23).
    const config = { ...conversationDefaults, model: 'test', ttsEnabled: true, broadcastQueueSegments: 400 }
    assert.equal((await post('/config', { config, keys: { llm: 'test', tts: 'test' } })).status, 200)
    await post('/send', { text: '你好。' })
    await until(frames, () => frames.some(frame => frame.event === 'reply' && frame.value.speaking === true), 'the chat reply to be spoken')
    assert.equal(clips(frames).length > 0, true, 'the pet really is speaking its own reply')
    assert.deepEqual(readoutStates(frames), [], 'its own chat voice must not claim the read-out control')
    // Positive control: the assertion above is sensitive — a real read-out of the main conversation does announce.
    assert.equal(host.speak('主对话正在播报的这一句。'), true)
    await until(frames, () => readoutStates(frames).includes('playing'), 'the broadcast to announce itself')
  })
})

test('only the pet chat own speech may claim the pet reply state', async () => {
  await withHost(400, async ({ host, frames, post }) => {
    // One finished chat turn leaves a reply object behind. That leftover is what a read-out used to resurrect:
    // any clip in the queue set `reply.speaking`, so the bubble came back and stayed for the whole read-out
    // (reported 2026-09-20).
    const config = { ...conversationDefaults, model: 'test', ttsEnabled: true, broadcastQueueSegments: 400 }
    assert.equal((await post('/config', { config, keys: { llm: 'test', tts: 'test' } })).status, 200)
    await post('/send', { text: '你好。' })
    await until(frames, () => frames.some(frame => frame.event === 'reply' && frame.value.speaking === true), 'the chat reply to be spoken')
    const chatClip = clips(frames).at(-1)
    assert.equal((await post('/ack', { id: chatClip.value.id, epoch: chatClip.value.epoch, played: true })).status, 200)
    await until(frames, () => frames.filter(frame => frame.event === 'reply').at(-1)?.value.speaking === false, 'the chat reply to settle')
    const seen = frames.filter(frame => frame.event === 'reply').length

    // Now something that is not the pet's conversation at all.
    assert.deepEqual(host.selection('念这段选中的文字。'), { state: 'playing', clips: 1 })
    await until(frames, () => clips(frames).length > 0, 'the selection clip to be queued')
    const after = frames.filter(frame => frame.event === 'reply').slice(seen)
    assert.equal(after.some(frame => frame.value.speaking === true), false, `reading a selection must not speak for the pet reply, got ${JSON.stringify(after)}`)
    // The same for the broadcast, which reads the main agent's prose through the pet's voice.
    assert.equal(host.speak('主对话的一段正文。'), true)
    await until(frames, () => clips(frames).length > 1, 'the broadcast clip to be queued')
    const broadcast = frames.filter(frame => frame.event === 'reply').slice(seen)
    assert.equal(broadcast.some(frame => frame.value.speaking === true), false, `a broadcast must not speak for the pet reply, got ${JSON.stringify(broadcast)}`)
  })
})

test('the pet bubble has exactly one producer', async () => {
  // The bubble belongs to the pet's own conversation. While broadcast shares it, a caption the person had already
  // dismissed came back and stayed on screen after its speech ended (reported 2026-09-20), so the window listens
  // to the reply and notice events only.
  const source = readFileSync(new URL('../src/pet-chat.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /addEventListener\('announce'/)
  assert.match(source, /addEventListener\('reply'/)
  assert.match(source, /addEventListener\('notice'/)
})

test('a long answer is read whole while only a few clips wait ahead of playback', async () => {
  await withHost(conversationDefaults.broadcastQueueSegments, async ({ host, frames, post }) => {
    // The answer that exposed this: headings and bullet lists, far past the chat's own 24-segment limit.
    const sentences = []
    for (const section of ['偷来的那点时间', '喊不出口的名字', '关于痕迹', '关于距离', '收尾']) {
      sentences.push(section)
      for (let line = 1; line <= 4; line++) sentences.push(`${section}的第 ${String(line)} 句情话，写给听得见的人。`)
    }
    assert.equal(sentences.length, 25)
    assert.equal(sentences.length > conversationDefaults.queueSegments, true, 'the answer is longer than the chat budget, which is the case that broke')
    assert.equal(sentences.filter(sentence => host.speak(sentence)).length, sentences.length, 'every sentence is accepted')

    // The player drains at its own pace: nothing is synthesized far ahead of it, and nothing is dropped.
    const acked = new Set()
    let played = 0
    for (let round = 0; round < 600 && played < sentences.length; round++) {
      const ready = clips(frames).filter(clip => !acked.has(clip.value.id))
      assert.equal(ready.length <= conversationDefaults.speechLookahead, true, `at most the look-ahead may wait, got ${String(ready.length)}`)
      for (const clip of ready) {
        assert.equal((await post('/ack', { id: clip.value.id, epoch: clip.value.epoch, played: true })).status, 200)
        acked.add(clip.value.id); played++
      }
      await new Promise(resolve => setTimeout(resolve, 5))
    }
    assert.equal(played, sentences.length, 'every sentence reaches the player')
    assert.equal(frames.filter(frame => frame.event === 'notice').length, 0, 'nothing is dropped for being long')
    assert.equal(frames.filter(frame => frame.event === 'speech-stop').length, 0, 'nothing is cancelled')
  })
})

test('the per-message control speaks, cancels, replays, and settles when its clips are done', async () => {
  await withHost(400, async ({ host, frames, post }) => {
    const text = '第一句情话。第二句情话。第三句情话。'
    assert.equal(host.readout('message-1', text).state, 'playing', 'pressing the control starts the read-out')
    await until(frames, () => clips(frames).length >= 3, 'three spoken sentences')
    assert.equal(readoutStates(frames).at(-1), 'playing', 'the control reports that it is speaking')
    // A read-out never captions the bubble. The bubble belongs to the pet's own reply and to the main agent's
    // prose while the pet broadcasts it, so text someone asked to hear must not overwrite what the character is
    // saying (changed 2026-09-20; this assertion previously required the opposite).
    assert.deepEqual(frames.filter(frame => frame.event === 'announce'), [], 'a read-out does not write the bubble')

    // Pressing it again while it plays cancels; nothing of that message keeps speaking.
    assert.equal(host.readout('message-1', text).state, 'idle', 'pressing it while it plays cancels')
    // The state change travels over the event stream, so the test waits for the frame rather than guessing.
    await until(frames, () => readoutStates(frames).at(-1) === 'idle', 'the control to report rest')
    assert.equal(frames.filter(frame => frame.event === 'speech-stop').length >= 1, true, 'cancelling stops the queue')
    assert.equal(readoutStates(frames).at(-1), 'idle', 'the control returns to rest')
    assert.equal(await post('/ack', { id: 'unknown', epoch: 'nope' }).then(result => result.status), 200, 'a stale acknowledgement is harmless')

    // Pressing it after the cancellation speaks the same message again from its start.
    const before = clips(frames).length
    assert.equal(host.readout('message-1', text).state, 'playing', 'pressing it again replays the message')
    await until(frames, () => clips(frames).length >= before + 3, 'three more spoken sentences')
    assert.equal(readoutStates(frames).at(-1), 'playing')

    // The player acknowledging the last clip is what returns the control to rest.
    const playing = clips(frames).slice(-3)
    for (const clip of playing) await post('/ack', { id: clip.value.id, epoch: clip.value.epoch, played: true })
    await until(frames, () => readoutStates(frames).at(-1) === 'idle', 'the control to settle after its last clip')
    assert.equal(readoutStates(frames).at(-1), 'idle', 'a finished read-out settles on its own')
  })
})

test('the pet\'s own reply keeps its own budget and its own stopping behaviour', async () => {
  await withHost(3, async ({ host, frames }) => {
    // The private chat still passes its auto-read switch, and its overflow still stops the reading.
    host.store.save({ config: { ...host.store.config, ttsEnabled: true, queueSegments: 1 }, keys: { tts: 'test' } })
    const accepted = ['第一句。', '第二句。'].map(sentence => host.speak(sentence))
    assert.deepEqual(accepted, [true, true], 'broadcast keeps its own budget while the chat has another')
    await settle(frames)
    assert.equal(frames.filter(frame => frame.event === 'speech').length, 2, 'the broadcast queue is the one being measured')
  })
})
