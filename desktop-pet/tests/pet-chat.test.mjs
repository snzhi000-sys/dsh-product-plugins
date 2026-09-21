/**
 * Contracts of the pet window's compact input.
 *
 * The person presses 发送 and expects an answer to that press. Two defects made the press look dead: the button
 * carried `disabled`, so a busy client swallowed the click with no reply at all, and the busy flags come from the
 * event stream, so a lost `state` event left the input refusing forever. Both are asserted here, together with
 * the visible failure that keeps a stalled connection from leaving the box saying 发送中… (2026-09-21).
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { mountPetChat } from '../src/pet-chat.mjs'
import { mountSpeechPlayer } from '../src/speech-player.mjs'

const IDLE = { generating: false, recording: null, session: { id: 'session', messages: [] } }

/**
 * Mount the compact input over a fresh document and record everything it asks the Host for.
 * @param options - `sendStatus` for the send answer, `live` for what the Host reports about its own state.
 * @returns the mounted input: its elements, the requests it made, the stream it opened, and a disposer.
 */
function mount({ sendStatus = 200, live = IDLE } = {}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="bubble"></div><button data-action="chat">聊天</button><form id="pet-chat" hidden><textarea id="pet-input"></textarea><button type="submit">发送</button></form></body></html>', { url: 'http://127.0.0.1/' })
  const saved = ['window', 'document', 'fetch', 'EventSource'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
  const borrow = (name, value) => Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
  const calls = [], streams = []
  class StubEventSource {
    constructor(url) { this.url = String(url); this.listeners = new Map(); streams.push(this) }
    addEventListener(name, listener) { this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]) }
    close() { this.closed = true }
  }
  borrow('window', dom.window)
  borrow('document', dom.window.document)
  borrow('EventSource', StubEventSource)
  borrow('fetch', async (input, init) => {
    const url = String(typeof input === 'string' ? input : input?.url ?? '')
    calls.push({ url, body: init?.body === undefined ? undefined : String(init.body), method: init?.method ?? 'GET' })
    const value = url.includes('/conversation/send') ? { id: 'reply-1' } : live
    const ok = url.includes('/conversation/send') ? sendStatus < 400 : true
    return { ok, status: ok ? 200 : sendStatus, json: async () => (ok ? value : { error: '这条消息没有发出去' }) }
  })
  const document = dom.window.document
  const chat = mountPetChat(document.getElementById('bubble'), async () => {}, () => {})
  const stream = streams[0]
  const form = document.getElementById('pet-chat'), input = document.getElementById('pet-input'), send = form.querySelector('button')
  return {
    chat, input, send, document,
    posts: () => calls.filter(call => call.url.includes('/conversation/send')),
    reads: () => calls.filter(call => !call.url.includes('/conversation/send') && call.url.includes('/api/conversation')),
    bubble: () => document.getElementById('bubble').textContent,
    emit: (name, value) => { for (const listener of stream.listeners.get(name) ?? []) listener({ data: JSON.stringify(value) }) },
    press: () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })),
    close() { chat.dispose(); for (const [name, descriptor] of saved) { if (descriptor === undefined) delete globalThis[name]; else Object.defineProperty(globalThis, name, descriptor) } dom.window.close() },
  }
}

const tick = () => new Promise(resolve => setImmediate(resolve))

test('the compact input sends the draft, clears it, and says what it is doing while it waits', async () => {
  const panel = mount()
  try {
    panel.input.value = '在吗'
    assert.equal(panel.send.type, 'submit', 'the control is the form\'s submit button')
    assert.equal(panel.send.getAttribute('aria-disabled'), 'false', 'a resting control reports that it can be pressed')
    assert.equal(panel.send.textContent, '发送')
    panel.press()
    // The press is answered synchronously, so the button cannot look dead while the Host decides.
    assert.equal(panel.send.textContent, '发送中…')
    assert.equal(panel.input.placeholder, '正在发送…')
    await tick(); await tick()
    assert.equal(panel.posts().length, 1, 'exactly one request leaves the page')
    assert.equal(JSON.parse(panel.posts()[0].body).text, '在吗')
    assert.equal(panel.input.value, '', 'the draft is cleared once the Host took it')
    assert.equal(panel.send.textContent, '发送', 'and the button comes back')
  } finally { panel.close() }
})

