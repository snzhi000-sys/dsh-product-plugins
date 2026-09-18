import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const sourceUrl = new URL('../client/src/client.js', import.meta.url)

test('partial coverage does not render a warning or hold an empty review dock open', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  assert.match(source, /const visible = !!\(sid && \(rowSet.length > 0 \|\| undoFresh\)\)/)
  assert.doesNotMatch(source, /auditNotice|dismissedCoverage|data-audit-coverage|审核不完整/)
})

test('file content toolbar does not repeat the active tab filename', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  assert.doesNotMatch(source, /className:\s*['"]dsh-fe-tb-name['"]/)
  assert.doesNotMatch(source, /\.dsh-fe-tb-name\s*\{/)

  const toolbarAt = source.indexOf("const toolbar = React.createElement('div', { className: 'dsh-fe-toolbar'")
  assert.notEqual(toolbarAt, -1)
  const toolbarSource = source.slice(toolbarAt, toolbarAt + 1800)
  const statusAt = toolbarSource.indexOf("className: 'dsh-fe-chip' }, statusText")
  const statsAt = toolbarSource.indexOf("className: 'dsh-fe-stats'")
  const spacerAt = toolbarSource.indexOf("className: 'dsh-fe-spacer'")
  assert.ok(statusAt >= 0, 'status badge remains in the toolbar')
  assert.ok(statsAt > statusAt, 'file statistics stay beside the status badge')
  assert.ok(spacerAt > statsAt, 'actions remain right-aligned after the left metadata group')
})

test('references keep the native textarea as the single editing surface', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  assert.match(source, /const NATIVE_REFERENCE_COMPOSER = true/)
  const nativeAt = source.indexOf('if (NATIVE_REFERENCE_COMPOSER) {')
  assert.notEqual(nativeAt, -1)
  const nativeSource = source.slice(nativeAt, nativeAt + 2600)
  assert.match(nativeSource, /document\.querySelector\('textarea\[data-phase\]'\)/)
  assert.match(nativeSource, /ta\.focus\(\{ preventScroll: true \}\)/)
  assert.match(nativeSource, /ta\.setSelectionRange\(at, at\)/)
  assert.match(nativeSource, /scroll\.scrollTop = scroll\.scrollHeight/)
  assert.doesNotMatch(nativeSource, /contentEditable|compositionstart|keydown/)
  assert.match(source, /chipWidthEm: chipWidthEm/)
  assert.match(source, /browserReferenceTextMeasurer\(textarea\)/)
  assert.match(source, /referenceChipWidthEm\(\{ name, line: rows, measureText, composerFontSizePx \}\)/)
  assert.doesNotMatch(source, /referenceTextUnits/)
  assert.match(source, /renderInlineReferenceChips/)
  assert.doesNotMatch(source, /data-file-ref-rail['\"]/)
  assert.match(source, /meta\.line \? 'data-file-ref-lines' : 'data-file-ref-icon'/)
  assert.match(source, /max-width:20em/)
  assert.match(source, /data-dsh-file-ref-inline\]:hover \[data-file-ref-rail-remove\]/)
  assert.match(source, /application\/x-dsh-file-edit-references\+json/)
  assert.doesNotMatch(source.slice(nativeAt, source.indexOf('let editor = null')), /contentEditable|compositionstart|keydown/)
})

test('review bar hydrates persisted files before target-only reconciliation and opens a file in one click', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  assert.match(source, /call\('getModifiedSnapshot', \{ sessionId: sid \}\)/)
  assert.match(source, /scheduleStartupTask\([\s\S]*call\('getModified', \{ sessionId: sid \}\)[\s\S]*controller\.signal/)
  assert.match(source, /controller\.abort\(\)/)
  assert.match(source, /if \(full\.ok \|\| !snapshotApplied\) applyModified\(full, token\)/)
  assert.match(source, /activateFilesView\(this\.sessionId\)[\s\S]*this\.tabs\.indexOf\(path\)/)
  assert.match(source, /store\.openFile\(reviewId, props\.sid, item\.path, \{ firstChange: true \}\)/)
})

test('the review bar hover surfaces follow the official interaction spec', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  // Rows: the enlarged radius the reader asked for (official rows are 8px/10px) over the official fill.
  assert.match(source, /'\.dsh-fe-bar \.dsh-fe-file-row, \.dsh-fe-bar \.dsh-fe-delete-batch-child \{ border-radius:12px; \}'/)
  assert.match(source, /'\.dsh-fe-bar \.dsh-fe-file-row:hover, \.dsh-fe-bar \.dsh-fe-delete-batch-child:hover \{ background:var\(--dsw-alias-interactive-bg-hover\); \}'/)
  // Official icon buttons are circles over that same fill, with tone only in the ink.
  assert.match(source, /'\.dsh-fe-bar \.dsh-fe-iconbtn, \.dsh-fe-bar \.dsh-fe-secbtn \{ border-radius:999px; \}'/)
  assert.match(source, /'\.dsh-fe-bar \.dsh-fe-iconbtn:hover, \.dsh-fe-bar \.dsh-fe-secbtn:hover \{ background:var\(--dsw-alias-interactive-bg-hover\); color:var\(--dsw-alias-label-primary\); \}'/)
  assert.match(source, /'\.dsh-fe-bar \.dsh-fe-iconbtn-ok:hover \{ color:var\(--dsh-fe-review-add, var\(--dsw-alias-state-success-primary\)\); \}'/)
  assert.match(source, /'\.dsh-fe-bar \.dsh-fe-iconbtn-no:hover \{ color:var\(--dsw-alias-state-error-primary\); \}'/)
  // The bar's own surfaces no longer carry the plugin's private hover mix.
  assert.doesNotMatch(source, /\.dsh-fe-bar \.dsh-fe-file-row:hover \{ background:color-mix/)
  // Status chips are filled capsules in the official Tag tones, never outlined.
  assert.match(source, /'\.dsh-fe-bar \.dsh-fe-chip \{ border:none; border-radius:999px; padding:1px 8px; font-size:11px; line-height:17px; font-weight:500; background:var\(--dsw-alias-bg-module-platform\); color:var\(--dsw-alias-label-secondary\); \}'/)
  assert.match(source, /'\.dsh-fe-bar \.dsh-fe-chip-external \{ border:none; background:color-mix\(in srgb, var\(--dsw-alias-state-warn-primary\) 12%, transparent\); color:var\(--dsw-alias-state-warn-primary\); \}'/)
  assert.match(source, /'\.dsh-fe-bar \.dsh-fe-chip-add \{ border:none; background:color-mix\(in srgb, var\(--dsh-fe-review-add, var\(--dsw-alias-state-success-primary\)\) 10%, transparent\); color:var\(--dsh-fe-review-add, var\(--dsw-alias-state-success-primary\)\); \}'/)
  assert.match(source, /'\.dsh-fe-bar \.dsh-fe-chip-del \{ border:none; background:color-mix\(in srgb, var\(--dsw-alias-state-error-primary\) 10%, transparent\); color:var\(--dsw-alias-state-error-primary\); \}'/)
  // The review green is the plugin's own brighter step; the official success token
  // stays the fallback, and no review-green use point reads the official token bare.
  assert.match(source, /':root \{ --dsh-fe-review-add: #19BB4D; \}'/)
  const reviewGreen = 'var(--dsh-fe-review-add, var(--dsw-alias-state-success-primary))'
  assert.ok(source.split(reviewGreen).length - 1 >= 10, 'review green use points')
  assert.doesNotMatch(source.split(reviewGreen).join(''), /var\(--dsw-alias-state-success-primary\)/)
})

test('the review bar ink follows the official dock card and file tree hierarchy', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  // Official decorative glyphs sit on the weakest ink: TodoPanel's .lead and .chevron, GoalBar's
  // .iconBtn, and ui-sidebar-files' .icon are all label-tertiary, with the icon button's hover one
  // rung up at secondary. The plugin had the lead pencil on primary (inherited from the head row)
  // and both the chevron and the file glyph on secondary.
  assert.match(source, /'\.dsh-fe-bar-lead \{ display:inline-flex; color:var\(--dsw-alias-label-tertiary\); \}'/)
  assert.match(source, /'\.dsh-fe-bar \.dsh-fe-ic \{ color:var\(--dsw-alias-label-tertiary\); \}'/)
  assert.match(source, /'\.dsh-fe-bar \.dsh-fe-iconbtn:not\(\.dsh-fe-iconbtn-ok\):not\(\.dsh-fe-iconbtn-no\) \{ color:var\(--dsw-alias-label-tertiary\); \}'/)
  assert.match(source, /'\.dsh-fe-bar \.dsh-fe-iconbtn:not\(\.dsh-fe-iconbtn-ok\):not\(\.dsh-fe-iconbtn-no\):hover \{ color:var\(--dsw-alias-label-secondary\); \}'/)
  // The title and the file name keep primary ink, matching TodoPanel's .title and
  // ui-sidebar-files' .pathName; the directory line stays tertiary.
  assert.match(source, /'\.dsh-fe-bar-head \{ color:var\(--dsw-alias-label-primary\); \}'/)
  assert.match(source, /'\.dsh-fe-path-split > \.dsh-fe-file-name \{ flex:0 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var\(--dsw-alias-label-primary\); \}'/)
  assert.match(source, /'\.dsh-fe-path-split > \.dsh-fe-file-dir \{ flex:1 1 0; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var\(--dsw-alias-label-tertiary\); font-size:10px; \}'/)
  // The pencil gets its own slot, so demoting the glyph cannot lighten the title text beside it.
  assert.match(source, /className: 'dsh-fe-bar-lead' \}, IconPencil\(\)\), '修改的文件'\)/)
  // The :not() guards keep the semantic accept/reject tones winning over the bar rule.
  assert.match(source, /'\.dsh-fe-bar \.dsh-fe-iconbtn-ok:hover \{ color:var\(--dsh-fe-review-add, var\(--dsw-alias-state-success-primary\)\); \}'/)
  assert.match(source, /'\.dsh-fe-bar \.dsh-fe-iconbtn-no:hover \{ color:var\(--dsw-alias-state-error-primary\); \}'/)
  // .dsh-fe-ic is shared with the file browser, so the base rule must stay untouched.
  assert.match(source, /'\.dsh-fe-ic \{ width:15px; flex:none; display:inline-flex; justify-content:center; color:var\(--dsw-alias-label-secondary\); \}'/)
})

