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

interface PanelSnapshot {
  role:         string
  panel:        string
  lastMessages: { role: string; content: string }[]
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const {
    messages: rawMessages,
    provider, model, endpoint, agentRole,
    team_id, team_type,
    otherPanelsSnapshot,
  } = await req.json() as {
    messages:              ChatMessage[]
    provider:              string
    model:                 string
    endpoint?:             string
    agentRole?:            string
    team_id?:              string | null
    workspace_id?:         string | null
    team_type?:            string | null
    panel_id?:             string | null
    session_id?:           string | null
    otherPanelsSnapshot?:  PanelSnapshot[]
  }

  // ── Capa 1: Role system prompt ──────────────────────────────────────────────
  const rolePromptParts: ChatMessage[] = []
  if (agentRole) {
    const systemPrompt = await getSystemPrompt(agentRole)
    if (systemPrompt) {
      rolePromptParts.push(
        { role: 'user',      content: systemPrompt },
        { role: 'assistant', content: 'Understood.' },
      )
    }
  }

  // ── Capa 3: Team system prompt from Supabase (tolerant — table may not have team_id column yet) ──
  const teamPromptParts: ChatMessage[] = []
  if (team_id) {
    try {
      const { data: tp } = await supabase
        .from('system_prompts')
        .select('role_prompt')
        .eq('team_id', team_id)
        .eq('is_active', true)
        .maybeSingle()
      if (tp?.role_prompt) {
        teamPromptParts.push(
          { role: 'user',      content: tp.role_prompt },
          { role: 'assistant', content: 'Understood.' },
        )
      }
    } catch {
      // no team prompt available — continue without breaking
    }
  }

  // ── Capa 4: Snapshot of other panels (SAT only — MAT left isolated by default) ──
  const snapshotParts: ChatMessage[] = []
  const snapshot = otherPanelsSnapshot ?? []
  if (team_type === 'SAT' && snapshot.length > 0) {
    const lines = snapshot
      .filter(p => p.lastMessages?.length > 0)
      .map(p => {
        const msgs = p.lastMessages
          .map(m => `  ${m.role === 'user' ? 'User' : p.role}: ${m.content.slice(0, 400)}`)
          .join('\n')
        return `${p.role}:\n${msgs}`
      })
      .join('\n\n')

    if (lines) {
      snapshotParts.push(
        { role: 'user',      content: `Current state of other team agents:\n\n${lines}` },
        { role: 'assistant', content: 'Understood. I have the current context of my team.' },
      )
    }
  }

  // ── Assemble final message array (order: role → team → snapshot → history) ──
  const messages: ChatMessage[] = [
    ...rolePromptParts,
    ...teamPromptParts,
    ...snapshotParts,
    ...rawMessages,
  ]

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
        { error: `No hay API key para ${provider}. Configurá una en Ajustes (/settings) o agregá la variable de entorno.` },
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
