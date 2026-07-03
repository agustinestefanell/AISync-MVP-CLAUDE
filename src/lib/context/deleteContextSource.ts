import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Shared delete logic for Context Files.
 *
 * Modes:
 * - User mode: enforces ownership check, used by DELETE /api/context/[id]
 * - Admin mode: skips ownership check, used by one-time migration script
 *
 * Steps:
 * 1. Read metadata before deleting (verify ownership if userId provided)
 * 2. Delete from Storage if file_path exists
 * 3. Update DB to status='deleted', content_text=null, extracted_text_available=false
 * 4. Insert audit_log event
 * 5. Handle partial failure (Storage deleted but DB update failed) with critical log
 *
 * @param supabase - Supabase client (RLS normal for user mode, admin for cleanup mode)
 * @param contextSourceId - ID of context_source to delete
 * @param userId - User ID for ownership check (omit for admin mode)
 * @returns DeleteResult with status and metadata
 */
export async function deleteContextSource(
  supabase: SupabaseClient,
  contextSourceId: string,
  userId?: string
): Promise<DeleteResult> {
  // Step 1: Read metadata and verify ownership if userId provided
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
    return {
      ok: false,
      deleted: false,
      storageDeleted: false,
      error: 'Failed to fetch context source',
      errorType: 'fetch_error',
    }
  }

  if (!source) {
    return {
      ok: false,
      deleted: false,
      storageDeleted: false,
      error: 'Context source not found',
      errorType: 'not_found',
    }
  }

  // Ownership check (only in user mode)
  if (userId && source.user_id !== userId) {
    return {
      ok: false,
      deleted: false,
      storageDeleted: false,
      error: 'Forbidden',
      errorType: 'forbidden',
    }
  }

  // If already deleted, respond idempotently
  if (source.status === 'deleted') {
    return {
      ok: true,
      deleted: true,
      storageDeleted: false,
      message: 'Already deleted',
    }
  }

  // Step 2: Delete from Storage if file_path exists
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

  // Step 3: Update DB to status='deleted'
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
        account_id: source.user_id,
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

    return {
      ok: false,
      deleted: false,
      storageDeleted,
      error: 'Storage object may have been deleted, but database status update failed',
      errorType: 'db_update_failed',
      metadata: {
        context_source_id: contextSourceId,
        file_path: source.file_path,
        storage_deleted: storageDeleted,
      },
    }
  }

  // Step 4: Insert audit_log for successful deletion
  try {
    await supabase.from('audit_log').insert({
      account_id: source.user_id,
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

  // Step 5: Return success result
  return {
    ok: true,
    deleted: true,
    storageDeleted,
    metadata: {
      context_source_id: contextSourceId,
      title: source.title,
      file_path: source.file_path,
      file_type: source.file_type,
      file_size_bytes: source.file_size_bytes,
      scope: source.scope,
    },
  }
}

/**
 * Result type for deleteContextSource
 */
export type DeleteResult = {
  ok: boolean
  deleted: boolean
  storageDeleted: boolean
  message?: string
  error?: string
  errorType?: 'fetch_error' | 'not_found' | 'forbidden' | 'db_update_failed'
  metadata?: {
    context_source_id: string
    title?: string
    file_path?: string | null
    file_type?: string
    file_size_bytes?: number
    scope?: string
    storage_deleted?: boolean
  }
}
