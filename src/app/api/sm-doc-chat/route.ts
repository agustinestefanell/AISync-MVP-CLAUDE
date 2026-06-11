import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/providers'
import { LocalProvider } from '@/lib/providers/local'
import { getSystemPrompt } from '@/lib/db/system-prompts'
import type { ChatMessage } from '@/lib/providers/types'

export const dynamic = 'force-dynamic'

const KNOWN_PROVIDERS = new Set(['Anthropic', 'OpenAI', 'Google', 'IA Local'])

const ENV_KEYS: Record<string, string | undefined> = {
  Anthropic: process.env.ANTHROPIC_API_KEY,
  OpenAI:    process.env.OPENAI_API_KEY,
  Google:    process.env.GOOGLE_AI_API_KEY,
}

// Map pageName → system_prompts role
const PAGE_ROLE: Record<string, string> = {
  'Documentation Mode': 'sm_documentation',
  'Audit Log':          'sm_audit',
}

// Fallback hardcoded si el system prompt de DB no está disponible todavía
const FALLBACK_PREAMBLE = `You are Sub-Manager, an AI assistant integrated into AISync.\n\nRESPONSE FORMAT — MANDATORY:\nNever explain, reflect, greet, or narrate. Never write prose.\nWhen listing documents or checkpoints, respond ONLY with this format, one per line:\n\n[exact checkpoint name as it appears in the metadata] — [Team] — [Workspace] — [Date]\n\nWrite the checkpoint name exactly as shown in the metadata. No brackets, no special codes, no prefixes. Just the exact name.\nIf nothing matches: respond only with: No results found.\nFor direct questions (not searches): one sentence maximum.`

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages, pageContext, pageName, provider, model, endpoint } = await req.json() as {
    messages:    ChatMessage[]
    pageContext: string
    pageName?:   string
    provider:    string
    model:       string
    endpoint?:   string
  }

  // ── Capa 1: cargar system prompt de rol desde DB ────────────────────────────
  const smRole = pageName ? PAGE_ROLE[pageName] : undefined
  const rolePrompt = smRole ? await getSystemPrompt(smRole) : ''
  const basePreamble = rolePrompt || FALLBACK_PREAMBLE

  // El pageContext se adjunta después del system prompt de rol
  const fullPreamble = `${basePreamble}\n\nPage context:\n${pageContext}`

  const fullMessages: ChatMessage[] = [
    { role: 'user',      content: fullPreamble },
    { role: 'assistant', content: 'Understood. I have reviewed the page context and I am ready to assist.' },
    ...messages,
  ]

  try {
    if (!KNOWN_PROVIDERS.has(provider)) {
      const { data: custom } = await supabase
        .from('user_custom_providers')
        .select('endpoint_url, api_key')
        .eq('account_id', user.id)
        .eq('name', provider)
        .maybeSingle()

      if (!custom) {
        return Response.json(
          { error: `Provider "${provider}" not found. Configure it in Settings → Custom Providers.` },
          { status: 400 }
        )
      }

      const stream = await new LocalProvider(custom.endpoint_url, custom.api_key).stream(fullMessages, model)
      return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }

    if (provider === 'IA Local') {
      const stream = await new LocalProvider(endpoint ?? 'http://localhost:11434/v1').stream(fullMessages, model)
      return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }

    const { data: keyRow } = await supabase
      .from('user_api_keys')
      .select('api_key')
      .eq('account_id', user.id)
      .eq('provider', provider)
      .maybeSingle()

    // BYOK estricto: las keys de plataforma (ENV_KEYS) solo operan en desarrollo.
    // En producción cada usuario usa su propia key (DECISIONS.md 2026-06-11).
    const apiKey = keyRow?.api_key ??
      (process.env.NODE_ENV === 'development' ? ENV_KEYS[provider] : undefined)

    if (!apiKey) {
      return Response.json(
        { error: `No API key configured for ${provider}. Add your key in Settings → Providers to use this agent.` },
        { status: 400 }
      )
    }

    const stream = await getProvider(provider, { apiKey }).stream(fullMessages, model)
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Provider error'
    return Response.json({ error: message }, { status: 500 })
  }
}
