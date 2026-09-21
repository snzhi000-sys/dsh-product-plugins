/**
 * Ground truth for the speech pipeline's first two layers, without the application running.
 *
 * A "the audio played but the mouth did not move" report can only be attributed if the provider's subtitle
 * payload and the audio's own energy envelope are both known. This synthesizes the exact text through the
 * saved voice configuration and prints: the raw subtitle packets, the audio duration, where speech actually
 * is inside that duration, and the cue timeline `speechCues` derives from them.
 *
 * Usage: node scripts/tts-subtitle-probe.mjs "text to synthesize" ["another text"]
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { synthesize } from '../src/voice-services.mjs'
import { speechCues, pronouncable } from '../src/speech-cues.mjs'
import { speechMask } from '../src/speech-mask.mjs'
import { weightedTimeline } from '../src/action-presets.mjs'
import { cueStatistics, poseStatistics, subtitleCoverage } from '../src/mouth-diagnostics.mjs'

const root = process.env.PET_STATE ?? join(homedir(), 'Library/Application Support/DeepSeek Harness Next Dev/harness/state/dsh-desktop-pet')
const config = { ...JSON.parse(readFileSync(join(root, 'conversation.json'), 'utf8')) }
const keys = JSON.parse(readFileSync(join(root, 'voice-credentials.json'), 'utf8'))
// A/B one voice against another without touching the saved settings: the subtitle alignment is the provider's
// output, and whether it collapses a spoken number may well depend on which voice was asked to speak.
if (process.env.PET_VOICE) config.speaker = process.env.PET_VOICE
if (config.speaker) config.voiceKind = config.speaker.startsWith('S_') ? 'clone' : 'default'
if (process.env.PET_RATE) config.speechRate = Number(process.env.PET_RATE)
// The person is looking at one specific character, so the probe measures the timeline the way that character is
// played: through the saved mouth recipes and the engine's own narrowing, exactly as the player does.
const settings = JSON.parse(readFileSync(join(root, 'settings.json'), 'utf8'))
const catalog = JSON.parse(readFileSync(new URL('../assets/catalog.json', import.meta.url), 'utf8'))
const model = (catalog.models ?? catalog).find(entry => entry.id === settings.modelId)
const engine = model?.kind ?? 'cubism4'

/**
 * Peak level per window, the coarsest honest picture of where the audio actually speaks.
 *
 * The fixed `.008` gate the player uses is not a voice detector: a cloned voice keeps a noise floor above it,
 * which is why the player reported `silentFrames: 0` for every clip while the mouth still stood still. The
 * speech mask here is adaptive — relative to the clip's own noise floor — so it marks real utterance.
 * @param pcm - 16-bit little-endian mono samples.
 * @param sampleRate - the samples' rate.
 * @param columns - how many windows to reduce the clip to.
 */
function envelope(pcm, sampleRate, columns = 60) {
  const samples = pcm.length / 2
  const window = Math.max(1, Math.floor(samples / columns))
  const levels = []
  for (let column = 0; column < columns; column++) {
    let peak = 0
    const from = column * window, to = Math.min(samples, from + window)
    for (let index = from; index < to; index++) peak = Math.max(peak, Math.abs(pcm.readInt16LE(index * 2) / 32768))
    levels.push(peak)
  }
  const sorted = [...levels].sort((a, b) => a - b)
  const floor = sorted[Math.floor(sorted.length * .1)] ?? 0
  // Speech is the loud mode, so the gate is a fraction of the clip's own median: an absolutely quiet clip and a
  // hot one both mask correctly, while a fixed threshold marks a hot clip silent everywhere.
  const median = sorted[Math.floor(sorted.length * .5)] ?? 0
  const gate = Math.max(.008, median * .18)
  const each = window / sampleRate
  // Contiguous runs above the gate, in seconds: the spans a mouth pose could legitimately be aimed at.
  const segments = []
  for (let column = 0; column < columns; column++) if (levels[column] >= gate) {
    const last = segments.at(-1)
    if (last && last.to === column) last.to = column + 1
    else segments.push({ from: column, to: column + 1 })
  }
  return {
    levels,
    floor: Number(floor.toFixed(4)),
    gate: Number(gate.toFixed(4)),
    // A coarse ladder: one character per window, digit for loudness so a gap is visible at a glance.
    map: levels.map(value => (value >= gate ? String(Math.min(9, 1 + Math.floor(value / (gate * 3)))) : '.')).join(''),
    segments: segments.map(s => [Number((s.from * each).toFixed(2)), Number((s.to * each).toFixed(2))]),
  }
}

