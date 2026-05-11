import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ApiKeysManager from '@/components/settings/ApiKeysManager'

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
          ← Dashboard
        </Link>
        <span className="text-gray-700">|</span>
        <span className="text-base font-bold tracking-tight">AISync</span>
        <span className="text-gray-700">·</span>
        <span className="text-sm font-semibold text-white">Ajustes</span>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-white">Configuración de providers</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tus API keys se guardan en Supabase y solo son accesibles por tu cuenta.
          </p>
        </div>

        <ApiKeysManager />
      </main>
    </div>
  )
}
