// Server-only — nunca importar desde client components.
//
// Los providers de IA solo aceptan adjuntos nativos limitados:
// Anthropic (imágenes + PDF), Google (imágenes + PDF), OpenAI (imágenes).
// Cualquier otro adjunto (Word, Excel, PPT) debe convertirse a texto
// extraído ANTES de llegar al provider, o la API lo rechaza.

import type { ChatMessage, ChatAttachment } from '@/lib/providers/types'
import { extractTextFromBuffer, detectMimeType } from '@/lib/context/extractText'

// Tope por adjunto para no explotar la ventana de contexto del modelo
// (un Excel de 3 MB puede producir varios MB de CSV).
const MAX_INLINE_CHARS = 150_000

function isNativelySupported(att: ChatAttachment): boolean {
  if (att.type === 'image') return true
  return (att.media_type || '').toLowerCase().split(';')[0].trim() === 'application/pdf'
}

// Convierte adjuntos no-nativos en bloques de texto dentro del mensaje.
// Imágenes y PDF pasan intactos al provider. Nunca lanza — un adjunto que
// no se puede analizar se reemplaza por una nota visible para el modelo.
export async function inlineOfficeAttachments(messages: ChatMessage[]): Promise<ChatMessage[]> {
  return Promise.all(messages.map(async msg => {
    if (msg.role !== 'user' || !msg.attachments?.length) return msg

    const passthrough:  ChatAttachment[] = []
    const inlineBlocks: string[]         = []

    for (const att of msg.attachments) {
      if (isNativelySupported(att)) {
        passthrough.push(att)
        continue
      }
      const name = att.name ?? 'file'
      if (!att.data) {
        // Historial recargado u otro caso sin contenido — solo referencia
        inlineBlocks.push(`[Attached file: ${name} — content not available]`)
        continue
      }
      try {
        const buffer   = Buffer.from(att.data, 'base64')
        const mimeType = att.media_type || detectMimeType(name)
        const { text } = await extractTextFromBuffer(buffer, mimeType)
        if (text?.trim()) {
          const clipped = text.length > MAX_INLINE_CHARS
            ? `${text.slice(0, MAX_INLINE_CHARS)}\n…[content truncated — file is larger than the analysis limit]`
            : text
          inlineBlocks.push(`[Attached file: ${name}]\n${clipped}`)
        } else {
          inlineBlocks.push(`[Attached file: ${name} — this file type cannot be analyzed automatically yet]`)
        }
      } catch (error) {
        console.error('[Chat] attachment text extraction failed', {
          filename:  name,
          mime_type: att.media_type,
          error:     error instanceof Error ? error.message : String(error),
        })
        inlineBlocks.push(`[Attached file: ${name} — content could not be analyzed]`)
      }
    }

    if (inlineBlocks.length === 0) return msg

    return {
      ...msg,
      content:     [msg.content, ...inlineBlocks].filter(Boolean).join('\n\n'),
      attachments: passthrough.length ? passthrough : undefined,
    }
  }))
}
