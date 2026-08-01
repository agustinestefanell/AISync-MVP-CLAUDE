import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized.' }, { status: 401 })

  const { name, workspaceId, fromAgent, toAgent, context, messages } = await req.json() as {
    name: string
    workspaceId: string
    fromAgent: string
    toAgent: string
    context: string | null
    messages: { role: string; content: string }[]
  }

  if (!name?.trim()) return Response.json({ error: 'Name required' }, { status: 400 })

  // SEC-008: ownership del workspace antes del insert (patrón checkpoint/[id])
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, teams(project_id, projects(account_id))')
    .eq('id', workspaceId)
    .single()

  if (!workspace) {
    return Response.json({ error: 'Workspace not found.' }, { status: 404 })
  }

  type OwnershipChain = { teams?: { projects?: { account_id?: string } | null } | null }
  const project = (workspace as unknown as OwnershipChain).teams?.projects

  if (!project || project.account_id !== user.id) {
    return Response.json({ error: 'Unauthorized.' }, { status: 403 })
  }

  const { data: hp, error } = await supabase
    .from('handoff_packages')
    .insert({
      name:         name.trim(),
      workspace_id: workspaceId,
      user_id:      user.id,
      from_agent:   fromAgent,
      to_agent:     toAgent,
      context:      context ?? null,
      messages,
    })
    .select('id')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  await supabase.from('audit_log').insert({
    account_id:   user.id,
    workspace_id: workspaceId,
    event_type:   'handoff_package.created',
    metadata:     {
      handoff_id: hp.id,
      name:       name.trim(),
      from_agent: fromAgent,
      to_agent:   toAgent,
    },
  })

  return Response.json({ ok: true, id: hp.id })
}
