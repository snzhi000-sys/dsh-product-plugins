/**
 * 打开文件时携带的目标行。store 里存的记录有两种语义：明确的 1-based 行号，
 * 或者「滚到第一个变更」——后者要等视图拿到 diff 才知道具体行。
 *
 * @param {{ line?: number, endLine?: number, firstChange?: boolean } | null} target
 *   store 里的目标记录。
 * @param {number} firstChangeLine
 *   视图当时知道的第一个变更行（1-based）；没有变更或还不知道时传 0。
 * @returns {{ line: number, endLine: number } | null}
 *   1-based 的行区间；记录缺行号且不是「第一个变更」时返回 null。
 */
export function resolveFileTarget(target, firstChangeLine) {
  if (!target) return null
  const fallback = Number(firstChangeLine) > 0 ? Math.floor(Number(firstChangeLine)) : 1
  const line = Number(target.line) > 0 ? Math.floor(Number(target.line)) : (target.firstChange ? fallback : 0)
  if (!(line > 0)) return null
  const endLine = Number(target.endLine) >= line ? Math.floor(Number(target.endLine)) : line
  return { line: line, endLine: endLine }
}
