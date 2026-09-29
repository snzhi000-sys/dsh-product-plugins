/**
 * Contracts the settings markup has to keep. These are the cheap checks that keep a class name, a control
 * style, or a field key from silently breaking the panel: on 2026-09-19 a bare `.switch` class in the voice
 * page matched the visibility track's own rule (36x20), so that row's label collapsed into a one-character
 * column on top of its neighbours. Layout cannot be asserted here — jsdom computes none — so this locks the
 * structure, and the packaged probes measure the rendered page.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { mountPanel } from './panel-harness.mjs'

/** Every settings key the form reads or writes, as the selectors its own load and save rely on. */
const REQUIRED = [
  '[data-tab="partner"]', '[data-tab="conversation"]', '[data-tab="prompts"]', '[data-tab="intimacy"]',
  '[data-tab="actions"]', '[data-tab="voice"]', '[data-tab="history"]',
  '[data-conversation-fields]', '[data-prompt-fields]', '[data-voice-fields]', '[data-action-keywords]',
  '[data-field="baseUrl"]', '[data-field="model"]', '[data-field="prompt"]', '[data-field="emotionPrompt"]',
  '[data-field="emotionCharacterName"]', '[data-field="emotionHistoryMessages"]', '[data-field="voiceKind"]',
  '[data-field="speaker"]', '[data-field="voiceName"]', '[data-field="speechRate"]', '[data-field="asrResource"]',
  '[data-key="llm"]', '[data-key="tts"]', '[data-key="asr"]', '[data-default-voice]', '[data-switch="ttsEnabled"]',
  '[data-test]', '[data-sample]', '[data-insert-emotion]', '[data-insert-history]', '[data-insert-intimacy]',
  '[data-prompt-actions]', '[data-emotion-status]', '[data-emotion-text]', '[data-intimacy-status]',
  '[data-intimacy-levels]', '[data-add-level]', '[data-action-character]', '[data-new-preset]',
  '[data-keyword-conflict]', '#visibility', '#animated', '#alwaysOnTop',
  '#height', '#model-preview', '#status',
]

test('the read-out control registers in the official assistant action strip', () => {
  const panel = mountPanel()
  try {
    const entry = panel.entries.find(item => item.definition.name === 'conversation.chat.assistant-actions')
    assert.notEqual(entry, undefined, 'the pet contributes one action to the assistant strip')
    assert.equal(entry.definition.id, 'desktop-pet-readout')
    assert.equal(typeof entry.definition.inject, 'function', 'the entry injects the Session it renders in')
    assert.equal(entry.definition.inject('session-1').sessionId, 'session-1', 'the control knows which session it belongs to')
    // Rendered once here: the control's own contract is the state a test can read off the element.
    const element = entry.Component({ messageId: 'message-1', sessionId: 'session-1' })
    assert.equal(element.type, 'button', 'the control is a button, not a link or a div')
    assert.equal(element.props.className, 'dsh-pet-readout')
    assert.equal(element.props['aria-pressed'], 'false', 'a resting control reports that it is not playing')
    assert.equal(element.props['aria-label'], '播报这条回复')
    assert.equal(element.props.disabled, false, 'a resting control can be pressed')
    assert.equal(element.props.onClick !== undefined, true, 'pressing it toggles the read-out')
  } finally {
    panel.close()
  }
})

