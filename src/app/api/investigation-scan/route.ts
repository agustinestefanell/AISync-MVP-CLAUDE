// CONTENT PLANE — investigation_snapshot (client-owned investigation output).
// Endpoint dedicado de Investigate View (Fase A, 2026-08-20) — NO comparte
// código con el SM lateral (src/app/api/sm-doc-chat/route.ts, roles
// sm_documentation/sm_audit). System prompt propio (role 'investigation_scan',
// migración 056), lógica de resolución de sesiones y armado de evidencia
// propia. Ver handoff-2026-07-b.md 2026-08-20 (Paso 0, puntos 1/3).

import { createClient } from '@/lib/supabase/server'
import { completeText } from '@/lib/providers/completeText'
import { resolveProviderApiKey, KNOWN_PROVIDERS } from '@/lib/providers/resolveApiKey'
import { getSystemPrompt } from '@/lib/db/system-prompts'
import { AGENT_LABEL, type AnchorKind } from '@/lib/documentation/anchors'
import type { ChatMessage } from '@/lib/providers/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const FALLBACK_SYSTEM_PROMPT = `You analyze a real investigation question against real chat message evidence provided to you. Rules: 1. Only cite content literally present in the messages provided — never invent or assume. 2. If evidence is insufficient, verdict MUST be "inconclusive". 3. Respond ONLY with valid JSON, no markdown fences, no extra text: {"verdict": "yes"|"partial"|"no"|"inconclusive", "justification": "...", "evidence": [{"source": "...", "excerpt": "...", "timestamp": "..."}]}.`

interface AnchorInput {
  kind:             AnchorKind
  id:               string
  title:            string
  originAgentRole?: string
  flavor?:          'context_files' | 'chat'
  originType?:      'checkpoint' | 'handoff_package' | 'saved_selection'
  originId?:        string
}

interface ScanBody {
  mode:               'session_scan' | 'deep_search'
  workspaceId:        string
  investigationFocus: string
  anchor:             AnchorInput
}

interface SessionInfo { id: string; agentRole: string; provider: string; model: string }

// ── Resolución de sesión(es) de origen — ver handoff 2026-08-20 Paso 0 punto 1.
// Checkpoint: siempre TODAS las sesiones del workspace (Save Version captura
// panels = workspace.agent_sessions.map(...) en /api/checkpoint, confirmado en
// código — no hay "sesión de origen única" real que resolver).
// Handoff/Review & Forward: agent_role explícito (from_agent / metadata.from).
// Saved Selection: distinct agent_role dentro del JSONB messages.
// Loaded Context "chat": FK real message_provenance → messages.session_id.
// Loaded Context "context_files": cascada al tipo de origen (origin_type/id).
// Cualquier resolución vacía cae a TODAS las sesiones del workspace (fallback
// documentado en la consigna original).
async function resolveOriginSessions(
  supabase: SupabaseClient,
  allSessions: SessionInfo[],
  anchor: AnchorInput,
): Promise<SessionInfo[]> {
  const byRole = (role: string | undefined) =>
    role ? allSessions.filter(s => s.agentRole === role) : []

  switch (anchor.kind) {
    case 'checkpoint':
      return allSessions

    case 'handoff':
    case 'review_forward': {
      const found = byRole(anchor.originAgentRole)
      return found.length ? found : allSessions
    }

    case 'saved_selection': {
      const { data } = await supabase
        .from('saved_selections')
        .select('messages')
        .eq('id', anchor.id)
        .single()
      const msgs = (Array.isArray(data?.messages) ? data.messages : []) as Array<{ agent_role?: string }>
      const roles = new Set(msgs.map(m => m.agent_role).filter((r): r is string => Boolean(r)))
      const found = allSessions.filter(s => roles.has(s.agentRole))
      return found.length ? found : allSessions
    }

    case 'loaded_context': {
      if (anchor.flavor === 'chat') {
        const { data: mp } = await supabase
          .from('message_provenance')
          .select('messages(session_id)')
          .eq('id', anchor.id)
          .single()
        const sessionId = (mp as { messages?: { session_id?: string } | null } | null)?.messages?.session_id
        const found = sessionId ? allSessions.filter(s => s.id === sessionId) : []
        return found.length ? found : allSessions
      }
      // flavor 'context_files' — cascada al tipo de origen real
      if (anchor.originType === 'checkpoint') return allSessions
      if (anchor.originType === 'handoff_package' && anchor.originId) {
        const { data } = await supabase.from('handoff_packages').select('from_agent').eq('id', anchor.originId).single()
        const found = byRole(data?.from_agent)
        return found.length ? found : allSessions
      }
      if (anchor.originType === 'saved_selection' && anchor.originId) {
        return resolveOriginSessions(supabase, allSessions, { ...anchor, kind: 'saved_selection', id: anchor.originId })
      }
      return allSessions
    }
  }
}

