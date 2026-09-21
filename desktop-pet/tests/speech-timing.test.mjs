import test from 'node:test'
import assert from 'node:assert/strict'
import { speechCues, pronouncable } from '../src/speech-cues.mjs'
import { speechMask } from '../src/speech-mask.mjs'
import { poseStatistics } from '../src/mouth-diagnostics.mjs'

/**
 * The subtitle payload measured from the voice service on 2026-09-20, verbatim: the Chinese tokens are timed
 * plausibly (130–460 ms a syllable) and every token carrying digits or symbols is exactly 30 ms wide, on a
 * cloned voice and a stock voice alike. The clip is 10.596 s long.
 */
const measured = {
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
  // The audible spans the same clip's PCM reports, so the repair has the audio's own answer for where speech is.
  segments: [[.35, 1.06], [1.24, 3.36], [3.71, 4.41], [4.77, 6.71], [6.89, 8.12], [8.3, 10.42]],
}

/** The longest a single closed-mouth pose is held, which is what a viewer sees as a still mouth. */
const longestClosed = (cues, duration) => {
  let longest = 0, run = 0
  for (const [index, cue] of cues.entries()) {
    const hold = Math.max(0, Math.min(cues[index + 1]?.time ?? duration, duration) - cue.time)
    run = cue.shape === 'm' ? run + hold : 0
    longest = Math.max(longest, run)
  }
  return longest
}

/** The longest stretch with no cue at all, during which the mouth just keeps whatever pose it had. */
const longestGap = (cues, duration) => cues.reduce((longest, cue, index) => Math.max(longest, (cues[index + 1]?.time ?? duration) - cue.time), 0)

/** A 16-bit little-endian mono buffer, one entry per 10 ms frame: a tone where `loud`, silence where not. */
function pcm(frames, sampleRate = 24000) {
  const each = sampleRate / 100
  const buffer = Buffer.alloc(frames.length * each * 2)
  let at = 0
  for (const frame of frames) {
    for (let index = 0; index < each; index++) buffer.writeInt16LE(frame.loud ? Math.round(Math.sin(index / 8) * 12000) : 0, at++ * 2)
  }
  return buffer
}

test('a 30 ms numeric token no longer swallows the number it must be spoken as', () => {
  const result = speechCues(measured.text, measured.duration, measured.words, { segments: measured.segments, last: 10.42 })
  assert.equal(result.alignment, 'word-pinyin', 'the payload still matches the reading, it is only mistimed')
  // The defect: a closed-mouth cue at the collapsed token's end, held across the two seconds the voice spends
  // saying "加十一点五百分号". A 2.5 s still mouth was the whole report.
  assert.ok(longestClosed(result.cues, measured.duration) < .6, `the mouth must not stay shut across a spoken number, got ${longestClosed(result.cues, measured.duration).toFixed(2)}s`)
  assert.ok(longestGap(result.cues, measured.duration) < .6, `every spoken syllable must have a cue near it, got a ${longestGap(result.cues, measured.duration).toFixed(2)}s gap`)
  const poses = poseStatistics(result.cues, measured.duration, { segments: measured.segments })
  // What is left is a fraction of a syllable of lag at each pause boundary, where the mouth closes just before
  // the audio does. A tenth of the clip is a generous ceiling; the defect this guards against was measured at
  // 7.34 s of closure on speech out of an 11.16 s clip.
  assert.ok(poses.silentDuringSpeech < measured.duration * .1, `closure must not land on speech, got ${poses.silentDuringSpeech}s`)
  // And the evidence the repair acted on, which the diagnostics record keeps for the next report.
  assert.equal(result.repaired, true)
  assert.ok(result.collapsed >= 3, `three digit-bearing tokens were rejected, got ${result.collapsed}`)
  assert.ok(result.minMsPerSyllable < 5, `the payload holds a sub-5 ms syllable rate, got ${result.minMsPerSyllable}`)
})

