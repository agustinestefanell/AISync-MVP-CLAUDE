import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const { status } = await req.json()

  if (!status || !['active', 'archived'].includes(status)) {
    return NextResponse.json(
      { error: 'Invalid status. Must be "active" or "archived".' },
      { status: 400 }
    )
  }

  // Ownership check
  const { data: project } = await supabase
    .from('projects')
    .select('id, account_id')
    .eq('id', params.id)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  }

  if (project.account_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  // Update status
  const { error: updateError } = await supabase
    .from('projects')
    .update({ status })
    .eq('id', params.id)

  if (updateError) {
    console.error('[projects/[id]] PATCH failed:', updateError)
    return NextResponse.json(
      { error: 'Failed to update project status.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  // Ownership check
  const { data: project } = await supabase
    .from('projects')
    .select('id, account_id')
    .eq('id', params.id)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  }

  if (project.account_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  // Delete project (cascade will handle teams, workspaces, sessions, messages)
  console.log('[projects/[id]] Attempting DELETE for project:', params.id, 'user:', user.id)

  // First, check how many rows will be affected
  const { count: beforeCount } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('id', params.id)

  console.log('[projects/[id]] Rows before DELETE:', beforeCount)

  const { data: deleteData, error: deleteError, count: deletedCount } = await supabase
    .from('projects')
    .delete({ count: 'exact' })
    .eq('id', params.id)
    .select()

  console.log('[projects/[id]] DELETE result - data:', deleteData, 'error:', deleteError, 'count:', deletedCount)

  if (deleteError) {
    console.error('[projects/[id]] DELETE failed:', deleteError)
    return NextResponse.json(
      { error: 'Failed to delete project.' },
      { status: 500 }
    )
  }

  // Check if any rows were affected
  if (!deleteData || deleteData.length === 0) {
    console.warn('[projects/[id]] DELETE succeeded but 0 rows affected - likely RLS blocked')
    return NextResponse.json(
      { error: 'Project could not be deleted. Check permissions.' },
      { status: 403 }
    )
  }

  console.log('[projects/[id]] DELETE successful, rows affected:', deleteData.length)
  return NextResponse.json({
    success: true,
    debug: {
      projectId: params.id,
      userId: user.id,
      rowsAffected: deleteData.length,
      deletedData: deleteData
    }
  })
}
