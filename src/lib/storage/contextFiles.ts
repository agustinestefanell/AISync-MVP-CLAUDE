import { createClient } from '@/lib/supabase/server'

const BUCKET = 'context-files'

function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 200)
}

export async function uploadContextFile(params: {
  file:            File | Buffer
  fileName:        string
  mimeType:        string
  userId:          string
  contextSourceId: string
}): Promise<string> {
  const supabase  = createClient()
  const safeName  = sanitizeFileName(params.fileName)
  const filePath  = `${params.userId}/${params.contextSourceId}/${safeName}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, params.file, {
      contentType: params.mimeType,
      upsert: false,
    })

  if (error) throw error
  return filePath
}

export async function getContextFileUrl(
  filePath: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, expiresInSeconds)

  if (error) throw error
  return data.signedUrl
}
