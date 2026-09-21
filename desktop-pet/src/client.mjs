/**
 * Companion picker with persistent basic preferences, contributed the way the official plugin manager
 * is: a `sidebar.panellist` entry beside Plugins and the `main` panel that entry selects. The panel
 * replaces the conversation column instead of floating a dialog over it, and the settings inside save
 * themselves, so no Save button exists.
 */
import { mountModelManager } from './model-manager.mjs'
import { mountConversationSettings } from './conversation-settings.mjs'
import { mountActionDebug } from './action-debug.mjs'
import { PANEL_STYLE } from './panel-style.mjs'
import { createSelectionSpeak } from './selection-speak.mjs'

export const name = 'desktop-pet-client'
/** The slots registry owns both contributions; the layout service selects the panel the entry names. */
export const inject = ['slots', 'layout', 'sessions']
/** The id shared by the sidebar entry and the main panel it opens. */
const PANEL_ID = 'desktop-pet'

/**
 * Render the sidebar entry's glyph. The primitive catalog ships no pet icon, so this draws a paw on the
 * official 16 grid in the official outline style: `fill="none"`, a 1.2px currentColor stroke, and round
 * joins, so it reads as the same family as the stroke icons beside it.
 * @param props - the sidebar's icon share.
 * @returns the icon element.
 */
function PetPanelIcon({ size }) {
  const React = require('react')
  const ellipse = (cx, cy, rx, ry) => React.createElement('ellipse', { key: `${cx}-${cy}`, cx, cy, rx, ry })
  return React.createElement('svg', {
    width: size, height: size, viewBox: '0 0 16 16', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.2, 'aria-hidden': true,
  },
  ellipse(4.4, 5.5, 1.55, 1.95),
  ellipse(8, 3.9, 1.55, 1.95),
  ellipse(11.6, 5.5, 1.55, 1.95),
  ellipse(8, 11.2, 3.15, 2.5))
}


