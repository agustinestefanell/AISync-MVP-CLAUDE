// GET handoff package detail (full messages) for Documentation Mode panel.
// This is also the sole trigger point for the handoff.received transition:
// opening this detail panel (RepositoryView.tsx HandoffDetailPanel) is the
// only place in the app where a recipient actually reads a Handoff Package.
// A dedicated POST endpoint would need its own UI wiring, out of scope for
// this phase (schema/events only) — reusing this existing GET keeps the
// side effect confined to the one real call site, guarded by an idempotent
// status check so it only fires once. Documented tradeoff, not an oversight.
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('handoff_packages')
    .select('messages, status, workspace_id')
    .eq('id', params.id)
    .single()

  if (!data) return Response.json([])

  // handoff.received — fail-open, must not block returning the messages
  if (data.status !== 'received') {
    try {
      const { error: updateError } = await supabase
        .from('handoff_packages')
        .update({ status: 'received' })
        .eq('id', params.id)
        .neq('status', 'received')

      if (!updateError) {
        await supabase.from('audit_log').insert({
          account_id:   user.id,
          workspace_id: data.workspace_id,
          event_type:   'handoff_received',
          metadata: {
            handoff_id:   params.id,
            workspace_id: data.workspace_id,
          },
        })
      }
    } catch (receivedError) {
      console.error('[documentation/handoff/[id]] Failed to mark handoff as received:', receivedError)
    }
  }

  const messages = Array.isArray(data.messages) ? data.messages : []
  return Response.json((messages as Record<string, unknown>[]).map(m => ({
    role:    typeof m.role    === 'string' ? m.role    : 'user',
    content: typeof m.content === 'string' ? m.content : '',
  })))
}
