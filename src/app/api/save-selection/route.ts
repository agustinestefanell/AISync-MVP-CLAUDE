import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const body = await request.json()
  const { workspace_id, team_id, project_id, name, messages } = body

  if (!workspace_id || !name || !messages) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // SEC-008: ownership del workspace antes del insert (patrón checkpoint/[id])
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, team_id, teams(project_id, projects(account_id))')
    .eq('id', workspace_id)
    .single()

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 })
  }

  type OwnershipChain = { team_id?: string; teams?: { project_id?: string; projects?: { account_id?: string } | null } | null }
  const chain = workspace as unknown as OwnershipChain
  const project = chain.teams?.projects

  if (!project || project.account_id !== user.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
  }

  // SEC-008: los IDs opcionales del body deben pertenecer a la cadena del workspace
  if (team_id && team_id !== chain.team_id) {
    return NextResponse.json({ error: 'team_id does not belong to this workspace.' }, { status: 400 })
  }
  if (project_id && project_id !== chain.teams?.project_id) {
    return NextResponse.json({ error: 'project_id does not belong to this workspace.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('saved_selections')
    .insert({
      user_id: user.id,
      workspace_id,
      team_id: team_id ?? null,
      project_id: project_id ?? null,
      name,
      messages,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  try {
    await supabase.from('audit_log').insert({
      account_id:   user.id,
      workspace_id,
      event_type:   'save_selection',
      metadata:     {
        saved_selection_id: data.id,
        name,
        message_count: Array.isArray(data.messages) ? data.messages.length : 0,
      },
    })
  } catch {
    // Audit log failure must not block saved selection creation.
  }

  return NextResponse.json(data, { status: 201 })
}
