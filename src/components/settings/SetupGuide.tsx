'use client'

import { useState } from 'react'

type Step = string | {
  text: string
  link: string
  linkText: string
  suffix?: string
  link2?: string
  linkText2?: string
}

const SECTIONS = [
  {
    name: 'Anthropic',
    label: 'ANTHROPIC (Claude)',
    color: 'text-orange-400',
    dot: 'bg-orange-500',
    steps: [
      { text: 'Go to ', link: 'https://console.anthropic.com', linkText: 'console.anthropic.com' },
      'Click "Get API Key" → "Create API Key"',
      'Copy the key and paste it here',
    ],
    cost: 'Pay as you go, starting at $0.003 per 1000 tokens',
  },
  {
    name: 'OpenAI',
    label: 'OPENAI (GPT)',
    color: 'text-green-400',
    dot: 'bg-green-500',
    steps: [
      { text: 'Go to ', link: 'https://platform.openai.com', linkText: 'platform.openai.com' },
      'Menu → API Keys → "Create new secret key"',
      'Add credits in Settings → Billing (minimum $5)',
      'Copy the key and paste it here',
    ],
    cost: 'Pay as you go, starting at $0.002 per 1000 tokens',
  },
  {
    name: 'Google',
    label: 'GOOGLE (Gemini)',
    color: 'text-blue-400',
    dot: 'bg-blue-500',
    steps: [
      { text: 'Go to ', link: 'https://aistudio.google.com', linkText: 'aistudio.google.com' },
      'Click "Get API Key" (left menu)',
      'Copy the key and paste it here',
      { text: 'Activate billing at ', link: 'https://console.cloud.google.com', linkText: 'console.cloud.google.com', suffix: ' → your project → Billing' },
    ],
    cost: 'Google offers $300 free credit for new accounts',
    note: 'Without active billing, the API returns quota 0 even if you have a valid key.',
  },
  {
    name: 'Local',
    label: 'LOCAL AI (Ollama / LM Studio)',
    color: 'text-gray-400',
    dot: 'bg-gray-500',
    steps: [
      { text: 'Install ', link: 'https://ollama.ai', linkText: 'Ollama', suffix: ' or ', link2: 'https://lmstudio.ai', linkText2: 'LM Studio' },
      'Download the model you want to use',
      'Copy the local URL (e.g. http://localhost:11434/v1)',
      'Paste it when creating or editing a team in Teams Map',
    ],
    cost: 'Free — runs on your own machine',
  },
]

export default function SetupGuide() {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-gray-800">
            How to connect your AI agents?
          </span>
          <span className="text-xs text-gray-600 hidden sm:inline">
            Quick setup guide
          </span>
        </div>
        <span
          className={`text-gray-500 text-lg leading-none transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        >
          ↓
        </span>
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-gray-800 px-5 py-5 space-y-6 bg-white/40">
          {/* Intro */}
          <p className="text-xs text-gray-400 leading-relaxed max-w-xl">
            AISync lets you work with the AI models you choose.
            The platform organizes and governs the work — the API keys and usage costs are yours.
          </p>

          {/* Provider sections */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SECTIONS.map(s => (
              <div
                key={s.name}
                className="bg-gray-50/50 border border-gray-200/60 rounded-lg px-4 py-3 space-y-2"
              >
                {/* Header */}
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                  <span className={`text-xs font-bold tracking-wide ${s.color}`}>
                    {s.label}
                  </span>
                </div>

                {/* Steps */}
                <ol className="space-y-1">
                  {s.steps.map((step: Step, i: number) => (
                    <li key={i} className="flex gap-2 text-xs text-gray-400 leading-relaxed">
                      <span className="shrink-0 text-gray-600 w-3">{i + 1}.</span>
                      {typeof step === 'string' ? (
                        <span>{step}</span>
                      ) : (
                        <span>
                          {step.text}
                          <a
                            href={step.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-400 underline"
                          >
                            {step.linkText}
                          </a>
                          {step.link2 && step.linkText2 && (
                            <>
                              {step.suffix || ''}
                              <a
                                href={step.link2}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-400 underline"
                              >
                                {step.linkText2}
                              </a>
                            </>
                          )}
                          {!step.link2 && step.suffix}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>

                {/* Cost */}
                <p className="text-xs text-gray-600 pt-0.5">
                  <span className="text-gray-500">Cost:</span> {s.cost}
                </p>

                {/* Nota adicional (ej. billing de Google) */}
                {'note' in s && s.note && (
                  <p className="text-xs text-amber-600/80 bg-amber-950/30 border border-amber-900/40 rounded px-2 py-1 leading-relaxed">
                    ⚠ {s.note}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Footer note */}
          <p className="text-xs text-gray-600 border-t border-gray-800 pt-4 leading-relaxed">
            <span className="text-gray-500 font-medium">Note:</span> AISync never stores your
            keys in plain text. Your data, your cost, your control.
          </p>
        </div>
      )}
    </div>
  )
}
