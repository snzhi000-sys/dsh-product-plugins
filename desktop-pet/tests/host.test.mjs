/**
 * The plugin's real HTTP surface: settings persistence and migration, which assets may be served, and the
 * broadcast diagnostics route.
 *
 * This is the only test that loads `host.mjs`, so it is the only one that can catch a route wired to a method the
 * conversation host does not return — which is exactly what the diagnostics endpoint shipped as. It needs the
 * plugin's peer packages (`@deepseek-ai/cordis`, `-schemastery`, `-dsh-host-webserver`) to resolve; the app runtime
 * carries them, and a standalone checkout must have them reachable from `node_modules` before this file can run.
 * While they were missing it failed at load and stopped covering every route below it.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { once } from 'node:events'
import { apply, Config, containedAsset } from '../src/host.mjs'
import { defaultSettings, readSettings, validateSettings, writeSettings } from '../src/settings.mjs'
import { builtinLibrary } from '../src/builtin-library.mjs'

test('legacy selected character maps to its built-in version without copying private assets', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pet-migrate-'))
  try {
    writeFileSync(join(dir, 'models.json'), JSON.stringify({ version: 1, models: [{ id: 'old-private-id', name: 'galgame live2d · mori_miko', entry: '/old/private/path' }] }))
    const library = builtinLibrary()
    assert.equal(library.resolveSaved('old-private-id', dir), 'companion-20')
    assert.equal(library.resolveSaved('companion-24', dir), 'companion-24')
    assert.equal(library.resolveSaved('removed-character', dir), library.defaultId)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('private settings persist, reject invalid updates, and do not reset corrupt files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pet-settings-'))
  const file = join(dir, 'settings.json')
  try {
    assert.equal(readSettings(file).height, 420)
    assert.equal(readSettings(file, { height: 550 }).height, 550)
    assert.throws(() => Config({ defaults: { height: 10 } }))
    writeSettings(file, { height: 600 })
    assert.equal(readSettings(file).height, 600)
    assert.equal(readSettings(file, { height: 550 }).height, 600)
    assert.throws(() => writeSettings(file, { height: -1 }))
    assert.equal(readSettings(file).height, 600)
    writeFileSync(file, JSON.stringify({ version: 1, height: 350, animated: false, alwaysOnTop: false, renderer: 'png', imagePath: '/obsolete.png' }))
    // The legacy file keeps the values it carried and takes the current defaults for everything else; writing the
    // expectation out by hand made this test stale the moment a setting was added, which hid the whole file.
    assert.deepEqual(readSettings(file), { ...defaultSettings, height: 350, animated: false, alwaysOnTop: false })
    // A file written by an earlier build carries settings this build retired. Loading it must drop them rather
    // than fail: `validateSettings` rejects unknown keys on purpose, and an installed copy still holds
    // `broadcastBubbleSentences` — the caption bound retired on 2026-09-20 when the broadcast stopped writing the
    // pet's bubble. Without the filter, this read throws and the plugin cannot load its own settings at all.
    writeFileSync(file, JSON.stringify({ version: 2, height: 500, broadcastBubbleSentences: 3 }))
    assert.deepEqual(readSettings(file), { ...defaultSettings, height: 500 })
    assert.equal('broadcastBubbleSentences' in readSettings(file), false, 'the retired key is dropped, not rejected')
    // Callers still get the strict answer: the filter is for stored files, not for incoming settings.
    assert.throws(() => validateSettings({ ...defaultSettings, broadcastBubbleSentences: 3 }), /未知设置/)
    writeFileSync(file, '{oops')
    assert.throws(() => readSettings(file))
    writeFileSync(file, 'null')
    assert.throws(() => readSettings(file))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('model resource resolution rejects traversal and symlink escapes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pet-assets-'))
  try {
    const root = join(dir, 'model'); mkdirSync(root)
    writeFileSync(join(root, 'texture.png'), 'inside')
    writeFileSync(join(dir, 'outside.png'), 'outside')
    symlinkSync(join(dir, 'outside.png'), join(root, 'link.png'))
    assert.equal(await containedAsset(root, 'texture.png'), realpathSync(join(root, 'texture.png')))
    await assert.rejects(containedAsset(root, '../outside.png'))
    await assert.rejects(containedAsset(root, 'link.png'))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('real HTTP routes save settings, serve only selected assets, and unload', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pet-host-'))
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = dir
  let route
  let dispose
  const server = createServer((req, res) => route ? void route.handler(req, res) : res.writeHead(404).end())
  try {
    // The context Cordis hands a plugin: a route registry, an effect scope, the service lookup the broadcast
    // observer reads, and event registration — the observer registers global listeners, and a listener without its
    // disposer would keep the previous test's host alive. The stub used to omit `on`, so this whole file failed at
    // the first route assertion and silently stopped covering every route below it.
    const listeners = new Map()
    apply({
      webServer: { register(value) { route = value; return () => { route = undefined } } },
      effect(factory) { dispose = factory() },
      get() { return undefined },
      on(name, handler) {
        const list = listeners.get(name) ?? []
        list.push(handler); listeners.set(name, list)
        return () => { const at = list.indexOf(handler); if (at >= 0) list.splice(at, 1) }
      },
    })
    server.listen(0, '127.0.0.1'); await once(server, 'listening')
    const base = `http://127.0.0.1:${server.address().port}/desktop-pet`
    const models = await (await fetch(`${base}/api/models`)).json()
    assert.equal(models.length, 23)
    const update = await fetch(`${base}/api/settings`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ modelId: models.at(-1).id }) })
    assert.equal(update.status, 200)
    assert.equal((await fetch(`${base}/image`)).status, 404)
    assert.equal((await fetch(`${base}/models/${models[0].id}/preview.png`)).status, 200)
    assert.equal((await fetch(`${base}/core.js`)).status, 200)
    // The diagnostics route is how a person reads back what the speech pipeline actually did, so it must answer
    // even before anything has been spoken. It called a method the host never returned and threw instead.
    const diagnostics = await fetch(`${base}/api/broadcast/diagnostics`)
    assert.equal(diagnostics.status, 200)
    assert.deepEqual((await diagnostics.json()).records, [])
    assert.equal((await fetch(`${base}/api/broadcast/diagnostics`, { method: 'POST' })).status, 405)
    assert.deepEqual([...listeners.keys()], ['session/event', 'session/disposed', 'llm/stream'], 'the broadcast observer registers its global listeners')
    // Reading a selection aloud takes text from the caller, so its input is bounded before it reaches the voice.
    const speak = (body, headers = { 'content-type': 'application/json' }) => fetch(`${base}/api/selection/speak`, { method: 'POST', headers, body: JSON.stringify(body) })
    assert.equal((await fetch(`${base}/api/selection/speak`)).status, 405, 'the selection route only accepts POST')
    assert.equal((await fetch(`${base}/api/selection/speak`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' })).status, 415)
    assert.match((await (await speak({ text: '   ' })).json()).error, /没有可朗读的选中文本/)
    assert.match((await (await speak({ text: 42 })).json()).error, /没有可朗读的选中文本/)
    assert.match((await (await speak({ text: '朗'.repeat(5001) })).json()).error, /最多 5000 字/)
    assert.equal((await speak({ text: '朗'.repeat(32768) })).status, 413, 'the body is bounded before it is parsed')
    // Five thousand characters is accepted by the route and refused later, by the voice that is not configured
    // here: that is the boundary, and it proves the limit is a length rule rather than an off-by-one accident.
    assert.match((await (await speak({ text: '朗'.repeat(5000) })).json()).error, /TTS Key/)
    for (const key of ['renderer', 'imagePath', 'modelPath', 'corePath', 'core2Path', 'parameters', 'motions', 'expressions', 'sessionId']) {
      assert.equal((await fetch(`${base}/api/settings`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ [key]: '' }) })).status, 400)
    }
    for (const action of ['import', 'discover', 'check', 'profile', 'preview']) assert.equal((await fetch(`${base}/api/${action}`, { method: 'POST' })).status, 405)
    assert.equal((await fetch(`${base}/api/settings`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://other.example' }, body: '{}' })).status, 403)
    assert.equal((await fetch(`${base}/api/settings`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' })).status, 415)
    assert.equal((await fetch(`${base}/arbitrary-file`)).status, 404)
    dispose()
    assert.equal((await fetch(`${base}/api/settings`)).status, 404)
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve))
    if (previous === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previous
    rmSync(dir, { recursive: true, force: true })
  }
})

/**
 * Watch a server-sent event stream for the named events, in order.
 * @param response - the streaming response to read.
 * @param names - the event names to record.
 * @returns the recorded names, appended as the stream is read.
 */
