import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, statSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { conversationStore, conversationDefaults, validateConversation } from '../src/conversation-store.mjs'
import { createConversationHost, turnExpired, TURN_GRACE_MS } from '../src/conversation-host.mjs'
import { asrPacket, decodeVoicePacket } from '../src/voice-protocol.mjs'
import { pronouncable, speechCues } from '../src/speech-cues.mjs'
import { createSpeechTextFilter, speechSegmentLength } from '../src/speech-text.mjs'
import { fixtureEmotion } from './fixtures/emotion.mjs'

test('speech excludes streamed nested asides and preserves short interjections', () => {
  const filter = createSpeechTextFilter()
  assert.equal(['啊？（惊','讶！（轻声））这','样吗？(smiles)当然。'].map(filter).join(''),'啊？这样吗？当然。')
  assert.equal(speechSegmentLength('啊？',80),0)
  assert.equal(speechSegmentLength('啊？这样吗？',80),6)
  assert.equal(filter('（尚未闭合'), ''); assert.equal(filter('不朗读'), '')
  const short = speechCues('啊？',.24,[{word:'啊？',startTime:0,endTime:.24}])
  assert.equal(short.cues.at(-1).shape,'a','Question punctuation cannot close the mouth halfway through the vowel')
  assert.equal(speechCues('啊？',.24).cues.at(-1).shape,'a')
  const partial = speechCues('啊？这样吗',1,[{word:'这样吗',startTime:.3,endTime:.9}])
  assert.equal(partial.alignment,'partial-word-pinyin'); assert.ok(partial.cues.some(c=>c.shape==='a'&&c.time<.3))
})

test('ellipsis and repeated asides preserve every spoken suffix regardless of streaming cuts',()=>{
 const original='（红着耳朵抬起头，睫毛忽闪）我、我还好！就是有点突然……（抿嘴笑）你不生气啦？'
 const expected=['我、我还好！','就是有点突然……','你不生气啦？']
 for(let cut=0;cut<=original.length;cut++){
   const filter=createSpeechTextFilter(),parts=[];let pending=''
   for(const delta of [original.slice(0,cut),original.slice(cut)])for(const ch of delta){pending+=filter(ch);for(;;){const n=speechSegmentLength(pending,100);if(!n)break;parts.push(pending.slice(0,n));pending=pending.slice(n)}}
   if(pending)parts.push(pending)
   assert.deepEqual(parts,expected,`cut ${cut}`)
 }
 assert.equal(speechSegmentLength('就是有点突然...',100),0)
 assert.equal(speechSegmentLength('就是有点突然...你',100),9)
 assert.equal(speechSegmentLength('价格是3.14元。',100),9)
})

