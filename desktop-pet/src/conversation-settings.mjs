/**
 * Scoped settings form for the pet's private model and speech services. Every page renders into the pet
 * panel's shadow root and uses the classes from `panel-style.mjs`, so the official control geometry lives in
 * one place. Fields holding a short value sit two per row; only textareas and their explanations claim a
 * full line, which is what keeps a page of small settings from scrolling like a form of paragraphs.
 */
import { conversationApi as api } from './conversation-api.mjs'
import { mountActionPresetSettings } from './action-preset-settings.mjs'
import { mountIntimacySettings } from './intimacy-settings.mjs'

/**
 * Wrap one labelled control as a field.
 * @param text - the field's label.
 * @param control - the input, select, key row, or button.
 * @param options - `wide` spans both grid columns; `hint` adds an explanation under the control; `plain`
 *   skips the label element, for a field whose control is a button rather than something a label can name.
 * @returns the field wrapper.
 */
function field(text, control, options = {}) {
  const wrapper = document.createElement(options.plain ? 'div' : 'label')
  wrapper.className = options.wide ? 'pet-field pet-fieldWide' : 'pet-field'
  const label = document.createElement('span'); label.className = 'pet-label'; label.textContent = text
  wrapper.append(label, control)
  if (options.hint) { const hint = document.createElement('span'); hint.className = 'pet-hint'; hint.textContent = options.hint; wrapper.append(hint) }
  return wrapper
}

/**
 * @param tag - `input`, `textarea`, or `select`.
 * @param attributes - attributes to set; `true` sets a bare attribute. `class` names extra classes, which
 *   are appended to the official class for the control's kind rather than replacing it.
 * @returns the control, carrying the official class for its kind.
 */
function control(tag, { class: extra, ...attributes } = {}) {
  const element = document.createElement(tag)
  for (const [name, value] of Object.entries(attributes)) { if (value === true) element.setAttribute(name, ''); else element.setAttribute(name, value) }
  const base = tag === 'textarea' ? 'pet-textarea' : tag === 'select' ? 'pet-select' : 'pet-input'
  element.className = extra ? `${base} ${extra}` : base
  return element
}

/** @param text - the copy. @param className - the class naming the text's role. @returns a paragraph carrying it. */
function textElement(text, className = 'pet-hint') {
  const element = document.createElement('p'); element.className = className; element.textContent = text
  return element
}

/**
 * Build one switch row: the label keeps the free space, the official track sits at the end.
 * @param text - the row's label.
 * @param key - the settings key the row writes.
 * @returns the row.
 */
function switchRow(text, key) {
  const row = document.createElement('div'); row.className = 'pet-switchRow'
  const label = document.createElement('span'); label.className = 'pet-label'; label.textContent = text
  const button = document.createElement('button')
  button.type = 'button'; button.className = 'pet-switch'; button.setAttribute('role', 'switch')
  button.setAttribute('aria-checked', 'false'); button.dataset.switch = key
  const thumb = document.createElement('span'); thumb.className = 'pet-thumb'
  button.append(thumb); row.append(label, button)
  return row
}

/**
 * Build one credential row: the secret input plus its clear action.
 * @param key - the credential name (`llm`, `tts`, or `asr`).
 * @returns the row.
 */
function keyRow(key) {
  const input = control('input', { type: 'password', autocomplete: 'off' }); input.dataset.key = key
  const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'pet-btn pet-btnSm pet-btnOutline'; clear.dataset.clear = key; clear.textContent = '清除'
  const row = document.createElement('span'); row.className = 'pet-keyrow'; row.append(input, clear)
  return row
}

/**
 * @param root - the settings host.
 * @param status - the panel's status writer.
 * @param showPet - brings the native window forward for a voice sample.
 * @returns the page controller the picker drives.
 */
