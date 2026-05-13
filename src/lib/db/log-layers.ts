// CONTROL PLANE — Layers 2 and 3 of the AISync log architecture.
// Layer 1 (audit_log) is written directly from API routes via supabase client.
// Layers 2 and 3 use the admin client to bypass RLS — server-side only.

import { createAdminClient } from '@/lib/supabase/admin'

// ── CAPA 2: System / Security Log ────────────────────────────────────────
export async function logSystemEvent({
  event_type,
  severity = 'info',
  user_id,
  payload = {},
}: {
  event_type: string
  severity?:  'debug' | 'info' | 'warning' | 'error' | 'critical'
  user_id?:   string
  payload?:   Record<string, unknown>
}): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('system_log').insert({
      event_type,
      severity,
      user_id:  user_id ?? null,
      payload,
    })
  } catch {
    // Never interrupt the main request flow
  }
}

// ── CAPA 3: Preservation / Provenance Event Store ─────────────────────────
export async function logProvenanceEvent({
  object_id,
  object_type,
  event_type,
  agent_type = 'system',
  agent_id,
  relation_type,
  related_object_id,
  related_object_type,
  payload = {},
}: {
  object_id:            string
  object_type:          string
  event_type:           string
  agent_type?:          'user' | 'system' | 'admin'
  agent_id?:            string
  relation_type?:       string
  related_object_id?:   string
  related_object_type?: string
  payload?:             Record<string, unknown>
}): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('provenance_log').insert({
      object_id,
      object_type,
      event_type,
      agent_type,
      agent_id:            agent_id            ?? null,
      relation_type:       relation_type        ?? null,
      related_object_id:   related_object_id   ?? null,
      related_object_type: related_object_type ?? null,
      payload,
    })
  } catch {
    // Never interrupt the main request flow
  }
}
