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
import { mountSpeechPlayer } from './speech-player.mjs'

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
/**
 * The sound toggle in the conversation header, from the icons supplied for it: one speaker with waves, one with a
 * cross. Both are single paths on a 30-unit grid, painted with `currentColor` so the header's own ink tokens decide
 * their colour instead of the grey they were exported with.
 */
const SOUND_ON_VIEWBOX = '0 0 30 23'
const SOUND_ON = [
  'M6.0524993,4.9060459L13.631248,0.2785936C14.509498,-0.25745472,15.665999,0.0033352838,16.214998,0.86101329C16.401373,1.1522232,16.499998,1.4886909,16.499998,1.8318362L16.499998,21.168159C16.499998,22.180161,15.660374,23,14.624999,23C14.273623,23,13.929375,22.903549,13.631248,22.721775L6.0524993,18.09395L2.6249995,18.09395C1.1752497,18.09395,0,16.945805,0,15.529449L0,7.4705462C0,6.0541911,1.1752497,4.9060459,2.6249995,4.9060459L6.0524993,4.9060459ZM6.9712496,6.9370942C6.7919888,7.0463486,6.5855508,7.1041465,6.375,7.1040297L2.6249995,7.1040297C2.4179997,7.1040297,2.2499995,7.2679973,2.2499995,7.4705453L2.2499995,15.52982C2.2499995,15.731998,2.4179997,15.896337,2.6249995,15.896337L6.3749986,15.896337C6.5857482,15.896337,6.7923741,15.954207,6.9712486,16.063271L14.249998,20.507097L14.249998,2.4929008L6.9712496,6.9370942ZM25.156874,22.547419C24.708073,22.969206,24.000408,22.957487,23.566124,22.52108C23.133926,22.086746,23.146095,21.386114,23.593124,20.966724C29.135624,15.733853,29.135624,7.2653999,23.593124,2.0325274C23.146351,1.6131757,23.134182,0.91283625,23.566124,0.47854346C24.000404,0.042136021,24.708073,0.030418748,25.156874,0.45220459C31.614372,6.5490603,31.614372,16.450562,25.156874,22.547419ZM21.398624,18.158871C20.945475,18.576361,20.237701,18.557547,19.807875,18.116579C19.380789,17.67774,19.400385,16.977749,19.851374,16.562967C22.882874,13.759565,22.882874,9.2400627,19.851374,6.4362884C19.400385,6.0215077,19.380789,5.3215141,19.807875,4.8826752C20.237701,4.4417095,20.945475,4.422894,21.398624,4.8403845C25.367249,8.5111113,25.367249,14.488514,21.398624,18.159241L21.398624,18.158871Z',
]
const SOUND_OFF_VIEWBOX = '0 0 30 23.41747283935547'
const SOUND_OFF = [
  'M2.2222173,8.1601896L2.2222173,15.134619L7.3999834,15.134619L13.492191,19.997942L13.492191,3.4279783L7.5966501,8.1601896L2.2222173,8.1601896ZM6.8144288,5.9379725L13.907745,0.24465188C14.24111,-0.022955419,14.698439,-0.075580634,15.083872,0.10931361C15.469308,0.29420787,15.714488,0.68383014,15.71441,1.1113168L15.71441,22.306826C15.714227,22.733679,15.469533,23.12269,15.084853,23.307688C14.700172,23.492683,14.243522,23.440954,13.909969,23.174603L6.6210966,17.356836L1.1111087,17.356836C0.49746031,17.356836,0,16.859375,0,16.245728L0,7.0490813C-1.3245447e-7,6.4354324,0.49746031,5.9379725,1.1111087,5.9379725L6.8144288,5.9379725ZM23.888836,9.4824085L27.999937,4.0013103C28.36813,3.5103917,29.064571,3.4108992,29.555489,3.7790878C30.046408,4.1472759,30.145899,4.8437204,29.777714,5.33464L25.277721,11.334627L29.77771,17.334614C30.145899,17.825531,30.046406,18.521976,29.555489,18.890163C29.064569,19.258354,28.368126,19.158863,27.999937,18.667944L23.888834,13.186845L19.777731,18.667944C19.409346,19.158257,18.713367,19.257381,18.22274,18.889412C17.732117,18.521444,17.632402,17.825548,17.999956,17.334614L22.499945,11.334627L17.999956,5.3346415C17.631769,4.8437228,17.73126,4.1472783,18.222179,3.7790897C18.713097,3.4109011,19.409542,3.5103929,19.777731,4.0013113L23.888836,9.4824085Z',
]

