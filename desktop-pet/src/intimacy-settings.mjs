/**
 * Editable level thresholds are global pet preferences; the displayed score belongs to the current chat.
 * Levels render as cards two per row: a threshold set is three short values and one sentence, so a full-width
 * row per level wasted the panel and turned the page into a long scroll.
 */
import { validateIntimacyLevels } from './intimacy.mjs'

/** @param text - the field's label. @param input - the control. @param wide - whether the field spans both columns. @returns the field wrapper. */
function field(text, input, wide = false) {
  const wrapper = document.createElement('label')
  wrapper.className = wide ? 'pet-field pet-fieldWide' : 'pet-field'
  const label = document.createElement('span'); label.className = 'pet-label'; label.textContent = text
  wrapper.append(label, input)
  return wrapper
}

/** @param root - the page's host element. @returns the level editor the settings form drives. */
export function mountIntimacySettings(root) {
  root.innerHTML = `<div class="pet-section">
    <div class="pet-hintBlock"><p class="pet-hint" data-intimacy-status role="status">正在读取…</p><p class="pet-hint">每完成一轮用户消息与 AI 回复加 1 分；失败、中断和测试连接不计分。新建对话从 0 开始，已有历史不补算。</p><p class="pet-hint">自由填写每级的起始分数、结束分数与等级名称，两端分数都包含在内。区间从 0 开始连续排列，不可重叠；最后一级结束分数留空表示无上限。在情绪模拟 Prompt 中插入 {{亲密情况}} 后生效。</p></div>
    <div class="pet-cards" data-intimacy-levels></div>
    <div class="pet-cardActions"><button class="pet-btn pet-btnOutline" type="button" data-add-level>添加等级</button></div></div>`
  const list = root.querySelector('[data-intimacy-levels]')
  const rows = () => [...list.children]
  const add = level => {
    const card = document.createElement('div'); card.className = 'pet-card'
    const title = document.createElement('div'); title.className = 'pet-cardHead'
    const name = document.createElement('span'); name.className = 'pet-cardTitle'; name.textContent = level.name
    title.append(name)
    const nameInput = document.createElement('input'); nameInput.className = 'pet-input'; nameInput.dataset.levelName = ''
    const min = document.createElement('input'); min.className = 'pet-input'; min.dataset.min = ''; min.type = 'number'; min.min = '0'; min.step = '1'
    const max = document.createElement('input'); max.className = 'pet-input'; max.dataset.max = ''; max.type = 'number'; max.min = '0'; max.step = '1'; max.placeholder = '留空即无上限'
    const description = document.createElement('textarea'); description.className = 'pet-textarea'; description.dataset.levelDescription = ''
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'pet-btn pet-btnSm pet-btnOutline pet-btnDanger'; remove.dataset.removeLevel = ''; remove.textContent = '删除等级'
    nameInput.value = level.name; min.value = level.min; description.value = level.description; max.value = level.max ?? ''
    nameInput.oninput = () => { name.textContent = nameInput.value }
    remove.onclick = e => { e.preventDefault(); card.remove() }
    const grid = document.createElement('div'); grid.className = 'pet-grid'
    grid.append(field('等级名称', nameInput, true), field('起始分数', min), field('结束分数', max), field('亲密情况描述', description, true))
    const actions = document.createElement('div'); actions.className = 'pet-cardActions'; actions.append(remove)
    card.append(title, grid, actions)
    list.append(card)
  }
  root.querySelector('[data-add-level]').onclick = e => {
    e.preventDefault(); const last = rows().at(-1)
    if (last && last.querySelector('[data-max]').value === '') last.querySelector('[data-max]').value = Number(last.querySelector('[data-min]').value)+9
    add({ min: last ? Number(last.querySelector('[data-max]').value)+1 : 0, max: null, name: `${rows().length+1}级`, description: '' })
  }
  return {
    load(levels) { list.replaceChildren(); levels.forEach(add) },
    state(value) { root.querySelector('[data-intimacy-status]').textContent = value ? `当前对话：${value.score} 分 · ${value.name}` : '当前对话：0 分' },
    value() { return validateIntimacyLevels(rows().map(card => ({ min: card.querySelector('[data-min]').value === '' ? NaN : Number(card.querySelector('[data-min]').value), max: card.querySelector('[data-max]').value === '' ? null : Number(card.querySelector('[data-max]').value), name: card.querySelector('[data-level-name]').value, description: card.querySelector('[data-level-description]').value }))) },
  }
}
