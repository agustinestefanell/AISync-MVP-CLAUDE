export interface ChatMessage {
  role:        'user' | 'assistant'
  content:     string
  agent_role?: string
}

export interface ChatProvider {
  stream(messages: ChatMessage[], model: string): Promise<ReadableStream<Uint8Array>>
}

// Configuración que recibe cada factory del registry.
// - apiKey: clave para providers cloud (Anthropic, OpenAI, Google)
// - endpoint: URL base para IA Local (Ollama, LM Studio, etc.)
export interface ProviderConfig {
  apiKey?: string
  endpoint?: string
}