test('private keys are retained by blank edits, explicitly cleared, and never returned by read API', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pet-store-'))
  try {
    const store = conversationStore(dir)
    store.save({ config: { ...conversationDefaults, model: 'test' }, keys: { llm: 'private-test-value', tts: 'tts-test' } })
    assert.equal(JSON.stringify(store.publicConfig()).includes('private-test-value'), false)
    store.save({ config: store.config, keys: { llm: '', tts: null } }); assert.equal(store.keys.llm, 'private-test-value'); assert.equal(store.keys.tts, undefined)
    assert.equal(statSync(join(dir, 'voice-credentials.json')).mode & 0o777, 0o600)
    assert.equal(conversationStore(dir).keys.llm, 'private-test-value')
    assert.throws(() => validateConversation({ baseUrl: 'http://evil.test' }))
    assert.throws(() => validateConversation({ baseUrl: 'https://ark.cn-beijing.volces.com.evil.test/api/v3' }))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
test('compressed PCM packets retain signed sequence and reject truncated data', () => {
  const source = Buffer.from([1, 0, 2, 0]), packet = asrPacket(4, source, true, true), decoded = decodeVoicePacket(packet)
  assert.equal(decoded.sequence, -4); assert.equal(decoded.last, true); assert.deepEqual(decoded.payload, source)
  assert.throws(() => decodeVoicePacket(packet.subarray(0, packet.length - 2)))
})
test('Arabic digits are read as spoken numerals and open the mouth', () => {
  // Digits have no pinyin of their own; before this they produced no vowel and closed the mouth for the whole
  // span, so a read-out of "1, 2, 3" moved nothing (reported 2026-09-19).
  const shapes = cues => [...new Set(cues.filter(cue => cue.shape !== 'm').map(cue => cue.shape))]
  for (const text of ['1234567890', '4839201756483920175648392017564839201756', '138 0042 7765', '数字 42 与中文混排']) {
    const result = speechCues(text, 4)
    assert.equal(shapes(result.cues).length > 0, true, `"${text.slice(0, 16)}" must open the mouth, got ${JSON.stringify(result.cues)}`)
  }
  // A digit's own span carries its vowel: the reading of "1" is open somewhere inside the first tenth.
  const digits = speechCues('1234567890', 5)
  assert.equal(digits.cues.some(cue => cue.time < .5 && cue.shape !== 'm'), true, 'the first digit opens the mouth')
  assert.equal(digits.cues.some(cue => cue.time > 4.4 && cue.shape !== 'm'), true, 'so does the last one')
  // Letters are read by name and symbols by their reading, so spelled-out acronyms and symbol-heavy text move
  // the mouth too: "GDP" has no vowel letter of its own and used to close it for the whole span.
  for (const text of ['GDP', 'USB', 'AI', 'hello world', '增长 5%', 'A+B=C → 100%', '单位 µΩ']) {
    assert.equal(shapes(speechCues(text, 4).cues).length > 0, true, `"${text}" must open the mouth`)
  }
  // Greek letters are letters and were never seen by the symbol pass; symbols that are read aloud get their
  // reading, while typographic punctuation stays the pause it is.
  assert.equal(pronouncable('Δ = β × π'), '德尔塔等于贝塔乘派', 'Greek letters, arithmetic, and the equals sign are read')
  // Digits are read one at a time, which is what a phone number, an id, and a long string all need.
  assert.equal(pronouncable('20℃ ± 2‰'), '二零摄氏度正负二千分号', 'measures and units are read where they stand')
  assert.equal(pronouncable('《活着》是一本“好书”（推荐）'), '活着是一本好书推荐', '书名号、引号与括号不产生读音')
  assert.equal(pronouncable('A → B ≈ 100%'), '诶到比约等于一零零百分号', 'arrows, approximate equality, and percent are read')
  for (const text of ['Δ = β', '增长 5% @someone', '1 + 2 - 3 × 4 ÷ 5 = 0', 'A → B ≈ C ≥ D', '$100 £50 ¥200']) {
    assert.equal(shapes(speechCues(text, 4).cues).length > 0, true, `"${text}" must open the mouth`)
  }
  assert.deepEqual(shapes(speechCues('《》「」“”（）【】，。', 2).cues), [], 'typographic punctuation alone never opens the mouth')

  // Punctuation is a pause, not a syllable, so a line of it still closes the mouth.
  assert.deepEqual(shapes(speechCues(',,, 。。。', 2).cues), [])
  assert.equal(pronouncable('GDP'), '基迪皮', 'a spelled-out acronym is read letter by letter')
  assert.equal(pronouncable('5%'), '五百分号', 'a symbol is read where it stands')

  // Letters are read by name, so even "hmm" carries vowels now; what still closes the mouth is text that is
  // only punctuation, asserted just above.
  assert.equal(pronouncable('a1b2'), '诶一比二', 'letters are read by name and digits as numerals')
})

test('word timing leaves silence closed and produces authored a/o/i/m shapes', () => {
  const result = speechCues('阿哦衣妈', 4, [{ words: ['阿', '哦', '衣', '妈'].map((word, i) => ({ word, startTime: i + .2, endTime: i + .7 })) }])
  assert.equal(result.alignment, 'word-pinyin'); assert.deepEqual(new Set(result.cues.map(c => c.shape)), new Set(['m', 'a', 'o', 'i']))
  assert.equal(result.cues.find(c => c.time === .7).shape, 'm'); assert.equal(speechCues('hello', 1).alignment, 'estimated')
  const continuous = speechCues('阿哦衣', .6, [{ words: ['阿', '哦', '衣'].map((word, i) => ({word, startTime:i*.2,endTime:(i+1)*.2})) }])
  assert.ok(continuous.cues.filter(c => c.shape === 'm').every(c => c.time === 0), 'Contiguous vowels do not insert tiny closed-mouth interruptions')
})
test('Host cancels obsolete speech, records actual model input, and leaves text enabled when TTS is off', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pet-conversation-')); let syntheses = 0, aborted = 0
  const services = {
    async converse(_c, _k, _m, delta, signal) { if (_m[0].content.includes('五行纯文本')) { delta(fixtureEmotion('平静')); return } delta('你好。'); await new Promise(r => setTimeout(r, 30)); if (signal.aborted) throw new DOMException('cancelled','AbortError'); delta('今天好吗？') },
    async synthesize(_c, _k, _t, signal) { syntheses++; await new Promise((resolve, reject) => { const timer = setTimeout(resolve, 500); signal.addEventListener('abort', () => { clearTimeout(timer); aborted++; reject(new DOMException('cancelled','AbortError')) }, { once: true }) }); return { pcm: Buffer.alloc(4800), duration: .1, sampleRate: 24000, subtitles: [] } },
  }
  const host = createConversationHost(dir, {}, services)
  const server = createServer((req, res) => host.handle(req, res, new URL(req.url, 'http://localhost')))
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); const base = `http://127.0.0.1:${server.address().port}/desktop-pet/api/conversation`
  const post = async (path, body) => { const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, value: await r.json() } }
  const playerController = new AbortController()
  try {
    const playerResponse = await fetch(base + '/events?role=player', { signal: playerController.signal })
    void (async()=>{try{for await(const chunk of playerResponse.body){ /* Keep the playback connection consumed and owned through the test. */ }}catch(error){if(!playerController.signal.aborted)throw error}})()
    await post('/config', { config: { ...conversationDefaults, model: 'test', ttsEnabled: true }, keys: { llm: 'test', tts: 'test' } })
    assert.equal((await post('/send', { text: '第一句' })).status, 200)
    assert.equal((await post('/send', { text: '重复' })).status, 400)
    for (let i=0;i<200 && (!syntheses || host.store.session.messages.at(-1).status==='streaming');i++) await new Promise(r=>setTimeout(r,10))
    await post('/config', { config: { ...host.store.config, ttsEnabled: false } })
    await new Promise(r => setTimeout(r, 30)); assert.ok(aborted >= 1)
    const previous = syntheses; assert.equal((await post('/send', { text: '第二句' })).status,200); for(let i=0;i<200&&host.store.session.messages.at(-1).status==='streaming';i++)await new Promise(r=>setTimeout(r,10)); assert.equal(syntheses, previous)
    const state = await (await fetch(base)).json(); assert.equal(state.session.messages.at(-1).content, '你好。今天好吗？')
    assert.equal(host.store.session.requests.filter(r=>r.kind==='dialogue').at(-1).messages.at(-1).content, '第二句')
    assert.equal(readFileSync(join(dir, 'conversation-session.json'), 'utf8').includes('private-test-value'), false)
    await post('/new', {}); assert.equal(host.store.session.messages.length, 0)
  } finally { playerController.abort(); await host.dispose(); server.closeAllConnections(); await new Promise(r => server.close(r)); rmSync(dir, { recursive: true, force: true }) }
})

