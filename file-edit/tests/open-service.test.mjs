import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const sourceUrl = new URL('../client/src/client.js', import.meta.url)

test('the open entry is a versioned Cordis service other plugins read with ctx.get', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  assert.match(source, /const fileEditOpenService = \{ version: 1, open: fileEditOpen \}/)
  assert.match(source, /ctx\.effect\(\(\) => ctx\.provide\('dshFileEditOpen', fileEditOpenService\)\)/)
})

test('the page global stays as a one-version fallback that publishes only the open entry', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  assert.match(source, /window\.__dshFileEdit = \{ open: fileEditOpen \}/)
  // 发布方只提供有消费方的入口：另外三个方法在任何树里都没有调用方。
  assert.doesNotMatch(source, /rename: \(from, to\) => \{ store\.renamePath/)
  assert.doesNotMatch(source, /remove: \(path\) => \{ store\.removePath\(path\) \}/)
  assert.doesNotMatch(source, /markDeleted: \(path\) => \{ store\.markDeleted\(path\) \}/)
})
