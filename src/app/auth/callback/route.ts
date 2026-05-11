import { createClient } from '@/lib/supabase/server'
import { createDemoProject } from '@/lib/db/projects'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const user = data.user

      // ¿Ya existe la cuenta? → primer login vs. logins posteriores
      const { data: existing } = await supabase
        .from('accounts')
        .select('id')
        .eq('id', user.id)
        .single()

      if (!existing) {
        // Primera vez: crear cuenta y proyecto demo
        await supabase.from('accounts').insert({
          id: user.id,
          email: user.email!,
          name:
            user.user_metadata?.full_name ??
            user.user_metadata?.name ??
            user.email!.split('@')[0],
        })
        await createDemoProject(user.id)
      }

      return NextResponse.redirect(`${origin}/`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