test('symbols, spaces, and unit mismatches never leave the mouth still for long', () => {
  // The reported failure: `+5.7%` was matched through its symbol-stripped form `57`, so the readings of `+`, `.`
  // and `%` never reached the mouth for that span while the timeline still claimed to be usable (2026-09-20).
  const texts = [
    '工业是最亮的：规上工业增加值 +5.7%，比上半年还在提速。电子 +11.5%、汽车 +11.0%、专用设备 +12.0%。',
    '高技术制造业 +11.1%，其中工业机器人产量 +36.6%、集成电路 +34.3%、新能源汽车 +49.0%。',
    '节奏上是明显走弱的：2025 年四个季度 5.4% → 5.2% → 4.8% → 4.5%。',
    '+49.0%',
    '4839201756483920175648392017564839201756',
    '138 0042 7765',
    'Δ = β × π，GDP +5%',
  ]
  const longestClosedRun = cues => {
    const times = cues.filter(cue => cue.shape !== 'm').map(cue => cue.time)
    if (!times.length) return Infinity
    let worst = times[0]
    for (let index = 1; index < times.length; index++) worst = Math.max(worst, times[index] - times[index - 1])
    return worst
  }
  for (const text of texts) {
    for (const label of ['estimated', 'with subtitles']) {
      // Both paths the host can take: the provider's subtitles, or the uniform fallback when they do not line up.
      const duration = Math.max(1, pronouncable(text).length * .22)
      const subtitles = label === 'with subtitles'
        ? text.split(/(?<=[，。、%])|\s+/u).filter(Boolean).reduce((list, word, _index, all) => {
          const total = all.reduce((n, item) => n + item.length, 0)
          const before = all.slice(0, list.length).reduce((n, item) => n + item.length, 0)
          list.push({ word, startTime: before / total * duration, endTime: (before + word.length) / total * duration })
          return list
        }, [])
        : []
      const result = speechCues(text, duration, subtitles)
      assert.equal(longestClosedRun(result.cues) < .8, true, `"${text.slice(0, 18)}" (${label}) must not fall silent for long: cues ${JSON.stringify(result.cues.slice(0, 8))}`)
    }
  }
})

