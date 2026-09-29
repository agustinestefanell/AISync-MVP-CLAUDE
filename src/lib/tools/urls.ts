// Normalización de URLs para trazabilidad de búsquedas web.
// Sin imports — se puede ejecutar aislado con `node` para pruebas.

// Parámetros de tracking que no cambian el contenido de la página.
const TRACKING_PARAMS = new Set([
  'fbclid', 'gclid', 'dclid', 'msclkid', 'mc_cid', 'mc_eid', 'igshid', 'ref', 'ref_src',
])

// URL limpia: sin fragmento (#...), sin parámetros de tracking (utm_*, fbclid,
// etc.), host en minúsculas y sin "www.". Si la URL no se puede parsear, se
// devuelve tal cual (recortada) — nunca tira error.
export function cleanUrl(raw: string): string {
  const trimmed = raw.trim()
  try {
    const u = new URL(trimmed)
    u.hash = ''
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '')
    for (const key of Array.from(u.searchParams.keys())) {
      if (/^utm_/i.test(key) || TRACKING_PARAMS.has(key.toLowerCase())) u.searchParams.delete(key)
    }
    return u.toString()
  } catch {
    return trimmed
  }
}

// Clave de comparación: URL limpia sin protocolo ni "/" final, para que
// http/https y "/path" vs "/path/" cuenten como la misma fuente.
export function urlKey(raw: string): string {
  return cleanUrl(raw).replace(/^https?:\/\//i, '').replace(/\/+$/, '')
}

// URLs que aparecen escritas en un texto (incluye links Markdown [t](url)).
export function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>()[\]"'`]+/gi) ?? []
  return matches.map(m => m.replace(/[.,;:!?*_]+$/, ''))
}

// Cuáles de las fuentes devueltas por la búsqueda aparecen citadas en la
// respuesta final. Devuelve sus clean_url, sin duplicados. Limitación
// conocida: solo detecta URLs escritas; una mención por nombre ("según
// AccuWeather") no cuenta como cita.
export function findCitedSources(text: string, sourceUrls: string[]): string[] {
  const inText = new Set(extractUrls(text).map(urlKey))
  const cited = new Set<string>()
  for (const url of sourceUrls) {
    if (inText.has(urlKey(url))) cited.add(cleanUrl(url))
  }
  return Array.from(cited)
}
