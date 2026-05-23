import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/providers'
import { LocalProvider } from '@/lib/providers/local'
import { getSystemPrompt } from '@/lib/db/system-prompts'
import { listActivePromptsForContext } from '@/lib/db/prompts'
import { getContextSourcesForRuntime } from '@/lib/db/context'
import type { ChatMessage } from '@/lib/providers/types'

export const dynamic = 'force-dynamic'

const KNOWN_PROVIDERS = new Set(['Anthropic', 'OpenAI', 'Google', 'Groq', 'IA Local'])

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

function truncateContextText(text: string, maxLength = 35000): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const {
    messages: rawMessages,
    provider, model, endpoint, agentRole,
    team_id, team_type,
    panel_id, session_id,
    project_id,
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
    project_id?:           string | null
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

  // ── Capa: Prompt Library — Team prompts first, Worker prompts after ─────────
  // Orden de precedencia: Team Prompt → Worker Prompt (Worker prevalece en su ámbito).
  const promptLibraryParts: ChatMessage[] = []
  try {
    const { teamPrompts, workerPrompts } = await listActivePromptsForContext({
      teamId:    team_id,
      sessionId: session_id,
      agentRole: panel_id,
    })

    if (teamPrompts.length > 0) {
      const content = [
        'Active Team Prompts from Prompt Library:',
        ...teamPrompts.map(p => `[Title: ${p.title} | Version: ${p.version}]\n${p.body}`),
      ].join('\n\n')
      promptLibraryParts.push(
        { role: 'user',      content },
        { role: 'assistant', content: 'Understood.' },
      )
    }

    if (workerPrompts.length > 0) {
      const content = [
        'Active Worker Prompts from Prompt Library:',
        ...workerPrompts.map(p => `[Title: ${p.title} | Version: ${p.version}]\n${p.body}`),
      ].join('\n\n')
      promptLibraryParts.push(
        { role: 'user',      content },
        { role: 'assistant', content: 'Understood.' },
      )
    }
  } catch { /* prompt library unavailable — continue without breaking */ }

  // ── Capa: Context Files — Project → Team → Session (material factual/documental) ─
  const contextFilesParts: ChatMessage[] = []
  try {
    const contextSources = await getContextSourcesForRuntime({
      projectId:  project_id  ?? null,
      teamId:     team_id     ?? null,
      sessionId:  session_id  ?? null,
    })

    if (contextSources.length > 0) {
      const lines = contextSources.map(s => {
        const scopeLabel = s.scope === 'project' ? 'Project Context'
          : s.scope === 'team' ? 'Team Context'
          : 'Session Context'
        return `[${scopeLabel}] Title: ${s.title}\nContent: ${truncateContextText(s.content_text ?? '')}`
      }).join('\n\n')

      contextFilesParts.push(
        { role: 'user',      content: `Context files available to this agent:\n\n${lines}` },
        { role: 'assistant', content: 'Understood. I have reviewed the context files.' },
      )
    }
  } catch { /* context files unavailable — continue without breaking */ }

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

  // ── Assemble final message array (order: role → team → prompt library → context files → snapshot → history) ──
  const messages: ChatMessage[] = [
    ...rolePromptParts,
    ...teamPromptParts,
    ...promptLibraryParts,
    ...contextFilesParts,
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