test('a payload that matches its audio is left exactly as the provider timed it', () => {
  const words = ['阿', '哦', '衣', '妈'].map((word, index) => ({ word, startTime: index + .2, endTime: index + .7 }))
  const clean = speechCues('阿哦衣妈', 4, [{ words }])
  assert.equal(clean.repaired, false, 'nothing is repaired without evidence that the payload is mistimed')
  assert.equal(clean.collapsed, 0)
  // Every gap the provider left closes the mouth, exactly where the provider said the pause was.
  const closed = clean.cues.filter(cue => cue.shape === 'm').map(cue => cue.time)
  assert.equal(closed[0], 0)
  for (const end of [.7, 1.7, 2.7, 3.7]) assert.ok(closed.includes(end), `the provider's pause at ${end}s closes the mouth, got ${JSON.stringify(closed)}`)
  // A single short syllable hides no reading: the provider times Chinese characters as low as 30 ms and those
  // clips play correctly, so a short single-syllable token is not evidence of anything.
  const short = speechCues('阿', 1, [{ word: '阿', startTime: .3, endTime: .33 }])
  assert.equal(short.repaired, false)
  assert.equal(short.collapsed, 0)
})

test('the audio contradicts a payload that calls a speaking hole silent', () => {
  // The aligner also compresses runs of correctly matched Chinese into milliseconds each: every one of those
  // tokens passes the per-token test alone, but the run leaves a hole nothing but the audio can expose.
  const words = [{ word: '阿', startTime: .2, endTime: .5 }, { word: '哦', startTime: .5, endTime: .8 }, { word: '衣', startTime: 2, endTime: 2.3 }, { word: '妈', startTime: 2.3, endTime: 2.6 }, { word: '衣', startTime: 2.6, endTime: 2.9 }]
  const mask = { segments: [[.1, 3]], last: 3 }
  const result = speechCues('阿哦衣妈衣', 3.2, [{ words }], mask)
  assert.equal(result.collapsed, 0, 'no single token is short enough to reject on its own')
  assert.equal(result.unlabelledSeconds, 1.4, 'the payload leaves 1.4 s of audible speech with no word on it')
  assert.equal(result.repaired, true, 'the speaking hole between the two runs is what gives it away')
  assert.ok(longestClosed(result.cues, 3.2) < .6, `the hole no longer closes the mouth, got ${longestClosed(result.cues, 3.2).toFixed(2)}s`)
  // Several holes that each look harmless add up to the same still mouth, and the sum is what triggers the repair.
  const many = [{ word: '阿', startTime: .1, endTime: .4 }, { word: '哦', startTime: .9, endTime: 1.2 }, { word: '衣', startTime: 1.7, endTime: 2 }, { word: '妈', startTime: 2.5, endTime: 2.8 }]
  const spread = speechCues('阿哦衣妈', 3.2, [{ words: many }], { segments: [[.05, 2.9]], last: 2.9 })
  assert.ok(spread.unlabelledSeconds > .5, `four 0.5 s holes sum to 1.5 s, got ${spread.unlabelledSeconds}`)
  assert.equal(spread.repaired, true)
  assert.equal(speechCues('阿哦衣妈衣', 3.2, [{ words }]).repaired, false, 'without the audio there is nothing to contradict the payload')
})

test('a payload whose pauses the audio agrees with is left alone', () => {
  // The provider's pauses line up with real silence, and every word sits where the voice is: nothing to repair.
  const words = [{ word: '阿', startTime: .2, endTime: .5 }, { word: '哦', startTime: .5, endTime: .8 }, { word: '衣', startTime: 2, endTime: 2.3 }, { word: '妈', startTime: 2.3, endTime: 2.6 }]
  const mask = { segments: [[.1, .9], [1.9, 2.7]], last: 2.7 }
  const result = speechCues('阿哦衣妈', 3, [{ words }], mask)
  // The mask's own edges run a tenth of a second past the words on either side; that is the voice starting and
  // stopping, and it must stay well under the trigger rather than being treated as a missing word.
  assert.ok(result.unlabelledSeconds <= .4, `only the mask's edges are unlabelled, got ${result.unlabelledSeconds}s`)
  assert.equal(result.repaired, false)
})

