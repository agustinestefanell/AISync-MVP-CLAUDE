import { createClient } from '@/lib/supabase/server'

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

  // Step 2: Verify ownership and read metadata before deleting
  const { data: source, error: fetchError } = await supabase
    .from('context_sources')
    .select('id,title,file_path,file_type,file_size_bytes,scope,status,user_id')
    .eq('id', contextSourceId)
    .maybeSingle()

  if (fetchError) {
    console.error('[Context Files] Error fetching context source for delete', {
      context_source_id: contextSourceId,
      error: fetchError,
    })
    return Response.json({ error: 'Failed to fetch context source' }, { status: 500 })
  }

  if (!source) {
    return Response.json({ error: 'Context source not found' }, { status: 404 })
  }

  if (source.user_id !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // If already deleted, respond idempotently
  if (source.status === 'deleted') {
    return Response.json({
      ok: true,
      deleted: true,
      storageDeleted: false,
      message: 'Already deleted'
    })
  }

  // Step 3: Delete from Storage if file_path exists
  let storageDeleted = false
  if (source.file_path) {
    try {
      const { error: storageError } = await supabase.storage
        .from('context-files')
        .remove([source.file_path])

      if (storageError) {
        console.error('[Context Files] Storage deletion failed', {
          context_source_id: contextSourceId,
          file_path: source.file_path,
          error: storageError,
        })
        // Continue anyway — DB update will mark as deleted
      } else {
        storageDeleted = true
      }
    } catch (storageException) {
      console.error('[Context Files] Storage deletion exception', {
        context_source_id: contextSourceId,
        file_path: source.file_path,
        exception: storageException,
      })
      // Continue anyway
    }
  }

  // Step 4: Update DB to status='deleted'
  const { error: updateError } = await supabase
    .from('context_sources')
    .update({
      status: 'deleted',
      content_text: null,
      extracted_text_available: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contextSourceId)

  if (updateError) {
    // CRITICAL: Storage may have been deleted but DB update failed
    console.error('[Context Files] CRITICAL: storage object deleted but DB update failed', {
      context_source_id: contextSourceId,
      file_path: source.file_path,
      storage_deleted: storageDeleted,
      db_error: updateError,
    })

    // Attempt to insert audit_log for inconsistency
    try {
      await supabase.from('audit_log').insert({
        account_id: user.id,
        event_type: 'context_file_delete_inconsistent',
        metadata: {
          context_source_id: contextSourceId,
          file_path: source.file_path,
          title: source.title,
          file_type: source.file_type,
          file_size_bytes: source.file_size_bytes,
          scope: source.scope,
          storage_deleted: storageDeleted,
          db_update_failed: true,
          db_error: updateError.message,
          occurred_at: new Date().toISOString(),
        },
      })
    } catch (auditError) {
      console.error('[Context Files] CRITICAL: Failed to insert audit_log for inconsistency', {
        context_source_id: contextSourceId,
        audit_error: auditError,
      })
    }

    return Response.json(
      {
        ok: false,
        error: 'Storage object may have been deleted, but database status update failed. Please contact support or perform manual verification.'
      },
      { status: 500 }
    )
  }

  // Step 5: Insert audit_log for successful deletion
  try {
    await supabase.from('audit_log').insert({
      account_id: user.id,
      event_type: 'context_file_deleted',
      metadata: {
        context_source_id: contextSourceId,
        title: source.title,
        file_path: source.file_path,
        file_type: source.file_type,
        file_size_bytes: source.file_size_bytes,
        scope: source.scope,
        deleted_at: new Date().toISOString(),
      },
    })
  } catch (auditError) {
    console.error('[Context Files] Failed to insert audit_log for deletion', {
      context_source_id: contextSourceId,
      audit_error: auditError,
    })
    // Non-blocking — deletion succeeded
  }

  // Step 6: Response
  return Response.json({
    ok: true,
    deleted: true,
    storageDeleted,
  })
}
