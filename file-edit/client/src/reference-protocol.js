const V2_PREFIX = 'dsh-file-ref:v2:'

function legacyReference(ref) {
  const raw = String(ref || '')
  const match = /^(.*?)(?::(\d+)(?:-(\d+))?)?$/.exec(raw)
  const path = match && match[1] ? match[1] : raw
  const start = match && match[2] ? Number.parseInt(match[2], 10) : 0
  const end = match && match[3] ? Number.parseInt(match[3], 10) : start
  return { path, start, end, kind: 'file' }
}

export function decodeFileReference(ref, fallbackKind = 'file') {
  const raw = String(ref || '')
  if (raw.startsWith(V2_PREFIX)) {
    try {
      const value = JSON.parse(decodeURIComponent(raw.slice(V2_PREFIX.length)))
      if (value && typeof value.path === 'string' && value.path) {
        const start = Number.isInteger(value.start) && value.start > 0 ? value.start : 0
        const end = Number.isInteger(value.end) && value.end > 0 ? value.end : start
        return {
          path: value.path,
          start,
          end,
          kind: value.kind === 'folder' ? 'folder' : 'file',
        }
      }
    } catch (error) {}
  }
  const decoded = legacyReference(raw)
  return { ...decoded, kind: fallbackKind === 'folder' && decoded.start === 0 ? 'folder' : 'file' }
}

export function encodeFileReference(ref, fallbackKind = 'file') {
  const decoded = ref && typeof ref === 'object' && typeof ref.path === 'string'
    ? {
        path: ref.path,
        start: Number.isInteger(ref.start) && ref.start > 0 ? ref.start : 0,
        end: Number.isInteger(ref.end) && ref.end > 0 ? ref.end : (Number.isInteger(ref.start) ? ref.start : 0),
        kind: ref.kind === 'folder' ? 'folder' : 'file',
      }
    : decodeFileReference(ref, fallbackKind)
  return V2_PREFIX + encodeURIComponent(JSON.stringify(decoded))
}

export function fileReferenceClipboardText(ref) {
  const value = decodeFileReference(ref)
  const range = value.start > 0
    ? ':' + value.start + (value.end !== value.start ? '-' + value.end : '')
    : ''
  return '@' + value.path + range
}

/**
 * Model-visible text of one file or line reference.
 *
 * The product's chat transcript decorates a bare `@path` token into the
 * official file chip, so the reference serializes to exactly that mention plus
 * the selected line range in words. The selected lines are deliberately NOT
 * inlined: the range names what to read and the model reads it, which keeps one
 * sent message to one chip and one short label instead of a tag plus its body.
 *
 * The result starts with one separating space on purpose. The transcript's
 * `@name` rule requires the token to start the text or follow whitespace, and
 * prose written in Chinese ends in punctuation such as `：` or `。` that is not
 * whitespace — a reference inserted right after it would render as raw
 * `@path …` text instead of a chip. The space is the separator a human would
 * have typed, and it is invisible once the token decorates.
 *
 * A path outside the `@name` grammar (whitespace) uses the quoted form the
 * official composer grammar defines; a directory keeps its trailing slash so
 * the transcript decorates it as a folder.
 * @param value - decoded reference: `path`, `start`, `end`, `kind`.
 * @returns a leading separator space, the mention, and `第N行` / `第N-M行` for a line range.
 */
export function fileReferenceModelText(value) {
  const path = String(value && value.path ? value.path : '')
  const folder = value && value.kind === 'folder'
  const body = folder && !path.endsWith('/') ? path + '/' : path
  const mention = /[\s"]/u.test(body) ? '@"' + body + '"' : '@' + body
  const start = value && Number.isInteger(value.start) && value.start > 0 ? value.start : 0
  if (start === 0) return ' ' + mention
  const end = Number.isInteger(value.end) && value.end > start ? value.end : start
  return ' ' + mention + ' 第' + (end === start ? String(start) : start + '-' + end) + '行'
}