export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = new URL(req.url).searchParams.get('workspaceId')
  if (!workspaceId) return Response.json({ error: 'workspaceId is required.' }, { status: 400 })

  const { data: sessions } = await supabase.from('agent_sessions').select('id').eq('workspace_id', workspaceId)
  const sessionIds = (sessions ?? []).map(s => s.id as string)
  if (sessionIds.length === 0) return Response.json({ messageCount: 0, sessionCount: 0 })

  // Estimación liviana (cantidad de mensajes, no tokens) — ver handoff
  // 2026-08-20 Paso 0 punto 4. count-only, barato, mismo criterio ya usado
  // para volumen real de `messages` en Fase 1.5/1.6.
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .in('session_id', sessionIds)

  return Response.json({ messageCount: count ?? 0, sessionCount: sessionIds.length })
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { mode, workspaceId, investigationFocus, anchor } = await req.json() as ScanBody
  if (!workspaceId || !anchor?.id) return Response.json({ error: 'workspaceId and anchor are required.' }, { status: 400 })

  const { data: sessionRows } = await supabase
    .from('agent_sessions')
    .select('id, agent_role, provider, model')
    .eq('workspace_id', workspaceId)
  const allSessions: SessionInfo[] = (sessionRows ?? []).map(s => ({
    id: s.id, agentRole: s.agent_role, provider: s.provider, model: s.model,
  }))
  if (allSessions.length === 0) return Response.json({ error: 'No agent sessions found for this workspace.' }, { status: 404 })

  const scannedSessions = mode === 'deep_search'
    ? allSessions
    : await resolveOriginSessions(supabase, allSessions, anchor)
  const notScannedSessions = allSessions.filter(s => !scannedSessions.some(sc => sc.id === s.id))

  const scannedIds = scannedSessions.map(s => s.id)
  const { data: messageRows } = await supabase
    .from('messages')
    .select('role, content, created_at, agent_sessions(agent_role)')
    .in('session_id', scannedIds)
    .order('created_at', { ascending: true })

  const evidenceMessages = (messageRows ?? []) as unknown as Array<{
    role: string; content: string; created_at: string; agent_sessions: { agent_role: string } | null
  }>

  const sourcesScanned    = scannedSessions.map(s => ({ sessionId: s.id, agentRole: s.agentRole, label: AGENT_LABEL[s.agentRole] ?? s.agentRole }))
  const sourcesNotScanned = notScannedSessions.map(s => ({ sessionId: s.id, agentRole: s.agentRole, label: AGENT_LABEL[s.agentRole] ?? s.agentRole }))

  if (evidenceMessages.length === 0) {
    return Response.json({
      verdict: 'inconclusive',
      justification: 'No chat messages were found in the scanned session(s) to evaluate this investigation focus against.',
      evidence: [],
      sourcesScanned,
      sourcesNotScanned,
    })
  }

  // Provider/model: el de la primera sesión escaneada (Manager si está entre
  // las escaneadas) — ninguna UI nueva de selección de provider, reusa lo ya
  // configurado por el usuario para ese agente. Ver handoff 2026-08-20 Paso 0.
  const primarySession = scannedSessions.find(s => s.agentRole === 'manager') ?? scannedSessions[0]

  const transcript = evidenceMessages.map(m => {
    const label = m.agent_sessions?.agent_role ? (AGENT_LABEL[m.agent_sessions.agent_role] ?? m.agent_sessions.agent_role) : 'Unknown'
    return `[${label} · ${m.created_at} · ${m.role}] ${m.content}`
  }).join('\n\n')

  const focus = (investigationFocus || '').trim() || `Reconstruct what this ${anchor.kind.replace('_', ' ')} ("${anchor.title}") represents based on the scanned evidence.`

  const userPrompt = `Investigation focus:\n${focus}\n\nEvidence (chat messages from the scanned session(s), chronological order):\n${transcript}\n\nRespond with the JSON object described in your instructions, evaluating the investigation focus strictly against this evidence.`

  const rolePrompt = await getSystemPrompt('investigation_scan')
  const systemPreamble = rolePrompt || FALLBACK_SYSTEM_PROMPT

  const chatMessages: ChatMessage[] = [
    { role: 'user', content: systemPreamble },
    { role: 'assistant', content: 'Understood. I will respond only with the JSON object described, based strictly on the evidence provided.' },
    { role: 'user', content: userPrompt },
  ]

  // 'IA Local' resuelve su endpoint desde el request del browser en cada
  // llamada de chat en vivo (ver chat/route.ts) — no hay endpoint persistido
  // en agent_sessions para reconstruirlo acá. Fase A: error claro en vez de
  // intentar un default silencioso que podría apuntar a nada.
  if (primarySession.provider === 'IA Local') {
    return Response.json({ error: 'Session Scan/Deep Search does not support IA Local sessions yet — the local endpoint is only known from the live chat panel.' }, { status: 400 })
  }

  try {
    const resolved = await resolveProviderApiKey(supabase, user.id, primarySession.provider)
    if (!resolved) {
      return Response.json({
        error: KNOWN_PROVIDERS.has(primarySession.provider)
          ? `No API key configured for ${primarySession.provider}. Add your key in Settings → Providers.`
          : `Provider "${primarySession.provider}" not found. Configure it in Settings → Custom Providers.`,
      }, { status: 400 })
    }

    const rawContent = await completeText(primarySession.provider, resolved, chatMessages, primarySession.model)

    const parsed = parseVerdict(rawContent)

    // Persistencia — fail-open, no bloquea la respuesta ya calculada.
    try {
      await supabase.from('investigation_snapshot').insert({
        account_id:          user.id,
        investigation_focus: investigationFocus || null,
        anchor_object_type:  anchor.kind === 'handoff' ? 'handoff_package' : anchor.kind,
        anchor_object_id:    anchor.id,
        scan_mode:           mode,
        sources_scanned:     sourcesScanned,
        sources_not_scanned: sourcesNotScanned,
        verdict:             parsed.verdict,
        justification:       parsed.justification,
        evidence_refs:       parsed.evidence,
        provider_used:       primarySession.provider,
        model_used:          primarySession.model,
        created_by:          user.id,
      })
    } catch (persistErr) {
      console.error('[investigation-scan] failed to persist snapshot', persistErr)
    }

    return Response.json({ ...parsed, sourcesScanned, sourcesNotScanned })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Provider error'
    return Response.json({ error: message }, { status: 500 })
  }
}

