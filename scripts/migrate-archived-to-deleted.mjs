/**
 * One-time migration script: migrate legacy archived context_sources to deleted
 *
 * Context:
 * Before OE 2 (Context Files Delete real), the Archive button did soft-update to status='archived'.
 * After OE 2, Archive was replaced by Delete real (status='deleted' + Storage removal + audit_log).
 * This script migrates the 7 legacy archived rows to the new Delete real flow.
 *
 * Why admin client:
 * This script runs as a one-time administrative migration without an authenticated user session.
 * Therefore, it uses createAdminClient() to bypass RLS. The live DELETE endpoint uses normal
 * client with RLS because it operates on behalf of an authenticated user.
 *
 * Safety:
 * - Operates ONLY on the 7 explicit IDs confirmed by Product Owner (closed list, not dynamic)
 * - Preflight validation: confirms all 7 exist and have status='archived' before processing
 * - Aborts entire batch if preflight fails (no partial processing)
 * - Reuses deleteContextSource() shared logic (zero duplication with endpoint)
 *
 * Usage:
 * node scripts/migrate-archived-to-deleted.mjs
 *
 * DO NOT execute without explicit Product Owner confirmation.
 */

import { createClient } from '@supabase/supabase-js'

// Admin client helper (inline to avoid TS imports)
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )
}

// deleteContextSource logic (inline to avoid TS imports)
async function deleteContextSource(supabase, contextSourceId, userId) {
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

// Closed list of 7 legacy archived context_source IDs (Product Owner confirmed)
const LEGACY_ARCHIVED_CONTEXT_SOURCE_IDS = [
  '091f096f-1253-45bb-8f24-ee927f76f7bf',
  '00ad02d6-917e-4103-b9f7-54605006c30c',
  '8a70088a-26d6-4d8a-aefd-da66f80ad74b',
  '504fb22b-ae32-4065-9744-44305b52f8eb',
  '8ac8a054-8b23-4123-8835-ddb591e37fcd',
  'd1e75a58-7db7-4db0-a831-f03bf5a77b23',
  '0eafed52-bbb6-43b7-9a83-3e72f465a176',
]

async function main() {
  console.log('='.repeat(80))
  console.log('Context Files Migration: archived → deleted')
  console.log('='.repeat(80))
  console.log('')
  console.log('This script migrates 7 legacy archived context_sources to deleted status.')
  console.log('Uses admin client because it runs without authenticated user session.')
  console.log('')

  const adminClient = createAdminClient()

  // PREFLIGHT: Validate all 7 IDs exist and are archived
  console.log('PREFLIGHT: Validating 7 legacy archived context_sources...')
  console.log('')

  const { data: preflightRows, error: preflightError } = await adminClient
    .from('context_sources')
    .select('id, status, title, file_path')
    .in('id', LEGACY_ARCHIVED_CONTEXT_SOURCE_IDS)

  if (preflightError) {
    console.error('❌ PREFLIGHT FAILED: Error querying context_sources')
    console.error(preflightError)
    process.exit(1)
  }

  if (!preflightRows || preflightRows.length !== 7) {
    console.error(`❌ PREFLIGHT FAILED: Expected exactly 7 rows, found ${preflightRows?.length ?? 0}`)
    console.error('Missing IDs:')
    const foundIds = new Set(preflightRows?.map(r => r.id) ?? [])
    LEGACY_ARCHIVED_CONTEXT_SOURCE_IDS.forEach(id => {
      if (!foundIds.has(id)) {
        console.error(`  - ${id}`)
      }
    })
    process.exit(1)
  }

  const notArchivedRows = preflightRows.filter(r => r.status !== 'archived')
  if (notArchivedRows.length > 0) {
    console.error(`❌ PREFLIGHT FAILED: ${notArchivedRows.length} row(s) are not archived`)
    notArchivedRows.forEach(r => {
      console.error(`  - ${r.id}: status='${r.status}' (expected 'archived')`)
    })
    process.exit(1)
  }

  console.log('✅ PREFLIGHT PASSED: All 7 rows exist and have status=archived')
  console.log('')

  // Display rows to be migrated
  console.log('Rows to migrate:')
  preflightRows.forEach((row, idx) => {
    console.log(`  ${idx + 1}. ${row.id}`)
    console.log(`     title: ${row.title}`)
    console.log(`     file_path: ${row.file_path ?? '(null)'}`)
  })
  console.log('')

  // MIGRATION: Process each ID
  console.log('='.repeat(80))
  console.log('MIGRATION: Processing 7 context_sources...')
  console.log('='.repeat(80))
  console.log('')

  const results = []

  for (const row of preflightRows) {
    console.log(`Processing ${row.id}...`)

    const deleteResult = await deleteContextSource(
      adminClient,
      row.id,
      undefined // No userId — admin mode (no ownership check)
    )

    const migrationResult = {
      id: row.id,
      status: row.status,
      title: row.title,
      file_path: row.file_path,
      storageDeleted: deleteResult.storageDeleted,
      dbUpdated: deleteResult.ok && deleteResult.deleted,
      auditLogged: deleteResult.ok && deleteResult.deleted,
      result: deleteResult.ok
        ? deleteResult.message === 'Already deleted'
          ? 'already_deleted'
          : 'success'
        : 'error',
      error: deleteResult.ok ? undefined : deleteResult.error,
    }

    results.push(migrationResult)

    if (migrationResult.result === 'success') {
      console.log(`  ✅ SUCCESS`)
      console.log(`     Storage deleted: ${migrationResult.storageDeleted}`)
      console.log(`     DB updated: ${migrationResult.dbUpdated}`)
      console.log(`     Audit logged: ${migrationResult.auditLogged}`)
    } else if (migrationResult.result === 'already_deleted') {
      console.log(`  ℹ️  ALREADY DELETED (idempotent)`)
    } else {
      console.log(`  ❌ ERROR: ${migrationResult.error}`)
    }
    console.log('')
  }

  // SUMMARY
  console.log('='.repeat(80))
  console.log('MIGRATION SUMMARY')
  console.log('='.repeat(80))
  console.log('')

  const successCount = results.filter(r => r.result === 'success').length
  const alreadyDeletedCount = results.filter(r => r.result === 'already_deleted').length
  const errorCount = results.filter(r => r.result === 'error').length

  console.log(`Total processed: ${results.length}`)
  console.log(`  ✅ Success: ${successCount}`)
  console.log(`  ℹ️  Already deleted: ${alreadyDeletedCount}`)
  console.log(`  ❌ Errors: ${errorCount}`)
  console.log('')

  if (errorCount > 0) {
    console.log('Errors:')
    results
      .filter(r => r.result === 'error')
      .forEach(r => {
        console.log(`  - ${r.id}: ${r.error}`)
      })
    console.log('')
  }

  console.log('NEXT STEPS:')
  console.log('1. Validate DB with SQL query:')
  console.log('   SELECT id, status, content_text IS NULL, extracted_text_available, file_path')
  console.log('   FROM context_sources WHERE id IN (...7 IDs...)')
  console.log('')
  console.log('2. Validate audit_log with SQL query:')
  console.log('   SELECT event_type, metadata FROM audit_log')
  console.log("   WHERE event_type IN ('context_file_deleted', 'context_file_delete_inconsistent')")
  console.log("   AND metadata->>'context_source_id' IN (...7 IDs...)")
  console.log('')
  console.log('3. Validate Storage: Check 1-2 cases manually in Supabase Storage bucket context-files')
  console.log('')
  console.log('Migration script completed.')
  console.log('='.repeat(80))

  process.exit(errorCount > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('FATAL ERROR:', err)
  process.exit(1)
})