/** @param path - one `/desktop-pet/api` route. @param body - the JSON body for a POST. @returns the host's JSON answer. */
async function api(path, body) {
  const response = await fetch(`/desktop-pet/api/${path}`, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const value = await response.json()
  if (!response.ok) throw new Error(value.error)
  return value
}

/**
 * The idle speaker, supplied as an SVG by the person who reported that the previous glyph looked smaller than the
 * icons beside it (2026-09-20).
 *
 * That size difference was not a CSS one: the hand-drawn speaker occupied only about two thirds of its 16 grid, so
 * the strip's own 15px rule rendered it visibly smaller than copy and share. This artwork fills its own 31x25 box,
 * and the box is kept verbatim so the glyph's proportions survive, which is what makes it read at the strip's
 * weight. It is a filled outline rather than a stroke: the path traces the speaker's edge and cuts the cone out,
 * the same way the catalogue's own filled icons are built.
 */
const READOUT_SPEAKER_VIEWBOX = '0 0 31 25'
const READOUT_SPEAKER = [
  'M13.83812,0.65637046C14.825261,-0.071926124,16.127447,-0.20439202,17.239569,0.31035504C18.35169,0.82510209,19.098766,1.9060704,19.191008,3.133961C19.660484,9.3690577,19.660484,15.63094,19.191008,21.866039C19.098766,23.093927,18.35169,24.174896,17.239569,24.689644C16.127447,25.204391,14.82526,25.071928,13.838119,24.343628L6.9722991,19.278631L3.6600192,19.278631C2.0771675,19.27865,0.70767713,18.170486,0.36863032,16.615307L0.33897814,16.464144C0.11395912,15.154883,0.00055402151,13.828682,0,12.499999C0,11.178165,0.11321729,9.8563318,0.33897802,8.5358543C0.6172173,6.909575,2.0194516,5.7212214,3.6600192,5.721365L6.9716253,5.721365L13.83812,0.65637046ZM16.320139,2.9231455C16.086529,2.6754725,15.706256,2.641201,15.432595,2.8431578L8.2102747,8.1704865C7.9790344,8.3409986,7.6997595,8.4328947,7.4130378,8.4328184L3.6593454,8.4328184C3.3314703,8.4329653,3.0512793,8.6704483,2.9955413,8.9954453C2.7965083,10.152903,2.6961792,11.325353,2.6956499,12.499999C2.6956499,13.66728,2.7953889,14.835238,2.9955409,16.004553C3.0513222,16.329803,3.3318892,16.567362,3.6600187,16.567181L7.4130378,16.567181C7.6997595,16.567102,7.9790354,16.658998,8.2102757,16.829512L15.432596,22.157516C15.630114,22.303001,15.890533,22.3293,16.11286,22.226217C16.33519,22.123131,16.484457,21.906878,16.502771,21.661322C16.961998,15.562505,16.961998,9.4374886,16.502771,3.3386734C16.493422,3.2123365,16.449064,3.0911627,16.374727,2.9888961L16.320139,2.9231455ZM29.210737,4.7323632C30.392134,7.1490598,31.004368,9.8069515,30.999977,12.499999C31.003069,15.192898,30.390903,17.850496,29.210739,20.267635C28.881979,20.939079,28.074509,21.21557,27.406752,20.885347C26.738995,20.55512,26.463558,19.743109,26.791393,19.071207C27.790915,17.02681,28.30862,14.778229,28.304325,12.499999C28.307316,10.221917,27.789679,7.973629,26.791393,5.9287915C26.462492,5.256722,26.73773,4.443717,27.406046,4.1132183C28.07436,3.7827194,28.882492,4.059968,29.210737,4.7323632ZM24.687437,7.8288426C25.297382,9.3096657,25.610456,10.897113,25.608677,12.499999C25.608677,14.122805,25.293285,15.702903,24.687439,17.171154C24.392143,17.846121,23.614649,18.159891,22.937447,17.877392C22.260241,17.594891,21.931719,16.819738,22.198006,16.132668C22.672022,14.981009,22.915018,13.746453,22.913027,12.499999C22.913027,11.235784,22.667723,10.008173,22.198008,8.8673296C21.931721,8.1802616,22.260242,7.4051089,22.93745,7.1226068C23.614653,6.8401055,24.392147,7.1538754,24.687437,7.8288426Z',
]
/** The four bars of the playing state, left to right; the stylesheet animates their height. */
const READOUT_BARS = [1.6, 5.2, 8.8, 12.4]
/** Each bar starts its own rise a little later, which is what makes the four read as a waveform. */
const READOUT_BAR_DELAYS = [0, 0.14, 0.28, 0.42]

/**
 * @param props - whether the message is being spoken right now.
 * @returns a speaker at rest, and a waveform while it plays, so the two states are distinguished by shape and not
 *   only by colour.
 */
function ReadoutIcon({ playing }) {
  const React = require('react')
  if (playing) return React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': true },
    READOUT_BARS.map((x, index) => React.createElement('rect', {
      key: x, className: 'dsh-pet-readout-bar', x, y: 3, width: 2, height: 10, rx: 1, fill: 'currentColor',
      style: { animationDelay: `${String(READOUT_BAR_DELAYS[index])}s` },
    })))
  return React.createElement('svg', {
    width: 16, height: 16, viewBox: READOUT_SPEAKER_VIEWBOX, fill: 'currentColor', 'aria-hidden': true,
  }, READOUT_SPEAKER.map((d, index) => React.createElement('path', { key: d, d })))
}

/**
 * Styles for the read-out control: the official action-strip button, taken from the strip's own stylesheet
 * (`ui-chat/src/client/chat/MessageIconActions.module.css`) — a 28px round action with 6px padding, a 15px glyph,
 * `label-tertiary` at rest and `label-secondary` on hover. The plugin previously painted `label-caption`, one tier
 * too faint, which is why the control looked washed out beside copy and share (reported 2026-09-20).
 */
const READOUT_STYLE = `
.dsh-pet-readout{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;width:28px;height:28px;padding:6px;border:0;border-radius:28px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.dsh-pet-readout svg{width:15px;height:15px}
.dsh-pet-readout:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.dsh-pet-readout:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dsh-pet-readout:disabled{cursor:default;opacity:.4}
.dsh-pet-readout[data-playing="true"],.dsh-pet-readout[data-playing="true"]:hover:not(:disabled){color:var(--dsw-alias-state-business-primary)}
.dsh-pet-readout-bar{transform-box:fill-box;transform-origin:center;animation:dsh-pet-readout-bar .9s ease-in-out infinite alternate both}
@keyframes dsh-pet-readout-bar{from{transform:scaleY(.35)}to{transform:scaleY(1)}}
@media (prefers-reduced-motion:reduce){.dsh-pet-readout-bar{animation:none;transform:scaleY(.7)}}
`