test('selection references use the official reference source, and a bubble sits above the selection', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  // The official payload: the shared `@` mention grammar, the official source, and the public facade.
  assert.match(source, /const officialMention = \(target, kind\) => \{/)
  assert.match(source, /if \(!\/\\s\/u\.test\(path\)\) return '@' \+ path/)
  assert.match(source, /source: 'reference',/)
  assert.match(source, /input\.insertReference\(\{/)
  // The span is the draft end in detect coordinates: chips are one character there, not their clipboard text.
  assert.match(source, /const expanded = \(snap\.occurrences \|\| \[\]\)\.reduce/)
  assert.match(source, /\{ start: end, end: end, draftRev: snap\.draftRev \}/)
  // Both selection entry points go through it instead of the plugin's own page global.
  assert.match(source, /insertOfficialReference\(\{ path: path, kind: 'file', label: rows \? name \+ ':' \+ rows : name \}\)/)
  assert.match(source, /const referenced = insertOfficialReference\(\{/)
  assert.doesNotMatch(source, /window\.__dshFileRef\(\{ path: path, startLine/)
  // The bubble floats above the selection, keeps the selection on pointer down, and reads @引用.
  assert.match(source, /const top = above >= 8 \? above : Math\.min\(window\.innerHeight - height - 8, rect\.bottom \+ gap\)/)
  assert.match(source, /const above = rect\.top - gap - height/)
  assert.match(source, /className: 'dsh-fe-refbubble'/)
  assert.match(source, /'@引用'\)/)
  assert.match(source, /onPointerDown: \(event\) => \{ event\.preventDefault\(\) \}/)
  assert.match(source, /'\.dsh-fe-refbubble \{ position:fixed;[^']*border-radius:999px;[^']*box-shadow:var\(--dsw-elevation-soft\); \}'/)
  // A floating bubble keeps an opaque hover fill; the translucent hover token would make it see-through.
  assert.match(source, /'\.dsh-fe-refbubble:hover \{ background:var\(--dsw-alias-interactive-bg-hover-solid\); \}'/)
  // Mounted wherever a selection can happen: the markdown render view, the document editor, and the diff view.
  assert.equal((source.match(/selectionBubbleElement\(\),/g) || []).length, 3)
})

test('a CodeMirror selection keeps its bubble instead of being cleared by the line-view listener', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  // The selectionchange listener clears the bubble only when the selection is gone;
  // a selection outside the diff lines belongs to the editor, which sets the bubble itself.
  assert.match(source, /if \(!a \|\| !b\) return\n/)
  assert.match(source, /if \(!sel \|\| sel\.isCollapsed \|\| !sel\.rangeCount\) return setSelectionBubble\(null\)/)
  assert.doesNotMatch(source, /if \(!a \|\| !b\) return setSelectionBubble\(null\)/)
})

test('the review bar card takes the official composer card style', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  // No layout border: the 0.5px ring comes from the official elevation tier with the l2 stroke colour.
  assert.match(source, /'\.dsh-fe-bar \{ border:0; --dsw-elevation-stroke-color:var\(--dsw-alias-border-l2\); border-radius:22px; box-shadow:var\(--dsw-elevation-soft\); \}'/)
  // Collapsed, the body's gap must not add to the bottom inset: 8px above and below the head row.
  assert.match(source, /'\.dsh-fe-bar-collapsed \{ gap:0; \}'/)
  // The bar no longer carries the plugin's own lv2 shadow.
  assert.doesNotMatch(source, /\.dsh-fe-bar \{ box-shadow:var\(--dsw-shadow-lv2/)
})

test('review rows lead with the file name and keep the address as secondary small text', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  // One path string split into name and directory; the row keeps the full path for hover.
  assert.match(source, /const splitReviewPath = \(path\) => \{/)
  assert.match(source, /const name = referenceFileName\(full\)/)
  assert.match(source, /const label = splitReviewPath\(item\.path\)/)
  assert.match(source, /className: 'dsh-fe-path dsh-fe-path-split', title: item\.path/)
  assert.match(source, /className: 'dsh-fe-file-name' \}, label\.name\)/)
  assert.match(source, /label\.dir \? React\.createElement\('span', \{ className: 'dsh-fe-file-dir' \}, label\.dir\) : null/)
  // The raw path is no longer the row's own text.
  assert.doesNotMatch(source, /dsh-fe-path', title: item\.path, onClick: \(\) => store\.openFile\(reviewId, props\.sid, item\.path, \{ firstChange: true \}\) \}, item\.path\)/)
  // Name in primary ink, address in tertiary ink at a smaller size, both ellipsized.
  assert.match(source, /'\.dsh-fe-path-split \{ display:flex; align-items:baseline; gap:6px; min-width:0; \}'/)
  assert.match(source, /'\.dsh-fe-path-split > \.dsh-fe-file-name \{ flex:0 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var\(--dsw-alias-label-primary\); \}'/)
  assert.match(source, /'\.dsh-fe-path-split > \.dsh-fe-file-dir \{ flex:1 1 0; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var\(--dsw-alias-label-tertiary\); font-size:10px; \}'/)
})

test('the review bar tracks the official composer width instead of overshooting it', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  // The official card is width:100% inside `.pW7-CW_root`'s 16px side clearance, so its real
  // width is min(container - 2*clearance, card-max-width). The bar is a sibling in the same
  // `.composerStack` and must reproduce both bounds; with a bare width:100% it stays 32px wider
  // than the input box on narrow columns and stops shrinking at the container edge.
  assert.match(source, /'\.dsh-fe-bar \{ width:calc\(100% - var\(--dsh-composer-side-clearance, 16px\) - var\(--dsh-composer-side-clearance, 16px\)\); max-width:var\(--dsh-composer-card-max-width, 100%\); margin:0 auto; box-sizing:border-box; container-type:inline-size; \}'/)
  assert.doesNotMatch(source, /\.dsh-fe-bar \{ width:100%; max-width:var\(--dsh-composer-card-max-width\)/)
  // The floating variant expresses the same inset through left/right, so max-width still caps
  // the width and the two auto margins still centre it.
  assert.match(source, /'\.dsh-fe-bar-overlay \{ position:absolute; left:var\(--dsh-composer-side-clearance, 16px\); right:var\(--dsh-composer-side-clearance, 16px\); width:auto; margin:0 auto; z-index:8; \}'/)
})

test('a narrow review bar drops the address and keeps the ellipsized file name', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  // The bar is its own inline-size container, so the adaptation reads the bar's own width.
  assert.match(source, /'@container \(max-width:480px\) \{ \.dsh-fe-path-split > \.dsh-fe-file-dir \{ display:none; \} \}'/)
  // The address is only hidden: the full path stays on the row and in its title attribute.
  assert.match(source, /className: 'dsh-fe-path dsh-fe-path-split', title: item\.path/)
  assert.match(source, /label\.dir \? React\.createElement\('span', \{ className: 'dsh-fe-file-dir' \}, label\.dir\) : null/)
  // The name keeps the ellipsis rule that renders once the address is gone.
  assert.match(source, /'\.dsh-fe-path-split > \.dsh-fe-file-name \{ flex:0 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var\(--dsw-alias-label-primary\); \}'/)
})

test('review bar keeps its header reachable and scrolls its body in every conversation view', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  // The cap is 20vh: half the old 40vh, which took 321px of an 803px window with 14 rows open.
  assert.match(source, /'\.dsh-fe-bar \{ max-height:20vh; animation:/)
  assert.match(source, /'\.dsh-fe-bar-head \{ flex:none; \}'/)
  assert.match(source, /'\.dsh-fe-body \{ display:grid; flex:0 1 auto; min-height:0;/)
  assert.match(source, /'\.dsh-fe-body-inner \{ overflow-x:hidden; overflow-y:auto; min-height:0; overscroll-behavior:contain; \}'/)
  assert.doesNotMatch(source, /'\.dsh-fe-bar-overlay \{[^']*max-height:/)
  assert.doesNotMatch(source, /'\.dsh-fe-bar-overlay \.dsh-fe-body-inner \{[^']*overflow-y:auto/)
})

test('created-then-deleted tombstones have explicit review copy and actions', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  assert.match(source, /item\.createdThenDeleted[\s\S]*本会话新建后删除/)
  assert.match(source, /diff\.createdThenDeleted[\s\S]*本会话新建后删除/)
  assert.match(source, /恢复文件并继续保留新增审核/)
  assert.match(source, /确认文件保持删除并结束整条变化/)
})

test('deleted files remain read-only browseable and use a red strike-through tab title', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  assert.match(source, /deletedPreview/)
  assert.match(source, /文件已从磁盘删除，以下为删除前内容/)
  assert.match(source, /path: path \+ ':deleted'[\s\S]*readOnly: true/)
  assert.match(source, /dsh-fe-tab-name-deleted/)
  assert.match(source, /text-decoration-line:line-through/)
  assert.match(source, /var\(--dsw-alias-state-error-primary\)/)
  assert.match(source, /文件已删除，当前显示删除前内容/)
  assert.match(source, /if \(result\.deleted\) store\.markDeleted\(String\(result\.id\)\)/)
  assert.match(source, /requestSeq\.latest !== seq/)
  assert.match(source, /r\.same && diff[\s\S]*diff\.deleted[\s\S]*store\.markDeleted\(reqPath\)/)
})