export function mountConversationSettings(root, status, showPet) {
  root.innerHTML = `<div class="pet-section" data-page="conversation"><p class="pet-hint">桌宠对话和情绪模拟共用这里的独立模型配置，不影响 Harness 主对话。</p><div class="pet-grid" data-conversation-fields></div></div>
    <div class="pet-section" data-page="prompts" hidden><div class="pet-grid" data-prompt-fields></div></div>
    <div class="pet-section" data-page="actions" hidden></div>
    <div class="pet-section" data-page="voice" hidden><div class="pet-grid" data-voice-fields></div></div>`
  // Assembled in code rather than as one markup string: a field, a key row, and a switch each need several
  // elements with the official classes, and building them here keeps the field order readable.
  const conversation = root.querySelector('[data-conversation-fields]')
  const baseUrl = control('input'); baseUrl.dataset.field = 'baseUrl'
  const endpoint = control('input', { placeholder: 'ep-…' }); endpoint.dataset.field = 'model'
  const testButton = document.createElement('button'); testButton.type = 'button'; testButton.className = 'pet-btn pet-btnOutline'; testButton.dataset.test = ''; testButton.textContent = '测试对话连接'
  conversation.append(field('方舟 API Key', keyRow('llm'), { hint: '留空保持不变；点清除后保存即删除。' }), field('Base URL', baseUrl), field('模型接入点', endpoint), field('连接测试', testButton, { plain: true }))

  const prompts = root.querySelector('[data-prompt-fields]')
  const prompt = control('textarea', { 'data-field': 'prompt', class: 'pet-textareaPrompt' })
  const emotionPrompt = control('textarea', { 'data-field': 'emotionPrompt', class: 'pet-textareaEmotion' })
  const insertEmotion = document.createElement('button'); insertEmotion.type = 'button'; insertEmotion.className = 'pet-btn pet-btnSm pet-btnOutline'; insertEmotion.dataset.insertEmotion = ''; insertEmotion.textContent = '插入 {{情绪模拟}}'
  const promptActions = document.createElement('div'); promptActions.className = 'pet-cardActions'; promptActions.append(insertEmotion)
  const promptField = field('对话 Prompt', prompt, { wide: true }); promptField.append(promptActions, textElement('在需要的位置写入 {{情绪模拟}}，回复时替换为最新已完成的情绪文本。旧 Prompt 原样保留；未填写变量时不会自动注入。'))
  const insertHistory = document.createElement('button'); insertHistory.type = 'button'; insertHistory.className = 'pet-btn pet-btnSm pet-btnOutline'; insertHistory.dataset.insertHistory = ''; insertHistory.textContent = '插入 {{聊天记录}}'
  const emotionActions = document.createElement('div'); emotionActions.className = 'pet-cardActions'; emotionActions.dataset.promptActions = ''; emotionActions.append(insertHistory)
  const emotionField = field('情绪模拟 Prompt', emotionPrompt, { wide: true }); emotionField.append(emotionActions, textElement('{{聊天记录}} 按时间顺序包含双方消息，8 条就是双方消息合计 8 条。未填写变量时不会注入聊天记录。'))
  const characterName = control('input'); characterName.dataset.field = 'emotionCharacterName'
  const historyMessages = control('input', { type: 'number', min: '1', max: '100' }); historyMessages.dataset.field = 'emotionHistoryMessages'
  const emotionHeading = document.createElement('h3'); emotionHeading.className = 'pet-sectionTitle pet-fieldWide'; emotionHeading.textContent = '当前情绪'
  const emotionStatus = document.createElement('p'); emotionStatus.className = 'pet-hint pet-fieldWide'; emotionStatus.dataset.emotionStatus = ''; emotionStatus.setAttribute('role', 'status')
  const emotionText = document.createElement('div'); emotionText.className = 'pet-emotionText pet-fieldWide'; emotionText.dataset.emotionText = ''
  prompts.append(promptField, emotionField, field('聊天记录中的角色称呼', characterName), field('情绪参考最近几条消息', historyMessages),
    textElement('首次无记录时先根据用户消息生成情绪；之后每次回复完成在后台更新，供下一轮使用。情绪文本不进入聊天记录，也不朗读。'),
    emotionHeading, emotionStatus, emotionText)

  const voice = root.querySelector('[data-voice-fields]')
  const voiceKind = control('select', { 'data-field': 'voiceKind' })
  for (const [value, text] of [['default', '默认音色'], ['clone', '克隆音色']]) { const option = document.createElement('option'); option.value = value; option.textContent = text; voiceKind.append(option) }
  const defaultVoice = control('select'); defaultVoice.dataset.defaultVoice = ''
  for (const [value, text] of [['zh_female_gaolengyujie_uranus_bigtts', '高冷御姐'], ['custom', '其他官方音色']]) { const option = document.createElement('option'); option.value = value; option.textContent = text; defaultVoice.append(option) }
  const speaker = control('input', { placeholder: '官方 speaker 或 S_…' }); speaker.dataset.field = 'speaker'
  const voiceName = control('input'); voiceName.dataset.field = 'voiceName'
  const speechRate = control('input', { type: 'number', min: '-50', max: '100' }); speechRate.dataset.field = 'speechRate'
  const asrResource = control('select', { 'data-field': 'asrResource' })
  for (const [value, text] of [['volc.seedasr.sauc.duration', '豆包 2.0 · 小时版'], ['volc.seedasr.sauc.concurrent', '豆包 2.0 · 并发版'], ['volc.bigasr.sauc.duration', '豆包 1.0 · 小时版'], ['volc.bigasr.sauc.concurrent', '豆包 1.0 · 并发版']]) { const option = document.createElement('option'); option.value = value; option.textContent = text; asrResource.append(option) }
  const sampleButton = document.createElement('button'); sampleButton.type = 'button'; sampleButton.className = 'pet-btn pet-btnPrimary'; sampleButton.dataset.sample = ''; sampleButton.textContent = '保存并试听音色'
  voice.append(
    field('TTS API Key', keyRow('tts'), { hint: '留空保持不变；点清除后保存即删除。' }),
    field('ASR API Key', keyRow('asr')),
    field('音色类型', voiceKind),
    field('默认音色', defaultVoice),
    field('音色 ID', speaker),
    field('音色名称', voiceName),
    field('语速', speechRate),
    field('ASR 资源', asrResource),
    field('试听', sampleButton, { plain: true }),
  )
  const voicePage = root.querySelector('[data-page="voice"]')
  const voiceStatus = document.createElement('p'); voiceStatus.className = 'pet-hint'; voiceStatus.setAttribute('role', 'status')
  const ttsControl = switchRow('自动朗读回复', 'ttsEnabled')
  voicePage.append(textElement('识别测试：打开聊天，点击录音，结束后检查转写文字。'))
  voicePage.prepend(voiceStatus, ttsControl, textElement('关闭后立即停止朗读；开启后从下一次回复自动发声。'))

  let stored, disposed = false, generation = 0, events; const cleared = new Set()
  const intimacyRoot = document.createElement('div'); intimacyRoot.dataset.page = 'intimacy'; intimacyRoot.hidden = true; root.append(intimacyRoot)
  const intimacy = mountIntimacySettings(intimacyRoot)
  const insertIntimacy = document.createElement('button'); insertIntimacy.type = 'button'; insertIntimacy.className = 'pet-btn pet-btnSm pet-btnOutline'; insertIntimacy.textContent = '插入 {{亲密情况}}'; insertIntimacy.dataset.insertIntimacy = ''
  root.querySelector('[data-prompt-actions]').prepend(insertIntimacy)
  const insertInto = (input, text) => { input.setRangeText(text, input.selectionStart, input.selectionEnd, 'end'); input.focus() }
  insertIntimacy.onclick = e => { e.preventDefault(); insertInto(fieldOf('emotionPrompt'), '{{亲密情况}}') }
  const keywords = mountActionPresetSettings(root.querySelector('[data-page="actions"]'), status)
  const showEmotion = value => {
    root.querySelector('[data-emotion-text]').textContent = value?.text || '尚未生成情绪。'
    root.querySelector('[data-emotion-status]').textContent = value?.generating ? '正在生成下一轮的情绪，期间沿用上一份。' : value?.error || (value?.updatedAt ? '更新于 '+new Date(value.updatedAt).toLocaleString() : '')
  }
  const renderVoiceStatus = enabled => { voiceStatus.textContent = enabled ? '自动朗读已开启：保存的新音色用于下一轮回复。' : '自动朗读已关闭：聊天只显示文字；如需发声，请开启自动朗读开关。' }
  const fieldOf = key => root.querySelector(`[data-field="${key}"]`)
  const ttsSwitch = root.querySelector('[data-switch="ttsEnabled"]')
  const guarded = fn => async e => { e.preventDefault(); try { await fn() } catch (error) { if (!disposed) status(error.message) } }
  const load = async (force = false) => {
    if (stored && !force) return
    const token = ++generation; stored = undefined
    for (const control of root.querySelectorAll('input,textarea,select,button')) control.disabled = true
    let result
    try { result = await api('/config'); if (!disposed && token === generation) await keywords.load(result.config) }
    finally { if (!disposed && token === generation) for (const control of root.querySelectorAll('input,textarea,select,button')) if (!control.closest('[data-page="actions"]')) control.disabled = false }
    if (disposed || token !== generation) return
    stored = result.config; cleared.clear()
    intimacy.load(stored.intimacyLevels)
    events?.close(); events = new EventSource('/desktop-pet/api/conversation/events')
    events.addEventListener('state', e => { const value = JSON.parse(e.data); showEmotion(value.emotion); intimacy.state(value.intimacy) })
    events.addEventListener('emotion', e => showEmotion(JSON.parse(e.data)))
    renderVoiceStatus(stored.ttsEnabled)
    ttsSwitch.setAttribute('aria-checked', String(stored.ttsEnabled === true))
    for (const control of root.querySelectorAll('[data-field]')) { const value = stored[control.dataset.field]; if (control.type === 'checkbox') control.checked = value; else control.value = value }
    defaultVoice.parentElement.hidden = stored.voiceKind === 'clone'
    for (const control of root.querySelectorAll('[data-key]')) { control.value = ''; control.placeholder = result.configured[control.dataset.key] ? '已保存，留空保持不变' : '尚未配置' }
  }
  root.querySelector('[data-insert-emotion]').onclick = e => { e.preventDefault(); insertInto(fieldOf('prompt'), '{{情绪模拟}}') }
  root.querySelector('[data-insert-history]').onclick = e => { e.preventDefault(); insertInto(fieldOf('emotionPrompt'), '{{聊天记录}}') }
  for (const button of root.querySelectorAll('[data-clear]')) button.onclick = e => { e.preventDefault(); cleared.add(button.dataset.clear); const input = root.querySelector(`[data-key="${button.dataset.clear}"]`); input.value = ''; input.placeholder = '保存后清除' }
  defaultVoice.onchange = e => { if (e.target.value !== 'custom') { fieldOf('speaker').value = e.target.value; fieldOf('voiceName').value = '高冷御姐' } }
  voiceKind.onchange = () => { defaultVoice.parentElement.hidden = voiceKind.value === 'clone'; if (voiceKind.value === 'default') { fieldOf('speaker').value = 'zh_female_gaolengyujie_uranus_bigtts'; fieldOf('voiceName').value = '高冷御姐' } else { fieldOf('speaker').value = stored.voiceKind === 'clone' ? stored.speaker : ''; fieldOf('voiceName').value = stored.voiceKind === 'clone' ? stored.voiceName : '我的克隆音色' } }
  speaker.oninput = () => {
    const id = speaker.value.trim()
    if (!id) return
    voiceKind.value = id.startsWith('S_') ? 'clone' : 'default'
    defaultVoice.parentElement.hidden = voiceKind.value === 'clone'
    defaultVoice.value = id === 'zh_female_gaolengyujie_uranus_bigtts' ? id : 'custom'
    status('音色类型已按 ID 匹配，请保存；新音色从下一轮回复生效。')
  }
  ttsSwitch.onclick = guarded(async () => {
    const enabled = ttsSwitch.getAttribute('aria-checked') !== 'true'
    ttsSwitch.setAttribute('aria-checked', String(enabled))
    const current = await api('/config')
    await api('/config', { config: { ...current.config, ttsEnabled: enabled } })
    stored.ttsEnabled = enabled; renderVoiceStatus(enabled); status(enabled ? '已开启自动朗读，从下一次回复生效。' : '已关闭自动朗读。')
  })
  testButton.onclick = guarded(async () => { status('正在测试已保存配置…'); const result = await api('/test', {}); if (!disposed) status(`连接正常：${result.text}`) })
  const save = async () => {
    if (!stored) throw new Error('设置尚未加载')
    const config = { ...stored, ...keywords.value(), intimacyLevels: intimacy.value() }, keys = {}
    for (const control of root.querySelectorAll('[data-field]')) config[control.dataset.field] = control.type === 'checkbox' ? control.checked : control.type === 'number' ? Number(control.value) : control.value
    for (const control of root.querySelectorAll('[data-switch]')) config[control.dataset.switch] = control.getAttribute('aria-checked') === 'true'
    for (const control of root.querySelectorAll('[data-key]')) { if (control.value.trim()) keys[control.dataset.key] = control.value.trim(); else if (cleared.has(control.dataset.key)) keys[control.dataset.key] = null }
    await api('/config', { config, keys }); await load(true); status('设置已保存。')
  }
  root.querySelector('[data-sample]').onclick = guarded(async () => { await save(); await showPet(); status('正在合成试听…'); await api('/sample', {}); if (!disposed) status('音色已送至桌宠播放。') })
  return {
    load,
    show(page) { keywords.show(page === 'actions'); for (const div of root.querySelectorAll('[data-page]')) div.hidden = div.dataset.page !== page; root.scrollTop = 0 },
    save,
    suspend() { generation++; stored = undefined; events?.close(); keywords.suspend(); for (const control of root.querySelectorAll('[data-key]')) control.value = '' },
    dispose() { disposed = true; this.suspend(); keywords.dispose(); root.replaceChildren() },
  }
}
