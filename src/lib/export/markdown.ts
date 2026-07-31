/**
 * Markdown helpers for file export (Excel / Word).
 *
 * NOTA: NO reutiliza stripMarkdown() de src/lib/text/stripMarkdown.ts porque
 * esa función está diseñada para previews de cards: trunca a 200 caracteres,
 * colapsa todos los saltos de línea y reemplaza filas de tabla por "[table row]".
 * Para export necesitamos el texto completo, con estructura de líneas, y las
 * tablas Markdown parseadas a filas/columnas reales.
 */

export type MarkdownBlock =
  | { type: 'text'; text: string }
  | { type: 'table'; rows: string[][] }

/** Remove inline Markdown syntax (bold, italic, code, links) without truncating. */
export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/(^|\s)_(.+?)_(\s|$)/g, '$1$2$3')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '[image]')
    .trim()
}

const TABLE_ROW_RE       = /^\s*\|.*\|\s*$/
const TABLE_SEPARATOR_RE = /^\s*\|(\s*:?-+:?\s*\|)+\s*$/

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => stripInlineMarkdown(cell.trim()))
}

/**
 * Split Markdown content into alternating text and table blocks.
 * A table block requires a header row followed by a |---|---| separator row.
 * Pipe-lines that don't form a valid table are kept as plain text.
 */
export function splitMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = content.split('\n')
  const blocks: MarkdownBlock[] = []
  let textBuffer: string[] = []

  const flushText = () => {
    const text = textBuffer.join('\n').trim()
    if (text) blocks.push({ type: 'text', text })
    textBuffer = []
  }

  let i = 0
  while (i < lines.length) {
    const isTableStart =
      TABLE_ROW_RE.test(lines[i]) &&
      i + 1 < lines.length &&
      TABLE_SEPARATOR_RE.test(lines[i + 1])

    if (isTableStart) {
      flushText()
      const rows: string[][] = [parseTableRow(lines[i])]
      i += 2 // skip header + separator
      while (i < lines.length && TABLE_ROW_RE.test(lines[i]) && !TABLE_SEPARATOR_RE.test(lines[i])) {
        rows.push(parseTableRow(lines[i]))
        i++
      }
      blocks.push({ type: 'table', rows })
    } else {
      textBuffer.push(lines[i])
      i++
    }
  }
  flushText()
  return blocks
}

/**
 * Strip block-level Markdown from a text block, preserving line structure.
 * (Headers, blockquotes, list markers, horizontal rules, code fences.)
 */
export function stripBlockMarkdownKeepLines(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/^```.*$/gm, '')
    .split('\n')
    .map(line => stripInlineMarkdown(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const AGENT_LABEL: Record<string, string> = {
  manager: 'Manager',
  worker1: 'Worker 1',
  worker2: 'Worker 2',
}

export interface ExportMessage {
  role:          string
  content:       string
  agent_role?:   string
  created_at?:   string
  _displayLabel?: string
}

/** Human-readable sender label for an exported message. */
export function exportMessageLabel(msg: ExportMessage): string {
  if (msg._displayLabel) return msg._displayLabel
  if (msg.role === 'user') return 'User'
  if (msg.agent_role) return AGENT_LABEL[msg.agent_role] ?? msg.agent_role
  return 'Agent'
}

/** Safe filename base from a user-provided name (without extension). */
// RegExp constructor: el flag 'u' en literal no compila con el target TS del
// proyecto; en runtime (Node/browsers modernos) funciona igual.
const UNSAFE_FILENAME_CHARS = new RegExp('[^\\p{L}\\p{N}\\s\\-_]', 'gu')

export function sanitizeFilename(name: string | undefined | null): string {
  const base = (name ?? '')
    .replace(UNSAFE_FILENAME_CHARS, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
  return base || `selection-${new Date().toISOString().slice(0, 10)}`
}
