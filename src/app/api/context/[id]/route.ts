import { createClient } from '@/lib/supabase/server'
import { deleteContextSource } from '@/lib/context/deleteContextSource'

export const dynamic = 'force-dynamic'

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const contextSourceId = params.id

  // Step 1: Verify session
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Step 2: Delegate to shared delete logic (user mode with ownership check)
  const result = await deleteContextSource(supabase, contextSourceId, user.id)

  // Step 3: Map result to HTTP response
  if (!result.ok) {
    if (result.errorType === 'not_found') {
      return Response.json({ error: result.error }, { status: 404 })
    }
    if (result.errorType === 'forbidden') {
      return Response.json({ error: result.error }, { status: 403 })
    }
    if (result.errorType === 'db_update_failed') {
      return Response.json(
        {
          ok: false,
          error: 'Storage object may have been deleted, but database status update failed. Please contact support or perform manual verification.'
        },
        { status: 500 }
      )
    }
    // fetch_error or other
    return Response.json({ error: result.error }, { status: 500 })
  }

  // Success
  return Response.json({
    ok: true,
    deleted: result.deleted,
    storageDeleted: result.storageDeleted,
    message: result.message,
  })
}
