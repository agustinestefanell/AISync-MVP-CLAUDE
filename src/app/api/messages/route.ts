import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractTextFromBuffer } from '@/lib/context/extractText'
import { getProvider } from '@/lib/providers'
import { resolveProviderApiKey } from '@/lib/providers/resolveApiKey'
import { isUuid } from '@/lib/chat/traceability'
import { findCitedSources } from '@/lib/tools/urls'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized.' }, { status: 401 })

  const { sessionId, messages, provenance } = await req.json() as {
    sessionId: string
    messages: {
      // Opcional: id generado por el cliente (AgentPanel) para vincular
      // adjuntos/búsquedas de /api/chat con este mensaje. Si no es un UUID
      // válido se ignora y la base genera uno.
      id?:         string
      role:        'user' | 'assistant'
      content:     string
      attachments?: { name?: string; media_type: string; type: 'image' | 'document'; data?: string }[]
    }[]
    // Load Saved Context → Chat, o Review & Forward Agent↔Agent (Fase 1.6):
    // de dónde vino el contenido que generó este mensaje. Se aplica a todos
    // los mensajes de esta llamada — en la práctica siempre es una sola (ver
    // AgentPanel.tsx handleLoadToChat / AgentPanelHandle.appendUserMessage).
    provenance?: {
      source_object_type: 'checkpoint' | 'handoff_package' | 'saved_selection' | 'review_forward'
      source_object_id:   string
    }
  }

  // Provider/model activos de la sesión al momento de persistir — no
  // retroactivo, solo lo que se sabe en este instante (ver migración 054).
  const { data: sessionInfo } = await supabase
    .from('agent_sessions')
    .select('provider, model')
    .eq('id', sessionId)
    .maybeSingle()

  // Insert and get back IDs
  const { data: insertedMessages, error } = await supabase
    .from('messages')
    .insert(
      messages.map(m => ({
        ...(isUuid(m.id) ? { id: m.id } : {}),
        session_id:          sessionId,
        role:                m.role,
        content:             m.content,
        attachment_metadata: m.attachments?.length
          ? m.attachments.map(a => ({ name: a.name ?? '', media_type: a.media_type, type: a.type }))
          : null,
        provider:            sessionInfo?.provider ?? null,
        model:               sessionInfo?.model    ?? null,
      }))
    )
    .select('id, role, attachment_metadata')

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // message_provenance — fail-open, no debe bloquear la respuesta ya exitosa
  if (provenance && insertedMessages?.length) {
    try {
      await supabase.from('message_provenance').insert(
        insertedMessages.map(m => ({
          message_id:         m.id,
          source_object_type: provenance.source_object_type,
          source_object_id:   provenance.source_object_id,
        }))
      )
    } catch (provenanceError) {
      console.error('[messages] Failed to insert message_provenance:', provenanceError)
    }
  }

  // URLs citadas — compara la respuesta final con las fuentes de las
  // búsquedas que /api/chat registró con este mismo message_id. Se hace acá
  // (con el texto completo que el cliente ya manda) para no tocar el
  // streaming de /api/chat. Fail-open: nunca bloquea la respuesta.
  // session_tool_calls NO tiene policy de UPDATE (una búsqueda registrada no
  // debe poder reescribirse — migración 062): el SELECT va con el cliente del
  // usuario (RLS verifica ownership) y la única escritura, solo cited_urls,
  // con el cliente admin y una sola vez (solo si sigue en NULL).
  const assistantWithId = (insertedMessages ?? []).filter(m => m.role === 'assistant')
  for (const inserted of assistantWithId) {
    try {
      const original = messages[insertedMessages!.indexOf(inserted)]
      const { data: toolCalls } = await supabase
        .from('session_tool_calls')
        .select('id, sources')
        .eq('message_id', inserted.id)
        .eq('status', 'success')
        .is('cited_urls', null)
      if (!toolCalls?.length) continue
      const admin = createAdminClient()
      for (const tc of toolCalls) {
        const sourceUrls = ((tc.sources ?? []) as { url?: string }[])
          .map(s => s.url)
          .filter((u): u is string => typeof u === 'string')
        const { error: citedError } = await admin
          .from('session_tool_calls')
          .update({ cited_urls: findCitedSources(original?.content ?? '', sourceUrls) })
          .eq('id', tc.id)
          .is('cited_urls', null)
        if (citedError) console.error('[messages] Failed to update cited_urls:', citedError)
      }
    } catch (citedErr) {
      console.error('[messages] cited_urls evaluation failed (non-blocking):', citedErr)
    }
  }

  // Fire-and-forget: generar resumen AI de adjuntos
  // Map original messages with their inserted DB IDs
  const messagesWithIds = messages.map((msg, index) => ({
    ...msg,
    messageId: insertedMessages?.[index]?.id ?? null,
  }))

  const userMessagesWithAttachments = messagesWithIds.filter(
    m => m.role === 'user' && m.attachments?.length && m.messageId
  )

  if (userMessagesWithAttachments.length > 0) {
    // No await — fire-and-forget para no bloquear respuesta
    generateAttachmentSummaries(supabase, user.id, sessionId, userMessagesWithAttachments).catch(err => {
      console.error('[messages] generateAttachmentSummaries failed (non-blocking)', err)
    })
  }

  return Response.json({ ok: true })
}

export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized.' }, { status: 401 })

  const sessionId = new URL(req.url).searchParams.get('sessionId')
  if (!sessionId) return Response.json({ error: 'sessionId is required.' }, { status: 400 })

  const { data } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  return Response.json(data ?? [])
}