/**
 * The shared read-out state: one event stream for the whole window, and the set of messages it is speaking.
 * Every per-message control subscribes to this instead of opening its own connection.
 *
 * A read-out is owned by one control at a time — a message, or the selection — and the host names that owner in
 * every event. `has` answers for one control, `anyPlaying` for the whole pet: a person reading a selection sees the
 * message strip light up too, because both are the same voice and the same queue.
 * @returns the store: `has`, `anyPlaying`, `isPending`, `subscribe`, `stop`, and `toggle`/`settle` fed by the host.
 */
function readoutStore() {
  const playing = new Set(), listeners = new Set(), pending = new Set()
  const notify = () => { for (const listener of listeners) listener() }
  let stream
  const ensureStream = () => {
    if (stream) return
    stream = new EventSource('/desktop-pet/api/conversation/events?role=chat')
    stream.addEventListener('readout', event => {
      const value = JSON.parse(event.data)
      if (value.messageId) { playing.add(value.messageId); pending.delete(value.messageId) } else { playing.clear() }
      if (value.state === 'idle' && value.messageId) playing.delete(value.messageId)
      notify()
    })
  }
  return {
    has: messageId => playing.has(messageId),
    anyPlaying: () => playing.size > 0,
    isPending: messageId => pending.has(messageId),
    subscribe(listener) { ensureStream(); listeners.add(listener); return () => { listeners.delete(listener); if (!listeners.size) { stream?.close(); stream = undefined } } },
    toggle(messageId) { pending.add(messageId); notify() },
    settle(messageId) { pending.delete(messageId); notify() },
    // Cancelling belongs to whoever holds the voice, not to one control: the strip's stop clears every owner at
    // once, so a selection still playing cannot leave the button lit. The host confirms with an idle event.
    stop() { if (!playing.size) return; playing.clear(); notify() },
  }
}

/**
 * Build the picker inside one container and own everything it starts.
 * @param container - the panel host element.
 * @param session - the app-level native lease the panel reads and toggles.
 * @returns a disposer that releases previews, media, and the container.
 */
