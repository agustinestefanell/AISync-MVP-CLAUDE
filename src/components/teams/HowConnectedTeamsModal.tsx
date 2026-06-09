'use client'

type Section = { title: string; body: string }

const SECTIONS: Section[] = [
  {
    title: 'What Connected Teams are.',
    body: 'Connected Teams are cross-account connections between teams. Each team belongs to a different AISync account. When two teams are connected, their Situation Managers can exchange messages through a dedicated SM↔SM channel.',
  },
  {
    title: 'How to connect.',
    body: 'Click `+ Connect`, choose which of your teams will host the connection, and enter the email of the partner account. AISync sends a connection request to that account. The connection becomes active once they accept.',
  },
  {
    title: 'How to accept a request.',
    body: 'When another account sends you a connection request, a red badge appears on the `Requests` button. Click it to see incoming requests, choose which of your teams accepts the connection, and confirm. The connection becomes active immediately.',
  },
  {
    title: 'What happens when connected.',
    body: 'Active connections appear in this panel. Each card shows the partner team name, their account email, and the direction of the connection (`outgoing` if you initiated it, `incoming` if they did). Use `Open →` to go to your Teams page and work through the connection.',
  },
  {
    title: 'How to disconnect.',
    body: 'Click `Disconnect` next to any active connection and confirm. The connection is removed immediately. Either side can disconnect at any time. A new request is required to reconnect.',
  },
]

function renderText(text: string) {
  return text.split(/(`[^`]+`)/g).map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="rounded bg-gray-100 px-1.5 py-0.5 text-[0.92em] text-gray-800 font-mono">
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}

export default function HowConnectedTeamsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg mx-4 shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">How Connected Teams work</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Cross-account team connections in AISync</p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm px-2">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[60vh]">
          {SECTIONS.map(s => (
            <p key={s.title} className="text-sm leading-6 text-gray-700">
              <strong className="font-semibold text-gray-900">{s.title}</strong>{' '}
              {renderText(s.body)}
            </p>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="text-sm bg-gray-900 hover:bg-gray-700 text-white font-medium px-5 py-2 rounded-lg transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