test('unrecoverable shell deletion is labeled and cannot offer automatic reject', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  assert.match(source, /shell-delete-unrecoverable[\s\S]*Shell 删除未隔离/)
  assert.match(source, /删除前未建立隔离备份/)
  assert.match(source, /item\.restorable === false[\s\S]*disabled: !!acting \|\| item\.restorable === false/)
  assert.match(source, /diff\.restorable === false[\s\S]*disabled: !!reviewAction \|\| diff\.restorable === false/)
})

test('directory deletion batches reuse the review bar with expandable file details', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  assert.match(source, /function reviewRows\(files\)/)
  assert.match(source, /group\.items\.length === group\.fileCount/)
  assert.match(source, /function DeletionBatchRow\(props\)/)
  assert.doesNotMatch(source, /'删除目录 ' \+ item\.path/)
  assert.match(source, /dsh-fe-delete-batch-label[\s\S]*title: item\.path \}, item\.path\)[\s\S]*dsh-fe-delete-batch-toggle/)
  assert.match(source, /dsh-fe-chip dsh-fe-chip-del' \}, '删除'/)
  assert.match(source, /item\.children\.length \+ ' 个文件'/)
  assert.match(source, /'展开查看目录内文件'/)
  assert.match(source, /go\('acceptDeletionBatch'\)/)
  assert.match(source, /go\('rejectDeletionBatch'\)/)
  assert.match(source, /'接受整个删除批次'/)
  assert.match(source, /'拒绝并恢复整个目录'/)
  assert.match(source, /child\.deletionRelativePath/)
  assert.match(source, /item\.external[\s\S]*工作区外/)
  const batchRowAt = source.indexOf('function DeletionBatchRow(props)')
  const modifiedBarAt = source.indexOf('function ModifiedBar(props)', batchRowAt)
  const batchRowSource = source.slice(batchRowAt, modifiedBarAt)
  assert.doesNotMatch(batchRowSource, /child\.createdThenDeleted|新建后删除/)
})

test('file tab actions use a more menu and fail closed before closing processed files', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  assert.match(source, /aria-label': '更多文件操作'/)
  assert.match(source, /'aria-haspopup': 'menu'/)
  assert.match(source, /'aria-expanded': menuOpen \? 'true' : 'false'/)
  assert.match(source, /'关闭所有文件'/)
  assert.match(source, /'关闭已处理文件'/)
  assert.match(source, /onClick: \(\) => \{ setMenuOpen\(false\); store\.closeAll\(\) \}/)
  assert.match(source, /call\('getModified', \{ sessionId: sid \}\)[\s\S]*if \(!result\.ok\)[\s\S]*未关闭任何文件[\s\S]*store\.closeProcessed\(pending\)/)
  assert.match(source, /store\.setDraftDirty\(path, draftDirty\)/)
  assert.match(source, /document\.addEventListener\('pointerdown', onPointerDown, true\)/)
  assert.match(source, /event\.key !== 'Escape'/)
  assert.doesNotMatch(source, /className: 'dsh-fe-tab-closeall'/)
})