function watchEvents(response, names) {
  const seen = []
  let buffer = ''
  void (async () => {
    try {
      for await (const chunk of response.body) {
        buffer += Buffer.from(chunk).toString('utf8')
        for (;;) {
          const at = buffer.indexOf('\n\n')
          if (at < 0) break
          const event = /^event: (.+)$/mu.exec(buffer.slice(0, at))?.[1]
          buffer = buffer.slice(at + 2)
          if (event && names.includes(event)) seen.push(event)
        }
      }
    } catch { /* The test owns the connection's lifetime. */ }
  })()
  return seen
}

test('turning the broadcast switch off ends the read-out that setting started', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pet-sound-'))
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = dir
  let route
  let dispose
  const server = createServer((req, res) => route ? void route.handler(req, res) : res.writeHead(404).end())
  const controller = new AbortController()
  try {
    apply({
      webServer: { register(value) { route = value; return () => { route = undefined } } },
      effect(factory) { dispose = factory() },
      get() { return undefined },
      on() { return () => {} },
    })
    server.listen(0, '127.0.0.1'); await once(server, 'listening')
    const base = `http://127.0.0.1:${server.address().port}/desktop-pet`
    // A player window is what the host hands clips to, and `speech-stop` is how it tells that window to stop.
    const player = await fetch(`${base}/api/conversation/events?role=player`, { signal: controller.signal })
    const stopped = watchEvents(player, ['speech-stop'])
    const set = body => fetch(`${base}/api/settings`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const settle = () => new Promise(resolve => setTimeout(resolve, 80))

    // Turning the switch on only arms the next broadcast: nothing is speaking yet, so nothing is stopped.
    assert.equal((await set({ broadcastEnabled: true })).status, 200)
    await settle()
    assert.deepEqual(stopped, [], 'arming the switch does not stop the voice')

    // Turning it off means the pet stops speaking, so the sentence already in flight ends with the setting. It used
    // to keep playing: the only control that could stop it was the per-message strip, which a hidden pet window does
    // not show, so the switch looked like it did nothing (reported 2026-09-23).
    assert.equal((await set({ broadcastEnabled: false })).status, 200)
    for (let attempt = 0; attempt < 100 && !stopped.length; attempt++) await new Promise(resolve => setTimeout(resolve, 10))
    assert.deepEqual(stopped, ['speech-stop'], 'the switch asks the player to stop')

    // A switch that is already off is not a new decision: writing it again must not re-issue the stop.
    assert.equal((await set({ broadcastEnabled: false })).status, 200)
    await settle()
    assert.deepEqual(stopped, ['speech-stop'], 'an unchanged switch stops nothing')
  } finally {
    controller.abort(); dispose?.(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve))
    if (previous === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previous
    rmSync(dir, { recursive: true, force: true })
  }
})
