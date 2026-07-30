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
