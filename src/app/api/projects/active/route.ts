import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveProjectId } from '@/lib/db/teams'

export const dynamic = 'force-dynamic'

// GET — proyecto activo + lista de proyectos del usuario.
// Lo consumen ProjectList (badge/botón Set active) y TeamsClient (dropdown),
// que no reciben esta información por props desde sus pages.
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const projectId = await getActiveProjectId()

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .eq('account_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  return NextResponse.json({ projectId, projects: projects ?? [] })
}

export async function PATCH(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const { projectId } = await request.json() as { projectId?: string }

  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
  }

  // El ownership check vive en la RPC (projects.account_id = auth.uid() + status active)
  const { error } = await supabase.rpc('set_active_project', {
    p_project_id: projectId,
  })

  if (error) {
    console.error('[projects/active] failed to set active project', error)
    return NextResponse.json({ error: 'Project not found or unauthorized.' }, { status: 403 })
  }

  return NextResponse.json({ ok: true })
}
