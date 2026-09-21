/**
 * Basic companion preferences. Version 1 asset fields are removed during disk migration.
 *
 * `broadcastEnabled` reads the main agent's own prose aloud through the pet. It defaults off: this is speech a
 * person opts into, and it is spoken only — the pet's bubble belongs to the pet's own conversation.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
export const defaultSettings = Object.freeze({ version: 2, modelId: '', height: 420, animated: true, alwaysOnTop: true, broadcastEnabled: false })
export function validateSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('设置必须是对象')
  for (const key of Object.keys(value)) if (!Object.hasOwn(defaultSettings, key)) throw new Error(`未知设置：${key}`)
  const result = { ...defaultSettings, ...value }
  if (result.version !== 2) throw new Error('不支持的桌宠设置版本')
  if (typeof result.modelId !== 'string' || result.modelId.length > 200) throw new Error('角色无效')
  if (!Number.isInteger(result.height) || result.height < 180 || result.height > 1000) throw new Error('角色高度须为 180–1000 像素')
  for (const key of ['animated', 'alwaysOnTop', 'broadcastEnabled']) if (typeof result[key] !== 'boolean') throw new Error(`${key} 必须为布尔值`)
  return result
}
/**
 * Keep only the settings this build still knows.
 *
 * `validateSettings` rejects unknown keys on purpose, so a file written by an earlier build may not be handed to
 * it as-is: `broadcastBubbleSentences` was retired when the broadcast stopped writing the pet's bubble, and an
 * installed copy still carries it. The file is filtered here, and the next `writeSettings` drops it from disk.
 * @param value - the parsed settings file.
 * @returns the entries this build still owns.
 */
const knownOnly = value => Object.fromEntries(Object.entries(value).filter(([key]) => Object.hasOwn(defaultSettings, key)))

export function readSettings(path, defaults = {}) {
  const initial = validateSettings(defaults)
  try {
    const stored = JSON.parse(readFileSync(path, 'utf8'))
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) throw new Error('桌宠设置文件必须是对象')
    if (stored.version === 1) return validateSettings({ ...initial, ...Object.fromEntries(['modelId', 'height', 'animated', 'alwaysOnTop'].filter(key => Object.hasOwn(stored, key)).map(key => [key, stored[key]])) })
    return validateSettings({ ...initial, ...knownOnly(stored) })
  } catch (error) { if (error.code === 'ENOENT') return initial; throw error }
}
export function writeSettings(path, value) {
  const settings = validateSettings(value)
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.tmp`
  writeFileSync(temporary, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 })
  renameSync(temporary, path)
  return settings
}
