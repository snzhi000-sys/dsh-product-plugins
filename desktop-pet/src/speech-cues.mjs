/** Convert returned word timing into the four authored visual mouth poses; no phoneme-precision claim. */
import { pinyin } from 'pinyin-pro'

/**
 * Non-ASCII forms of digits, letters, and symbols. They are still letters and numbers to Unicode, so the symbol
 * pass never sees them and `pinyin` finds no vowel: `２０２５`, `ＧＤＰ`, `①`, `Ⅻ`, and `½` each closed the mouth
 * for their whole span while the audio read them out (measured 2026-09-20). Every form maps to the ASCII or
 * Chinese text a speaker would say, so the reading below can derive a vowel.
 */
const FORM_READING = (() => {
  const table = new Map()
  const fullWidth = (from, to, offset) => { for (let code = from; code <= to; code++) table.set(String.fromCodePoint(code), String.fromCodePoint(code - offset)) }
  fullWidth(0xFF10, 0xFF19, 0xFEE0)   // ０-９ → 0-9
  fullWidth(0xFF21, 0xFF3A, 0xFEE0)   // Ａ-Ｚ → A-Z
  fullWidth(0xFF41, 0xFF5A, 0xFEE0)   // ａ-ｚ → a-z
  for (const [wide, ascii] of [['＋', '+'], ['－', '-'], ['＊', '*'], ['／', '/'], ['＝', '='], ['％', '%'], ['＃', '#'], ['＠', '@'], ['＆', '&'], ['＄', '$'], ['～', '~'], ['＾', '^'], ['｜', '|'], ['＜', '<'], ['＞', '>']]) table.set(wide, ascii)
  for (let index = 0; index < 20; index++) table.set(String.fromCodePoint(0x2460 + index), String(index + 1))      // ①-⑳
  for (let index = 0; index < 10; index++) table.set(String.fromCodePoint(0x2474 + index), String(index + 1))      // ⑴-⑽
  for (const [superscript, digit] of [['⁰', '0'], ['¹', '1'], ['²', '2'], ['³', '3'], ['⁴', '4'], ['⁵', '5'], ['⁶', '6'], ['⁷', '7'], ['⁸', '8'], ['⁹', '9']]) table.set(superscript, digit)
  for (const [subscript, digit] of [['₀', '0'], ['₁', '1'], ['₂', '2'], ['₃', '3'], ['₄', '4'], ['₅', '5'], ['₆', '6'], ['₇', '7'], ['₈', '8'], ['₉', '9']]) table.set(subscript, digit)
  // Roman numerals become the letters they are read as, which the letter table then names.
  const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
  for (let value = 1; value <= 12; value++) { table.set(String.fromCodePoint(0x2160 + value - 1), roman[value]); table.set(String.fromCodePoint(0x2170 + value - 1), roman[value]) }
  for (const [fraction, reading] of [['½', '二分之一'], ['⅓', '三分之一'], ['⅔', '三分之二'], ['¼', '四分之一'], ['¾', '四分之三'], ['⅛', '八分之一'], ['⅜', '八分之三'], ['⅝', '八分之五'], ['⅞', '八分之七']]) table.set(fraction, reading)
  return table
})()

/** @param value - raw text. @returns the same text with every non-ASCII numeric or letter form spelled as ASCII. */
export function normalizeForms(value) {
  let result = ''
  for (const character of value) result += FORM_READING.get(character) ?? character
  return result
}

/** How a speaker reads one Arabic digit aloud. Digits have no pinyin of their own, so they must be spoken first. */
const DIGIT_READING = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']

/**
 * How each Latin letter sounds when it is named. `pinyin` splits a Latin run per character and a consonant has
 * no vowel, so a letter that is merely spelled out used to close the mouth for its whole span: "GDP" moved
 * nothing, and even "hello" closed on h, l, and l. Each letter therefore becomes the Chinese syllable whose
 * vowel is the one its name carries — an approximation of the mouth, exactly like the pinyin path beside it.
 */
