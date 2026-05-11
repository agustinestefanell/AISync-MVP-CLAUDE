import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { sessionId, messages } = await req.json() as {
    sessionId: string
    messages: { role: 'user' | 'assistant'; content: string }[]
  }

  const { error } = await supabase.from('messages').insert(
    messages.map(m => ({ session_id: sessionId, role: m.role, content: m.content }))
  )

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const sessionId = new URL(req.url).searchParams.get('sessionId')
  if (!sessionId) return Response.json({ error: 'sessionId requerido' }, { status: 400 })

  const { data } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  return Response.json(data ?? [])
}
