import { webSearchTool } from './web-search'
import type { ToolExecutor } from './types'

export const toolRegistry: Record<string, ToolExecutor> = {
  web_search: webSearchTool,
}

export function getTool(name: string): ToolExecutor | undefined {
  return toolRegistry[name]
}

export { webSearchTool }
export type { ToolDefinition, ToolCall, ToolResult, ToolExecutor } from './types'
