/**
 * The observer is the seam that decides whether the pet hears the main agent at all: it listens globally, it
 * leaves every chunk it sees untouched, and it stays silent unless the preference is on and the session is a
 * person's own turn rather than a subagent's.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { installBroadcast } from '../src/broadcast-observer.mjs'

/** A Cordis-shaped context: registrations are recorded, and tests emit into them. */
/** The observer reads the focused session from the host, which the client reports. */
const deps = (overrides = {}) => ({ settings: () => ({ broadcastEnabled: true }), focus: () => 'session-1', conversation: fakeConversation(), ...overrides })

function fakeContext() {
  const registered = new Map()
  return {
    registered,
    on(name, listener, options) {
      const entry = { listener, options }
      registered.set(name, [...(registered.get(name) ?? []), entry])
      return () => { registered.set(name, (registered.get(name) ?? []).filter(item => item !== entry)) }
    },
    emit(name, ...args) { for (const entry of registered.get(name) ?? []) entry.listener(...args) },
    count(name) { return (registered.get(name) ?? []).length },
  }
}

/**
 * The pet's host half, reduced to what the observer calls.
 *
 * There is deliberately no `announce` here: an observer that reached for one would fail loudly, which is the
 * point — the dead caption path must not come back unnoticed.
 */
function fakeConversation() {
  const spoken = []
  return { spoken, store: { config: { sentenceChars: 100 } }, speak: text => spoken.push(text) }
}

/** Drive one stream through the installed waterfall. */
async function stream(ctx, chunks, options = { sessionId: 'session-1' }) {
  const listeners = ctx.registered.get('llm/stream') ?? []
  assert.equal(listeners.length, 1, 'the observer installs one waterfall listener')
  async function* source() { for (const chunk of chunks) yield chunk }
  const out = []
  for await (const chunk of listeners[0].listener(options, () => source())) out.push(chunk)
  return out
}

const PROSE = [
  { type: 'text-delta', index: 0, text: '我把计时器改好了。' },
  { type: 'text-delta', index: 0, text: '现在跑一遍测试。' },
  { type: 'finish', reason: 'stop' },
]

test('the observer listens globally, so another scope\'s agent turn reaches it', () => {
  const ctx = fakeContext()
  installBroadcast(ctx, deps({ settings: () => ({ broadcastEnabled: false }) }))
  for (const name of ['llm/stream', 'session/event', 'session/disposed']) {
    assert.equal(ctx.count(name), 1, `${name} has one listener`)
    assert.equal(ctx.registered.get(name)[0].options.global, true, `${name} is registered globally`)
  }
})

test('an enabled preference speaks the sentences of the focused turn', async () => {
  const ctx = fakeContext(), conversation = fakeConversation()
  installBroadcast(ctx, deps({ conversation }))
  const out = await stream(ctx, PROSE)
  assert.equal(out.length, 3, 'every chunk still reaches the caller')
  assert.deepEqual(conversation.spoken, ['我把计时器改好了。', '现在跑一遍测试。'])
})

test('a disabled preference leaves the stream alone and says nothing', async () => {
  const ctx = fakeContext(), conversation = fakeConversation()
  installBroadcast(ctx, deps({ conversation, settings: () => ({ broadcastEnabled: false }) }))
  const source = [{ type: 'text-delta', index: 0, text: '不该被念出来。' }]
  const out = await stream(ctx, source)
  assert.deepEqual(out, source, 'the same chunks come back')
  assert.deepEqual(conversation.spoken, [])
})

test('a subagent session is never read aloud', async () => {
  const ctx = fakeContext(), conversation = fakeConversation()
  // The view follows the session under test, so the subagent marker is what decides here, not the focus.
  let focus = 'sub-1'
  installBroadcast(ctx, deps({ conversation, focus: () => focus }))
  ctx.emit('session/event', { id: 'sub-1', header: { origin: 'subagent' } }, { type: 'turn/start' })
  await stream(ctx, PROSE, { sessionId: 'sub-1' })
  assert.deepEqual(conversation.spoken, [], 'delegated work stays out of the pet\'s voice even while on screen')
  focus = 'session-1'
  await stream(ctx, PROSE, { sessionId: 'session-1' })
  assert.equal(conversation.spoken.length, 2, 'the main session still speaks')
  ctx.emit('session/disposed', { id: 'sub-1' })
  focus = 'sub-1'
  await stream(ctx, PROSE, { sessionId: 'sub-1' })
  assert.equal(conversation.spoken.length, 4, 'a disposed session is forgotten, so its id can be reused')
})

test('only the session on screen is read; another running task stays silent', async () => {
  const ctx = fakeContext(), conversation = fakeConversation()
  let focus = 'session-1'
  installBroadcast(ctx, deps({ conversation, focus: () => focus }))
  await stream(ctx, PROSE, { sessionId: 'session-1' })
  assert.equal(conversation.spoken.length, 2, 'the conversation in view is read')
  await stream(ctx, PROSE, { sessionId: 'session-2' })
  assert.equal(conversation.spoken.length, 2, 'a task in another session is not read')
  focus = 'session-2'
  await stream(ctx, PROSE, { sessionId: 'session-2' })
  assert.equal(conversation.spoken.length, 4, 'switching the view switches what is read')
  await stream(ctx, PROSE, { sessionId: 'session-1' })
  assert.equal(conversation.spoken.length, 4, 'the session that is no longer on screen goes quiet')
})

test('the observer remembers each assistant message\'s prose for the read-out control', () => {
  const ctx = fakeContext()
  const observer = installBroadcast(ctx, deps())
  ctx.emit('session/event', { id: 'session-1', header: {} }, { type: 'assistant/message', data: { message: { id: 'message-1', content: [{ type: 'reasoning', text: '想法' }, { type: 'text', text: '第一句。' }, { type: 'text', text: '第二句。' }] } } })
  assert.equal(observer.messageText('message-1'), '第一句。\n第二句。', 'only the text blocks are remembered')
  assert.equal(observer.messageText('message-unknown'), undefined)
  ctx.emit('session/event', { id: 'session-1', header: {} }, { type: 'assistant/message', data: { message: { id: 'message-2', content: [{ type: 'reasoning', text: '只有想法' }] } } })
  assert.equal(observer.messageText('message-2'), undefined, 'a message with no prose is not remembered')
  observer.dispose()
})

test('nothing is read until the client reports which session it shows', async () => {
  const ctx = fakeContext(), conversation = fakeConversation()
  installBroadcast(ctx, deps({ conversation, focus: () => undefined }))
  await stream(ctx, PROSE, { sessionId: 'session-1' })
  assert.deepEqual(conversation.spoken, [], 'an unknown view reads nothing rather than everything')
})

test('installing twice and disposing releases every listener', async () => {
  const ctx = fakeContext(), conversation = fakeConversation()
  const observer = installBroadcast(ctx, deps({ conversation, settings: () => ({ broadcastEnabled: true }) }))
  assert.equal(typeof observer.messageText, 'function', 'the observer exposes the prose of the messages it saw')
  observer.dispose()
  assert.equal(ctx.count('llm/stream'), 0)
  assert.equal(ctx.count('session/event'), 0)
  assert.equal(ctx.count('session/disposed'), 0)
  await assert.rejects(async () => { await stream(ctx, PROSE) }, /one waterfall listener/)
})
