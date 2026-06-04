export interface ChatAttachment {
  type:       'image' | 'document'
  media_type: string
  data:       string   // base64
  name?:      string
}

export interface ChatMessage {
  role:         'user' | 'assistant'
  content:      string
  agent_role?:  string
  attachments?: ChatAttachment[]
}

import type { ToolCall, ToolDefinition } from '@/lib/tools'

export interface ChatProvider {
  stream(messages: ChatMessage[], model: string): Promise<ReadableStream<Uint8Array>>
  complete?(
    messages: ChatMessage[],
    model: string,
    tools?: ToolDefinition[]
  ): Promise<{ content: string; toolCalls?: ToolCall[] }>
}

// Configuración que recibe cada factory del registry.
// - apiKey: clave para providers cloud (Anthropic, OpenAI, Google)
// - endpoint: URL base para IA Local (Ollama, LM Studio, etc.)
export interface ProviderConfig {
  apiKey?: string
  endpoint?: string
}
