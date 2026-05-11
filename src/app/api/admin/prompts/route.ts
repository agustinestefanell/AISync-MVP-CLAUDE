import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // 1. Verify auth
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Verify role — query with user's own session (respects RLS)
  const { data: account } = await supabase
    .from('accounts')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!account || !['owner', 'admin'].includes(account.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { role, base_layer, role_prompt } = await req.json() as {
    role:        string
    base_layer:  string
    role_prompt: string
  }

  if (!role || typeof base_layer !== 'string' || typeof role_prompt !== 'string') {
    return Response.json({ error: 'Invalid payload' }, { status: 400 })
  }

  // 3. Fetch current version for audit trail
  const adminClient = createAdminClient()
  const { data: current } = await adminClient
    .from('system_prompts')
    .select('role_prompt, base_layer')
    .eq('role', role)
    .single()

  // 4. Update
  const { error: updateError } = await adminClient
    .from('system_prompts')
    .update({ base_layer, role_prompt, updated_at: new Date().toISOString() })
    .eq('role', role)

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 })
  }

  // 5. Record admin event
  await adminClient.from('admin_events').insert({
    admin_user_id: user.id,
    action:        'prompt_updated',
    payload: {
      role,
      previous_base_layer:  current?.base_layer  ?? null,
      previous_role_prompt: current?.role_prompt ?? null,
    },
  })

  return Response.json({ ok: true })
}