const LETTER_READING = {
  a: '诶', b: '比', c: '西', d: '迪', e: '衣', f: '埃', g: '基', h: '艾', i: '艾', j: '杰', k: '开', l: '勒',
  m: '姆', n: '恩', o: '欧', p: '皮', q: '丘', r: '阿', s: '斯', t: '提', u: '优', v: '维', w: '溜', x: '克',
  y: '歪', z: '兹',
}

/**
 * Greek letters are letters, so the symbol pass never sees them; people read them by name, so they get one.
 * Only the names a Chinese speaker actually says are listed, upper and lower case alike.
 */
const GREEK_READING = {
  α: '阿尔法', β: '贝塔', γ: '伽马', δ: '德尔塔', ε: '伊普西龙', ζ: '泽塔', η: '伊塔', θ: '西塔', ι: '约塔',
  κ: '卡帕', λ: '拉姆达', μ: '缪', ν: '纽', ξ: '克西', ο: '奥密克戎', π: '派', ρ: '柔', σ: '西格玛', ς: '西格玛',
  τ: '陶', υ: '宇普西龙', φ: '斐', χ: '卡伊', ψ: '普西', ω: '欧米伽',
  Α: '阿尔法', Β: '贝塔', Γ: '伽马', Δ: '德尔塔', Ε: '伊普西龙', Ζ: '泽塔', Η: '伊塔', Θ: '西塔', Ι: '约塔',
  Κ: '卡帕', Λ: '拉姆达', Μ: '缪', Ν: '纽', Ξ: '克西', Ο: '奥密克戎', Π: '派', Ρ: '柔', Σ: '西格玛',
  Τ: '陶', Υ: '宇普西龙', Φ: '斐', Χ: '卡伊', Ψ: '普西', Ω: '欧米伽',
}

/**
 * The symbols a speaker reads out loud, with the reading they use. Typographic punctuation is deliberately
 * absent: nobody says "书名号" or "左括号" while reading, so 《》, quotes, brackets, dashes, and commas stay
 * pauses — the mouth simply holds whatever shape the surrounding words gave it.
 */
const SYMBOL_READING = {
  // Arithmetic, comparison, and the logic that is spoken in prose.
  '+': '加', '-': '减', '×': '乘', '÷': '除', '±': '正负', '=': '等于', '≠': '不等于', '≈': '约等于',
  '<': '小于', '>': '大于', '≤': '小于等于', '≥': '大于等于', '≡': '恒等于', '∝': '正比于',
  // Quantities, money, and measures.
  '%': '百分号', '‰': '千分号', '°': '度', '℃': '摄氏度', '℉': '华氏度', 'µ': '微', '$': '美元', '€': '欧元',
  '¥': '元', '£': '英镑', '₩': '韩元', '₹': '卢比', '₽': '卢布', 'Ω': '欧姆',
  // Marks people do read: an email address spells its at, a path spells its slash.
  '@': '艾特', '#': '井号', '*': '星号', '/': '斜杠', '\\': '反斜杠', '_': '下划线', '|': '竖线',
  '&': '和', '~': '约', '^': '次方', '·': '点',
  // Notation that is spoken as a phrase.
  '∑': '求和', '∏': '求积', '∫': '积分', '√': '根号', '∞': '无穷', '∠': '角', '∵': '因为', '∴': '所以',
  '∈': '属于', '∪': '并集', '∩': '交集', '∀': '任意', '∃': '存在', '∂': '偏导', '∇': '梯度',
  // Arrows are described, not read as "箭头符号" inside words.
  '→': '到', '←': '到', '↑': '上升', '↓': '下降', '⇒': '推出', '⇔': '等价',
  // Fractions people say out loud.
  '½': '二分之一', '⅓': '三分之一', '⅔': '三分之二', '¼': '四分之一', '¾': '四分之三',
}

/**
 * Turn what a speaker would say out of arbitrary text, so `pinyin` can derive a vowel for every character.
 * Digits become numerals, letters become their names, symbols become their readings, and everything else —
 * punctuation, spacing — disappears because it carries no sound.
 * @param value - raw text from one timing unit.
 * @returns text whose every character can be read.
 */