interface ParsedVerdict {
  verdict:       'yes' | 'partial' | 'no' | 'inconclusive'
  justification: string
  evidence:      Array<{ source: string; excerpt: string; timestamp?: string }>
}

const VALID_VERDICTS = new Set(['yes', 'partial', 'no', 'inconclusive'])

// El modelo puede devolver el JSON envuelto en ```json fences pese a la
// instrucción — se limpia antes de parsear. Si el parseo falla, no se
// inventa un verdict optimista: cae a "inconclusive" con el texto crudo
// como justificación, para no romper la UI ni fabricar evidencia.
function parseVerdict(raw: string): ParsedVerdict {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  try {
    const obj = JSON.parse(cleaned) as Partial<ParsedVerdict>
    const verdict = typeof obj.verdict === 'string' && VALID_VERDICTS.has(obj.verdict) ? obj.verdict as ParsedVerdict['verdict'] : 'inconclusive'
    const justification = typeof obj.justification === 'string' && obj.justification.trim() ? obj.justification : 'The model did not return a usable justification.'
    const evidence = Array.isArray(obj.evidence)
      ? obj.evidence.filter((e): e is { source: string; excerpt: string; timestamp?: string } => !!e && typeof e.source === 'string' && typeof e.excerpt === 'string')
      : []
    return { verdict, justification, evidence }
  } catch {
    return {
      verdict: 'inconclusive',
      justification: `The model response could not be parsed as structured evidence. Raw response: ${cleaned.slice(0, 300)}`,
      evidence: [],
    }
  }
}
