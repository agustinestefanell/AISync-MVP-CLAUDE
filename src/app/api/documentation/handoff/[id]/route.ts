// GET handoff package detail (full messages) for Documentation Mode panel
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
    .select('messages')
    .eq('id', params.id)
    .single()

  if (!data) return Response.json([])

  const messages = Array.isArray(data.messages) ? data.messages : []
  return Response.json((messages as Record<string, unknown>[]).map(m => ({
    role:    typeof m.role    === 'string' ? m.role    : 'user',
    content: typeof m.content === 'string' ? m.content : '',
  })))
}
