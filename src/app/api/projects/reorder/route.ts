import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// PATCH — persiste el nuevo orden de Projects tras un drag & drop en el
// sidebar de Teams Map. Recibe la lista completa de IDs en el orden deseado
// y reescribe sort_order = posición (1-based) para cada uno.
//
// No hace falta un check de ownership previo: cada update ya filtra por
// account_id = user.id, y la RLS policy "projects_update" (account_id =
// auth.uid()) es la última barrera — un ID de otra cuenta en el array
// simplemente no actualiza ninguna fila.
export async function PATCH(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const { projectIds } = body as { projectIds?: unknown }

  if (
    !Array.isArray(projectIds) ||
    projectIds.length === 0 ||
    !projectIds.every(id => typeof id === 'string' && id.trim())
  ) {
    return NextResponse.json(
      { error: 'projectIds must be a non-empty array of strings.' },
      { status: 400 }
    )
  }

  try {
    const results = await Promise.all(
      projectIds.map((id, index) =>
        supabase
          .from('projects')
          .update({ sort_order: index + 1 })
          .eq('id', id)
          .eq('account_id', user.id)
      )
    )

    const failed = results.find(r => r.error)
    if (failed?.error) {
      console.error('[PATCH /api/projects/reorder] Update error:', failed.error)
      return NextResponse.json(
        { error: 'Failed to save project order.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PATCH /api/projects/reorder] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Failed to save project order.' },
      { status: 500 }
    )
  }
}
