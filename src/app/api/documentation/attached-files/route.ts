import { createClient } from '@/lib/supabase/server'
import { getDocAttachments } from '@/lib/db/documentation-trace'

export const dynamic = 'force-dynamic'

// GET /api/documentation/attached-files — pestaña "Attached Files" de
// Documentation Mode. Se pide al abrir la pestaña, no en la carga inicial de
// la página (decisión de Agus, OE Trazabilidad Parte 2). Solo lectura, RLS.
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    return Response.json({ files: await getDocAttachments() })
  } catch (error) {
    console.error('[documentation/attached-files] failed:', error)
    return Response.json({ error: 'Could not load attached files.' }, { status: 500 })
  }
}
