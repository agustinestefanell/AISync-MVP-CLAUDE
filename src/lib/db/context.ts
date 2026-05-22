import { createClient } from '@/lib/supabase/server'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ContextSourceKind =
  | 'uploaded_file'
  | 'derived_context_note'
  | 'saved_selection_context'
  | 'external_reference'

export type ContextScope = 'project' | 'team' | 'session'

export type ContextSourceStatus = 'active' | 'archived'

export interface ContextSource {
  id:                       string
  user_id:                  string
  title:                    string
  source_kind:              ContextSourceKind | null
  scope:                    ContextScope | null
  project_id:               string | null
  team_id:                  string | null
  workspace_id:             string | null
  session_id:               string | null
  content_text:             string | null
  file_path:                string | null
  file_type:                string | null
  file_size_bytes:          number | null
  status:                   ContextSourceStatus
  retention_mode:           string
  extracted_text_available: boolean
  origin_type:              string | null
  origin_message_id:        string | null
  notes:                    string | null
  tags:                     string[] | null
  created_at:               string
  updated_at:               string
}

export type CreateContextSourceData = Omit<ContextSource, 'id' | 'created_at' | 'updated_at'>

export type UpdateContextSourceData = Partial<
  Omit<ContextSource, 'id' | 'user_id' | 'created_at'>
>

export interface ListContextSourcesFilters {
  userId:       string
  scope?:       ContextScope
  projectId?:   string
  teamId?:      string
  workspaceId?: string
  sessionId?:   string
}

export interface RuntimeContextParams {
  projectId?:  string | null
  teamId?:     string | null
  sessionId?:  string | null
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createContextSource(
  data: CreateContextSourceData,
): Promise<ContextSource> {
  const supabase = createClient()
  const { data: row, error } = await supabase
    .from('context_sources')
    .insert(data)
    .select()
    .single()
  if (error) throw error
  return row as ContextSource
}

export async function updateContextSource(
  id: string,
  data: UpdateContextSourceData,
): Promise<ContextSource> {
  const supabase = createClient()
  const { data: row, error } = await supabase
    .from('context_sources')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return row as ContextSource
}

export async function listContextSources(
  filters: ListContextSourcesFilters,
): Promise<ContextSource[]> {
  const supabase = createClient()
  let q = supabase
    .from('context_sources')
    .select('*')
    .eq('user_id', filters.userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (filters.scope)       q = q.eq('scope',        filters.scope)
  if (filters.projectId)   q = q.eq('project_id',   filters.projectId)
  if (filters.teamId)      q = q.eq('team_id',       filters.teamId)
  if (filters.workspaceId) q = q.eq('workspace_id',  filters.workspaceId)
  if (filters.sessionId)   q = q.eq('session_id',    filters.sessionId)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as ContextSource[]
}

export async function getContextSource(id: string): Promise<ContextSource | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('context_sources')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as ContextSource | null
}

export async function archiveContextSource(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('context_sources')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function extractAndSaveText(id: string, text: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('context_sources')
    .update({
      content_text:             text,
      extracted_text_available: true,
      updated_at:               new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

// ── Runtime query — preparado para OE C ──────────────────────────────────────
// Devuelve fuentes activas con texto extraído para los scopes relevantes.
// La lógica de inyección en route.ts queda para OE C.

export async function getContextSourcesForRuntime(
  params: RuntimeContextParams,
): Promise<ContextSource[]> {
  const supabase = createClient()

  const conditions: string[] = []
  if (params.projectId) conditions.push(`project_id.eq.${params.projectId}`)
  if (params.teamId)    conditions.push(`team_id.eq.${params.teamId}`)
  if (params.sessionId) conditions.push(`session_id.eq.${params.sessionId}`)

  if (conditions.length === 0) return []

  const { data, error } = await supabase
    .from('context_sources')
    .select('*')
    .eq('status', 'active')
    .eq('extracted_text_available', true)
    .not('content_text', 'is', null)
    .or(conditions.join(','))

  if (error) throw error

  const scopeOrder: Record<string, number> = { project: 0, team: 1, session: 2 }

  const sorted = ((data ?? []) as ContextSource[])
    .filter(s => s.content_text)
    .sort((a, b) => {
      const sa = scopeOrder[a.scope ?? ''] ?? 99
      const sb = scopeOrder[b.scope ?? ''] ?? 99
      if (sa !== sb) return sa - sb
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const counts: Record<string, number> = {}
  return sorted.filter(s => {
    const key = s.scope ?? 'unknown'
    counts[key] = (counts[key] ?? 0) + 1
    return counts[key] <= 3
  })
}
