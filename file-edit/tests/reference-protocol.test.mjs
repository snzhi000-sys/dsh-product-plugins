import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  decodeFileReference, encodeFileReference,
  fileReferenceClipboardText, fileReferenceModelText,
} from '../client/src/reference-protocol.js'

test('v2 owner ref preserves file kind, path, and line range while clipboard stays readable', () => {
  const encoded = encodeFileReference({ path: '目录/示例.md', start: 5, end: 12, kind: 'file' })
  assert.deepEqual(decodeFileReference(encoded), {
    path: '目录/示例.md', start: 5, end: 12, kind: 'file',
  })
  assert.equal(fileReferenceClipboardText(encoded), '@目录/示例.md:5-12')
})

test('legacy refs remain decodable and can acquire a folder kind at insertion', () => {
  assert.deepEqual(decodeFileReference('src/example.ts:8-9'), {
    path: 'src/example.ts', start: 8, end: 9, kind: 'file',
  })
  assert.equal(decodeFileReference('src', 'folder').kind, 'folder')
})

test('the model text is the official mention plus the line range, with no line bodies', () => {
  assert.equal(
    fileReferenceModelText({ path: 'docs/示例.md', start: 12, end: 19, kind: 'file' }),
    ' @docs/示例.md 第12-19行',
  )
  assert.equal(
    fileReferenceModelText({ path: 'docs/示例.md', start: 7, end: 7, kind: 'file' }),
    ' @docs/示例.md 第7行',
  )
  // A plain file reference is exactly the official mention, so the transcript
  // decorates it as a chip and its click resolves the real path.
  assert.equal(fileReferenceModelText({ path: 'docs/a.ts', start: 0, end: 0, kind: 'file' }), ' @docs/a.ts')
  // A directory keeps the trailing slash the transcript reads as folder kind.
  assert.equal(fileReferenceModelText({ path: 'src', start: 0, end: 0, kind: 'folder' }), ' @src/')
  // Whitespace leaves the `@name` grammar, so the quoted official form is used.
  assert.equal(
    fileReferenceModelText({ path: 'my notes/a b.md', start: 3, end: 4, kind: 'file' }),
    ' @"my notes/a b.md" 第3-4行',
  )
})

test('the model text carries the separating space the transcript chip rule needs', () => {
  // The transcript matches `(^|\s)@name`, and CJK prose ends in punctuation
  // that is not whitespace: `见上文。@a.md` decorates nothing. The leading space
  // is what makes a reference inserted mid-sentence render as a chip.
  const re = /(^|\s)@[^\s]+/u
  const cjkPunctuation = '这个是我在只读浏览上面进行的引用：'
  assert.equal(re.test(cjkPunctuation + fileReferenceModelText({ path: 'a.md', start: 13, end: 17, kind: 'file' })), true)
  assert.equal(re.test(cjkPunctuation + '@a.md 第13-17行'), false)
})

test('the model text never carries a line body', () => {
  const text = fileReferenceModelText({ path: 'a.ts', start: 50, end: 60, kind: 'file' })
  assert.equal(text.includes('<'), false)
  assert.equal(text.includes('CDATA'), false)
  assert.equal(text.includes('\n'), false)
})
