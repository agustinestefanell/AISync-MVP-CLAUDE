// Server-only — nunca importar desde client components.

// pdf-parse/pdfjs-dist se importan de forma perezosa dentro de la rama
// application/pdf (igual que mammoth/word-extractor/xlsx/jszip más abajo)
// — un import estático a nivel de módulo forzaba a cargar pdfjs-dist en
// CUALQUIER request que tocara este archivo, sin importar el tipo de
// archivo subido. Ver CodingWorkshop.md #28.
import type { PDFParse as PDFParseType } from 'pdf-parse'

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

  // PDF — pdf-parse v2 with CanvasFactory
  if (type === 'application/pdf') {
    let parser: PDFParseType | null = null

    try {
      const { CanvasFactory } = await import('pdf-parse/worker')
      const { PDFParse }      = await import('pdf-parse')

      parser = new PDFParse({
        data: new Uint8Array(buffer),
        CanvasFactory,
      })

      const result = await parser.getText()

      return { text: result.text ?? null, supported: true }
    } catch (error) {
      console.error('[Context Files] PDF text extraction error', {
        extraction_error: error instanceof Error ? error.message : String(error),
        stack:            error instanceof Error ? error.stack : undefined,
      })
      throw error
    } finally {
      if (parser) {
        try {
          await parser.destroy()
        } catch (destroyError) {
          console.error('[Context Files] PDFParse destroy() failed', {
            error: destroyError instanceof Error ? destroyError.message : String(destroyError),
          })
        }
      }
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
    } catch (error) {
      console.error('[Context Files] DOCX text extraction error', {
        extraction_error: error instanceof Error ? error.message : String(error),
        stack:            error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }

  // DOC legacy (OLE, pre-2007) — word-extractor. Sin dependencias de sistema,
  // acepta Buffer directo (no requiere ruta de archivo en disco).
  if (type === 'application/msword') {
    try {
      const WordExtractor = (await import('word-extractor')).default
      const extractor = new WordExtractor()
      const doc = await extractor.extract(buffer)
      return { text: doc.getBody() ?? null, supported: true }
    } catch (error) {
      console.error('[Context Files] DOC (legacy) text extraction error', {
        extraction_error: error instanceof Error ? error.message : String(error),
        stack:            error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }

  // XLSX / XLS — SheetJS (misma librería ya instalada para el export a Excel)
  if (
    type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    type === 'application/vnd.ms-excel'
  ) {
    try {
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const parts = workbook.SheetNames.map(name => {
        const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name])
        return `[Sheet: ${name}]\n${csv}`.trim()
      })
      const text = parts.join('\n\n').trim()
      return { text: text || null, supported: true }
    } catch (error) {
      console.error('[Context Files] Excel text extraction error', {
        extraction_error: error instanceof Error ? error.message : String(error),
        stack:            error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }

  // PPTX — jszip (dependencia directa, ya presente vía docx) + extracción
  // del texto de cada slide (tags <a:t> en ppt/slides/slideN.xml).
  // .ppt legacy (binario pre-2007) NO se soporta — sin librería JS liviana confiable.
  if (type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    try {
      const JSZip   = (await import('jszip')).default
      const archive = await JSZip.loadAsync(buffer)
      const slideNames = Object.keys(archive.files)
        .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
        .sort((a, b) =>
          Number(a.match(/slide(\d+)/)?.[1] ?? 0) - Number(b.match(/slide(\d+)/)?.[1] ?? 0)
        )
      const parts: string[] = []
      for (const name of slideNames) {
        const xml   = await archive.files[name].async('string')
        const texts = Array.from(xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)).map(m => m[1])
        const decoded = texts.join(' ')
          .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
          .replace(/&amp;/g, '&')
          .trim()
        if (decoded) {
          const num = name.match(/slide(\d+)/)?.[1] ?? '?'
          parts.push(`[Slide ${num}]\n${decoded}`)
        }
      }
      const text = parts.join('\n\n').trim()
      return { text: text || null, supported: true }
    } catch (error) {
      console.error('[Context Files] PPTX text extraction error', {
        extraction_error: error instanceof Error ? error.message : String(error),
        stack:            error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }

  // Tipo no soportado (PPT legacy, DOC legacy, imágenes, etc.) —
  // guardar referencia sin extracción
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
    xls:  'application/vnd.ms-excel',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ppt:  'application/vnd.ms-powerpoint',
    png:  'image/png',
    jpg:  'image/jpeg',
    jpeg: 'image/jpeg',
  }
  return map[ext] ?? 'application/octet-stream'
}