/**
 * @returns the speaker for the current sound state, so on and off are told apart by shape as well as colour.
 */
function SoundIcon({ on }) {
  const React = require('react')
  const paths = on ? SOUND_ON : SOUND_OFF
  return React.createElement('svg', {
    width: 16, height: on ? 12.27 : 12.49, viewBox: on ? SOUND_ON_VIEWBOX : SOUND_OFF_VIEWBOX, fill: 'currentColor', 'aria-hidden': true,
  }, paths.map((d, index) => React.createElement('path', { key: index, d })))
}

/**
 * Styles for that toggle, matching the header's 28px round utilities (see
 * `ui-open-in-app/src/client/OpenInAppAction.module.css` for the row's metrics): a 28px box, a 16px glyph,
 * `label-tertiary` at rest, `label-secondary` on hover, and the primary ink while the pet is speaking the main
 * conversation.
 */
const SOUND_STYLE = `
.dsh-pet-sound{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;width:28px;height:28px;padding:6px;border:0;border-radius:28px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.dsh-pet-sound svg{display:block}
.dsh-pet-sound:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.dsh-pet-sound:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dsh-pet-sound[aria-pressed="true"]{color:var(--dsw-alias-label-primary)}
`

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
 * The stream is the plugin's single connection to the host (passed in, never opened here): a browser allows only a
 * handful of connections per origin, and every extra long-lived stream takes one away from the page's own assets —
 * which is what starved the settings panel's preview iframe (2026-09-21).
 * @param stream - the window's shared conversation stream.
 * @returns the store: `has`, `anyPlaying`, `isPending`, `subscribe`, `stop`, and `toggle`/`settle` fed by the host.
 */