test('non-ASCII digits, letters, and symbols are read instead of closing the mouth', () => {
  // These are letters and numbers to Unicode, so the symbol pass never saw them and pinyin found no vowel: each
  // closed the mouth for its whole span while the audio read it out (measured 2026-09-20).
  const forms = {
    '＋１１.５％': '加一一点五百分号',
    '２０２５': '二零二五',
    'ＧＤＰ': '基迪皮',
    '①②③': '一二三',
    '5² + 3³': '五二加三三',
    '½ ⅓': '二分之一三分之一',
  }
  for (const [raw, reading] of Object.entries(forms)) {
    assert.equal(pronouncable(raw), reading, `${raw} reads as ${reading}`)
    assert.equal(speechCues(raw, 3).cues.some(cue => cue.shape !== 'm'), true, `${raw} must open the mouth`)
  }
  // Roman numerals become the letters they are read as.
  assert.equal(pronouncable('Ⅻ'), pronouncable('XII'), 'a Roman numeral reads like its letters')
  // A character that is spoken but has no reading we know fails OPEN: the mouth stays visibly spoken.
  const exotic = speechCues('\u13A0', 1)
  assert.equal(exotic.cues.some(cue => cue.shape !== 'm'), true, 'an unreadable letter is not silence')
  // Punctuation is still a pause, and that is the one case that closes the mouth.
  assert.deepEqual(speechCues('，。；：', 2).cues.filter(cue => cue.shape !== 'm'), [])
})

