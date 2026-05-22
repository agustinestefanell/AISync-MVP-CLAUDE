// Server-only — nunca importar desde client components.

export interface ExtractResult {
  text:      string | null
  supported: boolean
}

const TEXT_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'text/csv',
  'text/html',
  'application/json',
])

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<ExtractResult> {
  const type = mimeType.toLowerCase().split(';')[0].trim()

  // TXT / MD / texto plano — leer directamente
  if (TEXT_TYPES.has(type) || type.startsWith('text/')) {
    return { text: buffer.toString('utf-8'), supported: true }
  }

  // PDF — pdf-parse (export = syntax — cast to callable)
  if (type === 'application/pdf') {
    try {
      type PdfResult = { text: string }
      const pdfParse = (await import('pdf-parse')) as unknown as (buf: Buffer) => Promise<PdfResult>
      const data = await pdfParse(buffer)
      return { text: data.text ?? null, supported: true }
    } catch {
      return { text: null, supported: true }
    }
  }

  // DOCX — mammoth
  if (
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    type === 'application/docx'
  ) {
    try {
      const mammoth = await import('mammoth')
      const result  = await mammoth.extractRawText({ buffer })
      return { text: result.value ?? null, supported: true }
    } catch {
      return { text: null, supported: true }
    }
  }

  // Tipo no soportado — guardar referencia sin extracción
  return { text: null, supported: false }
}

export function detectMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    txt:  'text/plain',
    md:   'text/markdown',
    csv:  'text/csv',
    json: 'application/json',
    html: 'text/html',
    htm:  'text/html',
    pdf:  'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc:  'application/msword',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    png:  'image/png',
    jpg:  'image/jpeg',
    jpeg: 'image/jpeg',
  }
  return map[ext] ?? 'application/octet-stream'
}
