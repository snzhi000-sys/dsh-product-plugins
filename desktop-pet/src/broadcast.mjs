/**
 * Broadcasts the main agent's own prose to the pet: what the model says to the person, not what it is
 * doing internally. One model request contributes text through a stream of chunk records, and only
 * `text-delta` is user-facing prose:
 *
 * - `reasoning-delta` is the model thinking to itself, and reading it aloud would narrate deliberation the
 *   person never asked for.
 * - `tool-call-delta` carries tool names and raw JSON arguments, which are protocol, not speech.
 * - `block-start`, `block-end`, `usage`, and `finish` are structure and accounting.
 *
 * A fenced block is dropped when it holds code, but a model that answers by writing JSON is still answering: a
 * block tagged `json` — or an untagged one whose body parses as JSON — contributes the prose inside its string
 * values, in order, and everything that reads as code, a path, or an identifier stays out.
 *
 * Only the session the person is looking at is read. A request without `sessionId` was not built by the agent
 * loop (the pet's own private dialogue calls the provider directly, so it never reaches this seam), `purpose`
 * marks the internal compaction and session-title calls, and a session other than the focused one is a task
 * running somewhere the person is not looking — reading it would talk over the conversation on screen.
 *
 * Everything here is pure, so the rules are testable without a Harness runtime.
 */
import { speechSegmentLength } from './speech-text.mjs'

/** Defaults for the reading rules. */
export const BROADCAST_DEFAULTS = Object.freeze({ sentenceChars: 100 })

/**
 * Whether one model request's stream may be broadcast.
 * @param options - the request the agent loop built.
 * @param focus - the session the person is currently viewing, if the client has reported one.
 * @returns whether its prose belongs to the conversation on screen.
 */
export function broadcasts(options, focus) {
  if (!options || typeof options !== 'object') return false
  if (options.purpose !== undefined) return false
  if (typeof focus !== 'string' || focus === '') return false
  return options.sessionId === focus
}


/**
 * The prose inside a JSON answer, in document order. Only string leaves become speech: numbers, booleans, and
 * null carry no sentence, and a value that reads as an identifier, path, or URL is configuration rather than
 * something a person wants read out.
 * @param body - the fenced block's text.
 * @param tag - the fence's language tag, if it had one.
 * @returns the prose, one value per line, or an empty string when the block is not a JSON answer.
 */
