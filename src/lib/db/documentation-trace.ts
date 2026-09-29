// CONTENT PLANE — These queries operate on client-owned artifacts.
// Data is currently stored in platform infrastructure but must be
// treated as migratable client property. See src/lib/db/planes.ts
//
// Loaders de las pestañas "Web Searches" y "Attached Files" de Documentation
// Mode (OE Trazabilidad, Parte 2 — 2026-09-29). Solo lectura, cliente del
// usuario (RLS). Se llaman desde /api/documentation/web-searches y
// /api/documentation/attached-files — carga al abrir la pestaña, no en la
// carga inicial de la página.
//
// Regla de huérfanas (AISyncPlans.md, confirmada por Agus): la búsqueda es el
// objeto principal y SIEMPRE se muestra; el vínculo al mensaje es opcional.

import { createClient } from '@/lib/supabase/server'
import { stripMarkdown } from '@/lib/text/stripMarkdown'
import { cleanUrl } from '@/lib/tools/urls'
import { getHierarchyMaps } from './documentation'

type Supabase = ReturnType<typeof createClient>

const SNIPPET_LENGTH = 600
const PAGE_SIZE      = 1000  // tope por request de PostgREST
const ID_CHUNK       = 100   // ids por `.in()` — evita URLs demasiado largas
const CONCURRENCY    = 8

interface TraceLocation {
  session_id:     string
  agent_role:     string | null
  workspace_id:   string | null
  workspace_name: string
  team_id:        string | null
  team_name:      string | null
  project_id:     string | null
  project_name:   string | null
}

// linked      → la respuesta existe (message_id encontrado)
// interrupted → tiene message_id pero la respuesta nunca se guardó
// failed      → status='error' (la respuesta, si existe, es la que recibió el error)
// legacy      → sin message_id: registrada antes de la migración 062
export type WebSearchLinkState = 'linked' | 'interrupted' | 'failed' | 'legacy'

// exact   → respuesta por message_id
// by_time → primera respuesta del agente posterior en la misma sesión (legacy / adjuntos)
// none    → no hay respuesta guardada para ese turno
export type ResponseMatch = 'exact' | 'by_time' | 'none'

export interface DocWebSearchSource {
  position:       number | null
  title:          string
  url:            string
  clean_url:      string
  domain:         string
  published_date: string | null
  cited:          boolean
}

export interface DocWebSearch extends TraceLocation {
  id:               string
  query:            string
  created_at:       string
  status:           'success' | 'error'
  error:            string | null
  link_state:       WebSearchLinkState
  message_id:       string | null
  provider:         string | null
  model:            string | null
  sources:          DocWebSearchSource[]
  cited_evaluated:  boolean   // false = cited_urls NULL
  cited_count:      number
  response_snippet: string | null
  response_at:      string | null
  response_match:   ResponseMatch
}

export interface DocAttachedFile extends TraceLocation {
  id:               string
  filename:         string
  extension:        string
  mime_type:        string
  attachment_type:  'image' | 'document'
  size_bytes:       number | null
  provider:         string | null
  created_at:       string
  message_id:       string | null
  is_legacy:        boolean
  legacy_rows:      number    // filas agrupadas (duplicados pre-Parte 1); 1 si no es legacy
  response_snippet: string | null
  response_at:      string | null
  response_match:   ResponseMatch
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// Todas las filas de una tabla, paginando de a PAGE_SIZE (PostgREST corta en 1000).
async function selectAllRows<T>(supabase: Supabase, table: string, columns: string): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot > 0 && dot < filename.length - 1 ? filename.slice(dot + 1).toLowerCase() : ''
}

function snippetOf(content: string | null | undefined): string | null {
  if (!content) return null
  const text = stripMarkdown(content, SNIPPET_LENGTH).trim()
  return text || null
}

