/**
 * Real Cubism mouth movement. Live2D ships no authored mouth animation, so the renderer drives the model's own
 * mouth parameter from the cue timeline; this proves it against actual models in a browser: the parameter
 * follows the cues, scales with a recipe weight, goes neutral while the audio is silent, and is released when
 * the clip ends. One model per Cubism generation runs, because the parameter id and core API differ.
 */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { assetRoot, builtinLibrary } from '../src/builtin-library.mjs'
import { speechCues } from '../src/speech-cues.mjs'
import { weightedTimeline } from '../src/action-presets.mjs'

/**
 * The reported sentence and the subtitle payload the voice service actually returned for it on 2026-09-20: the
 * Chinese tokens are timed plausibly and every token carrying digits or symbols is exactly 30 ms wide, so the
 * whole reading of `+11.5%` used to be spoken into 30 ms and the hole it left was covered by a closed mouth.
 */
const reported = {
  text: '电子 +11.5%、汽车 +11.0%、专用设备 +12.0%。',
  duration: 10.596,
  words: [
    { word: '电', startTime: .375, endTime: .695 }, { word: '子', startTime: .695, endTime: 1.075 },
    { word: '+11.5%、', startTime: 1.075, endTime: 1.105 }, { word: '汽', startTime: 3.665, endTime: 3.995 },
    { word: '车', startTime: 3.995, endTime: 4.455 }, { word: '+11.0%、', startTime: 4.955, endTime: 4.985 },
    { word: '专', startTime: 5.325, endTime: 5.395 }, { word: '用', startTime: 5.395, endTime: 5.425 },
    { word: '设', startTime: 5.625, endTime: 5.855 }, { word: '备', startTime: 6.425, endTime: 6.485 },
    { word: '+12.0%。', startTime: 6.645, endTime: 6.675 },
  ],
  mask: { segments: [[.35, 1.06], [1.24, 3.36], [3.71, 4.41], [4.77, 6.71], [6.89, 8.12], [8.3, 10.42]], last: 10.42 },
}

// Playwright belongs to the application checkout, not to this package: the standalone plugin repo installs no
// browser test dependency, so the script borrows the one the desktop probes use.
const anchor = [
  process.env.PET_PLAYWRIGHT_ROOT,
  fileURLToPath(new URL('../../../upstream-harness-0.1.6-alpha.2/apps/web/package.json', import.meta.url)),
  fileURLToPath(new URL('../../../deepseek-harness/apps/web/package.json', import.meta.url)),
].filter(Boolean).find(candidate => existsSync(candidate))
if (anchor === undefined) throw new Error('找不到 playwright：请设置 PET_PLAYWRIGHT_ROOT 指向包含 playwright 的应用目录')
const { chromium } = createRequire(anchor)('playwright')

// The routes the model needs come straight from the plugin's own catalogue: this package installs no kernel
// dependency, so the smoke does not go through the host plugin to reach them.
const library = builtinLibrary()
const MIME = { '.json': 'application/json', '.moc3': 'application/octet-stream', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.js': 'text/javascript' }
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')
  const send = (type, body) => { res.setHeader('content-type', type); res.end(body) }
  try {
    if (url.pathname === '/fixture') return send('text/html', '<body style="margin:0;background:#eee"><div id="stage" style="width:420px;height:600px"></div></body>')
    if (url.pathname === '/desktop-pet/api/model') return send('application/json', JSON.stringify(await library.describe(url.searchParams.get('id') || library.defaultId)))
    if (url.pathname === '/desktop-pet/core.js') return send('text/javascript', await readFile(join(assetRoot, 'cores/live2dcubismcore.min.js')))
    if (url.pathname === '/desktop-pet/core2.js') return send('text/javascript', await readFile(join(assetRoot, 'cores/live2d.min.js')))
    if (url.pathname === '/desktop-pet/pixi8.js') return send('text/javascript', await readFile(join(assetRoot, 'cores/pixi8.js')))
    if (url.pathname === '/desktop-pet/dragonbones-core.js') return send('text/javascript', await readFile(join(assetRoot, 'cores/dragonbones.js')))
    if (url.pathname === '/desktop-pet/dragonbones.js') return send('text/javascript', await readFile(new URL('../dist/dragonbones.js', import.meta.url)))
    if (url.pathname === '/desktop-pet/live2d.js') return send('text/javascript', await readFile(new URL('../dist/live2d.js', import.meta.url)))
    if (url.pathname === '/desktop-pet/live2d2.js') return send('text/javascript', await readFile(new URL('../dist/live2d2.js', import.meta.url)))
    if (url.pathname.startsWith('/desktop-pet/models/')) {
      const [id, ...parts] = decodeURIComponent(url.pathname.slice('/desktop-pet/models/'.length)).split('/')
      const file = await library.asset(id, parts.join('/'))
      return send(MIME[extname(file)] ?? 'application/octet-stream', await readFile(file))
    }
    res.writeHead(404); res.end('{}')
  } catch (error) { res.writeHead(400); res.end(JSON.stringify({ error: error.message })) }
})
server.listen(0, '127.0.0.1'); await once(server, 'listening')