test('a busy flag that outlived the Host turn does not block the press', async () => {
  const panel = mount()
  try {
    // The stream says a reply is still being generated; the Host itself says it is idle, so the press must send.
    panel.emit('state', { ...IDLE, generating: true })
    assert.equal(panel.send.getAttribute('aria-disabled'), 'true', 'the control shows the state it was told')
    panel.input.value = '还能发吗'
    panel.press()
    await tick(); await tick(); await tick()
    assert.equal(panel.reads().length, 1, 'the Host is asked what it is really doing before anything is refused')
    assert.equal(panel.posts().length, 1, 'and the message goes out on the Host\'s word, not the stale flag')
    assert.equal(panel.input.value, '')
    assert.equal(panel.bubble(), '', 'nothing is claimed to the person, because nothing was wrong')
  } finally { panel.close() }
})

test('a genuinely busy Host refuses the message with a reason, even while the bubble holds a reply', async () => {
  const panel = mount({ live: { ...IDLE, generating: true } })
  try {
    // The stream and the Host agree that a reply is in flight, and the character is speaking it, so the bubble is
    // holding text through the very notice this refusal has to deliver.
    panel.emit('state', { ...IDLE, generating: true })
    panel.emit('reply', { id: 'reply-1', text: '我在听。', generating: false, speaking: true, voiced: false })
    assert.equal(panel.bubble(), '我在听。')
    panel.input.value = '再发一条'
    panel.press()
    await tick(); await tick(); await tick()
    assert.equal(panel.reads().length, 1, 'the Host is asked before the message is refused')
    assert.equal(panel.posts().length, 0, 'a busy Host is not sent a second message')
    assert.equal(panel.input.value, '再发一条', 'the draft stays')
    assert.match(panel.bubble(), /还在回复/, 'and the reason reaches the person instead of being swallowed')
  } finally { panel.close() }
})

test('a failed send says so even while the bubble holds a reply', async () => {
  const panel = mount({ sendStatus: 400 })
  try {
    panel.emit('reply', { id: 'reply-1', text: '我在听。', generating: false, speaking: true, voiced: false })
    panel.input.value = '发得出去吗'
    panel.press()
    await tick(); await tick(); await tick()
    assert.equal(panel.posts().length, 1, 'the message was attempted')
    assert.equal(panel.input.value, '发得出去吗', 'the draft stays so the person can retry')
    assert.match(panel.bubble(), /没有发出去/, 'and the failure is shown rather than hidden behind the held reply')
  } finally { panel.close() }
})

test('the pet window reads its chat and its voice from one shared stream', () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="bubble"></div><button data-action="chat">聊天</button><form id="pet-chat" hidden><textarea id="pet-input"></textarea><button type="submit">发送</button></form></body></html>', { url: 'http://127.0.0.1/' })
  const saved = ['window', 'document', 'fetch', 'EventSource', 'AudioContext', 'requestAnimationFrame', 'cancelAnimationFrame'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
  const borrow = (name, value) => Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
  // The window's own stream, handed to both readers; opening a second one is what the test forbids.
  class StubEventSource {
    constructor(url) { this.url = String(url); StubEventSource.opened.push(this.url); this.listeners = new Map() }
    addEventListener(name, listener) { this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]) }
    close() { this.closed = true }
    emit(name, value) { for (const listener of this.listeners.get(name) ?? []) listener({ data: JSON.stringify(value) }) }
  }
  StubEventSource.opened = []
  borrow('window', dom.window); borrow('document', dom.window.document); borrow('EventSource', StubEventSource)
  borrow('fetch', async () => ({ ok: true, status: 200, json: async () => ({}) }))
  borrow('requestAnimationFrame', dom.window.requestAnimationFrame?.bind(dom.window) ?? (() => 0))
  borrow('cancelAnimationFrame', dom.window.cancelAnimationFrame?.bind(dom.window) ?? (() => {}))
  const stream = new StubEventSource('/desktop-pet/api/conversation/events?role=player')
  StubEventSource.opened = []
  try {
    const chat = mountPetChat(dom.window.document.getElementById('bubble'), async () => {}, () => {}, { events: stream })
    const player = mountSpeechPlayer(undefined, () => {}, undefined, { role: 'player', events: stream })
    assert.deepEqual(StubEventSource.opened, [], 'neither reader opens a stream of its own')
    stream.emit('reply', { text: '我在听。', generating: false, speaking: true, voiced: false })
    assert.equal(dom.window.document.getElementById('bubble').textContent, '我在听。', 'the chat still reads the shared stream')
    chat.dispose(); player()
    assert.equal(stream.closed === true, false, 'neither reader closes a stream it does not own')
  } finally {
    for (const [name, descriptor] of saved) { if (descriptor === undefined) delete globalThis[name]; else Object.defineProperty(globalThis, name, descriptor) }
    dom.window.close()
  }
})