export function pronouncable(value) {
  return normalizeForms(value)
    // A separator between digits is part of the number, not punctuation: 5.4 is 五点四, 2025-2026 is 2025到2026,
    // and a thousands comma or a clock colon is simply not said.
    .replace(/(?<=\d)[.](?=\d)/gu, '点')
    .replace(/(?<=\d)[:](?=\d)/gu, '点')
    .replace(/(?<=\d)[-](?=\d)/gu, '到')
    .replace(/(?<=\d)[,](?=\d)/gu, '')
    .replace(/[A-Za-z]/gu, letter => LETTER_READING[letter.toLowerCase()] ?? '')
    .replace(/\p{Script=Greek}/gu, letter => GREEK_READING[letter] ?? '')
    .replace(/[µÅ]/gu, character => SYMBOL_READING[character] ?? '')
    .replace(/\d/gu, digit => DIGIT_READING[Number(digit)])
    .replace(/[^\p{L}\p{N}]/gu, character => SYMBOL_READING[character] ?? '')
}

/**
 * One spoken syllable cannot be shorter than this. The provider's subtitle aligner returns every token that
 * carries digits or symbols — `+11.5%`, `-11.3%`, `+49.0%。` — with a flat 30 ms span whatever the voice is
 * asked to say, because there are no phonemes in it for the aligner to lock onto: measured 3.7–3.8 ms per
 * syllable against 130–460 ms for the Chinese tokens beside them, on a cloned voice and a stock one alike
 * (2026-09-20). Its whole reading used to be squeezed into those 30 ms, and the hole the collapse left was then
 * filled by an explicit closed-mouth cue, which is why a spoken `+11.5%` moved nothing.
 */
const MIN_SYLLABLE_SECONDS = .06
/** What one syllable of a rejected token is worth instead: an ordinary speaking rate, taken from the same run. */
const TARGET_SYLLABLE_SECONDS = .22

/** The syllables a unit of text is actually spoken as. */
const syllablesOf = value => pinyin(pronouncable(value), { toneType: 'none', type: 'array' }).filter(Boolean)

/**
 * Whether a token's own span is too short to carry its syllables.
 *
 * A single short syllable hides nothing — the Chinese tokens the provider does time run as short as 30 ms — so
 * only a multi-syllable token counts. Nothing can say eight syllables in 30 ms, and that is the measurement that
 * names the defect.
 * @param unit - one matched unit.
 * @param count - how many syllables it is spoken as.
 */
const rejectedSpan = (unit, count) => count >= 2 && unit.end - unit.start < count * MIN_SYLLABLE_SECONDS

/**
 * How much audible speech the payload places no word on, in seconds.
 *
 * This is the measurement that names the whole family of failures: a hole the aligner calls silent while the
 * voice is speaking through it, or speech that continues after its last word. A real pause is not counted,
 * because the audio's own mask does not report speech there. One hole alone is not evidence — a 0.3 s one is
 * indistinguishable from a pause the mask could not resolve — so the caller sums them: a measured clip that
 * looked fine per hole still carried 1.5 s of speech no word was ever placed on, and the mouth was shut for it.
 * @param units - the matched units.
 * @param mask - the clip's speech mask, when the audio was available.
 */
function unlabelledSpeech(units, mask) {
  const segments = mask?.segments
  if (!segments?.length || units.length === 0) return 0
  const speaking = (from, to) => segments.reduce((sum, [start, end]) => sum + Math.max(0, Math.min(end, to) - Math.max(start, from)), 0)
  let total = speaking(0, units[0].start)
  for (let index = 1; index < units.length; index++) total += speaking(units[index - 1].end, units[index].start)
  total += speaking(units.at(-1).end, mask.last ?? units.at(-1).end)
  return total
}

/**
 * The spans of a clip that carry speech, or the whole clip when the audio's own mask is unknown.
 * @param mask - `{ segments }` from the speech mask, built from the PCM the host already holds.
 * @param duration - the clip length in seconds.
 * @returns non-empty `[from, to]` spans in order.
 */
