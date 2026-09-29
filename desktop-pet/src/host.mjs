/** Host routes serve the pet view and configured local assets inside bounded roots. */
import { readFile } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import z from '@deepseek-ai/schemastery'
import { defaultSettings, readSettings, writeSettings } from './settings.mjs'
import { builtinLibrary, assetRoot } from './builtin-library.mjs'
import { createConversationHost } from './conversation-host.mjs'
import { installBroadcast } from './broadcast-observer.mjs'
import { assistantProse } from './broadcast.mjs'
export { containedAsset } from './model-library.mjs'

export const name = 'desktop-pet'
export const inject = ['webServer']
/** Deployment defaults can be patched through cordis.yml; saved local preferences take precedence. */
export const Config = z.object({ automaticActionIntervalMs: z.number().min(1000).max(3600000).default(60000), defaults: z.object({
  modelId: z.string().default(''),
  height: z.number().step(1).min(180).max(1000).default(defaultSettings.height),
  animated: z.boolean().default(true), alwaysOnTop: z.boolean().default(true),
}).default({}) })
const base = '/desktop-pet'
const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.moc3': 'application/octet-stream', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' }

/** Register local-only routes and release them when Cordis unloads the plugin. */
export function apply(ctx, config = {}) {
  if (!process.env.DSH_HOME) throw new Error('desktop-pet requires DSH_HOME')
  const path = join(process.env.DSH_HOME, 'state', 'dsh-desktop-pet', 'settings.json')
  let settings = readSettings(path, config.defaults)
  const library = builtinLibrary()
  settings.modelId = library.resolveSaved(settings.modelId, dirname(path))
  // Only the conversation the person is looking at is read aloud. The UI knows which one that is, so the
  // client reports it here; until it does, nothing is broadcast rather than everything.
  let focusSessionId
  // Persist only the new schema; private legacy model files remain untouched.
  settings = writeSettings(path, settings)
  ctx.effect(() => {
    const conversation = createConversationHost(dirname(path))
    // The pet reads the main agent's own prose: its settings decide whether anything is spoken, and the
    // conversation host owns the voice, the queue, and the bubble it shares with the pet's private chat.
    const broadcast = installBroadcast(ctx, { settings: () => settings, focus: () => focusSessionId, conversation })
    // A message from a session this run has not seen settles nowhere in the cache, so fall back to the live
    // session's own event log; a message older than the session itself stays unspeakable and says so.
    const messageText = (sessionId, messageId) => {
      const cached = broadcast.messageText(messageId)
      if (cached) return cached
      const events = ctx.get('sessions')?.get(sessionId)?.ownEvents() ?? []
      const event = events.find(candidate => candidate?.type === 'assistant/message' && candidate.data?.message?.id === messageId)
      return event === undefined ? undefined : assistantProse(event.data.message.content)
    }
    const unregister = ctx.webServer.register({ kind: 'prefix', path: base, handler: async (req, res) => {
    const json = (status, value) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)) }
    try {
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) return json(403, { error: 'Local access only' })
      const origin = `http://${req.headers.host}`
      const url = new URL(req.url, origin)
      if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return json(403, { error: 'Loopback host required' })
      if (req.headers.origin && req.headers.origin !== origin) return json(403, { error: 'Origin mismatch' })
      if (req.headers['sec-fetch-site'] === 'cross-site') return json(403, { error: 'Cross-site access denied' })
      if (await conversation.handle(req, res, url)) return
      if (url.pathname === `${base}/api/broadcast/focus`) {
        if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
        if (!req.headers['content-type']?.startsWith('application/json')) return json(415, { error: 'JSON required' })
        let size = 0
        const chunks = []
        for await (const chunk of req) { size += chunk.length; if (size > 4096) return json(413, { error: 'Focus report too large' }); chunks.push(chunk) }
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        if (value?.sessionId !== null && (typeof value?.sessionId !== 'string' || value.sessionId === '' || value.sessionId.length > 200)) throw new Error('会话标识无效')
        focusSessionId = value.sessionId ?? undefined
        return json(200, { sessionId: focusSessionId ?? null })
      }
      if (url.pathname === `${base}/api/broadcast/message`) {
        if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
        if (!req.headers['content-type']?.startsWith('application/json')) return json(415, { error: 'JSON required' })
        let size = 0
        const chunks = []
        for await (const chunk of req) { size += chunk.length; if (size > 4096) return json(413, { error: 'Read-out request too large' }); chunks.push(chunk) }
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        for (const key of ['sessionId', 'messageId']) if (typeof value?.[key] !== 'string' || !value[key] || value[key].length > 200) throw new Error('消息标识无效')
        const text = messageText(value.sessionId, value.messageId)
        if (!text) return json(404, { error: '这条消息没有可播报的正文' })
        return json(200, conversation.readout(value.messageId, text))
      }
      if (url.pathname === `${base}/api/broadcast/diagnostics`) {
        if (req.method !== 'GET') return json(405, { error: 'Method not allowed' })
        return json(200, { records: conversation.diagnostics() })
      }
      // Text the person selected in the interface: the caller supplies it, so the pet speaks exactly what was
      // selected rather than session content. The voice, queue, caption and mouth all belong to the conversation
      // host, which is why this route only validates the caller's input and hands it over.
      if (url.pathname === `${base}/api/selection/speak`) {
        if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
        if (!req.headers['content-type']?.startsWith('application/json')) return json(415, { error: 'JSON required' })
        let size = 0
        const chunks = []
        for await (const chunk of req) { size += chunk.length; if (size > 32768) return json(413, { error: 'Selection too large' }); chunks.push(chunk) }
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        const text = typeof value?.text === 'string' ? value.text.trim() : ''
        if (!text) throw new Error('没有可朗读的选中文本')
        // Five thousand characters is several minutes of speech; longer than that is a copy-paste accident, not a
        // selection, and the caller is told rather than left with a queue that never ends.
        if (text.length > 5000) throw new Error(`选中文本最多 5000 字，当前 ${text.length} 字`)
        return json(200, conversation.selection(text))
      }
      if (url.pathname === `${base}/api/models` && req.method === 'GET') return json(200, library.list())
      if (url.pathname === `${base}/api/model` && req.method === 'GET') return json(200, {...await library.describe(url.searchParams.get('id') || settings.modelId),automaticActionIntervalMs:config.automaticActionIntervalMs ?? 60000})
      if (url.pathname === `${base}/api/settings`) {
        if (req.method === 'GET') return json(200, settings)
        if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
        if (!req.headers['content-type']?.startsWith('application/json')) return json(415, { error: 'JSON required' })
        let size = 0
        const chunks = []
        for await (const chunk of req) { size += chunk.length; if (size > 32768) return json(413, { error: 'Settings too large' }); chunks.push(chunk) }
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        if (value?.modelId) await library.get(value.modelId)
        const wasBroadcasting = settings.broadcastEnabled
        settings = writeSettings(path, { ...value, modelId: value.modelId || library.defaultId })
        // The sound switch means "the pet does not speak", so turning it off ends the sentence already playing: that
        // read-out was started while this setting was on, and while the pet window is hidden this switch is the only
        // control on screen. Reading resumes from a message's strip button or a selection, never by turning the
        // switch back on.
        if (wasBroadcasting && !settings.broadcastEnabled) conversation.stopSpeech()
        return json(200, settings)
      }
      if (req.method !== 'GET') return json(405, { error: 'Method not allowed' })
      let file
      if (url.pathname === `${base}/core.js`) file = join(assetRoot, 'cores/live2dcubismcore.min.js')
      else if (url.pathname === `${base}/core2.js`) file = join(assetRoot, 'cores/live2d.min.js')
      else if (url.pathname === `${base}/pixi8.js`) file = join(assetRoot, 'cores/pixi8.js')
      else if (url.pathname === `${base}/dragonbones-core.js`) file = join(assetRoot, 'cores/dragonbones.js')
      else if (url.pathname === `${base}/spine-core.js`) file = join(assetRoot, 'cores/spine-webgl.js')
      else if (url.pathname.startsWith(`${base}/models/`)) {
        const [id, ...parts] = decodeURIComponent(url.pathname.slice(`${base}/models/`.length)).split('/')
        file = await library.asset(id, parts.join('/'))
      }
      else {
        const files = { [`${base}/chat`]: 'chat.html', [`${base}/chat.js`]: 'chat.js', [`${base}/recorder-worklet.js`]: 'recorder-worklet.js', [`${base}/view`]: 'view.html', [`${base}/view.js`]: 'view.js', [`${base}/live2d.js`]: 'live2d.js', [`${base}/live2d2.js`]: 'live2d2.js', [`${base}/dragonbones.js`]: 'dragonbones.js', [`${base}/spine.js`]: 'spine.js' }
        if (!files[url.pathname]) return json(404, { error: 'Not found' })
        file = join(dist, files[url.pathname])
      }
      if (!file) return json(404, { error: '请先在桌宠设置中选择素材' })
      const data = await readFile(file)
      res.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'self'" })
      res.end(data)
    } catch (error) { json(400, { error: error.message }) }
    } })
    return () => { broadcast.dispose(); unregister(); return conversation.dispose() }
  }, 'desktop-pet: local routes')
}
