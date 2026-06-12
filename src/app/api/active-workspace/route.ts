import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveProjectId } from '@/lib/db/teams'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ workspaceId: null })

  // ARC-004: proyecto activo desde la fuente única (antes duplicaba "primer
  // proyecto por created_at"); luego primer team → primer workspace
  const projectId = await getActiveProjectId()
  if (!projectId) return NextResponse.json({ workspaceId: null })

  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!team) return NextResponse.json({ workspaceId: null })

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('team_id', team.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  return NextResponse.json({ workspaceId: workspace?.id ?? null })
}