export function jsonProse(body, tag) {
  const trimmed = body.trim()
  if (!/^[[{]/u.test(trimmed)) return ''
  if (tag && !['json', 'json5', 'jsonc'].includes(tag)) return ''
  let value
  try { value = JSON.parse(trimmed) } catch { return '' }
  const strings = []
  const walk = node => {
    if (typeof node === 'string') {
      const text = node.trim()
      if (text.length >= 4 && !/^https?:\/\//u.test(text) && !/^[\w./@:-]+$/u.test(text)) strings.push(text)
      return
    }
    if (Array.isArray(node)) { for (const item of node) walk(item); return }
    if (node && typeof node === 'object') { for (const item of Object.values(node)) walk(item) }
  }
  walk(value)
  return strings.length ? `${strings.join('\n')}\n` : ''
}

/**
 * The prose of one assistant message, as the session log stores it. Session events carry blocks with a `type`
 * discriminant, and only `text` blocks are the model's words to the person.
 * @param blocks - the message's content blocks.
 * @returns the message's prose, or an empty string when it has none.
 */
export function assistantProse(blocks) {
  if (!Array.isArray(blocks)) return ''
  return blocks.filter(block => block?.type === 'text' && typeof block.text === 'string').map(block => block.text).join('\n').trim()
}

/** Strip the markdown that reads as noise aloud, keeping the words it decorates. */
function plainLine(line) {
  return line
    .replace(/!?\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replace(/https?:\/\/\S+/gu, '')
    .replace(/`+([^`]*)`+/gu, '$1')
    .replace(/^ {0,3}#{1,6}\s+/u, '')
    .replace(/^ {0,3}>\s?/u, '')
    .replace(/^ {0,3}(?:[-*+]|\d{1,3}[.)])\s+/u, '')
    .replace(/\*\*|__|~~|\*/gu, '')
    .trim()
}

/**
 * The streaming prose projection. Whole lines decide what is content: a fenced code block, a table row, or a
 * rule is dropped, while inline decoration is removed from the lines that remain. Speech cannot wait for a
 * line to end, because one paragraph may stream for a long time, so a content line also hands over every
 * sentence it finishes, and the unfinished tail feeds the bubble on every push.
 * @returns the filter: push deltas, and read what to display.
 */
export function createProseFilter() {
  let pending = '', inFence = false, fence = '', fenceTag = '', fenceBody = '', text = ''
  const classify = line => {
    const marker = /^\s{0,3}(`{3,}|~{3,})\s*([A-Za-z0-9+#-]*)/u.exec(line)
    // A fence is buffered rather than dropped line by line: its body decides at the end whether it was code or a
    // JSON answer whose prose belongs to the person.
    if (inFence) {
      if (marker && line.trim().startsWith(fence)) { inFence = false; const prose = jsonProse(fenceBody, fenceTag); fenceBody = ''; fenceTag = ''; return prose }
      fenceBody += `${line}\n`
      return ''
    }
    if (marker) { inFence = true; fence = marker[1]; fenceTag = (marker[2] ?? '').toLowerCase(); fenceBody = ''; return '' }
    if (/^\s{0,3}\|/u.test(line) || /^\s{0,3}(?:[-*_])\s*(?:[-*_]\s*){2,}$/u.test(line)) return ''
    return plainLine(line)
  }
  // A line whose meaning is not yet decided: a fence, a table row, or a rule still needs its full text.
  const open = line => {
    if (inFence) return false
    if (/^\s*$/u.test(line)) return false
    if (/^\s{0,3}(`{3,}|~{3,})/u.test(line) || /^\s{0,3}\|/u.test(line)) return false
    return !/^\s{0,3}[-*_](?:\s|$)/u.test(line)
  }
  const boundary = line => {
    for (const match of line.matchAll(/[。！？!?]|…+|\.{3,}/gu)) {
      const end = match.index + match[0].length
      if (/^[….]/u.test(match[0]) && end === line.length) continue
      return end
    }
    return -1
  }
  return {
    /**
     * @param delta - one streamed text fragment.
     * @returns the clean prose that became speakable, including finished sentences of the open line.
     */
    push(delta) {
      pending += delta
      let out = ''
      for (;;) {
        const at = pending.indexOf('\n')
        if (at < 0) break
        const clean = classify(pending.slice(0, at)); pending = pending.slice(at + 1)
        if (clean) { text += `${clean}\n`; out += `${clean}\n` }
      }
      if (open(pending)) {
        for (;;) {
          const end = boundary(pending)
          if (end < 0) break
          const clean = plainLine(pending.slice(0, end)); pending = pending.slice(end)
          if (clean) { text += clean; out += clean }
        }
      }
      return out
    },
    /** @returns the cleaned lines so far, with the unfinished tail appended for display only. */
    display() { return inFence ? text : text + plainLine(pending) },
    /**
     * The prose still waiting for its line to finish.
     *
     * A one-shot caller — a selected passage, a message read out on demand — has no later push to complete the
     * line, so it must speak this itself. Inside a fence the answer is empty: an unfinished code block is not
     * something a person asked to hear.
     * @returns the tail's prose, or an empty string.
     */
    tail() { return inFence ? '' : plainLine(pending) },
  }
}

/**
 * Read one prose stream and hand its sentences to a sink as they finish.
 * @param sink - `sentenceChars` for the segment limit, plus `sentence`, `bubble`, and `done` handlers.
 * @returns the reader the stream wrapper drives.
 */
export function createProseReader(sink) {
  const filter = createProseFilter(), limit = sink.sentenceChars ?? BROADCAST_DEFAULTS.sentenceChars
  let spoken = '', closed = false
  const flush = () => {
    for (;;) {
      const length = speechSegmentLength(spoken, limit)
      if (!length) break
      const sentence = spoken.slice(0, length).trim()
      spoken = spoken.slice(length)
      if (sentence) sink.sentence(sentence.replace(/\s+/gu, ' ').trim())
    }
  }
  return {
    /** @param delta - one streamed text fragment. */
    push(delta) {
      spoken += filter.push(delta)
      flush()
      sink.bubble(filter.display())
    },
    /** Speak the trailing sentence and close the caption on a clean end of stream. */
    end() {
      // The unfinished tail is spoken too. A one-shot read-out has no later push to complete its line, so dropping
      // the tail silently lost the last words of a selected passage — and of a reply whose final sentence carried
      // no closing punctuation, which streaming used to drop as well.
      spoken += filter.tail()
      flush()
      const rest = spoken.trim()
      spoken = ''
      if (rest) sink.sentence(rest.replace(/\s+/gu, ' ').trim())
      closed = true
      sink.done()
    },
    /** Drop the remainder without speaking it: an interrupted stream is not a finished thought. */
    abort() { spoken = ''; if (!closed) { closed = true; sink.done() } },
  }
}

/**
 * Wrap one model stream, forwarding its prose without changing the chunks the caller receives.
 * @param stream - the provider chunk stream.
 * @param options - the request that produced it.
 * @param create - builds the sink for a broadcastable request.
 * @param focus - the session the person is viewing.
 * @returns the same chunks, in order.
 */
export async function* observeProse(stream, options, create, focus) {
  if (!broadcasts(options, focus)) { yield* stream; return }
  const reader = createProseReader(create())
  try {
    for await (const chunk of stream) {
      if (chunk?.type === 'text-delta' && typeof chunk.text === 'string') reader.push(chunk.text)
      yield chunk
    }
    reader.end()
  } catch (error) {
    reader.abort()
    throw error
  }
}
