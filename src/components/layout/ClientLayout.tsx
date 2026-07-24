'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import ApiKeyRequiredModal from '../onboarding/ApiKeyRequiredModal'

/**
 * ClientLayout — Global client-side layout wrapper
 *
 * Handles proactive API key check for user-facing pages.
 * Modal appears automatically when user has no API keys saved.
 */

// Routes where the API key modal should appear proactively
const ROUTES_WITH_API_KEY_CHECK = [
  '/',              // Dashboard (main)
  '/teams',         // Teams Map
  '/workspace',     // Workspace (any workspace ID)
  '/audit',         // Audit Log
  '/documentation', // Documentation Mode
  '/context',       // Context Files
  '/start',         // Onboarding
  // NOTE: /settings intentionally EXCLUDED — user is already on the page to add keys
]

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [showModal, setShowModal] = useState(false)
  const [hasChecked, setHasChecked] = useState(false)

  // Check if current route should trigger API key check
  const shouldCheckApiKeys = ROUTES_WITH_API_KEY_CHECK.some(route => {
    if (route === '/') {
      return pathname === '/'
    }
    return pathname?.startsWith(route)
  })

  useEffect(() => {
    if (!shouldCheckApiKeys || hasChecked) return

    const checkApiKeys = async () => {
      try {
        const res = await fetch('/api/settings/keys')
        const keys = await res.json()

        // DEBUG: Log to console for PO validation
        console.log('[ClientLayout] API Key check:', {
          pathname,
          keysCount: Array.isArray(keys) ? keys.length : 0,
          hasKeys: Array.isArray(keys) && keys.length > 0,
          willShowModal: !Array.isArray(keys) || keys.length === 0
        })

        if (!Array.isArray(keys) || keys.length === 0) {
          setShowModal(true)
        }
        setHasChecked(true)
      } catch (error) {
        console.error('[ClientLayout] Failed to check API keys:', error)
        setHasChecked(true)
        // Don't block on error — user will see modal when they try to use AI
      }
    }

    checkApiKeys()
  }, [shouldCheckApiKeys, hasChecked, pathname])

  return (
    <>
      {children}

      {showModal && (
        <ApiKeyRequiredModal
          onClose={() => setShowModal(false)}
          onSuccess={() => setShowModal(false)}
        />
      )}
    </>
  )
}