const browser = await chromium.launch({ headless: true })
try {
  const models = process.env.PET_MOUTH_MODELS ? process.env.PET_MOUTH_MODELS.split(',') : ['gfl-88type', 'companion-01']
  for (const id of models) {
    const page = await browser.newPage({ viewport: { width: 420, height: 600 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}/fixture`)
    const prepared = await page.evaluate(async modelId => {
      const info = await (await fetch(`/desktop-pet/api/model?id=${modelId}`)).json()
      await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = info.kind === 'cubism2' ? '/desktop-pet/core2.js' : '/desktop-pet/core.js'; script.onload = resolve; script.onerror = reject; document.head.append(script) })
      const module = await import(info.kind === 'cubism2' ? '/desktop-pet/live2d2.js' : '/desktop-pet/live2d.js')
      window.clock = performance.now(); performance.now = () => clock
      window.pet = await module.createLive2DRenderer(document.querySelector('#stage'), { animated: true }, error => { throw error }, info)
      window.step = count => { for (let index = 0; index < count; index++) { clock += 1000 / 60; pet.update(clock, { x: -1, y: -1 }) } }
      window.parameter = () => { const values = pet.inspect().parameters; return values.ParamMouthOpenY ?? values.PARAM_MOUTH_OPEN_Y }
      await new Promise(resolve => setTimeout(resolve, 120)); step(30)
      return { kind: info.kind, hasSpeech: pet.speech !== undefined, declared: info.parameterIds.some(name => name === 'ParamMouthOpenY' || name === 'PARAM_MOUTH_OPEN_Y') }
    }, id)
    assert.equal(prepared.declared, true, `${id} (${prepared.kind}) declares a mouth parameter`)
    assert.equal(prepared.hasSpeech, true, `${id} (${prepared.kind}) exposes a mouth driver`)

    // The core model restores its parameters at the end of every frame, so a value cannot be read back after
    // the fact. The renderer reports what its driver wrote AND what the core model stored, which is what
    // `coreModel.update()` evaluates; the clock is driven by hand so each sample is reproducible.
    const sample = async (shape) => page.evaluate(value => {
      pet.speech.cancel()
      const start = clock
      // The cue timeline is in seconds; the scripted clock counts milliseconds.
      pet.speech.start({ duration: 10, cues: [{ time: 0, shape: value.shape, weight: value.weight }] }, () => (clock - start) / 1000)
      if (value.silence) pet.speech.silence(true)
      step(1)
      const snapshot = pet.inspect()
      if (value.silence) pet.speech.silence(false)
      return snapshot.spokenMouth
    }, { shape: shape.shape, weight: shape.weight, silence: shape.silence === true })

    const open = await sample({ shape: 'a' })
    const half = await sample({ shape: 'i', weight: .5 })
    const full = await sample({ shape: 'i', weight: 1 })
    const closed = await sample({ shape: 'm' })
    const muted = await sample({ shape: 'a', silence: true })
    assert.equal(Math.abs(open.readBack - 1) < .001, true, `${id}: a full open vowel reaches the core model, got ${JSON.stringify(open)}`)
    assert.equal(Math.abs(half.readBack - .17) < .001, true, `${id}: a half-weight shape opens halfway, got ${JSON.stringify(half)}`)
    assert.equal(full.readBack > half.readBack, true, `${id}: a recipe weight scales the opening, got ${JSON.stringify({ half, full })}`)
    assert.equal(closed.readBack < .05, true, `${id}: the closed shape shuts the mouth, got ${JSON.stringify(closed)}`)
    assert.equal(muted.readBack < .05, true, `${id}: silence shuts the mouth while the clip keeps running, got ${JSON.stringify(muted)}`)
    await page.evaluate(() => { pet.speech.cancel(); step(1) })

    assert.equal(errors.length, 0, `${id}: the renderer must not throw: ${errors.join('; ')}`)
    console.log(`  ${id} (${prepared.kind}) 口型通过：写入核心模型并可回读 a=${open.readBack.toFixed(3)}、i×0.5=${half.readBack.toFixed(3)}、i×1=${full.readBack.toFixed(3)}、闭合=${closed.readBack.toFixed(3)}、静音=${muted.readBack.toFixed(3)}`)
    await page.close()
  }
  console.log('真实 Live2D 口型验证通过（cubism4 与 cubism2 各一个角色）')

  // The character the report came from: a DragonBones model, driven by cues generated from real text. Digits had
  // no vowel and therefore closed the mouth for their whole span; the same text must now open it.
  const digital = 'Counting: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 · GDP grew 5% · USB-C · A+B=C'
  const page = await browser.newPage({ viewport: { width: 420, height: 600 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`http://127.0.0.1:${server.address().port}/fixture`)
  const peaks = await page.evaluate(async payload => {
    const info = await (await fetch('/desktop-pet/api/model?id=mengmei')).json()
    const load = src => new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = src; script.onload = resolve; script.onerror = reject; document.head.append(script) })
    await load('/desktop-pet/pixi8.js'); await load('/desktop-pet/dragonbones-core.js')
    const module = await import('/desktop-pet/dragonbones.js')
    window.clock = performance.now(); performance.now = () => clock
    window.pet = await module.createDragonBonesRenderer(document.querySelector('#stage'), { animated: true }, error => { throw error }, info)
    window.step = count => { for (let index = 0; index < count; index++) { clock += 1000 / 60; pet.update(clock, { x: -1, y: -1 }) } }
    await new Promise(resolve => setTimeout(resolve, 120)); step(30)
    const measure = timeline => {
      const start = clock
      pet.speech.start(timeline, () => (clock - start) / 1000)
      let peak = 0, frames = 0, open = 0
      // The neutral shape is `m`, whose weight is one whenever the mouth is shut: only the other shapes say
      // anything about whether it opened. The first second is the blend out of whatever the previous sample left
      // behind, so it is not measured, and the clip is then followed for its own length.
      const steps = Math.ceil((timeline.duration + 1) * 60)
      for (let index = 0; index < steps; index++) {
        step(1)
        if (index < 70) continue
        frames++
        let widest = 0
        for (const weight of pet.inspect().mouthWeights) if (weight.shape !== 'm') widest = Math.max(widest, weight.weight)
        if (widest > .2) open++
        peak = Math.max(peak, widest)
      }
      pet.speech.cancel()
      return { peak, share: open / Math.max(1, frames) }
    }
    return {
      digits: measure(payload.digits),
      closed: measure({ duration: payload.digits.duration, cues: [{ time: 0, shape: 'm' }] }),
      alignment: payload.digits.alignment,
      reported: measure(payload.reported),
      reportedAlignment: payload.reported.alignment,
    }
  }, { digits: speechCues(digital, 6), reported: weightedTimeline(speechCues(reported.text, reported.duration, reported.words, reported.mask), null, 'dragonbones') })
  assert.equal(peaks.digits.peak > .2, true, `mengmei must open its mouth on digits, got ${JSON.stringify(peaks)}`)
  assert.equal(peaks.closed.peak < .2, true, `the control timeline must stay shut, got ${JSON.stringify(peaks)}`)
  // The sentence from the report, through the repaired timeline: the model has to be visibly open for most of it,
  // not merely reach one wide frame. Before the repair this timeline was 30 ms of cues and a shut mouth held
  // across each spoken number.
  assert.equal(peaks.reported.peak > .5, true, `the reported sentence must open the mouth wide, got ${JSON.stringify(peaks.reported)}`)
  assert.equal(peaks.reported.share > .5, true, `the reported sentence must look open most of the time, got ${JSON.stringify(peaks.reported)}`)
  assert.equal(errors.length, 0, `mengmei: the renderer must not throw: ${errors.join('; ')}`)
  console.log(`  萌妹（dragonbones）数字口型通过：真实文本 "${digital}" 的口型峰值 ${peaks.digits.peak.toFixed(3)}（对照纯闭嘴时间轴 ${peaks.closed.peak.toFixed(3)}，对齐方式 ${peaks.alignment}）`)
  console.log(`  萌妹（dragonbones）实测压缩字幕通过："${reported.text}" 修复后口型峰值 ${peaks.reported.peak.toFixed(3)}、可见张开帧占比 ${(peaks.reported.share * 100).toFixed(0)}%（对齐方式 ${peaks.reportedAlignment}）`)
  await page.close()
} finally {
  await browser.close().catch(() => {})
  server.closeAllConnections(); await new Promise(resolve => { server.close(resolve) })
}
