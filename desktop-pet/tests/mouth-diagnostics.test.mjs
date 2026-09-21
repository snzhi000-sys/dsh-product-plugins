/**
 * The mouth diagnostics exist because every layer of the mouth path was verified in isolation while a report
 * still said "the audio played and the mouth did not move": the provider's subtitles and the player's silence
 * gating left no record. These pin what a record has to carry so the next report can name its layer.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createMouthDiagnostics, cueStatistics, subtitleCoverage } from '../src/mouth-diagnostics.mjs'

test('cue statistics name the density and the openings a timeline has', () => {
  assert.deepEqual(cueStatistics([]), { cues: 0, openings: 0, minGapMs: null })
  const cues = [{ time: 0, shape: 'm' }, { time: .02, shape: 'a' }, { time: .14, shape: 'o' }, { time: .2, shape: 'm' }]
  assert.deepEqual(cueStatistics(cues), { cues: 4, openings: 2, minGapMs: 20 })
  assert.equal(cueStatistics([{ time: 0, shape: 'a' }]).minGapMs, null, 'a single cue has no gap')
})

test('subtitle coverage reports how much of the clip the provider labelled', () => {
  assert.deepEqual(subtitleCoverage(undefined, 4), { words: 0, coverage: null })
  const payload = { utterances: [{ words: [{ word: '工业', startTime: 0, endTime: 1 }, { word: '加五点七', startTime: 1, endTime: 2 }] }] }
  assert.deepEqual(subtitleCoverage(payload, 4), { words: 2, coverage: .5 }, 'nested word payloads are found and measured')
  assert.deepEqual(subtitleCoverage([{ word: 'a', startTime: 3, endTime: 9 }], 4), { words: 1, coverage: .25 }, 'time outside the clip is clamped')
})

test('a record carries the clip, its timing path, and what the player did', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pet-diagnostics-'))
  try {
    const store = createMouthDiagnostics(dir)
    const id = store.record({ source: 'broadcast', text: '工业增加值 +5.7%，比上半年提速。', duration: 3.2, alignment: 'word-pinyin', subtitleWords: 6, subtitleCoverage: .92, cues: 20, openings: 18, minGapMs: 150 })
    assert.equal(id, 1)
    store.playback(id, { played: true, silentFrames: 2, actionHits: 1 })
    const [record] = store.list()
    assert.equal(record.text, '工业增加值 +5.7%，比上半年提速。')
    assert.equal(record.alignment, 'word-pinyin')
    assert.equal(record.openings, 18)
    assert.deepEqual(record.playback, { played: true, silentFrames: 2, actionHits: 1 }, 'the player facts are attached to the clip they belong to')
    // The file survives a restart, which is what makes a report readable without the app running.
    const reopened = createMouthDiagnostics(dir)
    assert.equal(reopened.list().length, 1)
    assert.equal(reopened.list()[0].playback.silentFrames, 2)
    assert.match(readFileSync(join(dir, 'mouth-diagnostics.jsonl'), 'utf8'), /\+5\.7%/)
    // A long text is clipped, so the file never duplicates a session log.
    const long = createMouthDiagnostics(dir)
    long.record({ source: 'chat', text: 'x'.repeat(2000), duration: 1, alignment: 'estimated', cues: 1, openings: 1 })
    assert.equal(long.list().at(-1).text.length, 400)
    // An unknown playback id is ignored rather than throwing.
    assert.doesNotThrow(() => { store.playback(999, { played: false }) })
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('the ring keeps only the recent read-outs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pet-diagnostics-ring-'))
  try {
    const store = createMouthDiagnostics(dir)
    for (let index = 0; index < 80; index++) store.record({ source: 'broadcast', text: `第 ${String(index)} 句`, duration: 1, alignment: 'estimated', cues: 1, openings: 1 })
    const records = store.list()
    assert.equal(records.length, 60, 'memory stays bounded')
    assert.equal(records.at(-1).text, '第 79 句', 'the newest record is kept')
    assert.equal(records.some(record => record.text === '第 0 句'), false, 'the oldest is dropped')
    assert.equal(readFileSync(join(dir, 'mouth-diagnostics.jsonl'), 'utf8').trim().split('\n').length, 60, 'the file is bounded by the same limit, so a long session cannot grow it without end')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
