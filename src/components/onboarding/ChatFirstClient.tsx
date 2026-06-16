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
      await fetch('/api/onboarding/skip', { method: 'PATCH' })
    } catch {
      // Continue to dashboard even if skip API fails
    }
    router.push('/')
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-[#EEF6FF] via-[#F6F9FD] to-[#F8FAFC] px-10 py-24">
        <div className="mx-auto grid max-w-[1712px] grid-cols-1 gap-6 lg:grid-cols-[365px_918px_365px]">

          {/* LEFT SIDEBAR - Work structure */}
          <aside className="hidden lg:flex flex-col rounded-[24px] border border-[#E2E8F0] bg-white p-8 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            {/* SVG exacto líneas 27-48 del SVG de referencia, coordenadas ajustadas */}
            <svg viewBox="0 0 365 840" className="w-full h-full">
              <text className="font-sans text-[21px] font-bold fill-[#071A33]" x="84" y="54">Work structure</text>
              <circle cx="52" cy="45" r="12" fill="#EAF3FF"/>
              <path d="M44 50c3-8 13-8 16 0M48 39a4 4 0 1 0 8 0" stroke="#0969FF" strokeWidth="2" strokeLinecap="round"/>

              {/* Project node */}
              <rect x="35" y="87" width="290" height="92" rx="16" fill="#FAFCFF" stroke="#BFD7FF"/>
              <circle cx="85" cy="133" r="28" fill="#EAF3FF"/>
              <rect x="70" y="125" width="30" height="22" rx="4" fill="#0969FF"/>
              <path d="M72 123h11l3 4h14" stroke="#60A5FA" strokeWidth="3"/>
              <text className="font-sans text-[16px] font-bold fill-[#0B1F3A]" x="130" y="121">Project</text>
              <text className="font-sans text-[15px] fill-[#53657D]" x="130" y="151">Your governed workspace</text>

              {/* Connector */}
              <line x1="180" y1="179" x2="180" y2="230" stroke="#64748B" strokeWidth="2"/>

              {/* Main AI Session node */}
              <rect x="35" y="230" width="290" height="118" rx="16" fill="#F9F6FF" stroke="#7C3AED" strokeWidth="1.5"/>
              <circle cx="85" cy="289" r="28" fill="#F5F0FF"/>
              <rect x="69" y="275" width="32" height="24" rx="10" fill="#7C3AED"/>
              <circle cx="81" cy="287" r="3" fill="#38BDF8"/>
              <circle cx="91" cy="287" r="3" fill="#38BDF8"/>
              <rect x="284" y="255" width="28" height="22" rx="5" fill="#7C3AED"/>
              <text className="font-sans text-[12px] font-extrabold fill-white" x="290" y="271">AI</text>
              <text className="font-sans text-[16px] font-bold fill-[#0B1F3A]" x="130" y="270">Main AI Session</text>
              <text className="font-sans text-[15px] fill-[#53657D]" x="130" y="301">Structures the main line</text>
              <text className="font-sans text-[15px] fill-[#53657D]" x="130" y="325">of work</text>

              {/* Connector + split */}
              <line x1="180" y1="348" x2="180" y2="406" stroke="#64748B" strokeWidth="2"/>
              <path d="M85 406 V382 Q85 370 97 370 H263 Q275 370 275 382 V406" stroke="#64748B" strokeWidth="2" fill="none"/>

              {/* Research and Review nodes */}
              <rect x="35" y="406" width="290" height="94" rx="16" fill="white" stroke="#DCE7F5"/>
              <circle cx="85" cy="453" r="28" fill="#ECFDF3"/>
              <circle cx="85" cy="442" r="8" fill="#22C55E"/>
              <path d="M69 468c3-13 29-13 32 0" fill="#22C55E"/>
              <circle cx="310" cy="426" r="6" fill="#22C55E"/>
              <text className="font-sans text-[16px] font-bold fill-[#0B1F3A]" x="130" y="439">Research Session</text>
              <text className="font-sans text-[15px] fill-[#53657D]" x="130" y="468">Supports research and</text>
              <text className="font-sans text-[15px] fill-[#53657D]" x="130" y="492">analysis</text>

              <rect x="35" y="546" width="290" height="94" rx="16" fill="white" stroke="#EFE3D0"/>
              <circle cx="85" cy="593" r="28" fill="#FFF7E6"/>
              <circle cx="85" cy="582" r="8" fill="#F59E0B"/>
              <path d="M69 608c3-13 29-13 32 0" fill="#F59E0B"/>
              <circle cx="310" cy="566" r="6" fill="#F59E0B"/>
              <text className="font-sans text-[16px] font-bold fill-[#0B1F3A]" x="130" y="579">Review Session</text>
              <text className="font-sans text-[15px] fill-[#53657D]" x="130" y="608">Supports review and</text>
              <text className="font-sans text-[15px] fill-[#53657D]" x="130" y="632">documentation</text>

              {/* Footer */}
              <rect x="26" y="710" width="310" height="96" rx="16" fill="#F8FBFF" stroke="#CFE0F5"/>
              <text className="font-sans text-[15px] fill-[#53657D]" x="95" y="744">AISync organizes AI sessions while</text>
              <text className="font-sans text-[15px] fill-[#53657D]" x="95" y="768">preserving context, checkpoints,</text>
              <text className="font-sans text-[15px] fill-[#53657D]" x="95" y="792">and traceability.</text>
            </svg>
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

                {/* Robot illustration - SVG exacto líneas 54-59 */}
                <div className="hidden md:block">
                  <svg width="380" height="260" viewBox="650 150 380 260" fill="none">
                    {/* Líneas 54-59 del SVG de referencia EXACTAS */}
                    <circle cx="1160" cy="220" r="76" fill="#EAF3FF"/>
                    <rect x="1100" y="208" width="100" height="96" rx="12" fill="white" stroke="#DCE7F5"/>
                    <line x1="1130" y1="235" x2="1175" y2="235" stroke="#CBD5E1" strokeWidth="5" strokeLinecap="round"/>
                    <line x1="1130" y1="260" x2="1170" y2="260" stroke="#CBD5E1" strokeWidth="5" strokeLinecap="round"/>
                    <circle cx="1117" cy="234" r="7" fill="#0969FF"/>
                    <path d="M1114 234l2 2 4-5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    <rect x="1034" y="205" width="62" height="48" rx="18" fill="#071A33"/>
                    <circle cx="1055" cy="229" r="5" fill="#38BDF8"/>
                    <circle cx="1076" cy="229" r="5" fill="#38BDF8"/>
                    <path d="M1018 304c6-45 18-70 47-70s41 25 47 70" stroke="#38BDF8" strokeWidth="3" fill="none"/>
                    <circle cx="1215" cy="185" r="20" fill="#22C55E"/>
                    <path d="M1207 184l6 6 12-14" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
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
                  disabled={isStarting}
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
            {/* SVG exacto líneas 76-86 del SVG de referencia */}
            <svg viewBox="0 0 365 840" className="w-full h-full">
              <text className="font-sans text-[21px] font-bold fill-[#071A33]" x="84" y="54">How it works</text>
              <circle cx="53" cy="45" r="12" fill="#EAF3FF"/>
              <path d="M53 33l2 8 8 2-8 2-2 8-2-8-8-2 8-2 2-8z" fill="#0969FF"/>

              {/* Step 1 */}
              <circle cx="53" cy="134" r="18" fill="#0969FF"/>
              <text className="font-sans text-[15px] font-extrabold fill-white" x="48" y="140">1</text>
              <text className="font-sans text-[18px] font-bold fill-[#071A33]" x="91" y="141">Describe the work.</text>

              {/* Mini card step 1 - línea 79 */}
              <rect x="79" y="174" width="205" height="70" rx="12" fill="white" stroke="#7C3AED" strokeWidth="1.5"/>
              <line x1="114" y1="202" x2="179" y2="202" stroke="#CBD5E1" strokeWidth="4"/>
              <line x1="114" y1="222" x2="207" y2="222" stroke="#CBD5E1" strokeWidth="4"/>

              {/* Arrow */}
              <text x="145" y="294" fontSize="42" fill="#7C8EA6">↓</text>

              {/* Step 2 */}
              <circle cx="53" cy="324" r="18" fill="#0969FF"/>
              <text className="font-sans text-[15px] font-extrabold fill-white" x="48" y="330">2</text>
              <text className="font-sans text-[18px] font-bold fill-[#071A33]" x="91" y="320">AISync structures your</text>
              <text className="font-sans text-[18px] font-bold fill-[#071A33]" x="91" y="346">first work path.</text>

              {/* Mini card step 2 - línea 82 EXACTA */}
              <rect x="79" y="404" width="205" height="70" rx="12" fill="white" stroke="#DCE7F5"/>
              <circle cx="119" cy="439" r="13" fill="#7C3AED"/>
              <line x1="149" y1="439" x2="231" y2="439" stroke="#7C3AED" strokeWidth="4" strokeLinecap="round"/>
              <path d="M241 424v32l28-16-28-16z" fill="#22C55E"/>

              {/* Arrow */}
              <text x="145" y="519" fontSize="42" fill="#7C8EA6">↓</text>

              {/* Step 3 */}
              <circle cx="53" cy="549" r="18" fill="#0969FF"/>
              <text className="font-sans text-[15px] font-extrabold fill-white" x="48" y="555">3</text>
              <text className="font-sans text-[18px] font-bold fill-[#071A33]" x="91" y="542">AISync tracks context,</text>
              <text className="font-sans text-[18px] font-bold fill-[#071A33]" x="91" y="568">checkpoints, and handoffs.</text>

              {/* Footer */}
              <rect x="31" y="724" width="300" height="96" rx="16" fill="#F8FBFF" stroke="#CFE0F5"/>
              <text className="font-sans text-[15px] fill-[#53657D]" x="119" y="754">AISync keeps your AI work</text>
              <text className="font-sans text-[15px] fill-[#53657D]" x="119" y="778">traceable, recoverable, and</text>
              <text className="font-sans text-[15px] fill-[#53657D]" x="119" y="802">ready to continue.</text>
            </svg>
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
