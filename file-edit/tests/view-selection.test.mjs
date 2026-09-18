import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const sourceUrl = new URL('../client/src/client.js', import.meta.url)

test('the published open() reports a refusal as false so the caller can fall back', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  const openAt = source.indexOf('const fileEditOpen = async (request) => {')
  assert.notEqual(openAt, -1)
  const body = source.slice(openAt, source.indexOf('const fileEditOpenService', openAt))
  assert.doesNotMatch(body, /throw new Error/)
  assert.doesNotMatch(body, /return true/)
  assert.match(body, /return activateFilesView\(sid\)/)
  assert.match(body, /if \(!result \|\| !result\.ok \|\| !result\.id\) return false/)
  assert.match(body, /if \(current && String\(current\) !== sid\) return false/)
})

test('the browser is hosted by the official right Sidebar page tab', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  const activateAt = source.indexOf('const activateFilesView = (sid) => {')
  assert.notEqual(activateAt, -1)
  const activate = source.slice(activateAt, source.indexOf('// [文件引用]', activateAt))
  const sidebarAt = activate.indexOf("ctx.get('sidebarRight')")
  const legacyAt = activate.indexOf("conversation.activateView")
  assert.notEqual(sidebarAt, -1)
  assert.notEqual(legacyAt, -1)
  assert.ok(sidebarAt < legacyAt, 'the Sidebar host is tried before the legacy conversation view')
  assert.match(activate, /sidebar\.openTab\(FILE_BROWSER_KIND\)/)
  // The removed conversation view selector must not come back: the Sidebar host is a page tab.
  assert.doesNotMatch(source, /conversation\.selectView/)
})

