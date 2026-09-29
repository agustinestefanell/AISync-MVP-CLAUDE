// Helpers de trazabilidad para /api/chat y /api/messages (OE 2026-09-29).
// Solo `import type` — se puede ejecutar aislado con `node` para pruebas.
import type { ChatAttachment, ChatMessage } from '../providers/types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

// Adjuntos a registrar en session_attachments / audit_log: SOLO los del
// mensaje nuevo (el último, si es del usuario). El cliente reenvía todo el
// historial con sus adjuntos en cada mensaje — registrar el historial
// completo generaba una fila repetida por cada mensaje enviado después.
export function attachmentsToTrace(messages: ChatMessage[]): ChatAttachment[] {
  const last = messages[messages.length - 1]
  if (!last || last.role !== 'user') return []
  return last.attachments ?? []
}

// Tamaño real en bytes a partir del base64 (sin decodificarlo).
export function base64Bytes(data: string | undefined): number | null {
  if (!data) return null
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0
  return Math.floor((data.length * 3) / 4) - padding
}

// Error de herramienta → categoría fija, apta para guardar y para mostrarle
// al modelo. Nunca se devuelve el mensaje crudo: puede contener claves,
// URLs internas o detalles del proveedor.
export function sanitizeToolError(error: unknown): string {
  const raw = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '')
  const text = raw.toLowerCase()
  if (text.includes('not configured'))                                   return 'Search provider not configured'
  if (/\b401\b|\b403\b|unauthori[sz]ed|forbidden|invalid api key|api key/.test(text))
                                                                         return 'Search provider authentication failed'
  if (/\b429\b|rate limit|too many requests|quota|usage limit/.test(text)) return 'Search provider rate limit reached'
  if (/timeout|timed out|aborted/.test(text))                            return 'Search provider timed out'
  if (/fetch failed|network|econn|enotfound|socket/.test(text))          return 'Search provider unreachable'
  if (/\b5\d\d\b/.test(text))                                            return 'Search provider server error'
  return 'Search failed (unknown error)'
}