test('the speech mask finds the phrases and merges the breaths between them', () => {
  const frames = [
    ...Array.from({ length: 10 }, () => ({ loud: false })),
    ...Array.from({ length: 30 }, () => ({ loud: true })),
    ...Array.from({ length: 6 }, () => ({ loud: false })),   // 60 ms: a breath, merged into the phrase
    ...Array.from({ length: 30 }, () => ({ loud: true })),
    ...Array.from({ length: 25 }, () => ({ loud: false })),
    ...Array.from({ length: 20 }, () => ({ loud: true })),
    ...Array.from({ length: 20 }, () => ({ loud: false })),
  ]
  const mask = speechMask(pcm(frames), 24000)
  assert.equal(mask.segments.length, 2, `a 60 ms breath is not a phrase break, got ${JSON.stringify(mask.segments)}`)
  assert.ok(Math.abs(mask.segments[0][0] - .1) < .03 && Math.abs(mask.segments[0][1] - .76) < .05, JSON.stringify(mask.segments))
  assert.ok(Math.abs(mask.first - .1) < .03 && Math.abs(mask.last - 1.21) < .05, JSON.stringify(mask))
  // A clip with no silence at all has no mask to offer, and the caller must degrade rather than lose syllables.
  assert.equal(speechMask(pcm(Array.from({ length: 20 }, () => ({ loud: true }))), 24000).segments.length, 1)
  assert.equal(speechMask(Buffer.alloc(0), 24000).segments, null)
  assert.equal(speechMask(pcm(Array.from({ length: 20 }, () => ({ loud: false }))), 24000).segments, null, 'digital silence holds no speech')
})

test('estimated timing uses the audio it can hear instead of the whole clip', () => {
  const mask = { segments: [[1, 3]], last: 3 }
  const result = speechCues('阿哦衣妈', 4, [], mask)
  assert.equal(result.alignment, 'estimated')
  // The clip still opens closed at time zero; every syllable after that stays on the audible span.
  assert.ok(result.cues.slice(1).every(cue => cue.time >= 1 && cue.time <= 3), `syllables stay on the audible span, got ${JSON.stringify(result.cues)}`)
  assert.ok(result.cues.some(cue => cue.time > 2.9), 'the reading reaches the end of the audible span')
})

test('a degenerate clip still yields a finite timeline', () => {
  // A zero-length clip cannot reach the player — the host refuses audio with no payload, and the driver rejects a
  // non-positive duration — but this is a public pure function, and a NaN inside a cue is the kind of value that
  // would only surface as a renderer that quietly stops speaking.
  for (const [text, duration] of [['阿哦衣妈', 0], ['阿哦衣妈', .0001], ['+5.7%', 0], ['', 2], ['，。', 1]]) {
    const result = speechCues(text, duration, [], { segments: [], last: 0 })
    for (const cue of result.cues) {
      assert.ok(Number.isFinite(cue.time), `"${text}" at ${duration}s produced a non-finite cue time: ${JSON.stringify(cue)}`)
      assert.ok(cue.time >= 0 && cue.time < Math.max(duration, Number.EPSILON), `cue outside the clip: ${JSON.stringify(cue)} at ${duration}s`)
    }
    assert.ok(Number.isFinite(result.unlabelledSeconds), `"${text}" produced a non-finite unlabelled figure`)
  }
})

test('pose statistics report the seconds each pose holds, not how many cues it took', () => {
  const cues = [{ time: 0, shape: 'm' }, { time: .5, shape: 'a' }, { time: 1.5, shape: 'm' }, { time: 2, shape: 'i' }, { time: 3, shape: 'm' }]
  const mask = { segments: [[.4, 2.6]], last: 2.6 }
  const poses = poseStatistics(cues, 4, mask)
  assert.deepEqual(poses.poses, { a: 1, i: 1, m: 2 })
  assert.equal(poses.longestClosedSeconds, 1)
  // Closed-mouth time that landed on speech: 0.1 s of the leading closure and 0.5 s before the `i`; the whole
  // trailing closure is on silence and is therefore not counted against the character.
  assert.equal(poses.silentDuringSpeech, .6)
  assert.equal(poseStatistics(cues, 4).silentDuringSpeech, null, 'without audio the overlap is unknown, not zero')
})
