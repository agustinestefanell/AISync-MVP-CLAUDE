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

    try {
      const keysRes = await fetch('/api/settings/keys')
      const keys = await keysRes.json()

      if (!Array.isArray(keys) || keys.length === 0) {
        setShowApiKeyModal(true)
        setIsStarting(false)
        return
      }

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
      // Silently fail
    }
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-[#EEF6FF] via-[#F6F9FD] to-[#F8FAFC] px-10 py-24">
        <div className="mx-auto grid max-w-[1712px] grid-cols-1 gap-6 lg:grid-cols-[365px_918px_365px]">

          {/* LEFT SIDEBAR - Work structure */}
          <aside className="hidden lg:flex flex-col rounded-[24px] border border-[#E2E8F0] bg-white p-8 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EAF3FF]">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 6c3-8 13-8 16 0M8 5a4 4 0 1 0 8 0" stroke="#0969FF" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h2 className="text-[21px] font-bold leading-7 text-[#071A33]">Work structure</h2>
            </div>

            <div className="flex-1 space-y-4">
              {/* Project node */}
              <div className="rounded-[16px] border border-[#BFD7FF] bg-[#FAFCFF] p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#EAF3FF]">
                    <svg width="30" height="22" viewBox="0 0 30 22" fill="none">
                      <rect x="2" y="2" width="26" height="18" rx="4" fill="#0969FF"/>
                      <path d="M4 0h8l3 4h11" stroke="#60A5FA" strokeWidth="3"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-[16px] font-bold leading-[22px] text-[#0B1F3A]">Project</div>
                    <div className="mt-1 text-[15px] leading-6 text-[#53657D]">Your governed workspace</div>
                  </div>
                </div>
              </div>

              {/* Connector */}
              <div className="mx-auto h-12 w-0.5 bg-[#64748B]"/>

              {/* Main AI Session node */}
              <div className="rounded-[16px] border-[1.5px] border-[#7C3AED] bg-[#F9F6FF] p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#F5F0FF]">
                    <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#7C3AED]">
                      <div className="flex gap-2.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-[#38BDF8]"/>
                        <div className="h-1.5 w-1.5 rounded-full bg-[#38BDF8]"/>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-[16px] font-bold leading-[22px] text-[#0B1F3A]">Main AI Session</div>
                      <span className="rounded-md bg-[#7C3AED] px-2 py-1 text-[12px] font-extrabold leading-none text-white">AI</span>
                    </div>
                    <div className="mt-1 text-[15px] leading-6 text-[#53657D]">Structures the main line of work</div>
                  </div>
                </div>
              </div>

              {/* Split connector */}
              <div className="mx-auto h-14 w-0.5 bg-[#64748B]"/>
              <svg className="mx-auto -my-2" width="290" height="48" viewBox="0 0 290 48">
                <path d="M145 0 V12 Q145 24 157 24 H283 Q295 24 295 36 V48" stroke="#64748B" strokeWidth="2" fill="none"/>
                <path d="M145 0 V12 Q145 24 133 24 H12 Q0 24 0 36 V48" stroke="#64748B" strokeWidth="2" fill="none"/>
              </svg>

              {/* Research and Review nodes in grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Research Session */}
                <div className="rounded-[16px] border border-[#DCE7F5] bg-white p-4">
                  <div className="flex flex-col items-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ECFDF3]">
                      <svg width="16" height="26" fill="#22C55E">
                        <circle cx="8" cy="8" r="8"/>
                        <path d="M1 26c3-13 29-13 32 0" transform="translate(-8 0)"/>
                      </svg>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-[#22C55E]"/>
                      <div className="text-[16px] font-bold text-[#0B1F3A]">Research</div>
                    </div>
                    <div className="mt-1 text-[15px] leading-6 text-[#53657D]">Supports research and analysis</div>
                  </div>
                </div>

                {/* Review Session */}
                <div className="rounded-[16px] border border-[#EFE3D0] bg-white p-4">
                  <div className="flex flex-col items-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF7E6]">
                      <svg width="16" height="26" fill="#F59E0B">
                        <circle cx="8" cy="8" r="8"/>
                        <path d="M1 26c3-13 29-13 32 0" transform="translate(-8 0)"/>
                      </svg>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-[#F59E0B]"/>
                      <div className="text-[16px] font-bold text-[#0B1F3A]">Review</div>
                    </div>
                    <div className="mt-1 text-[15px] leading-6 text-[#53657D]">Supports review and documentation</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 rounded-[16px] border border-[#CFE0F5] bg-[#F8FBFF] p-5">
              <p className="text-[15px] leading-6 text-[#53657D]">
                AISync organizes AI sessions while preserving context, checkpoints, and traceability.
              </p>
            </div>
          </aside>

          {/* CENTER PANEL */}
          <main className="rounded-[24px] border border-[#E2E8F0] bg-white px-12 py-10 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <div className="mx-auto w-full space-y-8">

              {/* Hero + Illustration */}
              <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-8 items-start">
                <div>
                  <h1 className="text-[44px] font-extrabold leading-[50px] tracking-[-0.035em] text-[#071A33]">
                    Start your AI work in a structured, traceable way
                  </h1>
                  <p className="mt-6 text-[17px] leading-7 text-[#53657D]">
                    Describe the work you want to structure. AISync helps you organize AI sessions, preserve context, and keep work traceable from the start.
                  </p>
                </div>

                {/* Illustration */}
                <div className="hidden md:flex justify-center items-start pt-4">
                  <svg width="280" height="200" viewBox="0 0 280 200" fill="none">
                    {/* Background circle */}
                    <circle cx="140" cy="100" r="76" fill="#EAF3FF"/>

                    {/* Checklist card */}
                    <rect x="80" y="88" width="100" height="96" rx="12" fill="white" stroke="#DCE7F5" strokeWidth="1.5"/>
                    <line x1="110" y1="115" x2="155" y2="115" stroke="#CBD5E1" strokeWidth="5" strokeLinecap="round"/>
                    <line x1="110" y1="140" x2="150" y2="140" stroke="#CBD5E1" strokeWidth="5" strokeLinecap="round"/>
                    <circle cx="97" cy="114" r="7" fill="#0969FF"/>
                    <path d="M94 114l2 2 4-5" stroke="white" strokeWidth="2" strokeLinecap="round"/>

                    {/* Robot head */}
                    <rect x="14" y="85" width="62" height="48" rx="18" fill="#071A33"/>
                    <circle cx="35" cy="109" r="5" fill="#38BDF8"/>
                    <circle cx="56" cy="109" r="5" fill="#38BDF8"/>

                    {/* Orbit path */}
                    <path d="M-2 184c6-45 18-70 47-70s41 25 47 70" stroke="#38BDF8" strokeWidth="3" fill="none"/>

                    {/* Checkmark badge */}
                    <circle cx="195" cy="65" r="20" fill="#22C55E"/>
                    <path d="M187 64l6 6 12-14" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              {/* Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="project-name" className="mb-2 block text-[13px] font-semibold leading-[18px] text-[#0B1F3A]">
                    Project name
                  </label>
                  <input
                    id="project-name"
                    type="text"
                    value={projectName}
                    onChange={(e) => {
                      setProjectName(e.target.value)
                      if (validationMessage) setValidationMessage('')
                    }}
                    placeholder="My First Project"
                    disabled={isStarting}
                    className="h-[52px] w-full rounded-[12px] border border-[#CFE0F5] bg-white px-4 text-[17px] text-[#071A33] placeholder:text-[#7C8EA6] focus:border-[#0969FF] focus:outline-none focus:ring-2 focus:ring-[#0969FF]/20"
                  />
                </div>
                <div>
                  <label htmlFor="team-name" className="mb-2 block text-[13px] font-semibold leading-[18px] text-[#0B1F3A]">
                    Team name
                  </label>
                  <input
                    id="team-name"
                    type="text"
                    value={teamName}
                    onChange={(e) => {
                      setTeamName(e.target.value)
                      if (validationMessage) setValidationMessage('')
                    }}
                    placeholder="My First Team"
                    disabled={isStarting}
                    className="h-[52px] w-full rounded-[12px] border border-[#CFE0F5] bg-white px-4 text-[17px] text-[#071A33] placeholder:text-[#7C8EA6] focus:border-[#0969FF] focus:outline-none focus:ring-2 focus:ring-[#0969FF]/20"
                  />
                  <p className="mt-2 text-[13px] text-[#708198]">You can edit this later</p>
                </div>
              </div>

              {/* Textarea */}
              <div>
                <textarea
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value)
                    if (validationMessage) setValidationMessage('')
                  }}
                  placeholder="Describe the task, decision, document, or workflow you want AISync to structure and track..."
                  disabled={isStarting}
                  className="min-h-[190px] w-full resize-none rounded-[16px] border-[1.5px] border-[#0969FF] bg-white p-6 text-[18px] leading-8 text-[#071A33] placeholder:text-[#53657D] focus:border-[#0969FF] focus:outline-none focus:ring-2 focus:ring-[#0969FF]/20"
                />
              </div>

              {/* Examples */}
              <div>
                <p className="mb-3 text-[13px] font-semibold leading-[18px] text-[#0B1F3A]">Try an example</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {EXAMPLE_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => setMessage(prompt)}
                      disabled={isStarting}
                      className="h-[60px] rounded-[12px] border border-[#CFE0F5] bg-white px-4 text-left text-[16px] font-bold text-[#0B1F3A] transition-all hover:border-[#0969FF] hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="flex flex-col items-end gap-3">
                {validationMessage && (
                  <p className="w-full text-[14px] font-medium text-red-600">{validationMessage}</p>
                )}
                <button
                  onClick={startWithGeneralManager}
                  disabled={isStarting || !projectName.trim() || !teamName.trim() || !message.trim()}
                  className="h-[60px] min-w-[288px] rounded-[12px] bg-[#0969FF] px-8 text-[18px] font-bold text-white shadow-lg transition-all hover:bg-[#0757D8] disabled:cursor-not-allowed disabled:bg-[#AFC3DA] disabled:shadow-none"
                >
                  {isStarting ? 'Starting...' : 'Start governed work →'}
                </button>
                <button
                  onClick={skipOnboarding}
                  className="text-[13px] text-[#708198] underline hover:text-[#53657D]"
                >
                  Skip setup → go to dashboard
                </button>
              </div>
            </div>
          </main>

          {/* RIGHT SIDEBAR - How it works */}
          <aside className="hidden lg:flex flex-col rounded-[24px] border border-[#E2E8F0] bg-white p-8 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EAF3FF]">
                <svg width="16" height="16" fill="#0969FF">
                  <path d="M8 1l2 8 8 2-8 2-2 8-2-8-8-2 8-2 2-8z"/>
                </svg>
              </div>
              <h2 className="text-[21px] font-bold leading-7 text-[#071A33]">How it works</h2>
            </div>

            <div className="flex-1 space-y-6">
              {/* Step 1 */}
              <div className="flex items-start gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0969FF] text-[15px] font-extrabold text-white shadow-md">
                  1
                </div>
                <p className="pt-1 text-[18px] font-bold leading-6 text-[#071A33]">Describe the work.</p>
              </div>

              {/* Mini card step 1 */}
              <div className="ml-12 rounded-[12px] border-[1.5px] border-[#7C3AED] bg-white p-4">
                <div className="space-y-2">
                  <div className="h-1 w-16 rounded-full bg-[#CBD5E1]"/>
                  <div className="h-1 w-24 rounded-full bg-[#CBD5E1]"/>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center text-[42px] leading-none text-[#7C8EA6]">↓</div>

              {/* Step 2 */}
              <div className="flex items-start gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0969FF] text-[15px] font-extrabold text-white shadow-md">
                  2
                </div>
                <div>
                  <p className="text-[18px] font-bold leading-6 text-[#071A33]">AISync structures your first work path.</p>
                </div>
              </div>

              {/* Mini card step 2 - Path visual */}
              <div className="ml-12 rounded-[12px] border border-[#DCE7F5] bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-[#7C3AED]"/>
                  <div className="h-0.5 flex-1 rounded-full bg-[#7C3AED]"/>
                  <div className="relative h-8 w-8">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-0 w-0 border-y-8 border-l-16 border-y-transparent border-l-[#22C55E]"/>
                    </div>
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center text-[42px] leading-none text-[#7C8EA6]">↓</div>

              {/* Step 3 */}
              <div className="flex items-start gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0969FF] text-[15px] font-extrabold text-white shadow-md">
                  3
                </div>
                <div>
                  <p className="text-[18px] font-bold leading-6 text-[#071A33]">AISync tracks context, checkpoints, and handoffs.</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 rounded-[16px] border border-[#CFE0F5] bg-[#F8FBFF] p-5">
              <p className="text-[15px] leading-6 text-[#53657D]">
                AISync keeps your AI work traceable, recoverable, and ready to continue.
              </p>
            </div>
          </aside>
        </div>
      </div>

      {/* Modal */}
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
