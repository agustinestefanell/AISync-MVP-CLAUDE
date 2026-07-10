/**
 * One-time migration script: migrate 21 Groq agent_sessions to OpenAI GPT-5.5
 *
 * Context:
 * 21 agent_sessions with provider='Groq' and model='llama-3.3-70b-versatile' were
 * identified in production. Product Owner decided to migrate these specific agents
 * to OpenAI / GPT-5.5. This is NOT a global Groq migration — only the 21 explicitly
 * listed IDs are affected.
 *
 * Why admin client:
 * This script runs as a one-time administrative migration without an authenticated
 * user session. Therefore, it uses createAdminClient() to bypass RLS.
 *
 * Safety:
 * - Operates ONLY on the 21 explicit IDs confirmed by Product Owner (closed list)
 * - Preflight validation: confirms all 21 exist and match expected provider/model
 * - Aborts entire batch if preflight fails (no partial processing)
 * - Textual confirmation gate required before executing UPDATE
 * - No WHERE dynamic provider='Groq' as sole criterion
 *
 * Usage:
 * npx tsx scripts/migrate-groq-agents-to-openai.ts
 *
 * DO NOT execute without explicit Product Owner confirmation.
 */

import { createAdminClient } from '../src/lib/supabase/admin'
import * as readline from 'readline'

// Closed list of 21 Groq agent_session IDs (Product Owner confirmed)
const AGENT_SESSION_IDS = [
  'd513fdae-1f73-4114-b5a8-b364c079476b',
  'fc95a0c8-c974-4866-a627-63c1a5043080',
  'b4206c28-616f-4e55-883b-0cc31e074e5a',
  'c1f7f5b4-ad57-45d1-9380-5307c5aa545e',
  'a34e521a-8329-4841-8b6d-b108850f9b5b',
  'bda9ab61-09ed-4623-b7e0-4a23c35b7ee2',
  'ae136ca9-33be-4cba-a8c7-cca914b942e7',
  '5f7d48be-2ec3-40e7-a436-522ea1d06bcb',
  'a1d077eb-4bd8-4353-9796-298ae87e4785',
  '21ae61da-3997-465b-8a77-4afbcbd9f940',
  '22112057-3a70-4597-ab64-3e3e33b7e59c',
  'a08cf9d1-b8cf-41e0-aa9d-ad4b97c032f9',
  '9773c0e4-1cac-4d3a-ae5e-9173f484a469',
  '7880e86c-6b49-47d5-bf60-744e2c13ee8d',
  '9f10b7eb-8522-4924-acf7-cacc66f2d9a4',
  '5f48ede8-d5e3-496f-b6e7-c8e8e62d9d0d',
  'e9640125-3d98-4099-af5e-85b157225c38',
  '70706bd7-d7f8-459f-9e1a-622c9a016614',
  'c0371fa9-c3c1-4fd7-88f2-ffa94e0c9d19',
  '9f61479b-c19f-48d5-adeb-0fd5422c37a6',
  '30c27551-61ce-41a1-a66d-4b05db970efd',
] as const

const EXPECTED_PROVIDER = 'Groq'
const EXPECTED_MODEL = 'llama-3.3-70b-versatile'
const TARGET_PROVIDER = 'OpenAI'
const TARGET_MODEL = 'GPT-5.5'

async function promptForConfirmation(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise(resolve => {
    rl.question(
      '\nType exactly "migrate 21 groq agents to openai" to continue: ',
      answer => {
        rl.close()
        resolve(answer.trim() === 'migrate 21 groq agents to openai')
      }
    )
  })
}

