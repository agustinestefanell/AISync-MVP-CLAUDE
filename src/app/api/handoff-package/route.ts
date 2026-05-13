import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { name, workspaceId, fromAgent, toAgent, context, messages } = await req.json() as {
    name: string
    workspaceId: string
    fromAgent: string
    toAgent: string
    context: string | null
    messages: { role: string; content: string }[]
  }

  if (!name?.trim()) return Response.json({ error: 'Name required' }, { status: 400 })

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
