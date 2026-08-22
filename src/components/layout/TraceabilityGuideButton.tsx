'use client'

import { useState } from 'react'

const TRACEABILITY_GUIDE = `Esta es la parte más importante de esta plataforma. Vas a ver los verdaderos beneficios en el mediano y largo plazo, cuando el trabajo se acumule y necesites recuperar material valioso de sesiones anteriores.

Audit Log — Registra todo lo que hacés, el 100%. Es tu punto de entrada para encontrar cualquier momento anterior de trabajo y volver a él: qué pasó, cuándo, y con quién.

Documentation Mode — Una única base de conocimiento, con cinco formas de verla:

- Repository — Buscar y abrir. Imaginá que necesitás encontrar ese Checkpoint de hace dos semanas de un proyecto puntual: filtrás por proyecto, equipo, tipo y fecha, y lo encontrás en segundos.
- User Library — Organizá tu material guardado con tags propios. Imaginá que guardaste varias Save Selections de distintas sesiones sobre un mismo cliente o tema: les asignás los mismos tags al guardarlas, y después las encontrás todas juntas haciendo click en ese tag — sin carpetas fijas, con la organización que vos elijas.
- Audit — Documento + evento + traza. Imaginá que querés saber qué pasó con un Checkpoint específico: quién lo creó, cuándo se bloqueó, qué eventos tuvo — lo filtrás por estado, tipo de evento, equipo y fecha.
- Investigate — Seguí un tema a lo largo del tiempo. Imaginá que querés ver cómo evolucionó un trabajo a través de varias sesiones: buscás por el foco de tu investigación y ves la cronología de Checkpoints y Selecciones relacionadas.
- Knowledge Map (en desarrollo) — Relaciones entre lo que fuiste guardando. Hoy conecta Proyectos, Equipos, Workspaces y Checkpoints; se irán sumando más relaciones con el tiempo.

Review & Forward — Cada interacción entre agentes que hagas con Review & Forward también queda registrada. Esto te permite rastrear líneas de pensamiento entre el usuario y los agentes, con orden.

Load Saved Context — Te permite recuperar material guardado (Save Selection, Handoff Package o Checkpoint) y volcarlo tanto al chat como a Context Files. Muy útil para reutilizar material valioso producido en sesiones anteriores. Contás con filtros (proyecto, equipo, tipo, fecha, y búsqueda por palabra clave) para encontrar la información fácilmente.

+ Add Context File — Subí un archivo (PDF, Word, Excel, PowerPoint, CSV, texto, entre otros) para que quede disponible como contexto. Por ejemplo: subís un contrato en PDF y elegís que quede disponible para todo el Team — a partir de ahí, cualquier agente de ese equipo puede usarlo como referencia, no solo el que lo subió.

+ Prompt Library — Acá podés generar tu biblioteca de Prompts. Quedan disponibles para ser aplicados desde el Workspace, tanto a un agente puntual como a todo el equipo, permitiéndote personalizar la forma de trabajo de forma sistemática y ordenada.

El principio detrás de todo esto: la metadata estructural — quién, cuándo, de qué proyecto, de dónde viene — se captura automáticamente. Los tags te ayudan a encontrar cosas más rápido, pero nunca son la fuente de verdad. Nada depende de que vos te acuerdes de documentar bien.`

// Títulos de sección que se estilizan como pill dentro del modal — mismo
// look que el botón del ribbon (rounded-lg, border, px-3 py-1.5, text-[11px]
// font-semibold tracking-wide), ver handoff-2026-07-b.md 2026-08-17.
const SECTION_TITLES = [
  'Audit Log',
  'Documentation Mode',
  'Review & Forward',
  'Load Saved Context',
  '+ Add Context File',
  '+ Prompt Library',
]

const GUIDE_PARAGRAPHS = TRACEABILITY_GUIDE.split('\n\n').map(paragraph => {
  const title = SECTION_TITLES.find(t => paragraph.startsWith(`${t} — `))
  if (!title) return { title: null, body: paragraph }
  return { title, body: paragraph.slice(title.length + 3) }
})

// Botón + modal educativo, montado vía TopRibbon.rightBadge en Workspace,
// Audit Log y Documentation Mode — un único componente reutilizado en los
// 3 ribbons (ver handoff-2026-07-b.md 2026-08-12).
export default function TraceabilityGuideButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg px-3 py-1.5 text-[11px] font-semibold tracking-wide border transition-colors"
        style={{ background: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.4)', color: '#ffffff' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.26)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)' }}
      >
        How Traceability Works
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div
            className="bg-white border border-gray-200 rounded-2xl w-full max-w-2xl mx-4 shadow-2xl flex flex-col"
            style={{ maxHeight: '85vh' }}
          >
            <div className="px-6 py-5 border-b border-[var(--color-border-default)] flex items-start justify-between gap-4 shrink-0">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                How Traceability Works — What Gets Saved, and How
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm px-1 transition-colors shrink-0"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto space-y-4">
              {GUIDE_PARAGRAPHS.map((p, i) => p.title ? (
                <div key={i}>
                  <span
                    className="inline-block rounded-lg px-3 py-1.5 text-[11px] font-semibold tracking-wide border mb-2"
                    style={{ background: 'var(--color-accent)', borderColor: 'var(--color-accent)', color: '#ffffff' }}
                  >
                    {p.title}
                  </span>
                  <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line">
                    {p.body}
                  </p>
                </div>
              ) : (
                <p key={i} className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line">
                  {p.body}
                </p>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end shrink-0">
              <button
                onClick={() => setOpen(false)}
                className="text-sm bg-gray-900 hover:bg-gray-700 text-white font-medium px-5 py-2 rounded-lg transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
