/**
 * Verifies that every relative image or link target in this repository's Markdown files exists,
 * so a README that points at a moved or never-created file fails a gate instead of rendering broken.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))

/**
 * @param directory - a directory to walk.
 * @returns every Markdown file below it, ignoring installed dependencies and the git directory.
 */
function markdownFiles(directory) {
  const found = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue
    const item = join(directory, entry.name)
    if (entry.isDirectory()) found.push(...markdownFiles(item))
    else if (entry.isFile() && entry.name.endsWith('.md')) found.push(item)
  }
  return found.sort()
}

/**
 * @param file - a Markdown file.
 * @param source - its contents.
 * @returns every relative target the file references, with its line number.
 */
export function relativeTargets(file, source) {
  const targets = []
  source.split('\n').forEach((line, index) => {
    for (const match of line.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = match[1]
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) continue
      targets.push({ target: target.split('#')[0], line: index + 1 })
    }
  })
  return targets.filter(entry => entry.target.length > 0)
}

/**
 * @param files - the Markdown files to check.
 * @returns every reference whose target is missing, as `path:line → target`.
 */
export function missingTargets(files) {
  const missing = []
  for (const file of files) {
    for (const { target, line } of relativeTargets(file, readFileSync(file, 'utf8'))) {
      if (!existsSync(resolve(dirname(file), target))) missing.push(`${file.slice(repoRoot.length + 1)}:${line} → ${target}`)
    }
  }
  return missing
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const files = markdownFiles(repoRoot)
  const missing = missingTargets(files)
  if (missing.length > 0) {
    console.error(`Markdown references do not resolve:\n${missing.map(entry => `  ${entry}`).join('\n')}`)
    process.exitCode = 1
  } else {
    console.log(`markdown references resolve: ${String(files.length)} files checked`)
  }
}
