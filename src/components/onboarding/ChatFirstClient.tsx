'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ApiKeyRequiredModal from './ApiKeyRequiredModal'

const structureItems = [
  { label: 'Project context', value: 'Your first AISync project' },
  {
    label: 'Team base',
    value: 'One General Manager and two workers will be ready.',
  },
  {
    label: 'General Manager',
    value: 'Your entry point for defining and organizing the work.',
  },
  {
    label: 'Worker 1',
    value: 'Available when the work needs execution support.',
  },
  {
    label: 'Worker 2',
    value: 'Available when the work needs documentation support.',
  },
]

export default function ChatFirstClient() {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [validationMessage, setValidationMessage] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)

  const startWithGeneralManager = async () => {
    const initialIntent = message.trim()

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
        body: JSON.stringify({ initialIntent }),
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
      router.push(`/workspace/${workspaceId}`)
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
      <div className="app-page-shell h-full min-h-0 min-w-0 overflow-hidden bg-[#eef2f5] px-2 py-2 sm:px-3 sm:py-3">
        <div className="mx-auto grid h-full min-h-0 w-full max-w-[1600px] gap-3 lg:grid-cols-[240px_minmax(0,1fr)_260px] xl:grid-cols-[260px_minmax(0,1fr)_280px]">
          {/* Left sidebar — project structure info */}
          <aside className="ui-surface hidden min-h-0 overflow-hidden rounded-[16px] border-neutral-200/80 bg-white/72 px-4 py-4 shadow-sm lg:flex lg:flex-col">
            <div>
              <h2 className="text-sm font-semibold tracking-[-0.02em] text-neutral-950">
                Project structure
              </h2>
              <p className="mt-2 text-xs leading-5 text-neutral-600">
                This project is ready to begin. The base team will be created
                automatically, so you do not need to configure the structure
                before starting.
              </p>
            </div>

            <div
              className="mt-5 grid gap-2"
              aria-label="Project structure summary"
            >
              {structureItems.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[10px] border border-neutral-200/80 bg-white/64 px-3 py-3"
                >
                  <div className="text-[11px] font-semibold leading-4 text-neutral-900">
                    {item.label}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-neutral-600">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* Center — main textarea + button */}
          <main className="ui-surface min-h-0 overflow-hidden rounded-[16px] border-neutral-200 bg-white shadow-md shadow-slate-900/10">
            <div className="flex h-full min-h-0 flex-col px-5 py-5 sm:px-8 lg:px-10">
              <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col">
                <div className="shrink-0 pt-1">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-5">
                    <div className="min-w-0">
                      <h1 className="whitespace-nowrap text-[clamp(1.35rem,2.05vw,2.35rem)] font-semibold leading-tight tracking-[-0.035em] text-neutral-950">
                        Start your project with the General Manager
                      </h1>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600 sm:text-base">
                        AISync turns AI-assisted work into structured,
                        traceable, and resumable work. Describe your goal, task,
                        or project context below. The General Manager will open
                        the Main Workspace and organize the first working path
                        for your team.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex min-h-0 flex-1 flex-col rounded-[18px] border border-neutral-200 bg-white p-3 shadow-xl shadow-slate-900/10">
                  <textarea
                    className="min-h-0 flex-1 w-full resize-none rounded-[12px] border-0 bg-[#f8fafc] px-4 py-4 text-base leading-7 text-neutral-900 outline-none placeholder:text-neutral-400"
                    value={message}
                    onChange={(event) => {
                      setMessage(event.target.value)
                      if (validationMessage) {
                        setValidationMessage('')
                      }
                    }}
                    placeholder="Describe your goal, your task, or the context of your project."
                    disabled={isStarting}
                  />
                  <div className="shrink-0 border-t border-neutral-100 px-1 pt-3">
                    {validationMessage ? (
                      <p className="mb-2 text-xs font-medium leading-5 text-red-700">
                        {validationMessage}
                      </p>
                    ) : null}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs leading-5 text-neutral-500">
                        {isStarting
                          ? 'The General Manager is preparing the first step of the project.'
                          : 'You can begin with a rough idea. The full structure does not need to be defined first.'}
                      </p>
                      <button
                        className="ui-button ui-button-primary min-h-11 shrink-0 px-5 text-sm text-white"
                        disabled={isStarting || !message.trim()}
                        onClick={startWithGeneralManager}
                      >
                        {isStarting
                          ? 'Preparing the workspace'
                          : 'Start with the General Manager'}
                      </button>
                    </div>
                    <div className="mt-3 text-center">
                      <button
                        onClick={skipOnboarding}
                        className="text-xs text-neutral-500 underline hover:text-neutral-700"
                      >
                        Skip setup → go to dashboard
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>

          {/* Right sidebar — what happens next */}
          <aside className="ui-surface hidden min-h-0 overflow-hidden rounded-[16px] border-neutral-200/70 bg-white/56 px-4 py-4 shadow-sm lg:block">
            <div className="grid gap-5 text-sm leading-6 text-neutral-600">
              <section>
                <h2 className="text-sm font-semibold tracking-[-0.02em] text-neutral-900">
                  What happens next
                </h2>
                <p className="mt-2">
                  After you describe the objective, the General Manager turns
                  the context into an initial operating path and identifies the
                  next useful action.
                </p>
              </section>
              <section className="border-t border-neutral-200/80 pt-5">
                <h2 className="text-sm font-semibold tracking-[-0.02em] text-neutral-900">
                  How the team supports the work
                </h2>
                <p className="mt-2">
                  The two workers stay in the background until the work needs
                  execution or documentation support.
                </p>
              </section>
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