// Ubicación (agente + Project/Team/Workspace) de cada sesión involucrada.
async function resolveLocations(supabase: Supabase, sessionIds: string[]): Promise<Map<string, TraceLocation>> {
  const [sessionChunks, { workspaceMap, teamMap, projectMap }] = await Promise.all([
    Promise.all(chunk(sessionIds, ID_CHUNK).map(ids =>
      supabase.from('agent_sessions').select('id, agent_role, workspace_id').in('id', ids)
    )),
    getHierarchyMaps(supabase),
  ])

  const map = new Map<string, TraceLocation>()
  for (const { data } of sessionChunks) {
    for (const s of (data ?? []) as { id: string; agent_role: string | null; workspace_id: string | null }[]) {
      const ws   = s.workspace_id ? workspaceMap.get(s.workspace_id) : undefined
      const team = ws?.team_id ? teamMap.get(ws.team_id) : undefined
      map.set(s.id, {
        session_id:     s.id,
        agent_role:     s.agent_role,
        workspace_id:   s.workspace_id,
        workspace_name: ws?.name ?? '—',
        team_id:        ws?.team_id ?? null,
        team_name:      team?.name ?? null,
        project_id:     team?.project_id ?? null,
        project_name:   team?.project_id ? projectMap.get(team.project_id) ?? null : null,
      })
    }
  }
  return map
}

function locationFor(locations: Map<string, TraceLocation>, sessionId: string): TraceLocation {
  return locations.get(sessionId) ?? {
    session_id: sessionId, agent_role: null, workspace_id: null, workspace_name: '—',
    team_id: null, team_name: null, project_id: null, project_name: null,
  }
}

// Mensajes por id (respuestas exactas vía message_id).
async function messagesById(supabase: Supabase, ids: string[]): Promise<Map<string, { content: string; created_at: string }>> {
  const map = new Map<string, { content: string; created_at: string }>()
  const results = await Promise.all(chunk(ids, ID_CHUNK).map(part =>
    supabase.from('messages').select('id, content, created_at').in('id', part)
  ))
  for (const { data } of results) {
    for (const m of (data ?? []) as { id: string; content: string; created_at: string }[]) {
      map.set(m.id, { content: m.content, created_at: m.created_at })
    }
  }
  return map
}

// "Siguiente respuesta del agente en la misma sesión": el primer mensaje
// posterior a `after`. Si ese primer mensaje es del usuario, la respuesta de
// ese turno nunca se guardó → 'none' (no se empareja con un turno posterior,
// sería un dato falso).
async function nextAssistantResponse(
  supabase: Supabase,
  sessionId: string,
  after: string,
): Promise<{ snippet: string | null; at: string | null; match: ResponseMatch }> {
  const { data } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .eq('session_id', sessionId)
    .gt('created_at', after)
    .order('created_at', { ascending: true })
    .limit(1)
  const next = (data ?? [])[0] as { role: string; content: string; created_at: string } | undefined
  if (!next || next.role !== 'assistant') return { snippet: null, at: null, match: 'none' }
  return { snippet: snippetOf(next.content), at: next.created_at, match: 'by_time' }
}

// ── Web Searches ────────────────────────────────────────────────────────────

interface ToolCallRow {
  id:             string
  session_id:     string
  query:          string | null
  provider:       string | null
  model:          string | null
  sources:        { title?: string; url?: string; clean_url?: string; published_date?: string | null; position?: number }[] | null
  created_at:     string
  message_id:     string | null
  status:         'success' | 'error' | null
  error:          string | null
  cited_urls:     string[] | null
}

export async function getDocWebSearches(): Promise<DocWebSearch[]> {
  const supabase = createClient()
  const rows = await selectAllRows<ToolCallRow>(
    supabase,
    'session_tool_calls',
    'id, session_id, query, provider, model, sources, created_at, message_id, status, error, cited_urls',
  )

  const sessionIds = Array.from(new Set(rows.map(r => r.session_id).filter(Boolean)))
  const messageIds = Array.from(new Set(rows.map(r => r.message_id).filter((id): id is string => Boolean(id))))
  const [locations, responses] = await Promise.all([
    resolveLocations(supabase, sessionIds),
    messagesById(supabase, messageIds),
  ])

  // Legacy (sin message_id): respuesta por tiempo, en paralelo acotado.
  const legacy = rows.filter(r => !r.message_id)
  const legacyResponses = new Map(
    (await mapLimit(legacy, CONCURRENCY, r => nextAssistantResponse(supabase, r.session_id, r.created_at)))
      .map((res, i) => [legacy[i].id, res]),
  )

  return rows.map(r => {
    const citedSet = new Set(r.cited_urls ?? [])
    const sources: DocWebSearchSource[] = (r.sources ?? [])
      .filter(s => typeof s.url === 'string')
      .map(s => {
        const clean = s.clean_url ?? cleanUrl(s.url!)
        return {
          position:       s.position ?? null,
          title:          s.title || s.url!,
          url:            s.url!,
          clean_url:      clean,
          domain:         domainOf(clean),
          published_date: s.published_date ?? null,
          cited:          citedSet.has(clean),
        }
      })

    const status = r.status === 'error' ? 'error' : 'success'
    const response = r.message_id ? responses.get(r.message_id) : undefined

    let linkState: WebSearchLinkState
    let snippet: string | null = null
    let responseAt: string | null = null
    let match: ResponseMatch = 'none'

    if (!r.message_id) {
      const res = legacyResponses.get(r.id)
      linkState = status === 'error' ? 'failed' : 'legacy'
      snippet = res?.snippet ?? null; responseAt = res?.at ?? null; match = res?.match ?? 'none'
    } else if (response) {
      linkState = status === 'error' ? 'failed' : 'linked'
      snippet = snippetOf(response.content); responseAt = response.created_at; match = 'exact'
    } else {
      // Respuesta nunca guardada (o ya borrada): la búsqueda igual se muestra.
      linkState = status === 'error' ? 'failed' : (r.cited_urls === null ? 'interrupted' : 'linked')
    }

    return {
      ...locationFor(locations, r.session_id),
      id:               r.id,
      query:            r.query ?? '',
      created_at:       r.created_at,
      status,
      error:            r.error,
      link_state:       linkState,
      message_id:       r.message_id,
      provider:         r.provider,
      model:            r.model,
      sources,
      cited_evaluated:  r.cited_urls !== null,
      cited_count:      sources.filter(s => s.cited).length,
      response_snippet: snippet,
      response_at:      responseAt,
      response_match:   match,
    }
  })
}

