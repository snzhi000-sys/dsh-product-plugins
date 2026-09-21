/**
 * The diagnostics record is the deliverable of a "the audio played but the mouth did not move" report, so it is
 * driven here through the real host and the real playback handshake rather than asserted field by field against a
 * store. When this route was first published it called a method the host never returned, so the record existed on
 * disk and the endpoint a person would read it from threw instead — a broken layer's own observability, which is
 * exactly the failure this file exists to prevent.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { createConversationHost } from '../src/conversation-host.mjs'
import { conversationDefaults } from '../src/conversation-store.mjs'

/** The sentence from the report and the subtitle payload the voice service returned for it (measured 2026-09-20). */
const reported = {
  text: '电子 +11.5%、汽车 +11.0%、专用设备 +12.0%。',
  duration: 10.596,
  words: [
    { word: '电', startTime: .375, endTime: .695 }, { word: '子', startTime: .695, endTime: 1.075 },
    { word: '+11.5%、', startTime: 1.075, endTime: 1.105 }, { word: '汽', startTime: 3.665, endTime: 3.995 },
    { word: '车', startTime: 3.995, endTime: 4.455 }, { word: '+11.0%、', startTime: 4.955, endTime: 4.985 },
    { word: '专', startTime: 5.325, endTime: 5.395 }, { word: '用', startTime: 5.395, endTime: 5.425 },
    { word: '设', startTime: 5.625, endTime: 5.855 }, { word: '备', startTime: 6.425, endTime: 6.485 },
    { word: '+12.0%。', startTime: 6.645, endTime: 6.675 },
  ],
  segments: [[.35, 1.06], [1.24, 3.36], [3.71, 4.41], [4.77, 6.71], [6.89, 8.12], [8.3, 10.42]],
}

/** 24 kHz mono PCM that speaks exactly inside the given spans and is digitally silent outside them. */
function tonePcm(duration, sampleRate, segments) {
  const samples = Math.floor(duration * sampleRate)
  const buffer = Buffer.alloc(samples * 2)
  for (const [from, to] of segments) for (let index = Math.floor(from * sampleRate); index < Math.min(samples, Math.floor(to * sampleRate)); index++) buffer.writeInt16LE(Math.round(Math.sin(index / 9) * 12000), index * 2)
  return buffer
}

test('the host serves back what it recorded, including the new timing facts', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pet-diagnostics-host-'))
  const services = {
    async converse() { throw new Error('a read-out must not call the model') },
    async synthesize() { return { pcm: tonePcm(reported.duration, 24000, reported.segments), duration: reported.duration, sampleRate: 24000, subtitles: [{ words: reported.words }] } },
  }
  const host = createConversationHost(dir, {}, services)
  const server = createServer((req, res) => host.handle(req, res, new URL(req.url, 'http://localhost')))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}/desktop-pet/api/conversation`
  const post = async (path, body) => { const response = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: response.status, value: await response.json() } }
  const player = new AbortController()
  const events = []
  try {
    const response = await fetch(base + '/events?role=player', { signal: player.signal })
    void (async () => {
      let buffer = ''
      try {
        for await (const chunk of response.body) {
          buffer += Buffer.from(chunk).toString('utf8')
          let index
          while ((index = buffer.indexOf('\n\n')) >= 0) {
            const frame = buffer.slice(0, index); buffer = buffer.slice(index + 2)
            const type = /^event: (.+)$/m.exec(frame)?.[1]
            const data = /^data: (.+)$/m.exec(frame)?.[1]
            if (type && data) events.push({ type, value: JSON.parse(data) })
          }
        }
      } catch (error) { if (!player.signal.aborted) throw error }
    })()
    await post('/config', { config: { ...conversationDefaults, model: 'test', ttsEnabled: true }, keys: { llm: 'test', tts: 'test' } })
    // The playback owner has to exist before a read-out is accepted, exactly as in the running application.
    assert.equal(host.readout('message-1', reported.text).state, 'playing')
    for (let index = 0; index < 400 && !events.some(event => event.type === 'speech'); index++) await new Promise(resolve => setTimeout(resolve, 10))
    const speech = events.find(event => event.type === 'speech')?.value
    assert.ok(speech, `the read-out must reach the player, got ${JSON.stringify(events.map(event => event.type))}`)
    assert.equal(speech.timeline.repaired, true, 'the measured payload is re-timed before it is played')

    const records = host.diagnostics()
    assert.equal(typeof host.diagnostics, 'function', 'the route reads this method, so the host must return it')
    const record = records.find(candidate => candidate.text.includes('+11.5%'))
    assert.ok(record, `the clip must be recorded, got ${JSON.stringify(records.map(candidate => candidate.text))}`)
    assert.equal(record.source, 'readout')
    assert.equal(record.messageId, 'message-1')
    assert.equal(record.alignment, 'word-pinyin')
    assert.ok(record.collapsedTokens >= 3, `the payload's 30 ms digit tokens are named, got ${record.collapsedTokens}`)
    assert.ok(record.minMsPerSyllable < 5, `the worst claimed rate is recorded, got ${record.minMsPerSyllable}`)
    assert.ok(record.unlabelledSeconds > .5, `speech with no word on it is recorded, got ${record.unlabelledSeconds}`)
    // The numbers that actually describe what a viewer sees, which a cue count could never express.
    assert.ok(record.poses.a > 1, `open poses hold real seconds, got ${JSON.stringify(record.poses)}`)
    assert.ok(record.longestClosedSeconds < 1, `the mouth never stays shut for a second, got ${record.longestClosedSeconds}`)
    assert.ok(record.silentDuringSpeech < reported.duration * .1, `almost no closure lands on speech, got ${record.silentDuringSpeech}`)
    assert.ok(record.speechSeconds > 5, `the audio's own speech span is recorded, got ${record.speechSeconds}`)

    assert.equal((await post('/ack', { id: speech.id, epoch: speech.epoch, played: true, diagnosticsId: speech.diagnosticsId, silentFrames: 2, actionHits: 1 })).status, 200)
    assert.deepEqual(host.diagnostics().find(candidate => candidate.id === record.id).playback, { played: true, silentFrames: 2, actionHits: 1 })
    // The file is the copy that survives a restart, and it carries the same record.
    const lines = readFileSync(join(dir, 'mouth-diagnostics.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line))
    assert.equal(lines.length, records.length)
    assert.equal(lines.find(candidate => candidate.id === record.id).poses.a, record.poses.a)
  } finally {
    player.abort(); await host.dispose(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); rmSync(dir, { recursive: true, force: true })
  }
})

