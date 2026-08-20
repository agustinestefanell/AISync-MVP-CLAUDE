import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/providers'
import { LocalProvider } from '@/lib/providers/local'
import { completeText } from '@/lib/providers/completeText'
import { resolveProviderApiKey, KNOWN_PROVIDERS } from '@/lib/providers/resolveApiKey'
import { getSystemPrompt } from '@/lib/db/system-prompts'
import type { ChatMessage } from '@/lib/providers/types'

export const dynamic = 'force-dynamic'

// Map pageName → system_prompts role
const PAGE_ROLE: Record<string, string> = {
  'Documentation Mode': 'sm_documentation',
  'Audit Log':          'sm_audit',
}

// Roles que devuelven JSON estricto (no streaming, no conversación libre) en
// vez de texto/streaming — hoy solo el SM de Documentation Mode (V1, 2026-08-20:
// Repository View + Audit View, ver DECISIONS.md). sm_audit sigue conversacional
// sin cambios, no está en este set.
const SEARCH_ROLES = new Set(['sm_documentation'])

// Fallback hardcoded si el system prompt de DB no está disponible todavía
const FALLBACK_PREAMBLE = `You are Sub-Manager, an AI assistant integrated into AISync.\n\nRESPONSE FORMAT — MANDATORY:\nNever explain, reflect, greet, or narrate. Never write prose.\nWhen listing documents or checkpoints, respond ONLY with this format, one per line:\n\n[exact checkpoint name as it appears in the metadata] — [Team] — [Workspace] — [Date]\n\nWrite the checkpoint name exactly as shown in the metadata. No brackets, no special codes, no prefixes. Just the exact name.\nIf nothing matches: respond only with: No results found.\nFor direct questions (not searches): one sentence maximum.`

// Fallback si el prompt de DB de sm_documentation no está disponible —
// mismo contrato JSON estricto que migración 057.
const FALLBACK_SEARCH_PREAMBLE = `You are a search-only tool for Documentation Mode. Respond ONLY with valid JSON, no markdown fences, no extra text: {"matches": ["key1", "key2", ...]}. Each key MUST be copied literally from the index provided in the page context — never invent one. If nothing matches, or the user's message is not a search, respond {"matches": []}.`

interface SearchMatch { matches: string[] }

// Limpia fences ```json``` si el modelo los agrega pese a la instrucción,
// valida que sea un array de strings — nunca deja pasar algo que no matchee
// el contrato, cae a matches vacío en vez de romper el frontend.
function parseSearchMatches(raw: string): SearchMatch {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  try {
    const obj = JSON.parse(cleaned) as Partial<SearchMatch>
    const matches = Array.isArray(obj.matches) ? obj.matches.filter((m): m is string => typeof m === 'string') : []
    return { matches }
  } catch {
    return { matches: [] }
  }
}

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
  const smRole   = pageName ? PAGE_ROLE[pageName] : undefined
  const isSearch = !!smRole && SEARCH_ROLES.has(smRole)
  const rolePrompt = smRole ? await getSystemPrompt(smRole) : ''
  const basePreamble = rolePrompt || (isSearch ? FALLBACK_SEARCH_PREAMBLE : FALLBACK_PREAMBLE)

  // El pageContext se adjunta después del system prompt de rol
  const fullPreamble = `${basePreamble}\n\nPage context:\n${pageContext}`

  const fullMessages: ChatMessage[] = [
    { role: 'user',      content: fullPreamble },
    { role: 'assistant', content: isSearch ? 'Understood. I will respond only with the JSON object described, based strictly on the index provided.' : 'Understood. I have reviewed the page context and I am ready to assist.' },
    ...messages,
  ]

  try {
    // ── Modo búsqueda (sm_documentation, V1 2026-08-20) — no streaming, el
    // frontend necesita el JSON completo para resolverlo contra el índice
    // real, no texto libre. sm_audit y cualquier otro rol futuro siguen el
    // camino streaming de siempre, sin cambios.
    if (isSearch) {
      if (provider === 'IA Local') {
        const stream = await new LocalProvider(endpoint ?? 'http://localhost:11434/v1').stream(fullMessages, model)
        const raw = await new Response(stream).text()
        return Response.json(parseSearchMatches(raw))
      }

      const resolved = await resolveProviderApiKey(supabase, user.id, provider)
      if (!resolved) {
        return Response.json(
          {
            error: KNOWN_PROVIDERS.has(provider)
              ? `No API key configured for ${provider}. Add your key in Settings → Providers.`
              : `Provider "${provider}" not found. Configure it in Settings → Custom Providers.`,
          },
          { status: 400 }
        )
      }

      const raw = await completeText(provider, resolved, fullMessages, model)
      return Response.json(parseSearchMatches(raw))
    }

    if (provider === 'IA Local') {
      const stream = await new LocalProvider(endpoint ?? 'http://localhost:11434/v1').stream(fullMessages, model)
      return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }

    // ── Resolución de API key — fuente única (ARC-001) ────────────────────────
    const resolved = await resolveProviderApiKey(supabase, user.id, provider)

    if (!resolved) {
      return Response.json(
        {
          error: KNOWN_PROVIDERS.has(provider)
            ? `No API key configured for ${provider}. Add your key in Settings → Providers.`
            : `Provider "${provider}" not found. Configure it in Settings → Custom Providers.`,
        },
        { status: 400 }
      )
    }

    if (resolved.isCustom) {
      const stream = await new LocalProvider(resolved.endpointUrl, resolved.apiKey ?? undefined).stream(fullMessages, model)
      return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }

    const stream = await getProvider(provider, { apiKey: resolved.apiKey }).stream(fullMessages, model)
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Provider error'
    return Response.json({ error: message }, { status: 500 })
  }
}