test('the strip control shows the read-out state of the whole pet, not only of its own message', () => {
  const panel = mountPanel()
  try {
    const entry = panel.entries.find(item => item.definition.name === 'conversation.chat.assistant-actions')
    const render = () => entry.Component({ messageId: 'message-7', sessionId: 'session-1' })
    const stream = panel.streams[0]
    const emitReadout = value => { for (const listener of stream.listeners.get('readout') ?? []) listener({ data: JSON.stringify(value) }) }

    let element = render()
    assert.equal(element.props['data-playing'], 'false', 'nothing is being read at rest')

    // A selection being read aloud is the same voice and the same queue, so the strip must show it too
    // (reported 2026-09-20: selecting text and pressing 朗读 left the strip looking idle). While anything plays
    // this single button *is* the stop control, so it reports pressed rather than only glowing.
    emitReadout({ messageId: 'selection', state: 'playing' })
    element = render()
    assert.equal(element.props['data-playing'], 'true', 'reading a selection lights the message strip up')
    assert.equal(element.props['aria-pressed'], 'true', 'the lit control is the stop control for the whole voice')
    assert.equal(element.props.title, '停止朗读', 'the tooltip says what pressing it will do')
    assert.equal(element.children[0].props.playing, true, 'and the icon draws the playing waveform')

    // Its own read-out is the same state: one queue, one button.
    emitReadout({ messageId: 'message-7', state: 'playing' })
    element = render()
    assert.equal(element.props['aria-pressed'], 'true')
    assert.equal(element.props.title, '停止朗读')

    // The host clears the owner when the queue drains, which clears every control.
    emitReadout({ messageId: null, state: 'idle' })
    element = render()
    assert.equal(element.props['data-playing'], 'false')
    assert.equal(element.props['aria-pressed'], 'false')
    assert.equal(element.props.title, '用桌宠的声音播报这条回复')
  } finally {
    panel.close()
  }
})

test('pressing the lit strip control stops every read-out instead of starting its own', async () => {
  const panel = mountPanel()
  try {
    const entry = panel.entries.find(item => item.definition.name === 'conversation.chat.assistant-actions')
    const stream = panel.streams[0]
    const emitReadout = value => { for (const listener of stream.listeners.get('readout') ?? []) listener({ data: JSON.stringify(value) }) }
    const render = () => entry.Component({ messageId: 'message-7', sessionId: 'session-1' })
    const tick = () => new Promise(resolve => setImmediate(resolve))

    // Reading a selection, then pressing the lit button: the press must cancel the selection's read-out, not
    // start a second one for this message (reported 2026-09-20: the button could not stop a selection).
    emitReadout({ messageId: 'selection', state: 'playing' })
    render().props.onClick()
    await tick()
    const stops = panel.posts.filter(post => post.url.includes('/conversation/stop'))
    assert.equal(stops.length, 1, 'the press asks the host to stop the queue')
    assert.deepEqual(JSON.parse(stops[0].body), { speechOnly: true }, 'and to stop speech only, leaving the reply text alone')
    assert.equal(panel.posts.some(post => post.url.includes('/broadcast/message')), false, 'it must not also start reading this reply')
    assert.equal(render().props['data-playing'], 'false', 'the icon answers the press immediately')
    assert.equal(render().props['aria-pressed'], 'false')

    // At rest the same button reads this reply out: the two jobs are one control.
    render().props.onClick()
    await tick()
    const started = panel.posts.filter(post => post.url.includes('/broadcast/message'))
    assert.equal(started.length, 1, 'a resting press starts this reply')
    assert.deepEqual(JSON.parse(started[0].body), { sessionId: 'session-1', messageId: 'message-7' }, 'with the Session and message it renders for')
  } finally {
    panel.close()
  }
})

test('the strip control can stop a voice that started while its own press was in flight', () => {
  const panel = mountPanel()
  try {
    const entry = panel.entries.find(item => item.definition.name === 'conversation.chat.assistant-actions')
    const stream = panel.streams[0]
    const emitReadout = value => { for (const listener of stream.listeners.get('readout') ?? []) listener({ data: JSON.stringify(value) }) }
    const render = () => entry.Component({ messageId: 'message-7', sessionId: 'session-1' })

    // A press whose request has not answered yet must not start a second read-out, so the control waits.
    render().props.onClick()
    assert.equal(render().props.disabled, true, 'a press in flight keeps the control from starting a second read-out')

    // A broadcast that begins meanwhile is a voice already playing — the same state the mouth follows. The control
    // has to show it and stay pressable, or the pet speaks with nothing on screen able to stop it
    // (reported 2026-09-23).
    emitReadout({ messageId: 'broadcast', state: 'playing' })
    const playing = render()
    assert.equal(playing.props['data-playing'], 'true', 'a broadcast lights the control like any other read-out')
    assert.equal(playing.props['aria-pressed'], 'true')
    assert.equal(playing.props.disabled, false, 'a voice that is already playing must always be stoppable')
  } finally {
    panel.close()
  }
})