async function main() {
  console.log('='.repeat(80))
  console.log('Agent Sessions Migration: Groq → OpenAI GPT-5.5')
  console.log('='.repeat(80))
  console.log('')
  console.log('This script migrates 21 explicitly listed agent_sessions from:')
  console.log(`  ${EXPECTED_PROVIDER} / ${EXPECTED_MODEL}`)
  console.log('to:')
  console.log(`  ${TARGET_PROVIDER} / ${TARGET_MODEL}`)
  console.log('')
  console.log('Uses admin client because it runs without authenticated user session.')
  console.log('')

  const adminClient = createAdminClient()

  // PREFLIGHT: Validate all 21 IDs exist and match expected provider/model
  console.log('PREFLIGHT: Validating 21 agent_sessions...')
  console.log('')

  const { data: preflightRows, error: preflightError } = await adminClient
    .from('agent_sessions')
    .select('id, provider, model, workspace_id, agent_role')
    .in('id', AGENT_SESSION_IDS)

  if (preflightError) {
    console.error('❌ PREFLIGHT FAILED: Error querying agent_sessions')
    console.error(preflightError)
    process.exit(1)
  }

  if (!preflightRows || preflightRows.length !== 21) {
    console.error(
      `❌ PREFLIGHT FAILED: Expected exactly 21 rows, found ${
        preflightRows?.length ?? 0
      }`
    )
    console.error('Missing IDs:')
    const foundIds = new Set(preflightRows?.map(r => r.id) ?? [])
    AGENT_SESSION_IDS.forEach(id => {
      if (!foundIds.has(id)) {
        console.error(`  - ${id}`)
      }
    })
    process.exit(1)
  }

  // Check for duplicate IDs in the list (sanity check)
  const uniqueIds = new Set(AGENT_SESSION_IDS)
  if (uniqueIds.size !== AGENT_SESSION_IDS.length) {
    console.error(
      '❌ PREFLIGHT FAILED: Duplicate IDs detected in AGENT_SESSION_IDS list'
    )
    process.exit(1)
  }

  // Validate provider and model match expected values
  const mismatchRows = preflightRows.filter(
    r => r.provider !== EXPECTED_PROVIDER || r.model !== EXPECTED_MODEL
  )

  if (mismatchRows.length > 0) {
    console.error(
      `❌ PREFLIGHT FAILED: ${mismatchRows.length} row(s) do not match expected provider/model`
    )
    mismatchRows.forEach(r => {
      console.error(
        `  - ${r.id}: provider='${r.provider}' model='${r.model}' (expected '${EXPECTED_PROVIDER}' / '${EXPECTED_MODEL}')`
      )
    })
    process.exit(1)
  }

  console.log('✅ PREFLIGHT PASSED: All 21 rows exist and match expected provider/model')
  console.log('')

  // Display rows to be migrated
  console.log('Rows to migrate:')
  preflightRows.forEach((row, idx) => {
    console.log(`  ${idx + 1}. ${row.id}`)
    console.log(`     provider: ${row.provider} → ${TARGET_PROVIDER}`)
    console.log(`     model: ${row.model} → ${TARGET_MODEL}`)
    console.log(`     workspace_id: ${row.workspace_id}`)
    console.log(`     agent_role: ${row.agent_role}`)
  })
  console.log('')

  // GATE: Textual confirmation
  console.log('='.repeat(80))
  console.log('CONFIRMATION REQUIRED')
  console.log('='.repeat(80))
  console.log('')
  console.log('You are about to UPDATE 21 agent_sessions in production.')
  console.log('This will change their provider and model, affecting runtime behavior.')
  console.log('')

  const confirmed = await promptForConfirmation()

  if (!confirmed) {
    console.log('')
    console.log('❌ Confirmation text did not match.')
    console.log('Migration ABORTED. No changes were made.')
    console.log('')
    process.exit(0)
  }

  console.log('')
  console.log('✅ Confirmation received.')
  console.log('')

  // MIGRATION: Update provider and model
  console.log('='.repeat(80))
  console.log('MIGRATION: Updating 21 agent_sessions...')
  console.log('='.repeat(80))
  console.log('')

  const { data: updatedRows, error: updateError } = await adminClient
    .from('agent_sessions')
    .update({
      provider: TARGET_PROVIDER,
      model: TARGET_MODEL,
    })
    .in('id', AGENT_SESSION_IDS)
    .eq('provider', EXPECTED_PROVIDER) // Defensive additional filter
    .eq('model', EXPECTED_MODEL) // Defensive additional filter
    .select('id, provider, model')

  if (updateError) {
    console.error('❌ UPDATE FAILED: Error updating agent_sessions')
    console.error(updateError)
    process.exit(1)
  }

  if (!updatedRows || updatedRows.length !== 21) {
    console.error(
      `⚠️  UPDATE WARNING: Expected to update 21 rows, but ${
        updatedRows?.length ?? 0
      } were affected.`
    )
    console.error(
      'This may indicate some rows changed between preflight and update.'
    )
  }

  console.log(`✅ UPDATE COMPLETED: ${updatedRows?.length ?? 0} rows updated`)
  console.log('')

  // VERIFICATION: Read back the 21 rows and confirm they match target
  console.log('='.repeat(80))
  console.log('VERIFICATION: Confirming updated values...')
  console.log('='.repeat(80))
  console.log('')

  const { data: verificationRows, error: verificationError } = await adminClient
    .from('agent_sessions')
    .select('id, provider, model')
    .in('id', AGENT_SESSION_IDS)

  if (verificationError) {
    console.error('❌ VERIFICATION FAILED: Error querying agent_sessions')
    console.error(verificationError)
    process.exit(1)
  }

  if (!verificationRows || verificationRows.length !== 21) {
    console.error(
      `❌ VERIFICATION FAILED: Expected 21 rows, found ${
        verificationRows?.length ?? 0
      }`
    )
    process.exit(1)
  }

  const stillMismatchRows = verificationRows.filter(
    r => r.provider !== TARGET_PROVIDER || r.model !== TARGET_MODEL
  )

  if (stillMismatchRows.length > 0) {
    console.error(
      `❌ VERIFICATION FAILED: ${stillMismatchRows.length} row(s) do not match target provider/model`
    )
    stillMismatchRows.forEach(r => {
      console.error(
        `  - ${r.id}: provider='${r.provider}' model='${r.model}' (expected '${TARGET_PROVIDER}' / '${TARGET_MODEL}')`
      )
    })
    process.exit(1)
  }

  console.log('✅ VERIFICATION PASSED: All 21 rows confirmed with target provider/model')
  console.log('')

  // SUMMARY
  console.log('='.repeat(80))
  console.log('MIGRATION SUMMARY')
  console.log('='.repeat(80))
  console.log('')

  console.log(`Total IDs in closed list: ${AGENT_SESSION_IDS.length}`)
  console.log(`Preflight found: ${preflightRows.length}`)
  console.log(`Update affected: ${updatedRows?.length ?? 0}`)
  console.log(`Verification confirmed: ${verificationRows.length}`)
  console.log('')

  console.log('All rows migrated successfully:')
  console.log(`  From: ${EXPECTED_PROVIDER} / ${EXPECTED_MODEL}`)
  console.log(`  To: ${TARGET_PROVIDER} / ${TARGET_MODEL}`)
  console.log('')

  console.log('NEXT STEPS:')
  console.log('1. Validate with SQL query in Supabase:')
  console.log(
    "   SELECT id, provider, model FROM agent_sessions WHERE provider='Groq'"
  )
  console.log('   (Should return 0 rows for the 21 migrated IDs)')
  console.log('')
  console.log('2. Test 1-2 migrated agents in production:')
  console.log('   - Open workspace containing a migrated agent')
  console.log('   - Send a test message')
  console.log('   - Confirm agent responds normally with OpenAI')
  console.log('')
  console.log('3. Confirm other agents in same teams were not affected')
  console.log('')
  console.log('Migration script completed successfully.')
  console.log('='.repeat(80))

  process.exit(0)
}

main().catch(err => {
  console.error('FATAL ERROR:', err)
  process.exit(1)
})
