/**
 * Scrollable built-in character navigation with one outstanding switch at a time. The list, its search field,
 * and the outfit picker use the panel's shared stylesheet, so they match the official settings controls
 * instead of carrying local colors and radii.
 */
export function mountModelManager(container, { wardrobe, api, selected, select, status }) {
  container.innerHTML = '<p class="pet-libraryLabel">选择伙伴</p><input id="model-search" class="pet-input" type="search" aria-label="搜索角色" placeholder="搜索角色名称"><p id="library-count" class="pet-libraryCount"></p><div id="models" class="pet-models" role="group" aria-label="内置角色列表"></div>'
  const find = id => container.querySelector(`#${id}`)
  let models = [], active = false, disposed = false, switching = false, revision = 0
  const remembered = new Map()
  const choose = async model => {
    if (!active || disposed || switching || selected() === model.id) return
    switching = true; render()
    try { await select(model); remembered.set(model.characterId, model.id); if (!disposed && active) status(`已切换为 ${model.name}`) }
    catch (error) { if (!disposed) status(error.message) }
    finally { switching = false; if (!disposed) render() }
  }
  const render = () => {
    const scrollTop = find('models').scrollTop
    const query = find('model-search').value.trim().toLowerCase()
    const groups = new Map()
    for (const model of models) { if (!groups.has(model.characterId)) groups.set(model.characterId, []); groups.get(model.characterId).push(model) }
    const filtered = [...groups.values()].filter(variants => variants.some(model => `${model.name} ${model.subtitle} ${model.characterName} ${model.outfitName}`.toLowerCase().includes(query)))
    find('library-count').textContent = query ? `找到 ${filtered.length} / ${groups.size} 位伙伴` : `${groups.size} 位伙伴 · ${models.length} 套造型`
    find('models').replaceChildren()
    for (const variants of filtered) {
      const model = variants.find(m => m.id === selected()) ?? variants.find(m => m.id === remembered.get(m.characterId)) ?? variants[0]
      const button = document.createElement('button')
      button.type = 'button'; button.className = 'pet-character'; button.dataset.modelId = model.id
      button.setAttribute('aria-pressed', String(selected() === model.id)); button.disabled = switching
      const image = document.createElement('img'); image.src = model.thumbnail; image.alt = ''; image.loading = 'lazy'
      const text = document.createElement('span'); text.className = 'pet-characterText'
      const name = document.createElement('strong'); name.className = 'pet-characterName'
      const detail = document.createElement('small'); detail.className = 'pet-characterMeta'
      name.textContent = model.characterName; detail.textContent = model.subtitle + (variants.length > 1 ? ` · ${variants.length} 套服装` : ''); text.append(name, detail)
      const marker = document.createElement('span'); marker.className = 'pet-selectionMark'; marker.textContent = selected() === model.id ? '✓' : ''
      button.append(image, text, marker)
      button.onclick = () => choose(model)
      find('models').append(button)
    }
    if (!filtered.length) { const empty = document.createElement('p'); empty.className = 'pet-empty'; empty.textContent = '没有找到这个角色，试试其他名字。'; find('models').append(empty) }
    find('models').scrollTop = scrollTop
    wardrobe.replaceChildren()
    const current = models.find(model => model.id === selected()), variants = groups.get(current?.characterId) ?? []
    if (variants.length > 1) {
      const label = document.createElement('span'); label.className = 'pet-label'; label.textContent = '服装'
      const picker = document.createElement('select'); picker.id = 'pet-outfit'; picker.className = 'pet-select'; picker.setAttribute('aria-label', '服装'); picker.disabled = switching
      for (const model of variants) { const option = document.createElement('option'); option.value = model.id; option.textContent = model.outfitName; picker.append(option) }
      picker.value = current.id; picker.onchange = () => choose(variants.find(model => model.id === picker.value))
      wardrobe.append(label, picker)
    }
  }
  find('model-search').oninput = render
  return {
    async refresh() { const token = ++revision; const value = await api('models'); if (disposed || !active || token !== revision) return; models = value; render(); return models.find(model => model.id === selected()) },
    resume() { active = true; find('model-search').value = '' },
    suspend() { active = false; ++revision },
    dispose() { disposed = true; active = false; ++revision; container.replaceChildren(); wardrobe.replaceChildren() },
  }
}
