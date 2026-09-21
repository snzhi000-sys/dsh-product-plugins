/**
 * Saved action variants and phoneme recipes share a leased live preview. Each preset is a card and the cards
 * fill two columns, so a keyword preset is edited where it is readable instead of in a full-width row whose
 * one-line fields stretched across the whole panel.
 */
import { mouthPhonemes } from './action-presets.mjs'

/** @param text - the label. @param control - the control. @param wide - whether the field spans both columns. @returns the field wrapper. */
function field(text, control, wide = false) {
  const wrapper = document.createElement('label')
  wrapper.className = wide ? 'pet-field pet-fieldWide' : 'pet-field'
  const label = document.createElement('span'); label.className = 'pet-label'; label.textContent = text
  wrapper.append(label, control)
  return wrapper
}

/** @param text - the row's label. @param checked - the initial state. @returns the switch row and its control. */
function switchRow(text, checked) {
  const row = document.createElement('div'); row.className = 'pet-switchRow'
  const label = document.createElement('span'); label.className = 'pet-label'; label.textContent = text
  const button = document.createElement('button')
  button.type = 'button'; button.className = 'pet-switch'; button.setAttribute('role', 'switch'); button.setAttribute('aria-checked', String(checked))
  const thumb = document.createElement('span'); thumb.className = 'pet-thumb'
  button.append(thumb); row.append(label, button)
  return { row, button }
}

