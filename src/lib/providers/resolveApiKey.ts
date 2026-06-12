import type { SupabaseClient } from '@supabase/supabase-js'

// Fuente única de providers conocidos (ARC-001). Los nombres son los display
// names que el cliente envía y la DB almacena — no cambiar a lowercase.
// 'IA Local' no usa keys: las routes lo resuelven antes de llamar al helper.
export const KNOWN_PROVIDERS = new Set(['Anthropic', 'OpenAI', 'Google', 'Groq', 'IA Local'])

const ENV_KEYS: Record<string, string | undefined> = {
  Anthropic: process.env.ANTHROPIC_API_KEY,
  OpenAI:    process.env.OPENAI_API_KEY,
  Google:    process.env.GOOGLE_AI_API_KEY,
}

export type ResolvedProviderKey =
  | { isCustom: true; apiKey: string | null; endpointUrl: string }
  | { isCustom: false; apiKey: string }

// Orden de resolución (DECISIONS.md 2026-06-11/12 — BYOK estricto + SEC-005 Vault):
// 1. Provider no conocido → user_custom_providers: key desde Vault (RPC), fallback
//    a api_key plaintext legacy (api_key puede ser null/'' — Ollama)
// 2. Provider conocido → Vault (RPC get_provider_key), fallback a user_api_keys
// 3. Solo en development → fallback a ENV_KEYS de plataforma
// 4. Sin key → null (la route decide el error 400)
// Nota dual-read: supabase.rpc() con función inexistente devuelve { data: null, error }
// sin throw — si la migración 026 no está aplicada, todo cae a legacy sin romper.
export async function resolveProviderApiKey(
  supabase: SupabaseClient,
  userId: string,
  provider: string
): Promise<ResolvedProviderKey | null> {
  if (!KNOWN_PROVIDERS.has(provider)) {
    const { data: custom } = await supabase
      .from('user_custom_providers')
      .select('endpoint_url, api_key')
      .eq('account_id', userId)
      .eq('name', provider)
      .maybeSingle()

    if (!custom) return null

    const { data: vaultCustomKey } = await supabase.rpc('get_custom_provider_key', {
      p_provider_name: provider,
    })

    const apiKey = (vaultCustomKey as string | null) ?? (custom.api_key || null)
    return { isCustom: true, apiKey, endpointUrl: custom.endpoint_url }
  }

  const { data: vaultKey } = await supabase.rpc('get_provider_key', {
    p_provider: provider,
  })

  if (vaultKey) {
    return { isCustom: false, apiKey: vaultKey as string }
  }

  const { data: keyRow } = await supabase
    .from('user_api_keys')
    .select('api_key')
    .eq('account_id', userId)
    .eq('provider', provider)
    .maybeSingle()

  const apiKey = (keyRow?.api_key || undefined) ??
    (process.env.NODE_ENV === 'development' ? ENV_KEYS[provider] : undefined)

  if (!apiKey) return null
  return { isCustom: false, apiKey }
}
