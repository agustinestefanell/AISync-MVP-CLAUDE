'use client'

import { useState } from 'react'

interface WelcomeScreenProps {
  requesterEmail: string
  requesterTeamName: string
  description?: string
  color?: string
  connectionId: string
  onClose: () => void
}

export default function WelcomeScreen({
  requesterEmail,
  requesterTeamName,
  description,
  color,
  connectionId,
  onClose,
}: WelcomeScreenProps) {
  const [isClosing, setIsClosing] = useState(false)

  async function handleStartWorking() {
    setIsClosing(true)
    try {
      await fetch('/api/connections/mark-welcome-viewed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      })
    } catch (err) {
      console.error('Failed to mark welcome as viewed:', err)
    } finally {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-2xl mx-4 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Welcome to this Shared Workspace</h2>
          <p className="text-sm text-gray-500 mt-1">You have been invited to collaborate</p>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6 overflow-y-auto max-h-[60vh]">
          {/* Who invited you */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Who invited you</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 space-y-1">
              <p className="text-sm font-medium text-gray-900">{requesterTeamName}</p>
              <p className="text-xs text-gray-500">{requesterEmail}</p>
            </div>
          </div>

          {/* About this connection */}
          {description && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">About this connection</h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 space-y-2">
                <p className="text-sm text-gray-700 italic">{description}</p>
                {color && color !== '#000000' && (
                  <div className="flex items-center gap-2 pt-1">
                    <div
                      className="w-4 h-4 rounded border border-gray-300"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs text-gray-500">Connection color</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* What you can do here */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">What you can do here</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
                  1
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Chat with the AI agent</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Interact with the AI agent from the host team. Your messages and the agent&apos;s responses are visible to both you and the host.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
                  2
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Direct chat with the host</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    <span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-semibold mr-1">
                      COMING SOON
                    </span>
                    Human-to-human messaging channel for direct communication.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Scope reminder */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <p className="text-xs text-blue-900">
              <strong className="font-semibold">Note:</strong> This is a{' '}
              <span className="font-mono text-[11px] bg-blue-100 px-1 py-0.5 rounded">scope-isolated</span>{' '}
              workspace. You can only access this specific workspace, not the host&apos;s entire account or other teams.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={handleStartWorking}
            disabled={isClosing}
            className="text-sm bg-gray-900 hover:bg-gray-700 text-white font-medium px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isClosing ? 'Loading...' : 'Start Working'}
          </button>
        </div>
      </div>
    </div>
  )
}
