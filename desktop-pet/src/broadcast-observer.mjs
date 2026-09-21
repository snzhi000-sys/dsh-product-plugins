/**
 * Installs the broadcast observer: every model stream the agent loop builds passes through it, and the
 * assistant's own prose is forwarded to the pet while the chunks continue to the caller untouched.
 *
 * Only the focused session is read: the client reports the conversation it is displaying, and every other
 * running task stays silent. Subagent sessions are skipped as well — a subagent streams its own work into a
 * session of its own, and reading that aloud would bury the main agent's report under delegated chatter.
 * Subagent identity is durable on the session header, so it is read from the session events rather than
 * guessed from the request.
 *
 * Kept free of Harness imports so a unit test can drive it with a fake context.
 */
import { assistantProse, broadcasts, observeProse } from './broadcast.mjs'

/**
 * Build one stream's sink. Speech uses the pet's own voice configuration; the prose is not captioned anywhere,
 * because the pet's bubble belongs to the pet's own conversation (2026-09-20).
 *
 * The reader calls `bubble` and `done` unconditionally, so they stay as no-ops rather than being left out.
 * @param deps - the plugin's live settings and conversation host.
 * @returns the sink the prose reader drives.
 */
function sinkFor(deps) {
  return {
    sentenceChars: deps.conversation.store.config.sentenceChars,
    sentence: text => { deps.conversation.speak(text) },
    bubble: () => {},
    done: () => {},
  }
}

/**
 * @param ctx - the Cordis context the plugin runs in.
 * @param deps - `settings` reads the live pet preferences, `focus` reports the session on screen, and
 *   `conversation` is the pet's host.
 * @returns the installed observer: its disposer, and the prose of any assistant message it has seen.
 */
export function installBroadcast(ctx, deps) {
  const subagents = new Set(), disposers = [], texts = new Map()
  disposers.push(ctx.on('session/event', (session, event) => {
    if (session?.header?.origin === 'subagent') subagents.add(session.id)
    // Remember every assistant message's prose as it settles: the per-message read-out control speaks a message
    // the person points at, and this is what the host hands it.
    if (event?.type === 'assistant/message') {
      const id = event.data?.message?.id
      const prose = assistantProse(event.data?.message?.content)
      if (typeof id === 'string' && prose) { texts.set(id, prose); if (texts.size > 500) texts.delete(texts.keys().next().value) }
    }
  }, { global: true }))
  disposers.push(ctx.on('session/disposed', session => { subagents.delete(session?.id) }, { global: true }))
  // A waterfall listener must always delegate: returning `next()`'s stream unchanged is the pass-through.
  disposers.push(ctx.on('llm/stream', (options, next) => {
    const stream = next()
    const focus = deps.focus()
    if (!broadcasts(options, focus) || !deps.settings().broadcastEnabled || subagents.has(options.sessionId)) return stream
    return observeProse(stream, options, () => sinkFor(deps), focus)
  }, { global: true }))
  return {
    dispose() { for (const dispose of disposers.reverse()) dispose(); texts.clear() },
    /** @param messageId - one assistant message. @returns its prose, when this run has seen it. */
    messageText(messageId) { return texts.get(messageId) },
  }
}