test('a selection is spoken through the pet voice, the prose rules, and its own record', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pet-selection-host-'))
  const spoken = []
  const services = {
    async converse() { throw new Error('reading a selection must not call the model') },
    async synthesize(_config, _key, text) { spoken.push(text); return { pcm: tonePcm(6, 24000, [[0, 6]]), duration: 6, sampleRate: 24000, subtitles: [] } },
  }
  const host = createConversationHost(dir, {}, services)
  const server = createServer((req, res) => host.handle(req, res, new URL(req.url, 'http://localhost')))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}/desktop-pet/api/conversation`
  const post = async (path, body) => { const response = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: response.status, value: await response.json() } }
  const player = new AbortController()
  const events = []
  try {
    // Two things have to exist before a selection can be read, and the person is told which one is missing
    // instead of watching a button do nothing.
    assert.throws(() => host.selection('念这句。'), /TTS Key/)
    await post('/config', { config: { ...conversationDefaults, model: 'test', ttsEnabled: true }, keys: { tts: 'test' } })
    assert.throws(() => host.selection('念这句。'), /请先显示伙伴/)
    const response = await fetch(base + '/events?role=player', { signal: player.signal })
    void (async () => {
      let buffer = ''
      try {
        for await (const chunk of response.body) {
          buffer += Buffer.from(chunk).toString('utf8')
          let index
          while ((index = buffer.indexOf('\n\n')) >= 0) {
            const frame = buffer.slice(0, index); buffer = buffer.slice(index + 2)
            const type = /^event: (.+)$/m.exec(frame)?.[1]
            const data = /^data: (.+)$/m.exec(frame)?.[1]
            if (type && data) events.push({ type, value: JSON.parse(data) })
          }
        }
      } catch (error) { if (!player.signal.aborted) throw error }
    })()
    // A selection is not session content: nothing here may reach the log or the model, and only the words a person
    // would say may reach the voice. The passage ends on a clause with no closing punctuation, which is the case a
    // one-shot read-out used to drop.
    const selected = ['这是正文。', '', '```js', 'const a = 1', '```', '', '| 列 | 列 |', '| - | - |', '', '还有半句'].join('\n')
    assert.deepEqual(host.selection(selected), { state: 'playing', clips: 2 })
    for (let index = 0; index < 400 && spoken.length < 2; index++) await new Promise(resolve => setTimeout(resolve, 10))
    assert.deepEqual(spoken, ['这是正文。', '还有半句'], 'code fences and table rows are not read out, and the tail is not dropped')
    // The event rides the same stream, but the socket delivers it on its own turn: wait for the fact, not for the
    // synthesis that was triggered before it.
    for (let index = 0; index < 400 && !events.some(event => event.type === 'readout'); index++) await new Promise(resolve => setTimeout(resolve, 10))
    const readout = events.find(event => event.type === 'readout')?.value
    assert.deepEqual(readout, { messageId: 'selection', state: 'playing' }, 'the client keys its playing state by this owner')
    // The bubble is the character's own voice on screen: a passage someone asked to hear must not take it over.
    assert.deepEqual(events.filter(event => event.type === 'announce'), [], 'reading a selection does not write the bubble')
    assert.deepEqual(host.store.session.messages, [], 'a selection never becomes session content')
    const record = host.diagnostics().find(candidate => candidate.source === 'selection')
    assert.ok(record, `the selection read-out is recorded as its own source, got ${JSON.stringify(host.diagnostics().map(candidate => candidate.source))}`)
    assert.equal(record.messageId, 'selection')
    assert.equal(record.text, '这是正文。')
    // Nothing speakable is refused rather than queued as silence the pet would never play.
    assert.throws(() => host.selection('   '), /没有可朗读的内容/)
    assert.throws(() => host.selection('```js\nconst a = 1\n```'), /没有可朗读的内容/)
  } finally {
    player.abort(); await host.dispose(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); rmSync(dir, { recursive: true, force: true })
  }
})