// ── Fire-and-forget: generar resumen AI de adjuntos ──────────────────────────

async function generateAttachmentSummaries(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  sessionId: string,
  userMessages: Array<{
    role: 'user' | 'assistant'
    content: string
    messageId: string | null
    attachments?: { name?: string; media_type: string; type: 'image' | 'document'; data?: string }[]
  }>
) {
  try {
    // Obtener provider/model desde agent_sessions
    const { data: session } = await supabase
      .from('agent_sessions')
      .select('provider, model, workspace_id')
      .eq('id', sessionId)
      .single()

    if (!session) {
      console.error('[messages] generateAttachmentSummaries: session not found', { sessionId })
      return
    }

    // Resolver API key
    const resolved = await resolveProviderApiKey(supabase, userId, session.provider)
    if (!resolved) {
      console.error('[messages] generateAttachmentSummaries: API key not resolved', {
        provider: session.provider,
      })
      return
    }

    const providerInstance = getProvider(session.provider, {
      apiKey: resolved.apiKey ?? undefined
    })

    // Procesar cada mensaje con adjuntos
    for (const msg of userMessages) {
      if (!msg.attachments?.length) continue

      for (const att of msg.attachments) {
        try {
          // Saltar si no hay data (edge case)
          if (!att.data) {
            console.warn('[messages] generateAttachmentSummaries: attachment without data', {
              filename: att.name,
            })
            continue
          }

          // Extraer texto del adjunto usando helper existente
          const buffer = Buffer.from(att.data, 'base64')
          let extractedText: string | null = null
          let extractionSupported = false

          try {
            const extractResult = await extractTextFromBuffer(buffer, att.media_type)
            extractedText = extractResult.text
            extractionSupported = extractResult.supported
          } catch (extractError) {
            console.error('[messages] generateAttachmentSummaries: text extraction failed', {
              filename: att.name,
              mime_type: att.media_type,
              error: extractError instanceof Error ? extractError.message : String(extractError),
            })
            // Continuar sin texto extraído
          }

          // Generar resumen AI
          let summary: string | null = null
          let summaryStatus: 'available' | 'unavailable' = 'unavailable'
          let summaryError: string | null = null

          if (extractionSupported && extractedText) {
            try {
              // Llamada al provider para generar resumen
              const summaryPrompt = [
                {
                  role: 'user' as const,
                  content: `Generate a concise summary (2-4 lines) of the following document content. Focus on the main topic, key information, and purpose. Do not include metadata like filename or technical details.\n\nDocument content:\n${extractedText.slice(0, 50000)}`,
                },
              ]

              if (providerInstance.complete) {
                const response = await providerInstance.complete(summaryPrompt, session.model)
                summary = response.content.trim()
                summaryStatus = 'available'
              } else {
                summaryError = 'Provider does not support complete() method'
              }
            } catch (summaryGenError) {
              summaryError =
                summaryGenError instanceof Error ? summaryGenError.message : String(summaryGenError)
              console.error('[messages] generateAttachmentSummaries: AI summary generation failed', {
                filename: att.name,
                provider: session.provider,
                model: session.model,
                error: summaryError,
              })
            }
          } else {
            summaryError = extractionSupported
              ? 'Text extraction returned empty'
              : 'File type not supported for text extraction'
          }

          // Actualizar attachment_metadata del mensaje correspondiente
          const aiSummaryMetadata = {
            status: summaryStatus,
            ...(summary ? { summary } : {}),
            ...(summaryError ? { error: summaryError } : {}),
            generated_at: new Date().toISOString(),
            provider: session.provider,
            model: session.model,
            source: 'chat_attachment',
          }

          // Usar ID real del mensaje insertado (no búsqueda aproximada)
          if (!msg.messageId) {
            console.error('[messages] generateAttachmentSummaries: messageId missing', {
              filename: att.name,
            })
            continue
          }

          // Obtener attachment_metadata actual del mensaje para no sobrescribirlo
          const { data: currentMessage } = await supabase
            .from('messages')
            .select('attachment_metadata')
            .eq('id', msg.messageId)
            .single()

          if (currentMessage) {
            // Enriquecer attachment_metadata existente con ai_summary
            const currentMetadata = currentMessage.attachment_metadata as Array<{
              name: string
              media_type: string
              type: string
              ai_summary?: typeof aiSummaryMetadata
            }> || []

            const enrichedMetadata = currentMetadata.map(meta => {
              if (meta.name === (att.name ?? '') && meta.media_type === att.media_type) {
                return { ...meta, ai_summary: aiSummaryMetadata }
              }
              return meta
            })

            await supabase
              .from('messages')
              .update({ attachment_metadata: enrichedMetadata })
              .eq('id', msg.messageId)
          }

          // Insertar evento audit_log attachment_summary_generated
          await supabase.from('audit_log').insert({
            account_id: userId,
            workspace_id: session.workspace_id ?? null,
            event_type: 'attachment_summary_generated',
            metadata: {
              filename: att.name ?? 'unknown',
              mime_type: att.media_type,
              attachment_type: att.type,
              provider: session.provider,
              model: session.model,
              attachment_summary: aiSummaryMetadata,
            },
          })
        } catch (attError) {
          console.error('[messages] generateAttachmentSummaries: attachment processing failed', {
            filename: att.name,
            error: attError instanceof Error ? attError.message : String(attError),
          })
          // Continuar con siguiente adjunto
        }
      }
    }
  } catch (error) {
    console.error('[messages] generateAttachmentSummaries: unexpected error', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
