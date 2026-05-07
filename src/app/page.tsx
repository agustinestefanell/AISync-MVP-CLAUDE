import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'

export default async function HomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: account } = await supabase
    .from('accounts')
    .select('name, email, plan, created_at')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Barra superior */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <span className="text-lg font-bold tracking-tight">AISync</span>
        <LogoutButton />
      </header>

      {/* Contenido */}
      <main className="max-w-2xl mx-auto px-6 py-16 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">
            Bienvenido{account?.name ? `, ${account.name}` : ''}
          </h1>
          <p className="text-gray-400 mt-1 text-sm">{account?.email ?? user.email}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
            Tu cuenta
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Plan</p>
              <p className="text-sm font-medium capitalize mt-0.5">
                {account?.plan ?? 'Free'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Miembro desde</p>
              <p className="text-sm font-medium mt-0.5">
                {account?.created_at
                  ? new Date(account.created_at).toLocaleDateString('es-AR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <p className="text-gray-400 text-sm">
            Dashboard en construcción. Bloque 3 →
          </p>
        </div>
      </main>
    </div>
  )
}
