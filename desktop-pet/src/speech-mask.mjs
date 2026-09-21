/**
 * Where a synthesized clip actually speaks, read from the PCM the host already holds.
 *
 * Nothing in the mouth path ever looked at the audio. Timing came entirely from the provider's word list, which
 * under-covers a clip by 20–40% and leaves seconds of audible speech carrying no word at all — a measured 14.2 s
 * clip had its last word end at 10.6 s while the voice kept speaking. The mask costs one pass over the samples
 * and answers two questions the word list cannot: which parts of the clip are silence, and where speech stops.
 *
 * Silence is judged relative to the clip's own loud level rather than against an absolute threshold. The player's
 * fixed `.008` gate never fires on a cloned voice whose noise floor sits above it, which is why every
 * acknowledgement reported `silentFrames: 0` while the mouth stood still (2026-09-20). When a clip truly has no
 * silence, the relative gate marks the whole clip as speech and the caller degrades to laying sound over the
 * whole duration — the behaviour that existed before the mask.
 */

/** How far below the clip's loud level a frame has to fall to count as silence. */
const SILENCE_RATIO = .06
/** The absolute floor, matching the player's own gate so the two never disagree about digital silence. */
const ABSOLUTE_GATE = .008
/** The window each level is measured over. */
const FRAME_SECONDS = .01
/** Gaps shorter than this are merged: a breath between syllables is not a phrase break. */
const MERGE_SECONDS = .12
/** Runs shorter than this are dropped: a click is not speech. */
const MIN_SEGMENT_SECONDS = .06

/**
 * @param pcm - one channel of 16-bit little-endian samples.
 * @param sampleRate - the samples' rate.
 * @param options - optional `{ frameSeconds, silenceRatio, mergeSeconds, minSegmentSeconds }` overrides.
 * @returns `{ segments, first, last, gate, loud }` where `segments` are `[from, to]` seconds in order, or `null`
 *   when the audio holds no speech at all.
 */
export function speechMask(pcm, sampleRate, options = {}) {
  const frameSeconds = options.frameSeconds ?? FRAME_SECONDS
  const mergeSeconds = options.mergeSeconds ?? MERGE_SECONDS
  const minSegmentSeconds = options.minSegmentSeconds ?? MIN_SEGMENT_SECONDS
  const ratio = options.silenceRatio ?? SILENCE_RATIO
  const samples = Math.floor(pcm.length / 2)
  const frame = Math.max(1, Math.round(sampleRate * frameSeconds))
  const count = Math.floor(samples / frame)
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || count === 0) return { segments: null, first: null, last: null, gate: ABSOLUTE_GATE, loud: 0 }
  const levels = []
  for (let index = 0; index < count; index++) {
    const from = index * frame, to = Math.min(samples, from + frame)
    let energy = 0
    for (let at = from; at < to; at++) { const value = pcm.readInt16LE(at * 2) / 32768; energy += value * value }
    levels.push(Math.sqrt(energy / Math.max(1, to - from)))
  }
  const loud = [...levels].sort((a, b) => b - a)[Math.floor(count * .1)] ?? 0
  const gate = Math.max(ABSOLUTE_GATE, loud * ratio)
  const seconds = index => index * frame / sampleRate
  const runs = []
  for (let index = 0; index < count; index++) {
    if (levels[index] < gate) continue
    const last = runs.at(-1)
    if (last && seconds(index) - last.to <= mergeSeconds) last.to = seconds(index + 1)
    else runs.push({ from: seconds(index), to: seconds(index + 1) })
  }
  const segments = runs.filter(run => run.to - run.from >= minSegmentSeconds).map(run => [Number(run.from.toFixed(3)), Number(run.to.toFixed(3))])
  if (!segments.length) return { segments: null, first: null, last: null, gate: Number(gate.toFixed(4)), loud: Number(loud.toFixed(4)) }
  return { segments, first: segments[0][0], last: segments.at(-1)[1], gate: Number(gate.toFixed(4)), loud: Number(loud.toFixed(4)) }
}
