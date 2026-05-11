'use server'

import { createClient } from '@/lib/supabase/server'
import { createProject } from '@/lib/db/projects'
import { revalidatePath } from 'next/cache'

export async function createProjectAction(name: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  await createProject(user.id, name.trim())
  revalidatePath('/')
}
