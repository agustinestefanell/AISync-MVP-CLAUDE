import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/providers'
import { LocalProvider } from '@/lib/providers/local'
import { getSystemPrompt } from '@/lib/db/system-prompts'
import type { ChatMessage } from '@/lib/providers/types'

export const dynamic = 'force-dynamic'

const KNOWN_PROVIDERS = new Set(['Anthropic', 'OpenAI', 'Google', 'IA Local'])

// Fallback a variables de entorno si el usuario no tiene key guardada en Supabase
const ENV_KEYS: Record<string, string | undefined> = {
  Anthropic: process.env.ANTHROPIC_API_KEY,
  OpenAI:    process.env.OPENAI_API_KEY,
  Google:    process.env.GOOGLE_AI_API_KEY,
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { messages: rawMessages, provider, model, endpoint, agentRole } = await req.json() as {
    messages:   ChatMessage[]
    provider:   string
    model:      string
    endpoint?:  string
    agentRole?: string  // 'manager' | 'worker' — mapeado en AgentPanel
  }

  // ── Capa 1: prepend system prompt de rol ────────────────────────────────────
  let messages = rawMessages
  if (agentRole) {
    const systemPrompt = await getSystemPrompt(agentRole)
    if (systemPrompt) {
      messages = [
        { role: 'user',      content: systemPrompt },
        { role: 'assistant', content: 'Understood.' },
        ...rawMessages,
      ]
    }
  }

  try {
    // ── Provider personalizado ────────────────────────────────────────────────
    if (!KNOWN_PROVIDERS.has(provider)) {
      const { data: custom } = await supabase
        .from('user_custom_providers')
        .select('endpoint_url, api_key')
        .eq('account_id', user.id)
        .eq('name', provider)
        .maybeSingle()

      if (!custom) {
        return Response.json(
          { error: `Provider "${provider}" no encontrado. Configuralo en Ajustes → Providers personalizados.` },
          { status: 400 }
        )
      }

      const stream = await new LocalProvider(custom.endpoint_url, custom.api_key).stream(messages, model)
      return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }

    // ── IA Local ──────────────────────────────────────────────────────────────
    if (provider === 'IA Local') {
      const stream = await new LocalProvider(endpoint ?? 'http://localhost:11434/v1').stream(messages, model)
      return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }

    // ── Providers cloud (Anthropic, OpenAI, Google) ───────────────────────────
    const { data: keyRow } = await supabase
      .from('user_api_keys')
      .select('api_key')
      .eq('account_id', user.id)
      .eq('provider', provider)
      .maybeSingle()

    const apiKey = keyRow?.api_key ?? ENV_KEYS[provider]

    if (!apiKey) {
      return Response.json(
        {
          error: `No hay API key para ${provider}. Configurá una en Ajustes (/settings) o agregá la variable de entorno.`,
        },
        { status: 400 }
      )
    }

    const stream = await getProvider(provider, { apiKey }).stream(messages, model)
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error del provider'
    return Response.json({ error: message }, { status: 500 })
  }
}
