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
