import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { lock_state } = await req.json() as { lock_state: 'locked' | 'unlocked' }
  if (lock_state !== 'locked' && lock_state !== 'unlocked') {
    return Response.json({ error: 'Invalid lock_state' }, { status: 400 })
  }

  // Ownership check explícito (patrón checkpoint/[id]): workspace → team → project → account
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, teams(project_id, projects(account_id))')
    .eq('id', params.id)
    .single()

  if (!workspace) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  type OwnershipChain = { teams?: { projects?: { account_id?: string } | null } | null }
  const project = (workspace as unknown as OwnershipChain).teams?.projects

  if (!project || project.account_id !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // .select() para verificar filas afectadas: un UPDATE sin política RLS afecta
  // 0 filas sin error — el audit event solo se registra si el cambio persistió.
  const { data: updated, error } = await supabase
    .from('workspaces')
    .update({ lock_state })
    .eq('id', params.id)
    .select('id')

  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (!updated || updated.length === 0) {
    return Response.json(
      { error: 'Lock state not persisted — no rows updated. Check workspaces UPDATE RLS policy (migration 025).' },
      { status: 500 }
    )
  }

  await supabase.from('audit_log').insert({
    account_id:   user.id,
    workspace_id: params.id,
    event_type:   lock_state === 'locked' ? 'lock' : 'unlock',
    metadata:     { lock_state },
  })

  return Response.json({ ok: true, lock_state })
}
