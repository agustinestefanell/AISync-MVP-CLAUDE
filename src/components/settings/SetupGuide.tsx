'use client'

import { useState } from 'react'

const SECTIONS = [
  {
    name: 'Anthropic',
    label: 'ANTHROPIC (Claude)',
    color: 'text-orange-400',
    dot: 'bg-orange-500',
    steps: [
      'Entrá a console.anthropic.com',
      'Clic en "Get API Key" → "Create API Key"',
      'Copiá la key y pegála acá',
    ],
    cost: 'Por uso, desde $0.003 por 1000 tokens',
  },
  {
    name: 'OpenAI',
    label: 'OPENAI (GPT)',
    color: 'text-green-400',
    dot: 'bg-green-500',
    steps: [
      'Entrá a platform.openai.com',
      'Menú → API Keys → "Create new secret key"',
      'Cargá créditos en Settings → Billing (mínimo $5)',
      'Copiá la key y pegála acá',
    ],
    cost: 'Por uso, desde $0.002 por 1000 tokens',
  },
  {
    name: 'Google',
    label: 'GOOGLE (Gemini)',
    color: 'text-blue-400',
    dot: 'bg-blue-500',
    steps: [
      'Entrá a aistudio.google.com',
      'Clic en "Get API Key" (menú izquierdo)',
      'Copiá la key y pegála acá',
      'Activá billing en console.cloud.google.com → tu proyecto → Billing',
    ],
    cost: 'Google ofrece $300 de crédito gratis para nuevas cuentas',
    note: 'Sin billing activo la API devuelve quota 0 aunque tengas key válida.',
  },
  {
    name: 'Local',
    label: 'IA LOCAL (Ollama / LM Studio)',
    color: 'text-gray-400',
    dot: 'bg-gray-500',
    steps: [
      'Instalá Ollama (ollama.ai) o LM Studio (lmstudio.ai)',
      'Descargá el modelo que querés usar',
      'Copiá la URL local (ej: http://localhost:11434/v1)',
      'Pegála al crear o editar un equipo en Teams Map',
    ],
    cost: 'Cero — corre en tu propia máquina',
  },
]

export default function SetupGuide() {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-gray-700 rounded-xl overflow-hidden">
      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-gray-200">
            ¿Cómo conectar tus agentes de IA?
          </span>
          <span className="text-xs text-gray-600 hidden sm:inline">
            Guía rápida de configuración
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
        <div className="border-t border-gray-800 px-5 py-5 space-y-6 bg-gray-900/40">
          {/* Intro */}
          <p className="text-xs text-gray-400 leading-relaxed max-w-xl">
            AISync te permite trabajar con los modelos de IA que vos elegís.
            La plataforma organiza y gobierna el trabajo — las API keys y el costo de uso son tuyos.
          </p>

          {/* Provider sections */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SECTIONS.map(s => (
              <div
                key={s.name}
                className="bg-gray-800/50 border border-gray-700/60 rounded-lg px-4 py-3 space-y-2"
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
                  {s.steps.map((step, i) => (
                    <li key={i} className="flex gap-2 text-xs text-gray-400 leading-relaxed">
                      <span className="shrink-0 text-gray-600 w-3">{i + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>

                {/* Cost */}
                <p className="text-xs text-gray-600 pt-0.5">
                  <span className="text-gray-500">Costo:</span> {s.cost}
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
            <span className="text-gray-500 font-medium">Nota:</span> AISync nunca almacena tus
            keys en texto plano. Tus datos, tu costo, tu control.
          </p>
        </div>
      )}
    </div>
  )
}