test('the browser chrome follows the official Sidebar tab strip', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  // The official chip is a 28px capsule: no border, 12px radius, 13px type, a tag fill
  // when active and the interactive hover fill otherwise.
  assert.match(source, /\.dsh-fe-filetab \{ position:relative; height:28px; padding:0 10px; border:none; border-radius:12px; font-size:var\(--dsh-content-font-size-secondary, 13px\)/)
  assert.match(source, /\.dsh-fe-filetab:hover \{ background:var\(--dsw-alias-interactive-bg-hover\)/)
  assert.match(source, /\.dsh-fe-filetab-on, \.dsh-fe-filetab-on:hover \{ background:var\(--dsw-alias-markdown-tag\)/)
  // Chips are separated by the official 10px slot hairline, cleared beside the active chip.
  assert.match(source, /\.dsh-fe-filetabs-scroll \{ gap:10px; \}/)
  assert.match(source, /\.dsh-fe-filetab::before \{[^}]*background:var\(--dsw-alias-border-l4\)/)
  // The slots beside the active capsule clear: the one it draws itself, and the next chip's.
  assert.match(source, /\.dsh-fe-filetab:first-child::before, \.dsh-fe-filetab-on::before, \.dsh-fe-filetab-on \+ \.dsh-fe-filetab::before \{ background:transparent; \}/)
  // The close control is a 20px circle in tertiary ink, revealed on hover, focus, or the active chip.
  assert.match(source, /\.dsh-fe-tab-x \{ width:20px; height:20px;[^}]*color:var\(--dsw-alias-label-tertiary\); opacity:0; pointer-events:none;/)
  assert.match(source, /\.dsh-fe-filetab:hover \.dsh-fe-tab-x, \.dsh-fe-filetab:focus-within \.dsh-fe-tab-x, \.dsh-fe-filetab-on \.dsh-fe-tab-x \{ opacity:1; pointer-events:auto; \}/)
  // The strip controls are the official 28px round buttons, and the pane-hosted viewer is not a card.
  assert.match(source, /\.dsh-fe-tab-more \{ width:28px; height:28px; border-radius:28px; \}/)
  assert.match(source, /\.dsh-fe-sidebar-host \.dsh-fe-viewer \{ border:none; border-radius:0; \}/)
  // The pane ground is --dsw-alias-bg-base, which differs from bg-layer-1 in the dark theme.
  assert.match(source, /\.dsh-fe-sidebar-host \.dsh-fe-viewer, \.dsh-fe-sidebar-host \.dsh-fe-filetabs, \.dsh-fe-sidebar-host \.dsh-fe-toolbar \{ background:var\(--dsw-alias-bg-base\); \}/)
  // The pane's own tab strip (the parent) is divided from these child document tabs by a hairline on
  // the child row's top edge; an inset shadow draws it without shifting the chips by half a pixel.
  assert.match(source, /\.dsh-fe-sidebar-host \.dsh-fe-filetabs \{ border-radius:0; box-shadow:inset 0 0\.5px 0 var\(--dsw-alias-border-l4\), inset 0 -1px 0 var\(--dsw-alias-border-l1\); margin-top:12px; padding-top:12px; padding-bottom:11px; \}/)
  // The child row is fenced from the content row below it by the child row's own 11px bottom padding
  // and the pane's hairline; the toolbar's 6px top and bottom padding then hold the content row
  // symmetric. A top margin here is what used to make the gap above the status chip oversized.
  assert.doesNotMatch(source, /\.dsh-fe-sidebar-host \.dsh-fe-toolbar \{ margin-top:/)
  // The browser's review buttons are the same circles over the official interaction fill as the list's.
  assert.match(source, /'\.dsh-fe-sidebar-host \.dsh-fe-iconbtn, \.dsh-fe-sidebar-host \.dsh-fe-secbtn \{ border-radius:999px; \}'/)
  assert.match(source, /'\.dsh-fe-sidebar-host \.dsh-fe-iconbtn:hover, \.dsh-fe-sidebar-host \.dsh-fe-secbtn:hover \{ background:var\(--dsw-alias-interactive-bg-hover\); color:var\(--dsw-alias-label-primary\); \}'/)
  assert.match(source, /'\.dsh-fe-sidebar-host \.dsh-fe-iconbtn-ok:hover \{ color:var\(--dsh-fe-review-add, var\(--dsw-alias-state-success-primary\)\); \}'/)
  assert.match(source, /'\.dsh-fe-sidebar-host \.dsh-fe-iconbtn-no:hover \{ color:var\(--dsw-alias-state-error-primary\); \}'/)
  // The content area keeps the plugin's own type and insets: the reader rejected the official
  // document inset and the official content-row geometry (16px header inset, 0.5px rules, 13px).
  assert.doesNotMatch(source, /dsh-fe-sidebar-host \.dsh-fe-toolbar \{ padding:/)
  assert.doesNotMatch(source, /\.dsh-fe-sidebar-host \.dsh-fe-toolbar \.dsh-fe-btn/)
  assert.doesNotMatch(source, /\.dsh-fe-sidebar-host \.dsh-fe-deleted-hint/)
  assert.doesNotMatch(source, /\.dsh-fe-sidebar-host \.dsh-fe-diff, \.dsh-fe-sidebar-host \.dsh-fe-document-editor \{/)
  assert.doesNotMatch(source, /\.dsh-fe-sidebar-host \.dsh-fe-diff, \.dsh-fe-sidebar-host \.dsh-fe-document-editor \.cm-scroller \{/)
  // The content area still scrolls, but draws no bar: the reader asked for the indicator to go.
  assert.match(source, /'\.dsh-fe-diff, \.dsh-fe-mdwrap, \.dsh-fe-document-editor \.cm-scroller \{ scrollbar-width:none; \}'/)
  assert.match(source, /'\.dsh-fe-diff::-webkit-scrollbar, \.dsh-fe-mdwrap::-webkit-scrollbar, \.dsh-fe-document-editor \.cm-scroller::-webkit-scrollbar \{ width:0; height:0; \}'/)
  // Status chips take the official Tag primitive: capsule geometry and tone fills.
  assert.match(source, /\.dsh-fe-sidebar-host \.dsh-fe-chip \{ border:none; border-radius:999px; padding:1px 8px; font-size:11px; line-height:17px; font-weight:500; background:var\(--dsw-alias-bg-module-platform\); color:var\(--dsw-alias-label-secondary\); \}/)
  assert.match(source, /\.dsh-fe-sidebar-host \.dsh-fe-chip-add \{ border:none; background:color-mix\(in srgb, var\(--dsh-fe-review-add, var\(--dsw-alias-state-success-primary\)\) 10%, transparent\);/)
  assert.match(source, /\.dsh-fe-sidebar-host \.dsh-fe-chip-del \{ border:none; background:color-mix\(in srgb, var\(--dsw-alias-state-error-primary\) 10%, transparent\);/)
})

test('the tab type and its body are registered, and the conversation host only survives without them', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  assert.match(source, /sidebarCtx\.sidebarRightTabs\.register\(\{/)
  assert.match(source, /kind: FILE_BROWSER_KIND/)
  assert.match(source, /name: 'sidebar\.right\.pane\.tab', key: FILE_BROWSER_KIND/)
  // A page type exposes no guide entry, so the browser never becomes a permanent, empty tab.
  assert.doesNotMatch(source, /guide:/)
  assert.match(source, /if \(!ctx\.get\('sidebarRightTabs'\)\) registerConversationHost\(\)/)
  // The sidebar body drives the editor's screen state and leaves no blank tab behind.
  // The overlay posture stays with the conversation host; the Sidebar host must not drive it,
  // otherwise opening the right column floats the review bar over the plan panel.
  assert.match(source, /if \(props\.hostConversationView === false\) \{/)
  assert.match(source, /store\.setFileViewActive\(props\.hostVisible === undefined \? true : !!props\.hostVisible\)/)
  assert.match(source, /hostConversationView: false,/)
  assert.doesNotMatch(source, /hostVisible: visible,/)
  assert.match(source, /tabInfo\.tab\.actions\.close\(\)/)
  assert.match(source, /props\.hostDockless === true \? 0 : \(store\.dockH \|\| 0\)/)
})

test('the rendered Markdown view turns a selection into a real line-range reference', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  // The parser is annotated with source lines before anything renders through it.
  assert.match(source, /const mdParser = new MarkdownIt\(\{ html: false, linkify: true, highlight: mdHighlight \}\)\n\s*markdownSourceLines\(mdParser\)/)
  // A selection inside .dsh-fe-md reads its line range from the renderer's own annotation,
  // and is flagged so the bubble inserts through the plugin codec instead of an official mention.
  assert.match(source, /const insideMarkdown = node => \(node\?\.nodeType === 1 \? node : node\?\.parentElement\)\?\.closest\?\.\('\.dsh-fe-md'\)/)
  assert.match(source, /const own = el\.closest \? el\.closest\('\[data-line\]'\) : null/)
  assert.match(source, /if \(insideMarkdown\(sel\.anchorNode\) && insideMarkdown\(sel\.focusNode\)\) \{/)
  assert.match(source, /lineRef: true \}\)/)
  // The line-range insert goes through the plugin's own ref codec, which now serializes to the
  // official `@path` mention plus the range in words; the official mention path stays for the
  // editor and diff views.
  assert.match(source, /const referenceDocumentLines = \(startLine, endLine\) => \{/)
  assert.match(source, /insertFileReference\(fileReferenceInsert\(path \+ ':' \+ startLine \+ '-' \+ endLine, 'file', referenceFileName\(path\)\)\)/)
  assert.match(source, /if \(bubble\.lineRef\) referenceDocumentLines\(bubble\.start, bubble\.end\)/)
  assert.match(source, /else referenceDocumentSelection\(bubble\.start, bubble\.end\)/)
})

test('the submitted reference is one mention plus a range, never a tag with its body', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  // The codec delegates to the shared model-text projection...
  assert.match(source, /serialize\(ref\) \{\n\s*return Promise\.resolve\(fileReferenceModelText\(decodeFileReference\(ref\)\)\)/)
  // ...and the plugin no longer reads line bodies back from the host to inline them.
  assert.equal(source.includes("call('readLines'"), false)
  assert.equal(source.includes('fileReferenceTag'), false)
})

test('the composer chip declares the official file/folder appearance', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  // Without this the chip renders the '@' marker instead of the official icon.
  assert.match(source, /appearance: decoded\.kind === 'folder' \? 'folder' : 'file'/)
})

test('the read-only browse and edit views reference a real line range too', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  // The whole-document CodeMirror editor reports its own line numbers; both its
  // bubble and its Command+U now go through the line-range codec instead of the
  // path-only official mention, so the model learns the lines there as well.
  assert.match(source, /onReference: referenceDocumentLines,/)
  assert.match(source, /onSelection: \(start, end, rect\) => setSelectionBubble\(start == null \? null : \{ start, end, rect, lineRef: true \}\)/)
})

test('an inserted reference lands at the official caret, not the draft front', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  // The composer is the shell's Lexical contenteditable. The pre-migration
  // probe read `textarea[data-phase]`, which no longer exists, so every
  // insertion resolved to detect position 0 and landed at the very front.
  assert.match(source, /const live = typeof input\.caretSpan === 'function' \? input\.caretSpan\(\) : null/)
  assert.match(source, /const span = \{ start: caret\.start, end: Math\.max\(caret\.start, caret\.end\), draftRev: draftRev \}/)
  // The insertion no longer derives a caret from the retired textarea at all.
  assert.doesNotMatch(source, /const ta = document\.querySelector\('textarea\[data-phase\]'\)\n\s*const inline = getInlineSelection\(\)/)
  // The caller-supplied span is gone from the signature: detect coordinates
  // come from the input surface alone.
  assert.match(source, /const insertFileReference = \(insert\) => \{/)
})

test('Command+U inserts the same line-range reference from the rendered view', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  // The shortcut used to skip the rendered view because "markdown HTML has no line numbers";
  // the renderer now annotates them, so the keydown path resolves the range the same way.
  assert.doesNotMatch(source, /markdown 渲染视图是 HTML，无行号，此处自然跳过/)
  assert.match(source, /if \(insideMarkdown\(sel\.anchorNode\) && insideMarkdown\(sel\.focusNode\)\) \{\n\s*const rows = markdownLineRange\(sel\)/)
  assert.match(source, /const markdownLineRange = \(sel\) => \{/)
  // One definition, shared by the keydown path and the bubble.
  assert.equal((source.match(/const referenceDocumentLines = /g) || []).length, 1)
})
