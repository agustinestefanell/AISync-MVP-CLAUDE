import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const { name } = body

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Project name is required.' }, { status: 400 })
  }

  try {
    const { data: project, error } = await supabase
      .from('projects')
      .insert({ account_id: user.id, name: name.trim() })
      .select()
      .single()

    if (error) {
      console.error('[POST /api/projects] Insert error:', error)
      return NextResponse.json(
        { error: 'Failed to create project.' },
        { status: 500 }
      )
    }

    return NextResponse.json(project, { status: 201 })
  } catch (err) {
    console.error('[POST /api/projects] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Failed to create project.' },
      { status: 500 }
    )
  }
}