const texts = process.argv.slice(2)
if (!texts.length) { console.error('usage: node scripts/tts-subtitle-probe.mjs "text" …'); process.exit(2) }
for (const text of texts) {
  console.log(`\n=== ${text}`)
  const result = await synthesize(config, keys.tts, text, new AbortController().signal)
  const coverage = subtitleCoverage(result.subtitles, result.duration)
  const mask = speechMask(result.pcm, result.sampleRate)
  const cues = speechCues(text, result.duration, result.subtitles, mask)
  const energy = envelope(result.pcm, result.sampleRate)
  console.log(`reading      ${pronouncable(text)}`)
  console.log(`voice        ${config.voiceKind} ${config.speaker} rate ${config.speechRate}`)
  console.log(`duration     ${result.duration.toFixed(3)}s  firstAudio ${result.firstAudioMs?.toFixed(0)}ms  p10 ${energy.floor} gate ${energy.gate}`)
  console.log(`envelope     ${energy.map}   (one char ≈ ${(result.duration / energy.levels.length).toFixed(2)}s)`)
  console.log(`speech spans ${energy.segments.map(([from, to]) => `${from}-${to}`).join(' ')}`)
  // The player's own silence gate is an absolute peak threshold. A voice whose noise floor sits above it can
  // never be seen as silent, which is why every ack reported `silentFrames: 0` while the mouth stood still.
  const quiet = energy.levels.filter(level => level < .008).length
  console.log(`player gate  peak<.008 in ${((quiet / energy.levels.length) * 100).toFixed(0)}% of windows → the absolute gate ${quiet === 0 ? 'can never fire on this clip' : 'fires only in the gaps'}`)
  console.log(`subtitles    ${coverage.words} words, coverage ${coverage.coverage}`)
  console.log(`mask         gate ${mask.gate} loud ${mask.loud}  spans ${(mask.segments ?? []).map(([from, to]) => `${from}-${to}`).join(' ')}`)
  console.log(`alignment    ${cues.alignment}${cues.repaired ? ' (reflowed)' : ''}   cues ${JSON.stringify(cueStatistics(cues.cues))}   rejected tokens ${cues.collapsed}   worst ${cues.minMsPerSyllable}ms/syllable   speech with no word ${cues.unlabelledSeconds}s`)
  const pose = poseStatistics(weightedTimeline(cues, config.mouthRecipes?.[settings.modelId], engine).cues, result.duration, mask)
  const open = (pose.poses.a ?? 0) + (pose.poses.o ?? 0)
  console.log(`poses        ${JSON.stringify(pose.poses)}  open-looking ${open.toFixed(2)}s/${result.duration.toFixed(2)}s (${(open / result.duration * 100).toFixed(0)}%)  longest closed ${pose.longestClosedSeconds}s  closed during speech ${pose.silentDuringSpeech}s`)
  // The reported symptom is a mouth that stands still, so the closures worth naming are the long ones. A closure
  // that sits on a pause is the audio's own doing; one that sits on speech is the pipeline's.
  const held = cues.cues.map((cue, index) => ({ cue, hold: Math.min(cues.cues[index + 1]?.time ?? result.duration, result.duration) - cue.time })).filter(item => item.cue.shape === 'm').sort((a, b) => b.hold - a.hold).slice(0, 4)
  const onSpeech = (from, to) => (mask.segments ?? []).reduce((sum, [start, end]) => sum + Math.max(0, Math.min(end, to) - Math.max(start, from)), 0)
  console.log(`  longest closures: ${held.map(item => `${item.cue.time.toFixed(2)}+${item.hold.toFixed(2)}s (speech ${onSpeech(item.cue.time, item.cue.time + item.hold).toFixed(2)}s)`).join('  ')}`)
  const words = []
  const walk = value => { if (!value || typeof value !== 'object') return; if (Array.isArray(value)) { for (const item of value) walk(item); return } if (typeof value.word === 'string' && Number.isFinite(value.startTime) && Number.isFinite(value.endTime)) words.push({ word: value.word, start: value.startTime, end: value.endTime }); else for (const item of Object.values(value)) walk(item) }
  walk(result.subtitles)
  console.log(`  ${'token'.padEnd(14)}${'span'.padEnd(16)}syll  ms/syll`)
  for (const word of words) {
    const syllables = [...pronouncable(word.word)].length
    const span = word.end - word.start
    console.log(`  ${word.word.slice(0, 13).padEnd(14)}${`${word.start}-${word.end}`.padEnd(16)}${String(syllables).padEnd(6)}${syllables ? ((span * 1000) / syllables).toFixed(1) : '—'}`)
  }
  // A token whose audio span is far too short for the syllables it must carry is the reported defect: its
  // whole reading was squeezed into milliseconds, and the gap rule then closed the mouth across the real number.
  console.log(`  cue preview: ${cues.cues.slice(0, 12).map(c => `${c.time.toFixed(2)}${c.shape}${c.weight ?? ''}`).join(' ')} … ${cues.cues.at(-1)?.time.toFixed(2)}`)
}