test('the read-out control draws a speaker at rest and an animated waveform while it plays', () => {
  const panel = mountPanel()
  try {
    const entry = panel.entries.find(item => item.definition.name === 'conversation.chat.assistant-actions')
    // The stub React does not render, so the icon is invoked the way the renderer would.
    const iconOf = playing => {
      const element = entry.Component({ messageId: 'message-1', sessionId: 'session-1' })
      const icon = element.children[0]
      return icon.type({ ...icon.props, playing })
    }
    // This stub React keeps a children array passed as one argument unflattened; the real renderer flattens it.
    const glyphs = element => element.children.flat()
    const rest = iconOf(false)
    assert.equal(rest.type, 'svg')
    assert.equal(rest.props.fill, 'currentColor', 'the glyph takes the button colour rather than owning the grey it was exported with')
    assert.equal(rest.props.stroke, undefined, 'the supplied artwork is a filled outline, not a stroke')
    assert.deepEqual(glyphs(rest).map(child => child.type), ['path'], 'one path carries the speaker and its waves')
    // The supplied artwork fills its own 31x25 box, and that box is kept verbatim. The previous hand-drawn speaker
    // occupied about two thirds of a 16 grid, so the strip's 15px rule rendered it visibly smaller than the icons
    // beside it — the size mismatch the person reported (2026-09-20).
    assert.equal(rest.props.viewBox, '0 0 31 25', 'the supplied box survives, so the glyph keeps its proportions')
    assert.equal(glyphs(rest)[0].props.d.length > 2000, true, 'the supplied artwork is used as given, not redrawn')
    const playing = iconOf(true)
    assert.deepEqual(glyphs(playing).map(child => child.type), ['rect', 'rect', 'rect', 'rect'], 'four bars')
    assert.equal(glyphs(playing).every(bar => bar.props.fill === 'currentColor'), true, 'the bars are filled, not stroked')
    assert.deepEqual(glyphs(playing).map(bar => bar.props.style.animationDelay), ['0s', '0.14s', '0.28s', '0.42s'], 'each bar rises a little later')
    // The two states differ by shape, so the control is readable without relying on its colour alone.
    assert.notDeepEqual(glyphs(rest).length, glyphs(playing).length)
    const source = readFileSync(new URL('../src/client.mjs', import.meta.url), 'utf8')
    // The button follows the strip's own stylesheet: 28px with 6px padding, a 15px glyph, and the tertiary label
    // tier. It previously painted `label-caption`, one tier too faint, which is why it looked washed out beside
    // copy and share (reported 2026-09-20) — that token must not come back.
    assert.match(source, /\.dsh-pet-readout\{[^}]*box-sizing:border-box[^}]*width:28px;height:28px;padding:6px[^}]*color:var\(--dsw-alias-label-tertiary\)/)
    assert.match(source, /\.dsh-pet-readout svg\{width:15px;height:15px\}/)
    assert.doesNotMatch(source, /dsh-pet-readout\{[^}]*label-caption/)
    // The playing state animates the bars and is honoured by reduced-motion; the old breathing ring is gone.
    assert.match(source, /\.dsh-pet-readout-bar\{[^}]*animation:dsh-pet-readout-bar/)
    assert.match(source, /@keyframes dsh-pet-readout-bar\{from\{transform:scaleY\(\.35\)\}to\{transform:scaleY\(1\)\}\}/)
    assert.match(source, /prefers-reduced-motion:reduce\)\{\.dsh-pet-readout-bar\{animation:none/)
    assert.doesNotMatch(source, /dsh-pet-readout-ring/)
    assert.doesNotMatch(source, /READOUT_(RING|PLAY|PAUSE)/)
  } finally {
    panel.close()
  }
})

