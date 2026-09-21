/**
 * Mouth diagnostics: what the host actually handed the speech pipeline, and what the player then did with it.
 *
 * Every layer of the mouth path was verified in isolation, yet a report can still say "the audio played but the
 * mouth did not move". The reason that took days to locate is that the two layers which decide the outcome — the
 * provider's subtitle payload and the player's silence gating — left no record at all. This keeps a bounded ring
 * of recent read-outs, each carrying the clip text, its duration, which timing path matched, the cue statistics,
 * the subtitle payload's size and coverage, and the playback facts reported back by the player.
 *
 * The record is written to the pet's own state directory as JSONL, so it survives an application restart and can
 * be read without the app running.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** How many read-outs are kept: the same bound for memory and for the file, so both stay bounded. */
const RECORD_LIMIT = 60
/** How much of one clip's text is kept: enough to recognise it, not enough to duplicate the session log. */
const TEXT_LIMIT = 400

/** @param value - a clip text. @returns its first {@link TEXT_LIMIT} characters. */
const clip = value => (typeof value === 'string' ? value.slice(0, TEXT_LIMIT) : '')

/**
 * @param root - the pet's state directory.
 * @returns the diagnostics store the host records into and the route reads from.
 */
export function createMouthDiagnostics(root) {
  const file = join(root, 'mouth-diagnostics.jsonl')
  const records = []
  let nextId = 1
  // Start from the previous run's tail so a report can be read across restarts.
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue
      try { records.push(JSON.parse(line)) } catch { /* A torn final line is dropped, not fatal. */ }
    }
    if (records.length > RECORD_LIMIT) records.splice(0, records.length - RECORD_LIMIT)
    nextId = (records.at(-1)?.id ?? 0) + 1
  } catch { /* No previous run. */ }
  const persist = () => {
    try {
      mkdirSync(root, { recursive: true })
      const lines = records.map(record => JSON.stringify(record))
      writeFileSync(file, `${lines.join('\n')}\n`, { mode: 0o600 })
    } catch { /* Diagnostics never break speech. */ }
  }
  return {
    /**
     * Record one clip as it enters the speech queue.
     * @param entry - the clip's text, timing path, cue statistics, and subtitle facts.
     * @returns the record's id, which the player echoes back with its own findings.
     */
    record(entry) {
      const record = { id: nextId++, at: new Date().toISOString(), ...entry, text: clip(entry.text) }
      records.push(record)
      if (records.length > RECORD_LIMIT) records.splice(0, records.length - RECORD_LIMIT)
      persist()
      return record.id
    },
    /**
     * Attach what the player observed for one clip.
     * @param id - the record the speech event carried.
     * @param playback - acked/played plus the silence-gate and action-takeover counts.
     */
    playback(id, playback) {
      const record = records.find(candidate => candidate.id === id)
      if (record === undefined) return
      record.playback = playback
      persist()
    },
    /** @returns the recent records, newest last. */
    list() { return records.map(record => ({ ...record })) },
  }
}

/**
 * The statistics one cue timeline contributes to a diagnostics record.
 * @param cues - the timeline's cues.
 * @returns how many openings it holds and the shortest gap between two cues.
 */
export function cueStatistics(cues) {
  if (!Array.isArray(cues) || cues.length === 0) return { cues: 0, openings: 0, minGapMs: null }
  let minGap = Infinity
  for (let index = 1; index < cues.length; index++) minGap = Math.min(minGap, cues[index].time - cues[index - 1].time)
  return {
    cues: cues.length,
    openings: cues.filter(cue => cue.shape !== 'm').length,
    minGapMs: Number.isFinite(minGap) ? Math.round(minGap * 1000) : null,
  }
}

/**
 * How long each authored pose actually holds, which is the only thing a viewer sees.
 *
 * A cue count cannot express this: eight open cues squeezed into the 30 ms span the provider gives a spoken
 * `+11.5%` are eight cues and no visible movement at all. Counting cues is exactly why the defect survived
 * several rounds of "the mouth opens more often now" (2026-09-20). These are seconds per pose, plus the two
 * numbers that name the failure directly: the longest the mouth stayed closed, and how much of that closure
 * landed on audio that was speaking.
 * @param cues - the clip's cue timeline.
 * @param duration - the clip length in seconds.
 * @param mask - the clip's speech mask, when the audio was available.
 * @returns seconds per pose and the closed-mouth facts.
 */
export function poseStatistics(cues, duration, mask = null) {
  const segments = mask?.segments ?? null
  const overlaps = (from, to) => segments === null ? null : segments.reduce((sum, [start, end]) => sum + Math.max(0, Math.min(end, to) - Math.max(start, from)), 0)
  const poses = {}
  let longestClosedSeconds = 0, closedRun = 0, silentDuringSpeech = segments === null ? null : 0
  for (const [index, cue] of cues.entries()) {
    const hold = Math.max(0, Math.min(cues[index + 1]?.time ?? duration, duration) - cue.time)
    poses[cue.shape] = (poses[cue.shape] ?? 0) + hold
    if (cue.shape !== 'm') { closedRun = 0; continue }
    closedRun += hold
    longestClosedSeconds = Math.max(longestClosedSeconds, closedRun)
    if (silentDuringSpeech !== null && cue.shape === 'm') silentDuringSpeech += overlaps(cue.time, cue.time + hold)
  }
  const round = value => value === null ? null : Number(value.toFixed(3))
  return {
    poses: Object.fromEntries(Object.entries(poses).sort().map(([shape, seconds]) => [shape, round(seconds)])),
    longestClosedSeconds: round(longestClosedSeconds),
    silentDuringSpeech: round(silentDuringSpeech),
  }
}

/**
 * How much of a clip the provider's subtitles actually cover.
 * @param subtitles - the raw subtitle payload (any nesting).
 * @param duration - the clip's audio duration in seconds.
 * @returns the word count and the covered fraction of the clip, or nulls when there are none.
 */
export function subtitleCoverage(subtitles, duration) {
  const words = []
  const walk = value => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { for (const item of value) walk(item); return }
    if (typeof value.word === 'string' && Number.isFinite(value.startTime) && Number.isFinite(value.endTime)) words.push({ start: value.startTime, end: value.endTime })
    else for (const item of Object.values(value)) walk(item)
  }
  walk(subtitles)
  if (words.length === 0) return { words: 0, coverage: null }
  const covered = words.reduce((total, word) => total + Math.max(0, Math.min(duration, word.end) - Math.max(0, word.start)), 0)
  return { words: words.length, coverage: duration > 0 ? Number((covered / duration).toFixed(3)) : null }
}
