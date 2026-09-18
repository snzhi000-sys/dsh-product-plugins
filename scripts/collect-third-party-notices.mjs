/**
 * Renders `THIRD-PARTY-NOTICES.md`: the copyright lines and license text the MIT License requires for every
 * third-party component the built client bundle ships. `--check` fails when the committed document is stale,
 * so adding a dependency without its notice cannot pass unnoticed.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const lockPath = join(repoRoot, 'file-edit', 'package-lock.json')
const bundlePath = join(repoRoot, 'file-edit', 'client', 'dist', 'client.js')
const outputPath = join(repoRoot, 'THIRD-PARTY-NOTICES.md')

/** Packages the client build inlines from the plugin's devDependencies, with the copyright line their LICENSE carries. */
const bundled = [
  { name: '@codemirror/state', copyright: 'Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others' },
  { name: '@codemirror/view', copyright: 'Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others' },
  { name: '@codemirror/commands', copyright: 'Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others' },
  { name: '@codemirror/language', copyright: 'Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others' },
  { name: '@codemirror/legacy-modes', copyright: 'Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others' },
  { name: '@lezer/common', copyright: 'Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others' },
  { name: '@lezer/highlight', copyright: 'Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others' },
  { name: '@lezer/lr', copyright: 'Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others' },
  { name: 'style-mod', copyright: 'Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others' },
  { name: 'w3c-keyname', copyright: 'Copyright (C) 2016 by Marijn Haverbeke <marijn@haverbeke.berlin> and others' },
  { name: 'crelt', copyright: 'Copyright (C) 2020 by Marijn Haverbeke <marijn@haverbeke.berlin>' },
]

/** Components inserted into the client source by hand instead of resolved from the lockfile. */
const vendored = [
  {
    name: 'markdown-it',
    version: '15.0.0',
    copyright: 'Copyright (c) 2014 Vitaly Puzrin, Alex Kocharin.',
    note: 'browser UMD build embedded in the client source; it carries linkify-it, mdurl and uc.micro',
  },
]

/** The permission notice every component above is licensed under. */
const mit = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`

/**
 * @param lock - the parsed lockfile.
 * @param bundle - the built client bundle.
 * @returns the notice document for the components the bundle ships.
 * @throws when a bundled component is missing from the lockfile, is not MIT-licensed, or is absent from the bundle.
 */
export function renderNotices(lock, bundle) {
  const packages = lock.packages ?? {}
  for (const [path, entry] of Object.entries(packages)) {
    if (!path.startsWith('node_modules/') || entry === null || typeof entry !== 'object') continue
    const license = entry.license
    if (license !== undefined && license !== 'MIT') {
      throw new Error(`${path} is ${String(license)}, not MIT: the notice document cannot grant MIT terms for it`)
    }
  }
  const rows = bundled.map(({ name, copyright }) => {
    const entry = packages[`node_modules/${name}`]
    if (entry === undefined) throw new Error(`${name} is absent from the lockfile`)
    if (!bundle.includes(name)) throw new Error(`${name} is not embedded in the client bundle; drop it from the bundled list`)
    return `| \`${name}\` | ${String(entry.version)} | MIT | ${copyright} |`
  })
  for (const { name } of vendored) {
    if (!bundle.includes(name)) throw new Error(`${name} is not embedded in the client bundle`)
  }
  const vendoredRows = vendored.map(({ name, version, copyright, note }) => `| \`${name}\` | ${version} | MIT | ${copyright} |`)
  return `# Third-party notices

\`file-edit/client/dist/client.js\` ships third-party code. Everything it embeds is MIT-licensed; the copyright line and the permission notice each component requires follow. Regenerate this file with \`node scripts/collect-third-party-notices.mjs\`; \`--check\` fails when it is stale.

## Embedded by the client build (esbuild)

| Component | Version | License | Copyright |
| --- | --- | --- | --- |
${rows.join('\n')}

## Inserted into the client source

| Component | Version | License | Copyright |
| --- | --- | --- | --- |
${vendoredRows.join('\n')}

${vendored.map(({ name, note }) => `\`${name}\`: ${note}.`).join('\n')}

## MIT License

Each component above is licensed under the MIT License with its own copyright line, and all of them carry this permission notice:

\`\`\`text
${mit}
\`\`\`

## Not redistributed here

The plugin runs against the DeepSeek Harness plugin APIs. Harness itself is MIT-licensed (Copyright (c) 2026 DeepSeek), but no Harness code is redistributed in this repository: the client requires the host's platform modules at runtime instead of bundling them.
`
}

/** Writes the notice document, or verifies the committed one when run with `--check`. */
function main() {
  const document = renderNotices(JSON.parse(readFileSync(lockPath, 'utf8')), readFileSync(bundlePath, 'utf8'))
  if (process.argv.includes('--check')) {
    const committed = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : ''
    if (committed !== document) {
      console.error('THIRD-PARTY-NOTICES.md is stale: run node scripts/collect-third-party-notices.mjs')
      process.exitCode = 1
    } else {
      console.log('third-party notices match the lockfile and the client bundle')
    }
    return
  }
  writeFileSync(outputPath, document)
  console.log(`wrote ${outputPath}: ${String(bundled.length + vendored.length)} components`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
