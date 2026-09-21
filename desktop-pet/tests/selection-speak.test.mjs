/**
 * Reading a selection aloud, driven through the built client bundle.
 *
 * Two mounts share one implementation: a floating pill in the conversation panel, and a pill contributed into the
 * file browser's own selection bubble. The scoping rules are the interesting part — the official client has no
 * selection affordance, so the anchor is the `[data-slot]` wrapper the renderer emits for every slot, and a
 * selection anywhere else in the app must raise nothing.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mountPanel } from './panel-harness.mjs'

const source = readFileSync(new URL('../src/selection-speak.mjs', import.meta.url), 'utf8')

/** Put a DOM selection over one element's text and tell the document, the way a drag would. */
function select(harness, element, { start = 0, end } = {}) {
  const { window, document } = harness
  const node = element.firstChild ?? element
  const range = document().createRange()
  range.setStart(node, start)
  range.setEnd(node, end ?? (node.textContent ?? '').length)
  const selection = window().getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
  document().dispatchEvent(new (window().Event)('selectionchange'))
}

/** The floating pill, whether or not it is currently offered. */
const pillOf = harness => harness.document().querySelector('.dsh-pet-speakpill-float')

test('a selection in the conversation panel raises the pill and speaks exactly that text', async () => {
  const harness = mountPanel()
  try {
    harness.document().body.insertAdjacentHTML('beforeend', '<div data-slot="conversation.view"><p id="line">工厂很忙，消费很淡。</p></div>')
    const pill = pillOf(harness)
    assert.ok(pill, 'the pill is mounted on the document')
    assert.equal(pill.hidden, true, 'nothing is offered before a selection')
    select(harness, harness.document().querySelector('#line'))
    assert.equal(pill.hidden, false, 'a selection in the conversation panel offers a read-aloud')
    assert.equal(pill.textContent, '朗读')
    pill.dispatchEvent(new (harness.window().MouseEvent)('click', { bubbles: true }))
    await new Promise(resolve => setTimeout(resolve, 0))
    const post = harness.posts.find(entry => entry.url.includes('/selection/speak'))
    assert.ok(post, `the pill must post the selection, got ${JSON.stringify(harness.requests)}`)
    assert.deepEqual(JSON.parse(post.body), { text: '工厂很忙，消费很淡。' })
  } finally { harness.close() }
})

test('a selection raises nothing in the composer, outside the conversation, or when it is not a selection', () => {
  const harness = mountPanel()
  try {
    const { document } = harness
    document().body.insertAdjacentHTML('beforeend', [
      '<div data-slot="conversation.session">',
      '<div data-slot="conversation.composer.bar"><div data-composer-input=""><p id="draft">我的草稿</p></div></div>',
      '</div>',
      '<div data-slot="sidebar.right.pane.tab"><p id="file">文件里的正文</p></div>',
      '<div data-slot="conversation.view"><p id="line">可以朗读的一段话。</p></div>',
    ].join(''))
    const pill = pillOf(harness)
    select(harness, document().querySelector('#draft'))
    assert.equal(pill.hidden, true, 'a draft is not something to read out on selection')
    select(harness, document().querySelector('#file'))
    assert.equal(pill.hidden, true, 'the file browser floats its own bubble, so the standalone pill stays away')
    // A caret with no range is not a selection.
    const line = document().querySelector('#line')
    const range = document().createRange()
    range.setStart(line.firstChild, 2)
    range.collapse(true)
    const selection = harness.window().getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    document().dispatchEvent(new (harness.window().Event)('selectionchange'))
    assert.equal(pill.hidden, true, 'a collapsed selection offers nothing')
    // The same element, actually selected, is offered: the pill follows the selection, not the node.
    select(harness, line)
    assert.equal(pill.hidden, false)
  } finally { harness.close() }
})

