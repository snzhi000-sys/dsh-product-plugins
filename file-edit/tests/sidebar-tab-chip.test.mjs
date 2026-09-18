/** The right-sidebar tab carries our own glyph and the product name, and the plugin ships that glyph in its bundle. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stat } from 'node:fs/promises'
import { test } from 'node:test'

const sourceUrl = new URL('../client/src/client.js', import.meta.url)
const packageUrl = new URL('../package.json', import.meta.url)
const assetUrl = new URL('../client/src/assets/sidebar-tab.webp', import.meta.url)

test('the sidebar tab is named through one constant used by both registrations', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  assert.match(source, /const FILE_BROWSER_TITLE = 'Edit 文件浏览器'/)
  assert.match(source, /title: \(\) => FILE_BROWSER_TITLE,/)
  assert.match(source, /order: 20, label: FILE_BROWSER_TITLE \},/)
  assert.doesNotMatch(source, /title: \(\) => '文件'/)
})

test('the tab chip takes its glyph and text from the title seat', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  // The tab type definition carries text only, so the glyph needs the title seat the official guide uses.
  assert.match(source, /ctx\.slots\.inject\('sidebar\.right\.pane\.tab\.title', \(\) => ctx\.slots\.register\(\n\s+\{ name: 'sidebar\.right\.pane\.tab\.title', key: FILE_BROWSER_KIND \},\n\s+SidebarTabTitle,/)
  assert.match(source, /function SidebarTabTitle\(props\) \{/)
  assert.match(source, /src: SIDEBAR_TAB_ICON,/)
  // The seat runs before the plugin stylesheet is necessarily mounted, so the chip is styled inline.
  assert.match(source, /style: \{ display: 'inline-flex', alignItems: 'center', gap: '5px', minWidth: 0 \}/)
  assert.match(source, /style: \{ width: '15px', height: '15px', flex: 'none', objectFit: 'contain', borderRadius: '3px' \}/)
})

test('the glyph reaches the bundle as a string, never as a runtime require', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  const manifest = JSON.parse(await readFile(packageUrl, 'utf8'))
  // The factory's require resolves through the shell's static module table, so a binary asset must
  // arrive as a bundled string; importing the generated module is what inlines it.
  assert.match(source, /import \{ SIDEBAR_TAB_ICON \} from '\.\/tab-icon\.js'/)
  assert.doesNotMatch(source, /require\('\.\/assets\//)
  assert.equal(typeof manifest.scripts['build:icon'], 'string')
  assert.equal(manifest.scripts['build:icon'].includes('embed-tab-icon'), true)

  const asset = await stat(assetUrl)
  assert.equal(asset.isFile(), true)
  assert.equal(asset.size > 1000, true)

  const generated = await readFile(new URL('../client/src/tab-icon.js', import.meta.url), 'utf8')
  assert.match(generated, /export const SIDEBAR_TAB_ICON = 'data:image\/webp;base64,[A-Za-z0-9+/=]+'/)
})