test('reading aloud plays in the Harness window while the pet itself is hidden', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pet-page-player-'))
  const services = {
    async converse(_c, _k, _m, delta) { delta('你好。') },
    async synthesize() { return { pcm: Buffer.alloc(4800), duration: .1, sampleRate: 24000, subtitles: [] } },
  }
  const host = createConversationHost(dir, {}, services)
  const server = createServer((req, res) => host.handle(req, res, new URL(req.url, 'http://localhost')))
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); const base = `http://127.0.0.1:${server.address().port}/desktop-pet/api/conversation`
  const post = async (path, body) => { const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, value: await r.json() } }
  const listen = async role => {
    const controller = new AbortController(), response = await fetch(`${base}/events?role=${role}`, { signal: controller.signal }), seen = []
    void (async () => { try { let buffer = ''; for await (const chunk of response.body) { buffer += Buffer.from(chunk).toString('utf8'); let index; while ((index = buffer.indexOf('\n\n')) >= 0) { const frame = buffer.slice(0, index); buffer = buffer.slice(index + 2); const name = /^event: (.+)$/mu.exec(frame)?.[1]; const data = /^data: (.+)$/mu.exec(frame)?.[1]; if (name) seen.push({ name, value: data ? JSON.parse(data) : null }) } } } catch { /* the test closes these streams itself */ } })()
    return { seen, close: () => controller.abort() }
  }
  const page = await listen('page')
  try {
    await post('/config', { config: { ...conversationDefaults, model: 'test' }, keys: { llm: 'test', tts: 'test' } })
    // No pet window is attached at all: the read-out must still be synthesised and sent to the Harness window.
    const readout = host.selection('这段话要念出来。')
    assert.equal(readout.state, 'playing', `a hidden pet must not block a read-out, got ${JSON.stringify(readout)}`)
    for (let i = 0; i < 200 && !page.seen.some(event => event.name === 'speech'); i++) await new Promise(r => setTimeout(r, 10))
    const speech = page.seen.find(event => event.name === 'speech')
    assert.notEqual(speech, undefined, 'the Harness window receives the clip')
    // The clip is fetchable and acknowledgeable from that window, which is the whole playback contract.
    const audio = await fetch(`${base}/audio?id=${speech.value.id}`)
    assert.equal(audio.status, 200)
    assert.equal((await post('/ack', { id: speech.value.id, epoch: speech.value.epoch, played: true, diagnosticsId: speech.value.diagnosticsId })).status, 200)
  } finally { page.close(); await host.dispose(); server.closeAllConnections(); await new Promise(r => server.close(r)); rmSync(dir, { recursive: true, force: true }) }
})

test('the visible pet owns the audio, and hiding it hands the unplayed clip to the Harness window', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pet-handover-'))
  const services = {
    async converse(_c, _k, _m, delta) { delta('你好。') },
    async synthesize() { return { pcm: Buffer.alloc(4800), duration: .1, sampleRate: 24000, subtitles: [] } },
  }
  const host = createConversationHost(dir, {}, services)
  const server = createServer((req, res) => host.handle(req, res, new URL(req.url, 'http://localhost')))
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); const base = `http://127.0.0.1:${server.address().port}/desktop-pet/api/conversation`
  const post = async (path, body) => { const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, value: await r.json() } }
  const listen = async role => {
    const controller = new AbortController(), response = await fetch(`${base}/events?role=${role}`, { signal: controller.signal }), seen = []
    void (async () => { try { let buffer = ''; for await (const chunk of response.body) { buffer += Buffer.from(chunk).toString('utf8'); let index; while ((index = buffer.indexOf('\n\n')) >= 0) { const frame = buffer.slice(0, index); buffer = buffer.slice(index + 2); const name = /^event: (.+)$/mu.exec(frame)?.[1]; const data = /^data: (.+)$/mu.exec(frame)?.[1]; if (name) seen.push({ name, value: data ? JSON.parse(data) : null }) } } } catch { /* the test closes these streams itself */ } })()
    return { seen, close: () => controller.abort() }
  }
  const pet = await listen('player'), page = await listen('page')
  try {
    await post('/config', { config: { ...conversationDefaults, model: 'test' }, keys: { llm: 'test', tts: 'test' } })
    assert.equal(host.selection('这段话要念出来。').state, 'playing')
    // The visible pet is the one that gets the clip; the standby window must not play it as well.
    for (let i = 0; i < 200 && !pet.seen.some(event => event.name === 'speech'); i++) await new Promise(r => setTimeout(r, 10))
    const played = pet.seen.find(event => event.name === 'speech')
    assert.notEqual(played, undefined, 'the visible pet receives the clip')
    assert.equal(page.seen.some(event => event.name === 'speech'), false, 'the standby window stays silent while the pet is on screen')
    // Hiding the pet closes its stream; the clip it never acknowledged belongs to the window that is still there.
    pet.close()
    for (let i = 0; i < 200 && !page.seen.some(event => event.name === 'speech'); i++) await new Promise(r => setTimeout(r, 10))
    const handed = page.seen.find(event => event.name === 'speech')
    assert.notEqual(handed, undefined, 'the pending read-out survives hiding the pet')
    assert.equal(handed.value.id, played.value.id, 'the same clip changes hands rather than being lost')
    assert.equal((await post('/ack', { id: handed.value.id, epoch: handed.value.epoch, played: true, diagnosticsId: handed.value.diagnosticsId })).status, 200)

    // Showing the pet again, while the Harness window is playing, must move the clip to the model instead of
    // playing it in both windows.
    assert.equal(host.selection('再念一段。').state, 'playing')
    for (let i = 0; i < 200 && !page.seen.some(event => event.name === 'speech' && event.value.id !== handed.value.id); i++) await new Promise(r => setTimeout(r, 10))
    const second = page.seen.filter(event => event.name === 'speech').at(-1)
    const pet2 = await listen('player')
    try {
      for (let i = 0; i < 200 && !pet2.seen.some(event => event.name === 'speech'); i++) await new Promise(r => setTimeout(r, 10))
      assert.notEqual(pet2.seen.find(event => event.name === 'speech'), undefined, 'the pet takes the clip over when it comes back')
      assert.equal(page.seen.filter(event => event.name === 'speech-stop').length >= 1, true, 'and the window that lost the audio is told to stop')
      assert.equal(pet2.seen.find(event => event.name === 'speech').value.id, second.value.id, 'the clip that was playing in the window moves to the pet')
    } finally { pet2.close() }
  } finally { page.close(); await host.dispose(); server.closeAllConnections(); await new Promise(r => server.close(r)); rmSync(dir, { recursive: true, force: true }) }
})