/** @param root - the page's host element. @param status - the panel's status writer. @returns the preset editor the settings form drives. */
export function mountActionPresetSettings(root, status) {
  root.innerHTML = `<div class="pet-actions">
    <p class="pet-actionsHelp">同一动作可保存多个权重预设。关键词只匹配括号内文字，最长优先，等长按列表顺序。拖动滑块实时预览，松开恢复；改动随设置页自动保存。</p>
    <div class="pet-actionsToolbar"><label class="pet-field"><span class="pet-label">角色与服装</span><select class="pet-select" data-action-character></select></label><button class="pet-btn pet-btnOutline" type="button" data-new-preset>新建动作预设</button></div>
    <p class="pet-conflict" data-keyword-conflict></p>
    <div class="pet-actionsPane"><iframe class="pet-actionsPortrait" title="动作立绘预览" src="about:blank"></iframe><div class="pet-cards" data-action-keywords></div></div></div>`
  const select = root.querySelector('select'), list = root.querySelector('[data-action-keywords]'), newPreset = root.querySelector('[data-new-preset]'), conflict = root.querySelector('[data-keyword-conflict]'), portrait = root.querySelector('iframe'), channel = new BroadcastChannel('dsh-pet-action-debug')
  let draft = {}, recipes = {}, revision = 0, disposed = false, held, timer, animated = false, visible = false
  const json = async path => { const r = await fetch('/desktop-pet/api/' + path), value = await r.json(); if (!r.ok) throw Error(value.error); return value }
  const stop = () => { clearInterval(timer); if (held) channel.postMessage({ ...held, kind: 'release' }); held = null }
  const send = () => { if (held) channel.postMessage({ ...held, kind: 'hold' }) }
  const begin = selection => { stop(); if (!animated) { status('请先开启并保存动画设置，再预览。'); return } held = { modelId: select.value, token: crypto.randomUUID(), selection }; send(); timer = setInterval(send, 250) }
  const visibility = () => { if (document.hidden) stop() }
  window.addEventListener('blur', stop); document.addEventListener('visibilitychange', visibility)
  const card = () => { const element = document.createElement('div'); element.className = 'pet-card'; return element }
  const button = (text, fn, variant = 'pet-btnSm pet-btnOutline') => { const element = document.createElement('button'); element.type = 'button'; element.className = `pet-btn ${variant}`; element.textContent = text; element.onclick = fn; return element }
  const input = (value, change) => { const element = document.createElement('input'); element.className = 'pet-input'; element.value = value; element.oninput = () => { change(element.value) }; return element }
  const options = (items, value, change) => { const element = document.createElement('select'); element.className = 'pet-select'; for (const [id, text] of items) { const option = document.createElement('option'); option.value = id; option.textContent = text; element.append(option) } element.value = value; element.onchange = () => { stop(); change(element.value) }; return element }
  const header = (title, trailing) => { const element = document.createElement('div'); element.className = 'pet-cardHead'; const name = document.createElement('span'); name.className = 'pet-cardTitle'; name.textContent = title; if (trailing) element.append(name, trailing); else element.append(name); return element }
  /**
   * One weight control set: a slider, the matching number, and the held preview. The weight rides the same
   * leased preview channel as the presets, so dragging the slider animates the character.
   * @param target - the card to append the field to.
   * @param model - the model the weight applies to.
   * @param selection - the preset or recipe the hold describes.
   * @param weight - the current weight, 0..1.
   * @param update - receives each new weight.
   */
  const previewControls = (target, model, selection, weight, update) => {
    const slider = document.createElement('input'), number = document.createElement('input'); slider.type = 'range'; number.type = 'number'
    for (const element of [slider, number]) { element.min = '0'; element.max = '100'; element.step = '1'; element.value = String(Math.round(weight * 100)); element.disabled = model.kind !== 'dragonbones'; element.onblur = stop }
    slider.className = 'pet-range'; number.className = 'pet-input'
    slider.dataset.weight = ''; number.dataset.weightNumber = ''; slider.setAttribute('aria-label', '动作权重'); number.setAttribute('aria-label', '权重百分比')
    const value = () => Number(slider.value) / 100
    const change = (source, other) => {
      const next = Number(source.value)
      if (!Number.isFinite(next) || next < 0 || next > 100) { status('权重须为 0–100%。'); return }
      other.value = source.value; update(next / 100)
      if (!held) begin({ ...selection(), weight: next / 100 }); else { held.selection.weight = next / 100; send() }
    }
    slider.oninput = () => change(slider, number); number.oninput = () => change(number, slider)
    slider.onpointerdown = e => { if (e.button === 0) { slider.setPointerCapture(e.pointerId); begin({ ...selection(), weight: value() }) } }
    slider.onpointerup = slider.onpointercancel = slider.onlostpointercapture = slider.onkeyup = stop
    const preview = button('按住预览', null)
    preview.onpointerdown = e => { if (e.button !== 0) return; e.preventDefault(); preview.setPointerCapture(e.pointerId); begin({ ...selection(), weight: value() }) }
    preview.onpointerup = preview.onpointercancel = preview.onlostpointercapture = preview.onblur = preview.onkeyup = stop
    preview.onkeydown = e => { if ([' ', 'Enter'].includes(e.key)) { e.preventDefault(); if (!e.repeat) begin({ ...selection(), weight: value() }) } }
    const row = document.createElement('div'); row.className = 'pet-weight'; row.append(slider, number, preview)
    const wrapper = document.createElement('div'); wrapper.className = 'pet-field pet-fieldWide'
    const label = document.createElement('span'); label.className = 'pet-label'; label.textContent = model.kind === 'dragonbones' ? '动作权重 %' : '当前引擎保留完整动作（100%）'
    wrapper.append(label, row); target.append(wrapper)
  }
  const render = async () => {
    stop(); const token = ++revision, id = select.value; list.replaceChildren()
    try {
      const model = await json('model?id=' + encodeURIComponent(id)); if (disposed || token !== revision) return
      const src = '/desktop-pet/view?preview=1&model=' + encodeURIComponent(id)
      if (visible && portrait.getAttribute('src') !== src) portrait.src = src
      const modules = model.actionModules.filter(a => a.category === 'body' && a.automaticEligible)
      draft[id] ??= modules.map(a => ({ id: 'default:' + a.id, actionId: a.id, name: a.label, weight: 1, enabled: true, keywords: [] }))
      const entries = draft[id]
      const check = () => {
        const seen = new Set(), duplicates = new Set()
        for (const preset of entries.filter(p => p.enabled)) for (const tag of p.keywords) { const key = tag.toLocaleLowerCase(); if (seen.has(key)) duplicates.add(tag); seen.add(key) }
        conflict.textContent = duplicates.size ? '重复关键词按列表顺序匹配：' + [...duplicates].join('、') : ''
      }
      newPreset.disabled = !modules.length
      newPreset.onclick = () => { if (modules.length) { entries.push({ id: crypto.randomUUID(), name: '新动作预设', actionId: modules[0].id, weight: 1, enabled: true, keywords: [] }); void render() } }
      for (const [index, preset] of entries.entries()) {
        const element = card(); element.dataset.presetId = preset.id
        const fold = button('收起设置', () => { const collapsed = fold.dataset.collapsed === '1'; for (const child of [...element.children].slice(1)) child.hidden = !collapsed; fold.dataset.collapsed = collapsed ? '0' : '1'; fold.textContent = collapsed ? '收起设置' : '展开设置' })
        element.append(header(preset.name, fold))
        const name = input(preset.name, value => { preset.name = value; element.querySelector('.pet-cardTitle').textContent = value }); name.dataset.presetName = ''
        const choices = modules.map(a => [a.id, a.label]); if (!modules.some(a => a.id === preset.actionId)) choices.push([preset.actionId, '动作已不可用：' + preset.actionId])
        const source = options(choices, preset.actionId, value => { preset.actionId = value; void render() }); source.dataset.presetSource = ''
        const enabled = switchRow('启用关键词触发', preset.enabled)
        enabled.button.dataset.presetEnabled = ''
        enabled.button.onclick = () => { preset.enabled = enabled.button.getAttribute('aria-checked') !== 'true'; enabled.button.setAttribute('aria-checked', String(preset.enabled)); check() }
        const grid = document.createElement('div'); grid.className = 'pet-grid'
        grid.append(field('预设名称', name), field('原始动作', source), enabled.row)
        element.append(grid)
        previewControls(element, model, () => modules.find(a => a.id === preset.actionId) ?? {}, preset.weight, value => { preset.weight = value })
        const tags = document.createElement('textarea'); tags.className = 'pet-textarea'; tags.dataset.actionId = preset.actionId; tags.value = preset.keywords.join('\n'); tags.placeholder = '每行一个关键词'
        tags.oninput = () => { preset.keywords = [...new Set(tags.value.split('\n').map(t => t.trim()).filter(Boolean))]; check() }
        element.append(field('关键词', tags, true))
        const actions = document.createElement('div'); actions.className = 'pet-cardActions'
        actions.append(
          button('复制预设', () => { entries.splice(index + 1, 0, { ...structuredClone(preset), id: crypto.randomUUID(), name: preset.name + ' 副本' }); void render() }),
          button('上移', () => { if (index) { [entries[index - 1], entries[index]] = [entries[index], entries[index - 1]]; void render() } }),
          button('删除预设', () => { entries.splice(index, 1); void render() }, 'pet-btnSm pet-btnOutline pet-btnDanger'),
        )
        element.append(actions)
        list.append(element)
      }
      check()
      if (model.kind === 'dragonbones' && recipes[id]) {
        const heading = document.createElement('h3'); heading.className = 'pet-actionsHeading pet-fieldWide'; heading.textContent = '发音嘴型配方'; list.append(heading)
        const help = document.createElement('p'); help.className = 'pet-actionsHelp pet-fieldWide'; help.textContent = 'e/w/y 等发音标签可复用 a/o/i/m 的不同权重，自动说话按拼音字符匹配。未配置字符沿用基础嘴型。扩展默认值是可调整的近似效果，不是新制作的素材。'; list.append(help)
        const add = document.createElement('div'); add.className = 'pet-cardActions pet-fieldWide'
        add.append(button('新增发音配方', () => { const unused = mouthPhonemes.find(c => !recipes[id].some(r => r.phoneme === c)); if (unused) { recipes[id].push({ phoneme: unused, base: 'i', weight: .5 }); void render() } else status('当前支持的发音匹配项均已配置。') }))
        list.append(add)
        for (const [index, recipe] of recipes[id].entries()) {
          const element = card(); element.dataset.phoneme = recipe.phoneme
          const grid = document.createElement('div'); grid.className = 'pet-grid'
          const phoneme = options(mouthPhonemes.filter(p => p === recipe.phoneme || !recipes[id].some(r => r.phoneme === p)).map(p => [p, p]), recipe.phoneme, value => { recipe.phoneme = value; void render() }); phoneme.disabled = ['a', 'o', 'i', 'm'].includes(recipe.phoneme)
          const base = options(['a', 'o', 'i', 'm'].map(s => [s, s]), recipe.base, value => { recipe.base = value })
          grid.append(field('发音匹配符号', phoneme), field('基础嘴型', base))
          element.append(header('发音配方 · ' + recipe.phoneme), grid)
          previewControls(element, model, () => ({ animation: '__speech_' + recipe.base }), recipe.weight, value => { recipe.weight = value })
          if (!['a', 'o', 'i', 'm'].includes(recipe.phoneme)) { const actions = document.createElement('div'); actions.className = 'pet-cardActions'; actions.append(button('删除配方', () => { recipes[id].splice(index, 1); void render() }, 'pet-btnSm pet-btnOutline pet-btnDanger')); element.append(actions) }
          list.append(element)
        }
      }
    } catch (error) { if (!disposed && token === revision) status(error.message) }
  }
  select.onchange = render
  return {
    async load(config) {
      stop(); draft = structuredClone(config.actionPresets); recipes = structuredClone(config.mouthRecipes); const token = ++revision
      const [models, settings] = await Promise.all([json('models'), json('settings')]); if (disposed || token !== revision) return; animated = settings.animated
      const previous = select.value; select.replaceChildren()
      for (const model of models) { const option = document.createElement('option'); option.value = model.id; option.textContent = model.name + (model.outfitName ? ' · ' + model.outfitName : ''); select.append(option) }
      select.value = models.some(m => m.id === previous) ? previous : settings.modelId
      await render(); select.disabled = false
    },
    value() { return { actionPresets: draft, mouthRecipes: recipes } }, stop,
    show(value) { visible = value; stop(); portrait.src = value && select.value ? '/desktop-pet/view?preview=1&model=' + encodeURIComponent(select.value) : 'about:blank' },
    suspend() { ++revision; stop(); portrait.src = 'about:blank' },
    dispose() { disposed = true; ++revision; stop(); channel.close(); window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', visibility); root.replaceChildren() },
  }
}
