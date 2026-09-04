import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ContextPageClient from './ContextPageClient'

export default async function ContextPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: account, error: accountError } = await supabase.from('accounts').select('name').eq('id', user.id).single()
  // Ver comentario en getDocAuditEvents() (documentation.ts) — SEC-002,
  // handoff-2026-07-c.md OE 2026-09-04.
  if (accountError) console.error('[ContextPage] accounts query failed:', accountError)
  const userName = (account as { name?: string } | null)?.name ?? user.email ?? '—'

  return <ContextPageClient pageName="CONTEXT FILES" userId={user.id} userName={userName} />
}
