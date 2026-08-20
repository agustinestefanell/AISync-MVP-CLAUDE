import { getProvider } from '@/lib/providers'
import { LocalProvider } from '@/lib/providers/local'
import type { ResolvedProviderKey } from '@/lib/providers/resolveApiKey'
import type { ChatMessage } from '@/lib/providers/types'

// Ejecuta una llamada NO streaming a un provider ya resuelto (BYOK) y
// devuelve el texto completo — extraído de investigation-scan/route.ts
// (2026-08-20) para reusar en sm-doc-chat/route.ts (modo búsqueda de
// Documentation Mode, 2026-08-20): ambos necesitan la respuesta completa
// antes de parsear JSON, no un stream incremental.
export async function completeText(
  providerName: string,
  resolved:     ResolvedProviderKey,
  messages:     ChatMessage[],
  model:        string,
): Promise<string> {
  if (resolved.isCustom) {
    // LocalProvider (IA Local / custom OpenAI-compatible) no implementa
    // complete() — se consume el stream completo y se junta el texto.
    const stream = await new LocalProvider(resolved.endpointUrl, resolved.apiKey ?? undefined).stream(messages, model)
    return new Response(stream).text()
  }
  const provider = getProvider(providerName, { apiKey: resolved.apiKey })
  if (provider.complete) {
    const result = await provider.complete(messages, model)
    return result.content
  }
  const stream = await provider.stream(messages, model)
  return new Response(stream).text()
}
