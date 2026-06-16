'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ApiKeyRequiredModal from './ApiKeyRequiredModal'

const EXAMPLE_PROMPTS = [
  'Create a research brief',
  'Organize prompts in a library',
  'Organize AI sessions as teams',
]

export default function ChatFirstClient() {
  const router = useRouter()
  const [projectName, setProjectName] = useState('My First Project')
  const [teamName, setTeamName] = useState('My First Team')
  const [message, setMessage] = useState('')
  const [validationMessage, setValidationMessage] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)

  const startWithGeneralManager = async () => {
    const initialIntent = message.trim()
    const finalProjectName = projectName.trim()
    const finalTeamName = teamName.trim()

    if (!finalProjectName) {
      setValidationMessage('Please enter a project name.')
      return
    }

    if (!finalTeamName) {
      setValidationMessage('Please enter a team name.')
      return
    }

    if (!initialIntent) {
      setValidationMessage('Please describe your goal before starting.')
      return
    }

    setValidationMessage('')
    setIsStarting(true)

    // Pre-flight: validar API key
    try {
      const keysRes = await fetch('/api/settings/keys')
      const keys = await keysRes.json()

      if (!Array.isArray(keys) || keys.length === 0) {
        setShowApiKeyModal(true)
        setIsStarting(false)
        return
      }

      // Crear estructura completa
      const res = await fetch('/api/onboarding/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initialIntent,
          projectName: finalProjectName,
          teamName: finalTeamName
        }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => null)
        setValidationMessage(
          error?.error ?? 'Failed to start workspace. Please try again.'
        )
        setIsStarting(false)
        return
      }

      const { workspaceId } = await res.json()
      router.push(`/workspace/${workspaceId}?prefill=${encodeURIComponent(initialIntent)}`)
    } catch {
      setValidationMessage('Network error. Please try again.')
      setIsStarting(false)
    }
  }

  const skipOnboarding = async () => {
    try {
      const res = await fetch('/api/onboarding/skip', { method: 'PATCH' })
      if (res.ok) {
        router.push('/')
      }
    } catch {
      // Silently fail — user can try again
    }
  }

  return (
    <>
      <div className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,rgba(219,234,254,0.75)_0%,rgba(246,249,253,1)_42%,rgba(248,250,252,1)_100%)] px-6 py-8">
        <div className="mx-auto grid max-w-[1780px] grid-cols-1 gap-6 lg:grid-cols-[0.86fr_2.12fr_0.86fr]">
          {/* Left sidebar — Work structure */}
          <aside className="hidden lg:block rounded-[24px] border border-[#E2E8F0] bg-white p-8 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-3 mb-6">
              <svg className="w-5 h-5 text-[#0969FF]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M3 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>
                <path d="M14 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>
              </svg>
              <h2 className="text-[20px] font-bold tracking-[-0.015em] text-[#071A33]">Work structure</h2>
            </div>

            <div className="space-y-4">
              {/* Project node */}
              <div className="relative rounded-[16px] border border-[#BFD7FF] bg-[#FAFCFF] p-5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#EAF3FF] text-[#0969FF]">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                      <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-bold text-[#0B1F3A]">Project</div>
                    <div className="mt-1 text-[14px] leading-6 text-[#53657D]">Your governed workspace</div>
                  </div>
                </div>
              </div>

              {/* Connector */}
              <div className="mx-auto h-8 w-px bg-[#7C3AED]"/>

              {/* Main AI Session node */}
              <div className="relative rounded-[16px] border border-[#7C3AED] bg-[#F9F6FF] p-5 shadow-[0_14px_30px_rgba(124,58,237,0.13)]">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F5F0FF] text-[#7C3AED]">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <circle cx="15.5" cy="8.5" r="1.5"/>
                      <path d="M9 16s1 2 3 2 3-2 3-2"/>
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-[15px] font-bold text-[#0B1F3A]">Main AI Session</div>
                      <span className="rounded-md bg-[#7C3AED] px-2 py-1 text-[11px] font-bold leading-none text-white">AI</span>
                    </div>
                    <div className="mt-1 text-[14px] leading-6 text-[#53657D]">Structures the main line of work</div>
                  </div>
                </div>
              </div>

              {/* Split connector */}
              <div className="relative mx-auto h-8 w-px">
                <div className="absolute top-0 left-1/2 h-4 w-px -translate-x-1/2 bg-[#64748B]"/>
                <div className="absolute top-4 left-1/2 h-px w-20 -translate-x-1/2 border-t border-[#64748B]"/>
                <div className="absolute top-4 left-[calc(50%-40px)] h-4 w-px bg-[#64748B]"/>
                <div className="absolute top-4 left-[calc(50%+40px)] h-4 w-px bg-[#64748B]"/>
              </div>

              {/* Research and Review nodes */}
              <div className="grid grid-cols-2 gap-3">
                {/* Research Session */}
                <div className="rounded-[16px] border border-[#DCE7F5] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                  <div className="flex flex-col items-center text-center">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ECFDF3] text-[#22C55E]">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="8"/>
                        <path d="m21 21-4.35-4.35"/>
                      </svg>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-[#22C55E]"/>
                      <div className="text-[13px] font-bold text-[#0B1F3A]">Research</div>
                    </div>
                    <div className="mt-1 text-[12px] leading-5 text-[#53657D]">Research and analysis</div>
                  </div>
                </div>

                {/* Review Session */}
                <div className="rounded-[16px] border border-[#EFE3D0] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                  <div className="flex flex-col items-center text-center">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF7E6] text-[#F59E0B]">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <polyline points="10 9 9 9 8 9"/>
                      </svg>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-[#F59E0B]"/>
                      <div className="text-[13px] font-bold text-[#0B1F3A]">Review</div>
                    </div>
                    <div className="mt-1 text-[12px] leading-5 text-[#53657D]">Review and documentation</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 rounded-[16px] border border-[#CFE0F5] bg-[#F8FBFF] p-5 shadow-[0_8px_20px_rgba(15,23,42,0.045)]">
              <p className="text-[13px] leading-6 text-[#53657D]">
                AISync organizes AI sessions while preserving context, checkpoints, and traceability.
              </p>
            </div>
          </aside>

          {/* Center panel */}
          <main className="rounded-[24px] border border-[#E2E8F0] bg-white px-12 py-10 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <div className="mx-auto w-full max-w-5xl space-y-8">
              {/* Hero section */}
              <div className="grid grid-cols-1 md:grid-cols-[1.35fr_0.65fr] gap-8 items-start">
                <div>
                  <h1 className="text-[40px] lg:text-[44px] leading-[1.12] font-extrabold tracking-[-0.035em] text-[#071A33]">
                    Start your AI work in a structured, traceable way
                  </h1>
                  <p className="mt-4 text-[16px] leading-7 text-[#53657D]">
                    Describe the work you want to structure. AISync helps you organize AI sessions, preserve context, and keep work traceable from the start.
                  </p>
                </div>

                {/* Illustration */}
                <div className="hidden md:block">
                  <svg className="w-[240px] h-[190px]" viewBox="0 0 240 190" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Robot head */}
                    <rect x="80" y="40" width="80" height="70" rx="8" stroke="#38BDF8" strokeWidth="2.5" fill="white"/>
                    {/* Eyes */}
                    <circle cx="100" cy="65" r="6" fill="#38BDF8"/>
                    <circle cx="140" cy="65" r="6" fill="#38BDF8"/>
                    {/* Smile */}
                    <path d="M 100 85 Q 120 95 140 85" stroke="#071A33" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                    {/* Antenna */}
                    <line x1="120" y1="40" x2="120" y2="20" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round"/>
                    <circle cx="120" cy="15" r="5" fill="#0969FF"/>

                    {/* Checklist card */}
                    <rect x="20" y="120" width="90" height="60" rx="8" fill="white" stroke="#DCE7F5" strokeWidth="1.5"/>
                    <line x1="30" y1="135" x2="70" y2="135" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="90" cy="135" r="4" stroke="#0969FF" strokeWidth="2" fill="none"/>
                    <line x1="30" y1="150" x2="70" y2="150" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="90" cy="150" r="4" fill="#0969FF"/>
                    <line x1="87" y1="150" x2="89" y2="152" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="89" y1="152" x2="93" y2="148" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="30" y1="165" x2="70" y2="165" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="90" cy="165" r="4" stroke="#0969FF" strokeWidth="2" fill="none"/>

                    {/* Shield */}
                    <path d="M 180 130 L 180 110 Q 180 105 185 105 L 205 105 Q 210 105 210 110 L 210 130 Q 195 145 195 145 Q 180 130 180 130 Z" fill="#22C55E"/>
                    <path d="M 188 125 L 192 129 L 202 117" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>

                    {/* Decorative orbit */}
                    <circle cx="195" cy="75" r="35" stroke="#93C5FD" strokeWidth="1.5" fill="none" strokeDasharray="4 4" opacity="0.5"/>
                  </svg>
                </div>
              </div>

              {/* Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-7">
                <div>
                  <label htmlFor="project-name" className="block text-[13px] font-semibold text-[#0B1F3A] mb-2">
                    Project name
                  </label>
                  <input
                    id="project-name"
                    type="text"
                    className="w-full rounded-[12px] border border-[#CFE0F5] bg-white px-4 py-3 text-[15px] text-[#071A33] shadow-[0_6px_16px_rgba(15,23,42,0.04)] placeholder:text-[#7C8EA6] focus:border-[#0969FF] focus:outline-none focus:ring-4 focus:ring-[rgba(9,105,255,0.12)]"
                    value={projectName}
                    onChange={(e) => {
                      setProjectName(e.target.value)
                      if (validationMessage) setValidationMessage('')
                    }}
                    placeholder="My First Project"
                    disabled={isStarting}
                  />
                </div>
                <div>
                  <label htmlFor="team-name" className="block text-[13px] font-semibold text-[#0B1F3A] mb-2">
                    Team name
                  </label>
                  <input
                    id="team-name"
                    type="text"
                    className="w-full rounded-[12px] border border-[#CFE0F5] bg-white px-4 py-3 text-[15px] text-[#071A33] shadow-[0_6px_16px_rgba(15,23,42,0.04)] placeholder:text-[#7C8EA6] focus:border-[#0969FF] focus:outline-none focus:ring-4 focus:ring-[rgba(9,105,255,0.12)]"
                    value={teamName}
                    onChange={(e) => {
                      setTeamName(e.target.value)
                      if (validationMessage) setValidationMessage('')
                    }}
                    placeholder="My First Team"
                    disabled={isStarting}
                  />
                  <p className="mt-2 text-[13px] text-[#708198]">You can edit this later</p>
                </div>
              </div>

              {/* Textarea */}
              <div>
                <textarea
                  className="min-h-[180px] w-full resize-none rounded-[16px] border border-[#0969FF] bg-white p-6 text-[17px] leading-7 text-[#071A33] shadow-[0_14px_30px_rgba(9,105,255,0.08)] placeholder:text-[#7C8EA6] focus:border-[#0969FF] focus:outline-none focus:ring-4 focus:ring-[rgba(9,105,255,0.12)]"
                  value={message}
                  onChange={(event) => {
                    setMessage(event.target.value)
                    if (validationMessage) {
                      setValidationMessage('')
                    }
                  }}
                  placeholder="Describe the task, decision, document, or workflow you want AISync to structure and track..."
                  disabled={isStarting}
                />
              </div>

              {/* Try an example */}
              <div>
                <p className="text-[13px] font-semibold text-[#0B1F3A] mb-3">Try an example</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {EXAMPLE_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setMessage(prompt)}
                      disabled={isStarting}
                      className="rounded-[12px] border border-[#CFE0F5] bg-white px-4 py-3 text-left text-[14px] leading-6 text-[#53657D] shadow-[0_8px_18px_rgba(15,23,42,0.05)] transition-all hover:border-[#0969FF] hover:shadow-[0_10px_24px_rgba(9,105,255,0.10)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              {/* CTA row */}
              <div className="space-y-3">
                {validationMessage && (
                  <p className="text-[14px] font-medium text-red-600">
                    {validationMessage}
                  </p>
                )}
                <div className="flex items-center justify-end">
                  <button
                    className="h-14 min-w-[280px] rounded-[12px] bg-[#0969FF] px-8 text-[17px] font-bold text-white shadow-[0_16px_34px_rgba(9,105,255,0.28)] transition-all hover:bg-[#0757D8] disabled:cursor-not-allowed disabled:bg-[#AFC3DA] disabled:shadow-none"
                    disabled={isStarting || !projectName.trim() || !teamName.trim() || !message.trim()}
                    onClick={startWithGeneralManager}
                  >
                    {isStarting ? 'Starting...' : 'Start governed work →'}
                  </button>
                </div>
                <div className="text-center">
                  <button
                    onClick={skipOnboarding}
                    className="text-[13px] text-[#708198] underline hover:text-[#53657D]"
                  >
                    Skip setup → go to dashboard
                  </button>
                </div>
              </div>
            </div>
          </main>

          {/* Right sidebar — How it works */}
          <aside className="hidden lg:block rounded-[24px] border border-[#E2E8F0] bg-white p-8 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-3 mb-6">
              <svg className="w-5 h-5 text-[#0969FF]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <h2 className="text-[20px] font-bold tracking-[-0.015em] text-[#071A33]">How it works</h2>
            </div>

            <div className="space-y-6">
              {/* Step 1 */}
              <div className="flex items-start gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0969FF] text-sm font-bold text-white shadow-[0_8px_18px_rgba(9,105,255,0.25)]">
                  1
                </div>
                <div>
                  <p className="text-[18px] font-bold leading-6 text-[#071A33]">Describe the work.</p>
                </div>
              </div>

              <div className="flex justify-center">
                <svg className="w-4 h-6 text-[#7C8EA6]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <polyline points="19 12 12 19 5 12"/>
                </svg>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0969FF] text-sm font-bold text-white shadow-[0_8px_18px_rgba(9,105,255,0.25)]">
                  2
                </div>
                <div>
                  <p className="text-[18px] font-bold leading-6 text-[#071A33]">AISync structures your first work path.</p>
                  <div className="mt-3 space-y-2">
                    <div className="rounded-[12px] border border-[#DCE7F5] bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
                      <div className="text-[12px] font-semibold text-[#0B1F3A]">Project</div>
                      <div className="mt-0.5 h-1 w-16 rounded-full bg-[#BFD7FF]"/>
                    </div>
                    <div className="rounded-[12px] border border-[#DCE7F5] bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
                      <div className="flex items-center gap-2">
                        <div className="text-[12px] font-semibold text-[#0B1F3A]">Main AI</div>
                        <span className="rounded bg-[#7C3AED] px-1.5 py-0.5 text-[9px] font-bold text-white">AI</span>
                      </div>
                      <div className="mt-0.5 h-1 w-20 rounded-full bg-[#A78BFA]"/>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <svg className="w-4 h-6 text-[#7C8EA6]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <polyline points="19 12 12 19 5 12"/>
                </svg>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0969FF] text-sm font-bold text-white shadow-[0_8px_18px_rgba(9,105,255,0.25)]">
                  3
                </div>
                <div>
                  <p className="text-[18px] font-bold leading-6 text-[#071A33]">AISync tracks context, checkpoints, and handoffs.</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 rounded-[16px] border border-[#CFE0F5] bg-[#F8FBFF] p-5 shadow-[0_8px_20px_rgba(15,23,42,0.045)]">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 shrink-0 text-[#0969FF]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                  <line x1="9" y1="9" x2="9.01" y2="9"/>
                  <line x1="15" y1="9" x2="15.01" y2="9"/>
                </svg>
                <p className="text-[13px] leading-6 text-[#53657D]">
                  AISync keeps your AI work traceable, recoverable, and ready to continue.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Modal API Key */}
      {showApiKeyModal && (
        <ApiKeyRequiredModal
          onClose={() => setShowApiKeyModal(false)}
          onSuccess={() => {
            setShowApiKeyModal(false)
            startWithGeneralManager()
          }}
        />
      )}
    </>
  )
}
