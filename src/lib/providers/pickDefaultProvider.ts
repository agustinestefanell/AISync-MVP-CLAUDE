// Ajuste 4 (2026-08-24): SAT/Connect Team defaulteaban a un provider hardcodeado
// sin mirar qué API keys tiene configuradas la cuenta. Prioridad Anthropic >
// OpenAI > Google confirmada con el PO — solo aplica entre estos 3 providers
// cloud, no contempla custom providers.
export const CLOUD_PROVIDER_PRIORITY = ['Anthropic', 'OpenAI', 'Google'] as const
type CloudProviderName = typeof CLOUD_PROVIDER_PRIORITY[number]

export const CLOUD_PROVIDER_DEFAULT_MODELS: Record<CloudProviderName, string> = {
  Anthropic: 'Claude Sonnet 4.6',
  OpenAI:    'GPT-5.5',
  Google:    'Gemini 3.5 Flash',
}

/** 1 provider configurado → ese. 2+ → prioridad. 0 → fallback (comportamiento actual). */
export function pickDefaultProvider(configuredProviders: string[], fallback: string): string {
  return CLOUD_PROVIDER_PRIORITY.find(p => configuredProviders.includes(p)) ?? fallback
}

export function pickDefaultModel(provider: string, fallback: string): string {
  return (CLOUD_PROVIDER_DEFAULT_MODELS as Record<string, string>)[provider] ?? fallback
}
