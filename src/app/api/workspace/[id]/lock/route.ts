import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { lock_state } = await req.json() as { lock_state: 'locked' | 'unlocked' }

  const { error } = await supabase
    .from('workspaces')
    .update({ lock_state })
    .eq('id', params.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  await supabase.from('audit_log').insert({
    account_id:   user.id,
    workspace_id: params.id,
    event_type:   lock_state === 'locked' ? 'lock' : 'unlock',
    metadata:     { lock_state },
  })

  return Response.json({ ok: true, lock_state })
}