test('the settings markup keeps its namespacing, control, and layout contracts', () => {
  const panel = mountPanel()
  try {
    const shadow = panel.shadow()
    assert.notEqual(shadow, null, 'the panel mounts into its own shadow root')

    // One namespace for every class: the panel holds several modules' markup in one tree, so an unprefixed
    // name is a collision waiting for the next page to be added.
    const unnamespaced = new Set()
    for (const element of shadow.querySelectorAll('*')) for (const token of element.classList) if (!token.startsWith('pet-')) unnamespaced.add(token)
    assert.deepEqual([...unnamespaced], [], 'every class inside the panel starts with pet-')

    // Switches: the official contract, state readable from the attribute, one thumb each.
    const switches = [...shadow.querySelectorAll('[role="switch"]')]
    // Visibility, animation, keep-on-top and the voice page's automatic reading; the sound toggle left this panel
    // for the conversation header (2026-09-21).
    assert.equal(switches.length >= 4, true, `expected the on/off settings as switches, got ${String(switches.length)}`)
    for (const control of switches) {
      assert.equal(control.tagName, 'BUTTON', 'a switch is a button')
      assert.equal(control.classList.contains('pet-switch'), true, 'a switch carries the official track class')
      assert.equal(control.querySelectorAll('.pet-thumb').length, 1, 'a switch renders exactly one thumb')
      assert.equal(['true', 'false'].includes(control.getAttribute('aria-checked')), true, 'a switch carries aria-checked')
    }
    // The row that the collision broke: a label at the start and the track at the end.
    const autoRead = shadow.querySelector('[data-switch="ttsEnabled"]')
    assert.equal(autoRead.parentElement.classList.contains('pet-switchRow'), true, 'the auto-read switch sits in a switch row')
    assert.equal(autoRead.parentElement.querySelector('.pet-label')?.textContent, '自动朗读回复', 'the row keeps its own label')
    assert.equal(autoRead.closest('[data-page="voice"]') !== null, true, 'the auto-read switch belongs to the voice page')

    // Controls and buttons carry the shared official classes rather than local styling.
    const CONTROLS = ['pet-input', 'pet-select', 'pet-textarea', 'pet-range']
    for (const control of shadow.querySelectorAll('input,select,textarea')) {
      assert.equal(CONTROLS.some(name => control.classList.contains(name)), true, `${control.tagName} carries an official control class`)
    }
    for (const button of shadow.querySelectorAll('button')) {
      const kinds = ['pet-btn', 'pet-switch', 'pet-tab', 'pet-character']
      assert.equal(kinds.some(name => button.classList.contains(name)), true, `button "${button.textContent}" carries an official class`)
    }

    // Layout: the short settings sit in two-column grids, the prompts and the notes claim a full line.
    for (const id of ['data-conversation-fields', 'data-prompt-fields', 'data-voice-fields']) {
      assert.equal(shadow.querySelector(`[${id}]`).classList.contains('pet-grid'), true, `${id} is a two-column grid`)
    }
    for (const key of ['prompt', 'emotionPrompt']) {
      assert.equal(shadow.querySelector(`[data-field="${key}"]`).closest('.pet-field').classList.contains('pet-fieldWide'), true, `${key} spans both columns`)
    }
    for (const key of ['baseUrl', 'speaker', 'asrResource']) {
      assert.equal(shadow.querySelector(`[data-field="${key}"]`).closest('.pet-field').classList.contains('pet-fieldWide'), false, `${key} shares a row`)
    }
    for (const id of ['data-intimacy-levels', 'data-action-keywords']) {
      assert.equal(shadow.querySelector(`[${id}]`).classList.contains('pet-cards'), true, `${id} lays its cards out in columns`)
    }
    // The page frame the sidebar panel renders into, with the visibility switch in its header.
    assert.equal(shadow.querySelectorAll('.pet-page').length, 1, 'the panel renders one page frame')
    assert.equal(shadow.querySelector('.pet-pageHead').contains(shadow.querySelector('#visibility')), true, 'the visibility switch belongs in the header')

    // Reading the main conversation aloud moved to the conversation header's own toggle (2026-09-21), so the panel
    // must not offer a second control for the same setting.
    assert.equal(shadow.querySelector('#broadcastEnabled'), null, 'the panel no longer carries the sound switch')
    assert.equal(shadow.querySelector('#broadcastBubbleSentences'), null, 'the retired caption bound is not rendered')

    // Every key the form reads must exist: a rename here is a silent settings write of `undefined`.
    const missing = REQUIRED.filter(selector => shadow.querySelector(selector) === null)
    assert.deepEqual(missing, [], 'every settings selector the form uses resolves')
  } finally {
    panel.close()
  }
})