function mountPicker(container, session) {
  const { pet, command, setVisible } = session
  const host = document.createElement('div'); host.dataset.plugin = 'desktop-pet'
  const shadow = host.attachShadow({ mode: 'open' })
  // Every class comes from the shared stylesheet; a bare control name here reached the voice page's markup
  // through the same shadow root and collapsed one of its rows (see panel-style.mjs).
  shadow.innerHTML = `<style>${PANEL_STYLE}</style>
      <div class="pet-shell"><div class="pet-page"><header class="pet-pageHead"><div><h2 id="pet-title" class="pet-title">桌面伙伴</h2><p class="pet-intro">挑一位喜欢的伙伴，陪你一起工作。</p></div>
      <div class="pet-pageActions"><span id="status" class="pet-status" role="status"></span><span class="pet-visibility"><span id="visibility-label" class="pet-label">显示伙伴</span><button id="visibility" class="pet-switch" type="button" role="switch" aria-checked="false" aria-labelledby="visibility-label" title="显示或隐藏桌面伙伴"><span class="pet-thumb"></span></button></span></div></header><nav></nav>
      <div class="pet-pageBody"><div class="pet-body"><aside id="library" class="pet-library"></aside><section class="pet-detail" aria-label="当前角色与设置"><div class="pet-portrait"><iframe id="model-preview" class="pet-preview" title="角色立绘" src="about:blank"></iframe></div><h3 id="character-name" class="pet-characterTitle">正在加载伙伴…</h3><p id="character-subtitle" class="pet-characterSubtitle"></p>
      <div class="pet-field"><label class="pet-sizeLabel" for="height"><span class="pet-label">角色显示大小</span><output id="height-value" class="pet-sizeValue"></output></label><input id="height" class="pet-range" type="range" min="180" max="1000" step="10"></div>
      <div class="pet-detailGrid"><div class="pet-switchRow"><span id="animated-label" class="pet-label">开启动画</span><button id="animated" class="pet-switch" type="button" role="switch" aria-checked="false" aria-labelledby="animated-label"><span class="pet-thumb"></span></button></div><div class="pet-switchRow"><span id="alwaysOnTop-label" class="pet-label">保持在窗口上方</span><button id="alwaysOnTop" class="pet-switch" type="button" role="switch" aria-checked="false" aria-labelledby="alwaysOnTop-label"><span class="pet-thumb"></span></button></div>
      <div class="pet-switchRow"><span id="broadcastEnabled-label" class="pet-label">播报主对话</span><button id="broadcastEnabled" class="pet-switch" type="button" role="switch" aria-checked="false" aria-labelledby="broadcastEnabled-label"><span class="pet-thumb"></span></button></div></div>
      <p class="pet-hintLine">播报主对话时，桌宠念出 Harness 里大模型说给你听的那部分文字（思考与工具调用不念），气泡只保留最近几句。</p>
      <p class="pet-hintLine">轻轻摸头、点击互动，按住角色即可拖动。</p></section></div></div>
      </div></div>`
  container.append(host)
  const find = id => shadow.getElementById(id)
  const tabs = shadow.querySelector('nav'); tabs.className = 'pet-tabs'
  const TAB_LABELS = [['partner', '伙伴'], ['conversation', '对话'], ['prompts', 'Prompt 管理'], ['intimacy', '亲密度'], ['actions', '动作与关键词'], ['voice', '声音'], ['history', '聊天记录']]
  tabs.setAttribute('role', 'tablist')
  for (const [id, label] of TAB_LABELS) { const button = document.createElement('button'); button.className = 'pet-tab'; button.type = 'button'; button.setAttribute('role', 'tab'); button.dataset.tab = id; button.textContent = label; tabs.append(button) }
  tabs.setAttribute('aria-label', '桌宠设置分类')
  // Same contract as the conversation header's strip: the selected tab is aria-selected, never a class.
  const selectTab = tab => { for (const button of tabs.querySelectorAll('button')) button.setAttribute('aria-selected', String(button.dataset.tab === tab)) }
  selectTab('partner')
  const voiceRoot = document.createElement('section'); voiceRoot.className = 'pet-voice'; voiceRoot.hidden = true; shadow.querySelector('.pet-pageBody').append(voiceRoot)
  const history = document.createElement('iframe'); history.className = 'pet-history'; history.title = '聊天记录与高级对话'; history.allow = 'microphone'; history.src = 'about:blank'; history.hidden = true; shadow.querySelector('.pet-pageBody').append(history)
  let selectedTab = 'partner'
  let disposed = false, settings, saveTimer, statusTimer
  const status = text => { if (!disposed) find('status').textContent = text }
  // Both switches are buttons carrying aria-checked, the official switch contract: the state is read from
  // the attribute the accessibility tree exposes, so the picture cannot disagree with it.
  const isOn = id => find(id).getAttribute('aria-checked') === 'true'
  const setOn = (id, value) => find(id).setAttribute('aria-checked', String(value === true))
  const voiceSettings = mountConversationSettings(voiceRoot, status, async () => { await command({ action: 'show' }); await new Promise(resolve => setTimeout(resolve, 600)) })
  tabs.onclick = async event => {
    try {
      const tab = event.target.closest('[data-tab]')?.dataset.tab; if (!tab) return
      selectTab(tab)
      actionDebug.suspend(); selectedTab = tab; shadow.querySelector('.pet-body').hidden = tab !== 'partner'; voiceRoot.hidden = ['partner', 'history'].includes(tab); history.hidden = tab !== 'history'; history.src = tab === 'history' ? '/desktop-pet/chat' : 'about:blank'; voiceSettings.show(tab)
      if (tab !== 'partner') { find('model-preview').src = 'about:blank'; if (tab !== 'history') { await voiceSettings.load() } }
      else preview(await library.refresh())
    } catch (error) { status(error.message) }
  }
  const debugRoot = document.createElement('div'); shadow.querySelector('.pet-detail').append(debugRoot)
  const actionDebug = mountActionDebug(debugRoot, { api, status, animated: () => settings?.animated })
  /** The switch mirrors the app-level lease, so its state always comes from a command result. */
  const applyVisibility = visible => {
    const control = find('visibility')
    control.setAttribute('aria-checked', String(visible))
    control.title = visible ? '隐藏桌面伙伴' : '显示桌面伙伴'
  }
  applyVisibility(pet.visible)
  pet.listeners.add(applyVisibility)
  const preview = model => {
    if (disposed || !model || selectedTab !== 'partner') return
    find('character-name').textContent = model.name; find('character-subtitle').textContent = model.subtitle
    find('model-preview').src = `/desktop-pet/view?preview=1&model=${encodeURIComponent(model.id)}`
    void actionDebug.load(model.id)
  }
  let updates = Promise.resolve()
  const updateSettings = patch => {
    const result = updates.then(async () => { settings = await api('settings', { ...settings, ...patch }); pet.settings = settings })
    updates = result.catch(() => {})
    return result
  }
  const configure = async () => { if (pet.attached) await command({ action: 'configure', height: settings.height, alwaysOnTop: settings.alwaysOnTop }) }
  const wardrobe = document.createElement('div'); wardrobe.className = 'pet-outfit'; find('character-subtitle').after(wardrobe)
  const library = mountModelManager(find('library'), { wardrobe, api, selected: () => settings?.modelId, status, select: async model => {
    actionDebug.suspend()
    // Save only the character here; unconfirmed size and toggle edits stay in their controls.
    await updateSettings({ modelId: model.id })
    if (disposed) return
    preview(model)
    await configure()
    if (attached) await command({ action: 'show' })
  } })
  const ready = (async () => {
    settings = await api('settings')
    pet.settings = settings
  })()
  ready.catch(error => status(error.message))
  const run = action => async () => { try { await ready; if (!disposed) await action() } catch (error) { status(error.message) } }
  // The panel mounts instead of a dialog opening, so the first paint is where the form is filled in. The
  // partner controls stay disabled until the stored settings land: they save on change, so a click on a
  // not-yet-filled control would write the template's default over the stored value.
  const partnerControls = ['height', 'animated', 'alwaysOnTop', 'broadcastEnabled'].map(find)
  const partnerEnabled = enabled => { for (const control of partnerControls) control.disabled = !enabled }
  partnerEnabled(false)
  const enter = run(async () => {
    library.resume(); status('')
    if (selectedTab === 'history') history.src = '/desktop-pet/chat'; else if (selectedTab !== 'partner') { voiceSettings.show(selectedTab); await voiceSettings.load() }
    settings = await api('settings')
    if (disposed) return
    find('height').value = settings.height; find('height-value').value = `${settings.height} px`
    for (const key of ['animated', 'alwaysOnTop', 'broadcastEnabled']) setOn(key, settings[key])
    partnerEnabled(true)
    preview(await library.refresh())
  })
  // No Save button: each control lands its own change, and the slider coalesces while it is dragged.
  const flashSaved = () => {
    status('已保存。')
    clearTimeout(statusTimer)
    statusTimer = setTimeout(() => { if (!disposed) status('') }, 1500)
  }
  const saveSelected = async () => {
    if (selectedTab === 'history') return
    if (selectedTab !== 'partner') { await voiceSettings.save(); flashSaved(); return }
    await updateSettings({
      height: Number(find('height').value), animated: isOn('animated'), alwaysOnTop: isOn('alwaysOnTop'),
      broadcastEnabled: isOn('broadcastEnabled'),
      // The host refuses a sentence count outside its own range, so a half-typed number never leaves the panel.
    })
    if (disposed) return
    await configure()
    flashSaved()
  }
  const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { void run(saveSelected)() }, 300) }
  find('height').oninput = () => { find('height-value').value = `${find('height').value} px`; saveSoon() }
  find('height').onchange = () => { void run(saveSelected)() }
  for (const key of ['animated', 'alwaysOnTop', 'broadcastEnabled']) find(key).onclick = () => { setOn(key, !isOn(key)); void run(saveSelected)() }
  // Delegated because those pages rebuild their own controls; change (not input) keeps a key field from
  // hitting the network on every keystroke.
  voiceRoot.addEventListener('change', saveSoon)
  find('visibility').onclick = run(async () => {
    const next = pet.visible !== true
    const result = await command({ action: next ? 'show' : 'hide' })
    setVisible(result?.visible ?? next)
    status(next ? '伙伴已显示。' : '伙伴已隐藏。')
  })
  void enter()
  return () => {
    disposed = true; clearTimeout(saveTimer); clearTimeout(statusTimer)
    actionDebug.suspend(); history.src = 'about:blank'; library.suspend(); voiceSettings.suspend(); find('model-preview').src = 'about:blank'
    actionDebug.dispose(); library.dispose(); voiceSettings.dispose(); pet.listeners.delete(applyVisibility)
    host.remove()
  }
}