test('the pill normalises whitespace and refuses what the host would reject', () => {
  const harness = mountPanel()
  try {
    const { document } = harness
    document().body.insertAdjacentHTML('beforeend', [
      '<div data-slot="conversation.view">',
      '<p id="wrapped">第一行  第二行\n第三行</p>',
      '<p id="long">' + '朗'.repeat(5001) + '</p>',
      '<p id="punctuation">—— …… ，。</p>',
      '</div>',
    ].join(''))
    const pill = pillOf(harness)
    select(harness, document().querySelector('#wrapped'))
    assert.equal(pill.hidden, false)
    // The text is captured when the selection is read, which is what the click will send.
    select(harness, document().querySelector('#long'))
    assert.equal(pill.hidden, true, 'a selection longer than the host accepts is not offered at all')
    select(harness, document().querySelector('#punctuation'))
    assert.equal(pill.hidden, true, 'punctuation alone is not speech')
  } finally { harness.close() }
})

test('a failure is reported in the pill instead of a silent no-op', async () => {
  const harness = mountPanel()
  try {
    // The host explains itself: a hidden pet is the common case, and the person deserves to read why.
    const original = globalThis.fetch
    const attempted = []
    globalThis.fetch = async (input, init) => {
      attempted.push({ url: String(typeof input === 'string' ? input : input?.url ?? ''), body: String(init?.body ?? '') })
      return { ok: false, json: async () => ({ error: '请先显示伙伴，声音由桌宠窗口播放' }) }
    }
    try {
      harness.document().body.insertAdjacentHTML('beforeend', '<div data-slot="conversation.view"><p id="line">念这句。</p></div>')
      const pill = pillOf(harness)
      select(harness, harness.document().querySelector('#line'))
      pill.dispatchEvent(new (harness.window().MouseEvent)('click', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
      const post = attempted.find(entry => entry.url.includes('/selection/speak'))
      assert.ok(post, 'the click still posts')
      // The text has to have been read before the click: a pill that appears but sends nothing would be worse
      // than no pill, and this is the assertion that proves the selection was captured.
      assert.deepEqual(JSON.parse(post.body), { text: '念这句。' })
      assert.equal(pill.textContent, '请先显示伙伴，声音由桌宠窗口播放', 'the reason is shown in the pill, not hidden in a tooltip')
      assert.equal(pill.dataset.error, 'true')
      assert.equal(pill.title, '请先显示伙伴，声音由桌宠窗口播放', 'the full host message stays available')
    } finally { globalThis.fetch = original }
  } finally { harness.close() }
})

test('the pill owns the rules its own visibility and failures depend on', () => {
  // The pill sets its own `display`, which beats the hidden attribute's UA `display:none`: without this rule the
  // button stays visible over an empty selection, and no property assertion in jsdom can see that.
  assert.match(source, /\.dsh-pet-speakpill\[hidden\]\{display:none\}/)
  // A failure is shown where the person is looking, bounded so it cannot widen the pill without limit, with the
  // complete explanation still in the tooltip.
  assert.match(source, /const ERROR_CHARS = 28/)
  assert.match(source, /message\.length > ERROR_CHARS \? `\$\{message\.slice\(0, ERROR_CHARS\)\}…` : message/)
  assert.match(source, /button\.dataset\.error = String\(Boolean\(message\)\)/)
  // The standalone pill and the contributed one are the same control: one stylesheet, one class.
  assert.equal((source.match(/className: 'dsh-pet-speakpill'/g) ?? []).length, 1)
  assert.match(source, /className = 'dsh-pet-speakpill dsh-pet-speakpill-float'/)
})

test('the file browser action is contributed only when its seam exists, and withdrawn with the plugin', () => {
  const harness = mountPanel()
  let closed = false
  try {
    assert.equal(harness.injectRequests.length, 1, 'the pet waits on one optional service')
    assert.equal(harness.injectRequests[0].satisfied, false, 'a missing file browser registers nothing and throws nothing')
    const registered = [], disposed = []
    harness.provide('dshFileEditSelectionActions', {
      version: 1,
      register(action) { registered.push(action); return () => { disposed.push(action.id) } },
    })
    assert.equal(registered.length, 1, 'the seam is filled as soon as the file browser publishes it')
    assert.equal(registered[0].id, 'desktop-pet-speak')
    assert.equal(registered[0].order, 20)
    assert.equal(typeof registered[0].pill, 'function', 'the bubble renders the pill this plugin supplies')
    harness.close()
    closed = true
    assert.deepEqual(disposed, ['desktop-pet-speak'], 'the contribution is withdrawn with its plugin')
  } finally { if (!closed) harness.close() }
})
