'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const supabase = createClient()
  const router = useRouter()

  async function handleLogout() {
    // Clear SMPanel localStorage before signing out
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sm-connection')
      localStorage.removeItem('sm-messages')
      localStorage.removeItem('sm-panel-open')
    }
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-50"
    >
      Sign out
    </button>
  )
}