// ── Attached Files ──────────────────────────────────────────────────────────

interface AttachmentRow {
  id:              string
  session_id:      string
  message_id:      string | null
  filename:        string
  mime_type:       string
  size_bytes:      number | null
  attachment_type: 'image' | 'document'
  provider:        string | null
  created_at:      string
}

export async function getDocAttachments(): Promise<DocAttachedFile[]> {
  const supabase = createClient()
  const rows = await selectAllRows<AttachmentRow>(
    supabase,
    'session_attachments',
    'id, session_id, message_id, filename, mime_type, size_bytes, attachment_type, provider, created_at',
  )

  // Legacy (pre-Parte 1, sin message_id): una sola fila por sesión + archivo,
  // la más temprana — las demás eran duplicados del reenvío del historial.
  // Solo al mostrar; la base no se toca (decisión B de Agus).
  const linked = rows.filter(r => r.message_id)
  const legacyGroups = new Map<string, { first: AttachmentRow; count: number }>()
  for (const r of rows.filter(r => !r.message_id)) {
    const key = `${r.session_id}|${r.filename}`
    const group = legacyGroups.get(key)
    if (!group) legacyGroups.set(key, { first: r, count: 1 })
    else {
      group.count++
      if (r.created_at < group.first.created_at) group.first = r
    }
  }
  const items: { row: AttachmentRow; legacyRows: number }[] = [
    ...linked.map(row => ({ row, legacyRows: 1 })),
    ...Array.from(legacyGroups.values()).map(g => ({ row: g.first, legacyRows: g.count })),
  ]

  const sessionIds = Array.from(new Set(items.map(i => i.row.session_id).filter(Boolean)))
  const userMessageIds = linked.map(r => r.message_id as string)
  const [locations, userMessages] = await Promise.all([
    resolveLocations(supabase, sessionIds),
    messagesById(supabase, userMessageIds),
  ])

  // Punto de partida del "siguiente mensaje del agente": el mensaje del usuario
  // que subió el archivo; en legacy (o si ese mensaje no está), la fecha de la
  // fila — se escribe después de guardar el mensaje del usuario (ERR-003).
  const responses = await mapLimit(items, CONCURRENCY, ({ row }) => {
    const after = (row.message_id && userMessages.get(row.message_id)?.created_at) || row.created_at
    return nextAssistantResponse(supabase, row.session_id, after)
  })

  return items
    .map(({ row, legacyRows }, i) => ({
      ...locationFor(locations, row.session_id),
      id:               row.id,
      filename:         row.filename,
      extension:        extensionOf(row.filename),
      mime_type:        row.mime_type,
      attachment_type:  row.attachment_type,
      size_bytes:       row.size_bytes,
      provider:         row.provider,
      created_at:       row.created_at,
      message_id:       row.message_id,
      is_legacy:        !row.message_id,
      legacy_rows:      legacyRows,
      response_snippet: responses[i].snippet,
      response_at:      responses[i].at,
      response_match:   responses[i].match,
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}