export function apply(ctx) {
  // One native lease for the whole app: the pet must be on screen before anyone opens the settings panel,
  // and the panel only reads or toggles that state.
  const lease = crypto.randomUUID()
  const desktop = window.harnessDesktop
  const command = value => desktop?.petCommand({ ...value, lease }) ?? Promise.reject(new Error('请在 Harness 桌面 App 中使用桌宠窗口'))
  const pet = { settings: undefined, attached: false, visible: false, listeners: new Set() }
  const setVisible = visible => { if (pet.visible === visible) return; pet.visible = visible; for (const listener of pet.listeners) listener(visible) }
  ctx.effect(() => {
    if (!desktop?.petCommand) return () => {}
    let cancelled = false
    const attach = async () => {
      try {
        const settings = pet.settings ?? await api('settings')
        pet.settings = settings
        const result = await command({ action: 'attach', height: settings.height, alwaysOnTop: settings.alwaysOnTop })
        if (cancelled) { void command({ action: 'detach' }).catch(() => {}); return }
        pet.attached = true
        setVisible(result?.visible === true)
      } catch (error) { console.warn('[desktop-pet] 附着原生窗口失败:', error) }
    }
    void attach()
    const react = event => { if (['touch', 'click'].includes(event.detail?.action)) void command({ action: 'react', reaction: event.detail.action }).catch(() => {}) }
    const unload = () => { if (!pet.attached) return; pet.attached = false; void command({ action: 'detach' }).catch(() => { /* 原生侧在导航时也会释放。 */ }) }
    window.addEventListener('dsh-desktop-pet:react', react)
    window.addEventListener('pagehide', unload)
    return () => { cancelled = true; window.removeEventListener('dsh-desktop-pet:react', react); window.removeEventListener('pagehide', unload); unload() }
  }, 'desktop-pet: native window lease')
  // The model output the pet reads is the conversation on screen. `retainedBy.mainView` is the shell's own
  // public signal for which session the main view holds, so the choice needs no private service: report it on
  // every change and let the host broadcast that session alone.
  ctx.effect(() => {
    let reported
    const report = () => {
      const list = ctx.sessions.list.getSnapshot()
      const active = Object.entries(list?.byId ?? {}).find(([, row]) => (row?.retainedBy?.mainView ?? 0) > 0)?.[0]
      if (active === reported) return
      reported = active
      void fetch('/desktop-pet/api/broadcast/focus', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: active ?? null }) }).catch(() => { /* 宿主未就绪时下次变化会再报。 */ })
    }
    report()
    return ctx.sessions.list.subscribe(report)
  }, 'desktop-pet: broadcast focus')
  const disposeEntry = ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 1,
    label: () => '桌宠',
  }, PetPanelIcon))
  /** The layout renders this only while the panel is active; it mounts the picker and owns its disposer. */
  const PetPanel = () => {
    const React = require('react')
    const host = React.useRef(null)
    React.useEffect(() => mountPicker(host.current, { pet, command, setVisible }), [])
    return React.createElement('div', { ref: host, className: 'dsh-pet-panel-host', style: { display: 'flex', width: '100%', height: '100%', minHeight: 0 } })
  }
  const disposePanel = ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
  }, PetPanel))
  // The per-message read-out control lives in the official assistant action strip, beside copy and share: the
  // slot hands each entry the durable message id, and the host owns the voice, the queue, and the state.
  const readout = readoutStore()
  ctx.effect(() => {
    if (document.getElementById('dsh-pet-readout-style')) return () => {}
    const style = document.createElement('style'); style.id = 'dsh-pet-readout-style'; style.textContent = READOUT_STYLE
    document.head.append(style)
    return () => { style.remove() }
  }, 'desktop-pet: read-out styles')
  const ReadoutAction = ({ messageId, sessionId }) => {
    const React = require('react')
    const [, force] = React.useReducer(value => value + 1, 0)
    const [failed, setFailed] = React.useState(false)
    React.useEffect(() => readout.subscribe(force), [])
    // One button, two jobs, and which one it has is decided by whether the pet is speaking at all: at rest it reads
    // this reply out; while anything plays — this reply, another message, or a selection read aloud from the pill —
    // it is the stop control for the whole voice. There is one speaker and one queue, so a button that cancels only
    // "its own" read-out would leave a selection playing with the strip still lit (reported 2026-09-20).
    const speaking = readout.anyPlaying(), waiting = readout.isPending(messageId)
    const post = (url, body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(response => { if (!response.ok) return response.json().then(value => { throw new Error(value.error ?? '播报失败') }) })
      .catch(() => setFailed(true))
    const toggle = () => {
      setFailed(false)
      if (speaking) {
        // Clear first so the icon answers the press immediately; `/conversation/stop` then aborts the queue and
        // publishes the idle state that every other control follows.
        readout.stop()
        void post('/desktop-pet/api/conversation/stop', { speechOnly: true })
        return
      }
      readout.toggle(messageId)
      void post('/desktop-pet/api/broadcast/message', { sessionId, messageId }).finally(() => readout.settle(messageId))
    }
    return React.createElement('button', {
      type: 'button',
      className: 'dsh-pet-readout',
      'data-playing': String(speaking),
      title: speaking ? '停止朗读' : '用桌宠的声音播报这条回复',
      'aria-label': speaking ? '停止朗读' : '播报这条回复',
      'aria-pressed': String(speaking),
      disabled: waiting,
      onClick: toggle,
    }, React.createElement(ReadoutIcon, { playing: speaking }), failed ? React.createElement('span', { className: 'dsh-pet-readout-error', hidden: true }, '播报失败') : null)
  }
  const disposeReadout = ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
    name: 'conversation.chat.assistant-actions',
    id: 'desktop-pet-readout',
    order: 20,
    inject: sessionId => ({ sessionId }),
  }, ReadoutAction))
  // Reading a selection aloud, offered in the two places the person can select text: the conversation panel gets a
  // floating pill, and the file browser — which already floats its own bubble over a selection — gets the same
  // action contributed into that bubble, so 引用 and 朗读 sit side by side instead of two plugins racing for the
  // same coordinates.
  const selectionSpeak = createSelectionSpeak({ api, readout, React: require('react') })
  ctx.effect(() => {
    if (document.getElementById('dsh-pet-speak-style')) return () => {}
    const style = document.createElement('style'); style.id = 'dsh-pet-speak-style'; style.textContent = selectionSpeak.style
    document.head.append(style)
    return () => { style.remove() }
  }, 'desktop-pet: selection read-aloud styles')
  ctx.effect(() => selectionSpeak.mountConversation(), 'desktop-pet: selection read-aloud pill')
  ctx.inject(['dshFileEditSelectionActions'], scope => {
    scope.effect(() => scope.dshFileEditSelectionActions.register({
      id: 'desktop-pet-speak',
      order: 20,
      pill: selectionSpeak.pill,
    }), 'desktop-pet: file browser selection action')
  })
  // The pet window's own menu asks to open these settings: the entry's panel is the settings page now.
  const unsubscribe = window.harnessDesktop?.onPetSettings?.(() => { ctx.layout.selectPanel(PANEL_ID) })
  ctx.effect(() => () => { unsubscribe?.(); disposeReadout(); disposePanel(); disposeEntry() }, 'desktop-pet: sidebar entry and panel')
}
