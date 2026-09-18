import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const sourceUrl = new URL('../client/src/client.js', import.meta.url)

test('file and folder glyphs come from the official icon set, not from hand-drawn paths', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  // 官方图标是基线平台模块：键名就是包名，走模块表 require，不参与打包。
  assert.match(source, /require\('@deepseek-ai\/dsh-client-ui-primitives'\)/)
  assert.match(source, /const \{ FileTypeIcon, IconFolderClose16, IconFolderOpen16 \} = require\('@deepseek-ai\/dsh-client-ui-primitives'\)/)
  // 审核列表、文件树、删除批次与文件标签都用官方那套：文件按类型分类，文件夹分开关状态。
  assert.match(source, /React\.createElement\(FileTypeIcon, \{ path: item\.path, size: 15 \}\)/)
  assert.match(source, /React\.createElement\(FileTypeIcon, \{ path: node\.path, size: 15 \}\)/)
  assert.match(source, /React\.createElement\(FileTypeIcon, \{ path: child\.path, size: 15 \}\)/)
  assert.match(source, /React\.createElement\(FileTypeIcon, \{ path: t, size: 15 \}\)/)
  assert.match(source, /React\.createElement\(open \? IconFolderOpen16 : IconFolderClose16, \{ size: 15 \}\)/)
  // 插件自绘的通用文件/文件夹字形已删除。
  assert.doesNotMatch(source, /IconFile\(\)|IconFolder\(\)/)
  assert.doesNotMatch(source, /const IconFolder = \(\) => I\(14/)
})