function audibleSpans(mask, duration) {
  const segments = (mask?.segments ?? []).map(([from, to]) => [Math.max(0, from), Math.min(duration, to)]).filter(([from, to]) => to > from)
  return segments.length ? segments : [[0, Math.max(0, duration)]]
}

/**
 * Map a position on the concatenated audible timeline back to real time, so a plan laid over speech never spends
 * syllables on the silence between the phrases.
 * @param spans - the audible spans, in order.
 * @returns a function from virtual seconds to real seconds.
 */
function walker(spans) {
  const total = spans.reduce((sum, [from, to]) => sum + (to - from), 0)
  return value => {
    let walked = 0
    for (const [from, to] of spans) { const length = to - from; if (value <= walked + length) return from + (value - walked); walked += length }
    return spans.at(-1)[1]
  }
}

/**
 * The audible part of one unit's own span, so a unit that reaches across a pause does not put a syllable inside it.
 * @param spans - the clip's audible spans.
 * @param from - the unit's start in seconds.
 * @param to - the unit's end in seconds.
 * @returns the overlapping sub-spans, or the unit's own span when none of it is audible.
 */
function overlap(spans, from, to) {
  const parts = spans.map(([start, end]) => [Math.max(start, from), Math.min(end, to)]).filter(([start, end]) => end > start)
  return parts.length ? parts : [[from, to]]
}

/**
 * Lay units end to end over a clip's audible spans, with the given weights.
 * @param units - the text units, in the order they are spoken.
 * @param weights - one duration per unit, in seconds.
 * @param spans - the audible spans.
 * @returns the units placed on the real timeline.
 */
function place(units, weights, spans) {
  const at = walker(spans)
  let cursor = 0
  return units.map((unit, index) => { const placed = { ...unit, start: at(cursor), end: at(cursor + weights[index]) }; cursor += weights[index]; return placed })
}

/**
 * Re-place a timeline whose spans the provider could not time.
 *
 * A rejected token's span carries no information, but the spans beside it carry plenty: they are a usable
 * *duration model*, close to real speech. What they are not is a *placement model* — once a digit run has been
 * swallowed, everything after it drifts by seconds, which is why `专用设备` was timed 2.3 s before it is spoken.
 * So the repaired plan keeps each unit's measured length as a weight, hands the rejected digits the speaking time
 * they were denied, and lays the units out in order over the clip's audible spans. Every syllable then has
 * somewhere to land, and the silences the audio actually has become the only places the mouth closes.
 * @param units - the matched units.
 * @param spans - the audible spans.
 * @returns the units placed on the real timeline.
 */
function reflow(units, spans) {
  const counts = units.map(unit => Math.max(1, syllablesOf(unit.text).length))
  const rejected = units.map((unit, index) => rejectedSpan(unit, counts[index]))
  let weights = units.map((unit, index) => Math.max(unit.end - unit.start, counts[index] * MIN_SYLLABLE_SECONDS))
  const audible = spans.reduce((sum, [from, to]) => sum + (to - from), 0)
  let leftover = audible - weights.reduce((sum, weight) => sum + weight, 0)
  // The time a swallowed token lost is exactly what the hole around it was made of, so it goes back to the
  // tokens that lost it first, before any of it is shared with the units that were timed correctly.
  const shortfall = units.map((unit, index) => rejected[index] ? Math.max(0, counts[index] * TARGET_SYLLABLE_SECONDS - weights[index]) : 0)
  const missing = shortfall.reduce((sum, value) => sum + value, 0)
  if (leftover > 0 && missing > 0) {
    const grant = Math.min(leftover, missing)
    weights = weights.map((weight, index) => weight + shortfall[index] * (grant / missing))
    leftover -= grant
  }
  if (leftover > 0) { const total = weights.reduce((sum, weight) => sum + weight, 0) || 1; weights = weights.map(weight => weight + weight / total * leftover) }
  // A fast voice with many digits can still ask for more than the clip holds; scale rather than overrun.
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (total > audible && total > 0) weights = weights.map(weight => weight * audible / total)
  return place(units, weights, spans)
}

