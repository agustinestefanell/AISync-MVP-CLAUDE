import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const user = data.user

      // Crear account si es la primera vez (upsert no duplica)
      await supabase.from('accounts').upsert(
        {
          id: user.id,
          email: user.email!,
          name:
            user.user_metadata?.full_name ??
            user.user_metadata?.name ??
            user.email!.split('@')[0],
        },
        { onConflict: 'id', ignoreDuplicates: true }
      )

      return NextResponse.redirect(`${origin}/`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
