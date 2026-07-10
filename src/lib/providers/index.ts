import { AnthropicProvider } from './anthropic'
import { OpenAIProvider }   from './openai'
import { GoogleProvider }   from './google'
import { LocalProvider }    from './local'
import type { ChatProvider, ProviderConfig } from './types'

// Para agregar un provider: crear la clase en su propio archivo e incluirla aquí.
// La factory recibe apiKey (para cloud) o endpoint (para local).
type ProviderFactory = (config: ProviderConfig) => ChatProvider

const registry: Record<string, ProviderFactory> = {
  Anthropic:  (c) => new AnthropicProvider(c.apiKey ?? ''),
  OpenAI:     (c) => new OpenAIProvider(c.apiKey ?? ''),
  Google:     (c) => new GoogleProvider(c.apiKey ?? ''),
  'IA Local': (c) => new LocalProvider(c.endpoint ?? 'http://localhost:11434/v1'),
}

export function getProvider(name: string, config: ProviderConfig): ChatProvider {
  const factory = registry[name]
  if (!factory) {
    throw new Error(
      `Provider "${name}" no registrado. Disponibles: ${Object.keys(registry).join(', ')}`
    )
  }
  return factory(config)
}

export function getRegisteredProviders(): string[] {
  return Object.keys(registry)
}