/**
 * Timing derived from the text alone, for a clip whose subtitle payload cannot be matched at all.
 * @param spoken - the whole reading.
 * @param spans - the audible spans, so silence does not consume a share of the reading.
 * @returns one unit per character, placed on the real timeline.
 */
function estimate(spoken, spans) {
  const characters = [...spoken]
  const at = walker(spans)
  const total = spans.reduce((sum, [from, to]) => sum + (to - from), 0)
  return characters.map((character, index) => ({ text: character, start: at(index / characters.length * total), end: at((index + 1) / characters.length * total) }))
}

/**
 * Place a unit's syllables on the audible parts of its own span.
 *
 * Dividing them over the concatenated audible timeline instead would charge a pause to whichever syllable
 * straddles it: measured 4.34→5.02 for one syllable, with all of its cues bunched at the start and the mouth
 * then held for 0.86 s. Here each part divides its own syllables between its own edges, so a pause stays a pause.
 * @param parts - the audible sub-spans of one unit.
 * @param count - how many syllables the unit is spoken as.
 * @returns one `[start, end]` per syllable, in order.
 */
function spread(parts, count) {
  const slots = new Array(count)
  const total = parts.reduce((sum, [from, to]) => sum + (to - from), 0)
  let index = 0
  // An audible part always takes at least one syllable while syllables remain. Assigning them by the midpoint of
  // an equal share instead left a 0.3 s stretch of audible speech holding no syllable at all, which the pause
  // rule then covered with a closed mouth: measured as 1.2 s of closure on speech in one 8.99 s clip (2026-09-20).
  for (const [position, [from, to]] of parts.entries()) {
    const remaining = count - index, left = parts.length - position
    if (remaining <= 0) break
    // A clip with no length has no share to divide; its syllables simply sit at the span's edges rather than
    // becoming a hole in the returned list.
    const share = total > 0 ? Math.round((to - from) / total * count) : count
    const take = remaining < left ? Math.max(0, Math.min(remaining, share)) : Math.min(remaining - (left - 1), Math.max(1, share))
    const width = (to - from) / Math.max(1, take)
    for (let at = 0; at < take; at++) slots[index + at] = [from + width * at, from + width * (at + 1)]
    index += take
  }
  // Rounding must never leave a syllable without a span: the caller destructures this list.
  const tail = parts.at(-1) ?? [0, 0]
  while (index < count) { slots[index] = [tail[0], tail[1]]; index++ }
  return slots
}

