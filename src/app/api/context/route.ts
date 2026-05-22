import { createClient } from '@/lib/supabase/server'
import {
  createContextSource,
  updateContextSource,
  extractAndSaveText,
} from '@/lib/db/context'
import { uploadContextFile } from '@/lib/storage/contextFiles'
import { extractTextFromBuffer, detectMimeType } from '@/lib/context/extractText'
import type { ContextScope } from '@/lib/db/context'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

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
  } catch {
    // Extraction failed — non-blocking
  }

  return Response.json({ source })
}
