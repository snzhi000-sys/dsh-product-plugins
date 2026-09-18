/**
 * The rendered Markdown view annotates every text run with the `.md` source line it came
 * from, so a selection can become a real `path:start-end` reference. These tests run the
 * shipped renderer patch against the shipped markdown-it build, not a re-implementation.
 *
 * Both halves are extracted from `client/src/client.js` between the markers that the
 * vendoring already uses, so the assertions below cover the code the browser runs.
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const sourceUrl = new URL('../client/src/client.js', import.meta.url)

/** Load the vendored markdown-it build and the source-line patch from the plugin source. */
async function load() {
  const source = await readFile(sourceUrl, 'utf8')
  const iifeStart = source.indexOf('const MarkdownIt = (() => {')
  const iifeEnd = source.indexOf('// ==== end markdown-it vendored ====')
  assert.ok(iifeStart > 0 && iifeEnd > iifeStart, 'vendored markdown-it markers are present')
  const patchStart = source.indexOf('// ==== markdown source lines (begin) ====')
  const patchEnd = source.indexOf('// ==== markdown source lines (end) ====')
  assert.ok(patchStart > 0 && patchEnd > patchStart, 'source-line patch markers are present')
  const MarkdownIt = new Function(source.slice(iifeStart, iifeEnd) + '\n;return MarkdownIt;')()
  const markdownSourceLines = new Function(source.slice(patchStart, patchEnd) + '\n;return markdownSourceLines;')()
  const annotate = (text) => {
    const md = new MarkdownIt({ html: false, linkify: true })
    markdownSourceLines(md)
    return md.render(text)
  }
  const plain = (text) => new MarkdownIt({ html: false, linkify: true }).render(text)
  return { annotate, plain }
}

/** Every annotated text run with the line the renderer attributed it to. */
function runs(html) {
  return [...html.matchAll(/<span data-line="(\d+)">([^<]*)<\/span>/g)].map(([, line, text]) => ({ line: Number(line), text }))
}

/** Strip the annotation so the patch can be compared against an unpatched render. */
function strip(html) {
  return html
    .replace(/<span data-line="\d+">([\s\S]*?)<\/span>/g, '$1')
    .replace(/ data-line="\d+"/g, '')
}

const DOC = [
  '# Title', // 1
  '', // 2
  'Alpha one', // 3
  'alpha two', // 4
  'alpha three', // 5
  '', // 6
  '- item one', // 7
  '- item two', // 8
  '', // 9
  '```js', // 10
  'const a = 1;', // 11
  'const b = 2;', // 12
  '```', // 13
  '', // 14
  '> quoted', // 15
  '', // 16
  '| h1 | h2 |', // 17
  '| -- | -- |', // 18
  '| a  | b  |', // 19
].join('\n')

test('every annotated text run names the source line that produced it', async () => {
  const { annotate } = await load()
  const lines = DOC.split('\n')
  const annotated = runs(annotate(DOC))
  assert.ok(annotated.length >= 13, `expected the whole document to be annotated, saw ${annotated.length} runs`)
  for (const { line, text } of annotated) {
    assert.match(lines[line - 1] ?? '', new RegExp(text.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `"${text}" is attributed to line ${line}, which reads "${lines[line - 1]}"`)
  }
})

test('a soft-wrapped paragraph is split per source line instead of collapsing to its first line', async () => {
  const { annotate } = await load()
  const annotated = runs(annotate(DOC))
  assert.deepEqual(annotated.slice(1, 4).map(run => [run.line, run.text]), [
    [3, 'Alpha one'],
    [4, 'alpha two'],
    [5, 'alpha three'],
  ])
})

test('fenced code lines, table rows and list items each carry their own line', async () => {
  const { annotate } = await load()
  const annotated = runs(annotate(DOC))
  const lineOf = (text) => annotated.find(run => run.text.trim() === text)?.line
  assert.equal(lineOf('const a = 1;'), 11)
  assert.equal(lineOf('const b = 2;'), 12)
  assert.equal(lineOf('item one'), 7)
  assert.equal(lineOf('item two'), 8)
  assert.equal(lineOf('quoted'), 15)
  // Both cells of one table row belong to that row's single source line.
  assert.equal(lineOf('h1'), 17)
  assert.equal(lineOf('a'), 19)
})

test('a code span keeps its own start line; text after a wrapped one inherits it', async () => {
  const { annotate } = await load()
  const doc = ['before', '`code', 'span` tail'].join('\n')
  const annotated = runs(annotate(doc))
  // markdown-it folds the code span's line break into a space, so the rendered text cannot
  // distinguish line 2 from line 3: the span keeps its start line and ' tail' stays with it.
  // Drift is bounded to this block — the next block tag re-anchors the counter.
  assert.deepEqual(annotated.map(run => [run.line, run.text]), [
    [1, 'before'],
    [2, ' tail'],
  ])
  assert.match(annotate(doc), /<code data-line="2">code span<\/code>/)
})

test('the annotation only adds attributes and wrappers: the rendered output is otherwise unchanged', async () => {
  const { annotate, plain } = await load()
  assert.equal(strip(annotate(DOC)), plain(DOC))
  const inline = '# T\n\nplain **bold** and `code` and [link](https://example.com) and ![alt](x.png)\n'
  assert.equal(strip(annotate(inline)), plain(inline))
})
