import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import { resolveFileTarget } from '../client/src/file-target.js'

const sourceUrl = new URL('../client/src/client.js', import.meta.url)

test('a target carries an explicit line range through to the view', () => {
  assert.deepEqual(resolveFileTarget({ line: 12, endLine: 18 }, 0), { line: 12, endLine: 18 })
  // A range that ends before it starts cannot be highlighted, so it collapses to the start line.
  assert.deepEqual(resolveFileTarget({ line: 12, endLine: 3 }, 0), { line: 12, endLine: 12 })
  assert.deepEqual(resolveFileTarget({ line: 12 }, 0), { line: 12, endLine: 12 })
})

test('a first-change target resolves once the view knows its first changed line', () => {
  assert.deepEqual(resolveFileTarget({ line: 0, firstChange: true }, 42), { line: 42, endLine: 42 })
  // Nothing changed (or no diff yet): the reader still lands on the top of the file.
  assert.deepEqual(resolveFileTarget({ line: 0, firstChange: true }, 0), { line: 1, endLine: 1 })
})

test('a target without a usable line is refused instead of scrolling nowhere', () => {
  assert.equal(resolveFileTarget(null, 42), null)
  assert.equal(resolveFileTarget({ line: 0, endLine: 0 }, 0), null)
  assert.equal(resolveFileTarget({ line: Number.NaN }, 0), null)
})

test('the review list opens a file at its first change, not at the top', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  assert.match(source, /store\.openFile\(reviewId, props\.sid, item\.path, \{ firstChange: true \}\)/)
  assert.match(source, /openFile\(path, sessionId, displayPath, target\) \{/)
  assert.match(source, /claimFileTarget\(path, firstChangeLine\) \{/)
  // 目标只交付一次：认领即删除，后续轮询与编辑不会再抢滚动位置。
  assert.match(source, /this\.fileTargets\.delete\(path\)\n            return resolveFileTarget\(target, firstChangeLine\)/)
})

test('the page entry forwards a caller-supplied line range', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  assert.match(source, /store\.openFile\(String\(result\.id\), undefined, String\(result\.path \|\| result\.id\), \{\n            line: request\.line,\n            endLine: request\.endLine,\n          \}\)/)
})

test('the view scrolls to the target line and highlights it for 1.2s', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  // 行节点两种写法都认：diff/只读行是 data-n，Markdown 源码视图是 data-line。
  assert.match(source, /querySelector\('\[data-n="' \+ line \+ '"\]\, \[data-line="' \+ line \+ '"\]'\)/)
  assert.match(source, /if \(!pendingTarget \|\| documentMode === 'edit'\) return/)
  assert.match(source, /scrollNodeIntoView\(nodes\[0\]\)/)
  assert.match(source, /node\.classList\.add\('dsh-fe-target'\)/)
  assert.match(source, /node\.classList\.remove\('dsh-fe-target'\) \}, 1200\)/)
  // 编辑视图自己定位：选中整段目标行并滚进视野。
  assert.match(source, /lineTarget: editorLineTarget/)
  assert.match(source, /view\.dispatch\(\{ selection: \{ anchor: from\.from, head: to\.to \}, scrollIntoView: true \}\)/)
  assert.match(source, /'\.dsh-fe-target \{ box-shadow:inset 0 0 0 9999px color-mix\(in srgb, var\(--dsw-alias-state-warn-primary\) 14%, transparent\); \}'/)
})

test('the target effect stays above the pane early returns so hook order is stable', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  const hook = source.indexOf("const pendingTarget = store.fileTargets.get(path) || null")
  const firstReturn = source.indexOf("if (!diff) {\n            return React.createElement('div', { className: 'dsh-fe-msg' }")
  assert.ok(hook > 0 && firstReturn > 0 && hook < firstReturn, 'target hook must precede the pane early return')
})
