/**
 * Strip Markdown syntax and truncate to plain text preview
 * Used for Documentation Mode card previews
 */
export function stripMarkdown(text: string, maxLength: number = 200): string {
  if (!text || typeof text !== 'string') return ''

  const cleaned = text
    // Headers (# ## ###)
    .replace(/^#{1,6}\s+/gm, '')
    // Bold (**text** or __text__)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    // Italic (*text* or _text_)
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // Strikethrough (~~text~~)
    .replace(/~~(.+?)~~/g, '$1')
    // Code blocks (```code```)
    .replace(/```[\s\S]*?```/g, '[code block]')
    // Inline code (`code`)
    .replace(/`([^`]+)`/g, '$1')
    // Links ([text](url))
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Images (![alt](url))
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '[image]')
    // Blockquotes (> text)
    .replace(/^>\s+/gm, '')
    // Horizontal rules (--- or ***)
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // Lists (- item, * item, 1. item)
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // Tables (| cell | cell |)
    .replace(/\|.*\|/g, '[table row]')
    // Multiple newlines → single space
    .replace(/\n+/g, ' ')
    // Multiple spaces → single space
    .replace(/\s{2,}/g, ' ')
    .trim()

  // Truncate to maxLength
  if (cleaned.length <= maxLength) {
    return cleaned
  }

  // Find last complete word within limit
  const truncated = cleaned.slice(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')

  return lastSpace > maxLength * 0.8
    ? truncated.slice(0, lastSpace) + '…'
    : truncated + '…'
}

/**
 * Same markdown stripping as stripMarkdown(), but preserves line breaks
 * (only collapses 3+ blank lines to 1) instead of flattening everything to
 * a single line — for User Library cards (2026-08-22), which show full
 * height and need paragraphs to stay readable, not a dense single-line
 * blob. Does NOT hard-truncate like stripMarkdown() — maxLength here is a
 * safety cap against pathological input, not a designed preview length.
 */
export function stripMarkdownPreserveParagraphs(text: string, maxLength: number = 4000): string {
  if (!text || typeof text !== 'string') return ''

  const cleaned = text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/```[\s\S]*?```/g, '[code block]')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '[image]')
    .replace(/^>\s+/gm, '')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\|.*\|/g, '[table row]')
    // A diferencia de stripMarkdown(): NO colapsa saltos de línea a espacio,
    // solo normaliza 3+ líneas vacías seguidas a 1 sola.
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()

  if (cleaned.length <= maxLength) return cleaned
  return cleaned.slice(0, maxLength).trimEnd() + '…'
}
