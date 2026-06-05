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

export type ToolSource = {
  title: string
  url:   string
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
