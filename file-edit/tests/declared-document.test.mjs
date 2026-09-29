import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const sourceUrl = new URL('../client/src/client.js', import.meta.url)

// A declared deliverable has no baseline, but the content it names is on disk and the host ships it. The pane used
// to render the notice alone, so opening the row gave the reviewer nothing to read — the file could not be
// inspected, only accepted blind (reported 2026-09-24).
test('a declared deliverable with content browses as a read-only document', async () => {
  const source = await readFile(sourceUrl, 'utf8')

  assert.match(source, /const declaredDocument = !!diff && diff\.note === 'present-declared' && Array\.isArray\(diff\.current\)/)
  assert.match(source, /const sourceText = \(cleanDocument \|\| declaredDocument\)/)

  const declaredAt = source.indexOf('if (declaredDocument) {')
  const noticeAt = source.indexOf('if (diff.note) {')
  assert.notEqual(declaredAt, -1, 'the declared document branch exists')
  assert.notEqual(noticeAt, -1, 'the notice-only branch still serves the notes that truly have no content')
  assert.ok(declaredAt < noticeAt, 'the declared branch must win before the notice-only branch swallows it')

  const branch = source.slice(declaredAt, noticeAt)
  assert.match(branch, /WholeDocumentEditor/, 'the content uses the same document view a clean file gets')
  assert.match(branch, /readOnly: true/, 'the declared content is browseable but never editable')
  assert.match(branch, /模型声明交付此文件/, 'the notice stays, so the reviewer knows why only accept is offered')
  assert.match(branch, /renderMarkdown\(sourceText\)/, 'a declared markdown deliverable renders like a clean one')
})

test('a declared deliverable keeps its accept action and stays unrestorable', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  // Accept/reject/refresh come from `showActions`, stamped by the host's `changed`; the host keeps `changed` true
  // for a declaration and marks it unrestorable, so reject is the only action that goes away.
  assert.match(source, /const showActions = diff\.changed === true/)
  assert.match(source, /disabled: !!reviewAction \|\| diff\.restorable === false/)
  assert.match(source, /const declaredDocument = !!diff && diff\.note === 'present-declared'/)
})