test('one window keeps one conversation stream, whatever reads it', () => {
  const panel = mountPanel()
  try {
    // The read-out store and the window's audio seat are two readers of the same stream: a browser allows only a
    // handful of connections per origin, and a second long-lived stream takes one from the page's own assets — which
    // is what starved the settings panel's preview iframe (2026-09-21).
    assert.equal(panel.streams.length, 1, `the plugin must open exactly one stream per window, got ${String(panel.streams.length)}`)
    assert.match(panel.streams[0].url, /conversation\/events\?role=page/, 'and it is the audio seat that owns it')
    const entry = panel.entries.find(item => item.definition.name === 'conversation.chat.assistant-actions')
    const stream = panel.streams[0]
    const emitReadout = value => { for (const listener of stream.listeners.get('readout') ?? []) listener({ data: JSON.stringify(value) }) }
    emitReadout({ messageId: 'selection', state: 'playing' })
    assert.equal(entry.Component({ messageId: 'message-1', sessionId: 'session-1' }).props['data-playing'], 'true', 'the strip still follows the shared stream')
    // Closing the panel closes the window's only stream.
    panel.close()
    assert.equal(stream.closed, true, 'the stream is released with the plugin')
  } catch (error) { panel.close(); throw error }
})

test('the sound toggle registers in the conversation header and speaks for the pet setting', () => {
  const panel = mountPanel()
  try {
    const entry = panel.entries.find(item => item.definition.name === 'conversation.session.header.utilities')
    assert.notEqual(entry, undefined, 'the pet contributes one utility to the conversation header')
    assert.equal(entry.definition.id, 'desktop-pet-sound')
    // The official open-in-app split button registers at -10; earlier order puts the speaker to its left.
    assert.equal(entry.definition.order, -20, 'the toggle sorts before the official utilities')
    const element = entry.Component({})
    assert.equal(element.type, 'button', 'the header entry is a button, not a link or a div')
    assert.equal(element.props.className, 'dsh-pet-sound')
    assert.equal(element.props['data-pet-sound'], 'off', 'the state is on the element, not only in the picture')
    assert.equal(element.props['aria-pressed'], 'false')
    assert.equal(element.props.title, '开启桌宠播报', 'the tooltip says what pressing it will do')
    assert.equal(element.props.disabled, true, 'it waits for the stored setting before it can write one')
    const icon = element.children[0]
    // The stub React does not render, so the icon is invoked the way the renderer would.
    const glyph = icon.type({ ...icon.props, on: false })
    assert.equal(glyph.type, 'svg')
    assert.equal(glyph.props.fill, 'currentColor', 'the glyph takes the header colour rather than its exported grey')
    assert.equal(glyph.props.viewBox, '0 0 30 23.41747283935547', 'the off state is the crossed speaker')
    const lit = icon.type({ ...icon.props, on: true })
    assert.equal(lit.props.viewBox, '0 0 30 23', 'the on state is the speaker with waves')
  } finally {
    panel.close()
  }
})

test('the sound toggle keeps the official header metrics and writes the setting it owns', () => {
  const source = readFileSync(new URL('../dist/client.js', import.meta.url), 'utf8')
  assert.match(source, /conversation\.session\.header\.utilities/)
  assert.match(source, /desktop-pet-sound/)
  assert.match(source, /\.dsh-pet-sound\{[^}]*width:28px;height:28px;padding:6px[^}]*color:var\(--dsw-alias-label-tertiary\)/)
  assert.match(source, /\.dsh-pet-sound:hover\{[^}]*background:var\(--dsw-alias-interactive-bg-hover\)/)
  assert.match(source, /\.dsh-pet-sound\[aria-pressed="true"\]\{color:var\(--dsw-alias-label-primary\)\}/)
  assert.match(source, /api\(["']settings["'], \{ \.\.\.stored, broadcastEnabled: next \}\)/, 'the toggle reads the stored settings before it writes')
  assert.doesNotMatch(source, /broadcastEnabled: isOn\(/, 'the panel no longer writes the setting the header owns')
})

// The picker's watchers tear down through the shell's module table, which this stub cannot provide.
setTimeout(() => process.exit(process.exitCode ?? 0), 500)