function readoutStore(stream) {
  const playing = new Set(), listeners = new Set(), pending = new Set()
  const notify = () => { for (const listener of listeners) listener() }
  stream.addEventListener('readout', event => {
    const value = JSON.parse(event.data)
    if (value.messageId) { playing.add(value.messageId); pending.delete(value.messageId) } else { playing.clear() }
    if (value.state === 'idle' && value.messageId) playing.delete(value.messageId)
    notify()
  })
  return {
    has: messageId => playing.has(messageId),
    anyPlaying: () => playing.size > 0,
    isPending: messageId => pending.has(messageId),
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
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
      </div>
      <p class="pet-hintLine">播报主对话的开关在对话标题栏右侧（喇叭图标）：打开后桌宠念出 Harness 里大模型说给你听的那部分文字（思考与工具调用不念），气泡只显示伙伴自己的回复。</p>
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
      // Leaving the settings pages closes their stream: a browser gives only a few connections per origin, and one
      // left open for a page nobody is looking at starves the page that is (2026-09-21).
      if (tab === 'partner' || tab === 'history') voiceSettings.suspend()
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
  // The stored settings are read back before every write: the conversation header owns `broadcastEnabled` now, and
  // saving this panel's older copy would silently turn the pet's sound back off.
  const updateSettings = patch => {
    const result = updates.then(async () => { const stored = await api('settings'); settings = await api('settings', { ...stored, ...patch }); pet.settings = settings })
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
  const partnerControls = ['height', 'animated', 'alwaysOnTop'].map(find)
  const partnerEnabled = enabled => { for (const control of partnerControls) control.disabled = !enabled }
  partnerEnabled(false)
  const enter = run(async () => {
    library.resume(); status('')
    if (selectedTab === 'history') history.src = '/desktop-pet/chat'; else if (selectedTab !== 'partner') { voiceSettings.show(selectedTab); await voiceSettings.load() }
    settings = await api('settings')
    if (disposed) return
    find('height').value = settings.height; find('height-value').value = `${settings.height} px`
    for (const key of ['animated', 'alwaysOnTop']) setOn(key, settings[key])
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
    // `broadcastEnabled` is not written here any more: the conversation header owns that switch, and re-sending a
    // stale copy from this panel would fight it.
    await updateSettings({
      height: Number(find('height').value), animated: isOn('animated'), alwaysOnTop: isOn('alwaysOnTop'),
    })
    if (disposed) return
    await configure()
    flashSaved()
  }
  const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { void run(saveSelected)() }, 300) }
  find('height').oninput = () => { find('height-value').value = `${find('height').value} px`; saveSoon() }
  find('height').onchange = () => { void run(saveSelected)() }
  for (const key of ['animated', 'alwaysOnTop']) find(key).onclick = () => { setOn(key, !isOn(key)); void run(saveSelected)() }
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
  // One connection serves the whole window: the read-out store and the audio seat below both read from it. Two
  // streams here cost the page one of the browser's few same-origin connections (2026-09-21).
  const conversationEvents = new EventSource('/desktop-pet/api/conversation/events?role=page')
  ctx.effect(() => () => conversationEvents.close(), 'desktop-pet: conversation stream')
  const readout = readoutStore(conversationEvents)
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
  // Reading aloud needs a window to play in, and the Harness window is always there: this seat plays the pet's voice
  // while the pet itself is hidden, and stands by while the visible pet (which also drives its mouth) is attached.
  // The host hands each clip to exactly one of them.
  ctx.effect(() => {
    if (document.getElementById('dsh-pet-sound-style')) return () => {}
    const style = document.createElement('style'); style.id = 'dsh-pet-sound-style'; style.textContent = SOUND_STYLE
    document.head.append(style)
    return () => { style.remove() }
  }, 'desktop-pet: sound toggle styles')
  const pagePlayer = mountSpeechPlayer(undefined, message => { console.warn(`[desktop-pet] ${message}`) }, undefined, { role: 'page', events: conversationEvents })
  ctx.effect(() => () => pagePlayer(), 'desktop-pet: window read-out player')
  // The sound toggle belongs to the conversation, not to the settings page: it sits in the header's right-aligned
  // utilities, before the official ones (`order: -20` against open-in-app's -10), and shows the pet's own on/off
  // icons. It reads and writes the same `broadcastEnabled` setting the panel used to own.
  const SoundAction = () => {
    const React = require('react')
    const [settings, setSettings] = React.useState(null)
    React.useEffect(() => {
      let live = true
      void api('settings').then(value => { if (live) setSettings(value) }).catch(() => {})
      return () => { live = false }
    }, [])
    const on = settings?.broadcastEnabled === true
    const toggle = () => {
      if (!settings) return
      const next = !on
      setSettings({ ...settings, broadcastEnabled: next })
      // Read the current settings first: the panel edits size, animation and window preferences through the same
      // endpoint, and writing this button's older copy back would undo whichever of those changed last.
      void api('settings')
        .then(stored => api('settings', { ...stored, broadcastEnabled: next }))
        .then(saved => setSettings(saved))
        .catch(() => { void api('settings').then(setSettings).catch(() => {}) })
    }
    return React.createElement('button', {
      type: 'button',
      className: 'dsh-pet-sound',
      'data-pet-sound': on ? 'on' : 'off',
      'aria-pressed': String(on),
      title: on ? '关闭桌宠播报' : '开启桌宠播报',
      'aria-label': on ? '关闭桌宠播报' : '开启桌宠播报',
      disabled: settings === null,
      onClick: toggle,
    }, React.createElement(SoundIcon, { on }))
  }
  const disposeSound = ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: 'desktop-pet-sound',
    order: -20,
  }, SoundAction))
  // The pet window's own menu asks to open these settings: the entry's panel is the settings page now.
  // The shell reports the pet window's own shows and hides, so this panel's switch always mirrors reality.
  const unsubscribeVisibility = window.harnessDesktop?.onPetVisibility?.(visible => { setVisible(visible === true) })
  const unsubscribe = window.harnessDesktop?.onPetSettings?.(() => { ctx.layout.selectPanel(PANEL_ID) })
  ctx.effect(() => () => { unsubscribe?.(); unsubscribeVisibility?.(); disposeSound(); disposeReadout(); disposePanel(); disposeEntry() }, 'desktop-pet: sidebar entry and panel')
}
