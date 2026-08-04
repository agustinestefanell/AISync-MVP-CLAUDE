import { createClient } from '@/lib/supabase/server'
import { rateLimiters } from '@/lib/rate-limit'
import {
  createContextSource,
  updateContextSource,
  extractAndSaveText,
  getContextSourcesForRuntime,
} from '@/lib/db/context'
import { uploadContextFile } from '@/lib/storage/contextFiles'
import { extractTextFromBuffer, detectMimeType } from '@/lib/context/extractText'
import type { ContextScope } from '@/lib/db/context'

export const dynamic = 'force-dynamic'

// GET /api/context?projectId=&teamId=&sessionId=
// Resumen liviano (id/título/scope/longitud) de los context files que
// /api/chat inyectará para esos scopes — misma selección que el runtime
// (getContextSourcesForRuntime), para que el panel pueda avisar ANTES de
// enviar cuando un archivo supera el umbral. Nunca devuelve el contenido.
export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const params = new URL(req.url).searchParams
  try {
    const sources = await getContextSourcesForRuntime({
      projectId: params.get('projectId'),
      teamId:    params.get('teamId'),
      sessionId: params.get('sessionId'),
    })
    return Response.json({
      sources: sources.map(s => ({
        id:             s.id,
        title:          s.title,
        scope:          s.scope,
        content_length: s.content_text?.length ?? 0,
      })),
    })
  } catch {
    return Response.json({ error: 'Failed to load context summary' }, { status: 500 })
  }
}

// Load Saved Context — crea un context_source a partir de un objeto ya
// guardado en Documentation Mode (Handoff Package / Saved Selection /
// Checkpoint), en vez de un archivo subido. El contenido ya viene armado
// por el cliente (regla de carga diferenciada por tipo — ver Mini-OE
// 2026-08-03): no hay extracción de texto acá, solo persistencia.
// source_kind reutiliza 'saved_selection_context' (único valor ya permitido
// por el CHECK constraint de la tabla para este tipo de origen) — el tipo
// real de objeto vive en origin_type, columna TEXT libre sin constraint.
async function handleLoadFromDocumentation(req: Request, userId: string) {
  const body = await req.json() as {
    title?:            string
    contentText?:       string
    scope?:             ContextScope
    teamId?:            string | null
    sessionId?:         string | null
    workspaceId?:       string | null
    projectId?:         string | null
    originType?:        'handoff_package' | 'saved_selection' | 'checkpoint'
    originMessageId?:   string
  }

  const { title, contentText, scope, teamId, sessionId, workspaceId, projectId, originType, originMessageId } = body

  if (!title?.trim() || !contentText?.trim() || !scope || !originType || !originMessageId) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  let source
  try {
    source = await createContextSource({
      user_id:                  userId,
      title:                    title.trim(),
      source_kind:              'saved_selection_context',
      scope,
      team_id:                  teamId      || null,
      session_id:                sessionId   || null,
      workspace_id:              workspaceId || null,
      project_id:                projectId   || null,
      content_text:              contentText,
      file_path:                 null,
      file_type:                 null,
      file_size_bytes:           null,
      status:                    'active',
      retention_mode:            'persistent',
      extracted_text_available:  true,
      origin_type:               originType,
      origin_message_id:         originMessageId,
      notes:                     null,
      tags:                      null,
    })
  } catch {
    return Response.json({ error: 'Failed to create context source' }, { status: 500 })
  }

  // Audit log — fail-open, no debe bloquear la creación ya exitosa
  try {
    const supabase = createClient()
    await supabase.from('audit_log').insert({
      account_id:   userId,
      workspace_id: workspaceId || null,
      event_type:   'context_loaded_from_documentation',
      metadata: {
        source_type:       originType,
        source_id:         originMessageId,
        source_name:       title.trim(),
        target_session_id: sessionId || null,
        target_scope:      scope,
        destination:       'context_files',
      },
    })
  } catch (err) {
    console.error('[Load Saved Context] audit_log insert failed (non-blocking)', err)
  }

  return Response.json({ source })
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const rateLimit = await rateLimiters.context.check(`context:${user.id}`)
  if (!rateLimit.success) {
    return Response.json(
      { error: 'Too many requests. Please wait a moment before trying again.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(rateLimit.limit),
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'X-RateLimit-Reset': String(rateLimit.reset),
        },
      }
    )
  }

  const contentType = req.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return handleLoadFromDocumentation(req, user.id)
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file        = formData.get('file')        as File   | null
  const title       = formData.get('title')       as string | null
  const scope       = formData.get('scope')       as ContextScope | null
  const teamId      = formData.get('teamId')      as string | null
  const sessionId   = formData.get('sessionId')   as string | null
  const workspaceId = formData.get('workspaceId') as string | null
  const projectId   = formData.get('projectId')   as string | null
  const notes       = formData.get('notes')       as string | null

  if (!file || file.size === 0) {
    return Response.json({ error: 'No file provided' }, { status: 400 })
  }

  const mimeType = file.type || detectMimeType(file.name)

  // 1. Create preliminary record
  let source
  try {
    source = await createContextSource({
      user_id:                  user.id,
      title:                    title?.trim() || file.name,
      source_kind:              'uploaded_file',
      scope:                    scope || 'team',
      team_id:                  teamId  || null,
      session_id:               sessionId   || null,
      workspace_id:             workspaceId || null,
      project_id:               projectId   || null,
      content_text:             null,
      file_path:                null,
      file_type:                mimeType,
      file_size_bytes:          file.size,
      status:                   'active',
      retention_mode:           'persistent',
      extracted_text_available: false,
      origin_type:              null,
      origin_message_id:        null,
      notes:                    notes?.trim() || null,
      tags:                     null,
    })
  } catch {
    return Response.json({ error: 'Failed to create context source' }, { status: 500 })
  }

  // 2. Upload file to bucket
  let filePath: string
  try {
    filePath = await uploadContextFile({
      file,
      fileName:        file.name,
      mimeType,
      userId:          user.id,
      contextSourceId: source.id,
    })
    await updateContextSource(source.id, {
      file_path:      filePath,
      file_type:      mimeType,
      file_size_bytes: file.size,
    })
  } catch {
    // Record created but upload failed — mark as-is, don't crash
    return Response.json({ source, uploadError: 'File upload failed' }, { status: 207 })
  }

  // 3. Extract text
  try {
    const bytes  = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const { text } = await extractTextFromBuffer(buffer, mimeType)
    if (text) {
      await extractAndSaveText(source.id, text)
      source.extracted_text_available = true
      source.content_text             = text
    }
  } catch (error) {
    // Extraction failed — log and persist error for diagnostics
    const extractionErrorMessage = error instanceof Error ? error.message : String(error)
    const extractionErrorStack   = error instanceof Error ? error.stack : undefined

    console.error('[Context Files] Extraction failed', {
      file_id:          source.id,
      file_type:        mimeType,
      file_size_bytes:  file.size,
      extraction_error: extractionErrorMessage,
      stack:            extractionErrorStack,
    })

    await supabase
      .from('context_sources')
      .update({
        extraction_error: extractionErrorStack
          ? `${extractionErrorMessage}\n${extractionErrorStack}`
          : extractionErrorMessage,
      })
      .eq('id', source.id)
  }

  return Response.json({ source })
}