test('only a turn that outlived its own model bound is abandoned', () => {
  const now = 1_000_000
  // A model call is bounded by `config.timeoutMs`, so a turn inside that bound is simply still working.
  assert.equal(turnExpired(undefined, now), false, 'no turn means nothing to abandon')
  assert.equal(turnExpired({ startedAt: now - 60_000, budget: 60_000 }, now), false, 'a turn inside its bound still owns the conversation')
  assert.equal(turnExpired({ startedAt: now - 60_000 - TURN_GRACE_MS, budget: 60_000 }, now), false, 'the grace covers a slow finally')
  assert.equal(turnExpired({ startedAt: now - 60_000 - TURN_GRACE_MS - 1, budget: 60_000 }, now), true, 'past the bound plus grace the turn is not making progress')
})

test('a message is accepted again once the previous turn outlived its model bound', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pet-stale-turn-'))
  // A model call that only settles when it is aborted: the turn can end only if something abandons it, which is
  // exactly the state that used to leave the person with a send button that never answered again.
  const services = {
    async converse(_c, _k, _m, _delta, signal) { await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true })); throw new DOMException('cancelled', 'AbortError') },
    async synthesize() { throw new Error('never used') },
  }
  const host = createConversationHost(dir, {}, services)
  const server = createServer((req, res) => host.handle(req, res, new URL(req.url, 'http://localhost')))
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); const base = `http://127.0.0.1:${server.address().port}/desktop-pet/api/conversation`
  const post = async (path, body) => { const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, value: await r.json() } }
  const realNow = Date.now
  try {
    await post('/config', { config: { ...conversationDefaults, model: 'test', timeoutMs: 5000 }, keys: { llm: 'test' } })
    assert.equal((await post('/send', { text: '第一句' })).status, 200)
    assert.equal((await post('/send', { text: '重复' })).status, 400, 'a live turn still refuses the next message')
    // The clock moves past the five-second bound this turn was given, plus the grace, without the test sleeping.
    Date.now = () => realNow() + 7000
    const again = await post('/send', { text: '再来一句' })
    assert.equal(again.status, 200, 'the abandoned turn is taken over instead of keeping the input dead')
    assert.equal(host.store.session.messages.at(-2).content, '再来一句')
  } finally {
    Date.now = realNow
    await host.dispose(); server.closeAllConnections(); await new Promise(r => server.close(r)); rmSync(dir, { recursive: true, force: true })
  }
})