export function speechCues(text, duration, subtitles = [], mask = null) {
  const words = []
  const walk = value => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { for (const v of value) walk(v); return }
    if (typeof value.word === 'string' && Number.isFinite(value.startTime) && Number.isFinite(value.endTime)) words.push({ text: value.word, start: value.startTime, end: value.endTime })
    else for (const v of Object.values(value)) walk(v)
  }
  walk(subtitles)
  // Matching happens on the READING, never on the symbol-stripped text: the provider returns the words it
  // actually said, so `+5.7%` arrives as `加五点七百分号` or as `5.7%`, and both normalize to the same reading.
  // Stripping symbols used to leave `57` there, which dropped the readings of `+`, `.`, and `%` from the mouth
  // for that whole span while leaving the timeline looking valid (reported 2026-09-20).
  const spokenText = pronouncable(text)
  const valid = words.filter(w => w.start >= 0 && w.end > w.start && w.start < duration && w.end <= duration + .25).map(w => ({...w,text:pronouncable(w.text),end:Math.min(duration,w.end)})).filter(w=>w.text).sort((a, b) => a.start - b.start)
  let units = [], cursor = 0, previousEnd = 0, incomplete = false, usable = valid.length > 0
  for (const word of valid) {
    const index = spokenText.indexOf(word.text, cursor)
    if (index < cursor || word.start < previousEnd) { usable = false; break }
    if (index > cursor) {
      incomplete = true
      if (word.start <= previousEnd) { usable = false; break }
      units.push({text:spokenText.slice(cursor,index),start:previousEnd,end:word.start})
    }
    units.push(word); cursor = index + word.text.length; previousEnd = word.end
  }
  if (cursor < spokenText.length && usable) {
    incomplete = true
    if (previousEnd >= duration) usable = false
    else units.push({text:spokenText.slice(cursor),start:previousEnd,end:duration})
  }
  // What the payload itself proved, which the diagnostics record keeps: a token whose own span cannot carry the
  // syllables it must be spoken as. Counting open cues could never show this.
  let collapsed = 0, minMsPerSyllable = null
  for (const unit of units) {
    const count = Math.max(1, syllablesOf(unit.text).length)
    const rate = (unit.end - unit.start) * 1000 / count
    minMsPerSyllable = minMsPerSyllable === null ? rate : Math.min(minMsPerSyllable, rate)
    if (rejectedSpan(unit, count)) collapsed++
  }
  const spans = audibleSpans(mask, duration)
  const unlabelled = unlabelledSpeech(units, mask)
  // Repair is driven by evidence, not by habit: a span no one could speak, or half a second of audible speech the
  // payload never placed a word on. Both leave the mouth closed while the voice is talking.
  const repaired = usable && (collapsed > 0 || unlabelled > .5)
  if (!usable) units = estimate(spokenText, spans)
  else if (repaired) units = reflow(units, spans)
  const cues = [{ time: 0, shape: 'm' }]
  // A syllable's end, wherever it was: a pause closes the mouth whether it sits between two syllables of one unit
  // or between two units, because that is what the audio is doing either way.
  let spokenEnd = null
  for (const word of units) {
    const spoken = pronouncable(word.text)
    const syllables = pinyin(spoken, { toneType: 'none', type: 'array' }).filter(Boolean)
    // A unit can be stretched over a pause the payload never marked. Its syllables belong on the audio, so they
    // are laid across the audible part of its own span instead of evenly across the silence inside it.
    const slots = spread(overlap(spans, word.start, word.end), syllables.length)
    for (const [i, syllable] of syllables.entries()) {
      const [start, end] = slots[i]
      if (spokenEnd !== null && start - spokenEnd >= .09) cues.push({ time: spokenEnd, shape: 'm' })
      spokenEnd = end
      const vowel = syllable.match(/[aeiouvü]+/i)?.[0]?.toLowerCase()
      // A character that is spoken but has no reading we know (an exotic letter or number) must not close the
      // mouth: failing open keeps the character visibly spoken, while punctuation is dropped before reaching here.
      if (!vowel) {
        if (/[\p{L}\p{N}]/u.test(syllable)) cues.push({ time: start, shape: 'o', weight: .35 })
        else cues.push({ time: start, shape: 'm' })
        continue
      }
      const shapes = [...vowel].map(v => 'ouüv'.includes(v) ? 'o' : 'ie'.includes(v) ? 'i' : 'a')
      if (/^[bpm]/i.test(syllable)) cues.push({ time: start, shape: 'm' })
      if (/^[wy]/i.test(syllable)) cues.push({ time: start, shape: syllable[0].toLowerCase() === 'w' ? 'o' : 'i', phoneme: syllable[0].toLowerCase() })
      shapes.forEach((shape, index) => cues.push({ time: start + (end - start) * (.1 + .75 * index / shapes.length), shape, phoneme: vowel[index] }))
    }
  }
  if (spokenEnd !== null && duration - spokenEnd >= .09) cues.push({ time: spokenEnd, shape: 'm' })
  return {
    duration,
    cues: cues.filter(c => c.time < duration).sort((a, b) => a.time - b.time),
    alignment: usable ? incomplete ? 'partial-word-pinyin' : 'word-pinyin' : 'estimated',
    collapsed,
    minMsPerSyllable: minMsPerSyllable === null ? null : Number(minMsPerSyllable.toFixed(2)),
    unlabelledSeconds: Number(unlabelled.toFixed(3)),
    repaired,
  }
}
