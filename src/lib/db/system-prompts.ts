// CONTROL PLANE — System prompts son infraestructura de AISync.
// Capa 1: definidos por AISync, intocables por el usuario.
// Acceso exclusivamente desde server-side via service_role. Ver src/lib/supabase/admin.ts

import { createAdminClient } from '@/lib/supabase/admin'

export async function getSystemPrompt(role: string): Promise<string> {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('system_prompts')
      .select('base_layer, role_prompt')
      .eq('role', role)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      console.error(`[SystemPrompt] No prompt found for role: ${role}`)
      return ''
    }

    return `${data.base_layer}\n\n${data.role_prompt}`
  } catch {
    console.error(`[SystemPrompt] Failed to load prompt for role: ${role}`)
    return ''
  }
}
