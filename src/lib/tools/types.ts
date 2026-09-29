export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown> // JSON Schema
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResult {
  tool_call_id: string
  content: string
}

// title/url se mantienen con el mismo nombre: los lee AuditTimeline.tsx y
// las filas históricas de session_tool_calls / audit_log solo tienen esos dos.
export type ToolSource = {
  title:           string
  url:             string         // URL exacta devuelta por el buscador
  clean_url?:      string         // sin #fragmento ni parámetros de tracking (ver urls.ts)
  published_date?: string | null  // si el buscador la informa; suele faltar fuera de noticias
  position?:       number         // orden en los resultados del buscador (1 = primero)
}

export type ToolExecutionResult = {
  content: string
  sources?: ToolSource[]
}

export interface ToolExecutor {
  definition: ToolDefinition
  execute: (input: Record<string, unknown>) => Promise<ToolExecutionResult>
}

export type TokenUsage = {
  provider:      string
  model:         string
  input_tokens:  number
  output_tokens: number
  total_tokens:  number
}

export type StreamOptions = {
  onUsage?: (usage: TokenUsage) => void | Promise<void>
}
