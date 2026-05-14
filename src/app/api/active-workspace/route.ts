import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ workspaceId: null })

  // Navigate account → project → team → workspace (first of each)
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('account_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!project) return NextResponse.json({ workspaceId: null })

  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('project_id', project.id)
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
