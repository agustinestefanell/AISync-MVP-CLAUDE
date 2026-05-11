// CONTENT PLANE — These queries operate on client-owned artifacts.
// Data is currently stored in platform infrastructure but must be
// treated as migratable client property. See src/lib/db/planes.ts

import { createClient } from '@/lib/supabase/server'
import type { Message } from './types'

export async function getMessages(sessionId: string): Promise<Message[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  return (data as Message[]) ?? []
}
