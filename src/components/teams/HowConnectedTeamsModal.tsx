'use client'

type Section = { title: string; body: string }

const SECTIONS: Section[] = [
  {
    title: 'What is a Connected Team.',
    body: 'A Connected Team is a link between one of your teams and a team that belongs to another AISync account. Each side keeps its own structure, its own workspaces, and its own agents. The connection creates a channel between the two teams — specifically between their `Situation Managers` — without merging the accounts or sharing any internal content.',
  },
  {
    title: 'How to connect.',
    body: 'Go to the Dashboard and click `+ Connect`. Choose which of your teams will host the connection, then enter the email of the external account you want to connect with. AISync sends a connection request to that account. Nothing becomes active until the other side accepts.',
  },
  {
    title: 'How the other side accepts.',
    body: 'When another account receives your request, a red badge appears on the `Requests` button in their Dashboard. They click it, see the incoming request, choose which of their teams accepts it, and confirm. The connection becomes active immediately after they accept.',
  },
  {
    title: 'What an active connection means.',
    body: 'Once active, the connection appears in the `Connected Teams` panel on your Dashboard. The connected team also appears as an external node in your Teams Map, marked with the `↔ EXTERNAL` badge. The two Situation Managers can exchange messages through the SM↔SM channel.',
  },
  {
    title: 'How to disconnect.',
    body: 'Click `Disconnect` next to any active connection in the Dashboard and confirm when prompted. The connection is removed immediately. Either side can disconnect at any time. A new request is required to reconnect.',
  },
  {
    title: 'Current scope.',
    body: 'Connected Teams at this stage support `project-bound` connections with `no shared repository`. The two Situation Managers can exchange messages. Persistent partner connections and shared project repositories are planned for a future version.',
  },
]

const SUMMARY = [
  { action: 'Send a connection request', where: 'Dashboard → + Connect',       result: 'Request sent to external account' },
  { action: 'Accept a request',          where: 'Dashboard → Requests',         result: 'Connection becomes active' },
  { action: 'View active connections',   where: 'Dashboard → Connected Teams',  result: 'Cards with partner team info' },
  { action: 'See connection in map',     where: 'Teams → Teams Map',            result: 'External node with ↔ EXTERNAL badge' },
  { action: 'Disconnect',               where: 'Dashboard → Disconnect',        result: 'Connection removed immediately' },
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
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-2xl mx-4 shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">How Connected Teams Work</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Cross-account team connections in AISync</p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm px-2">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[65vh]">
          {SECTIONS.map(s => (
            <p key={s.title} className="text-sm leading-6 text-gray-700">
              <strong className="font-semibold text-gray-900">{s.title}</strong>{' '}
              {renderText(s.body)}
            </p>
          ))}

          {/* Summary table */}
          <div className="pt-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick reference</p>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-2.5 font-semibold text-gray-600 w-[30%]">Action</th>
                    <th className="px-4 py-2.5 font-semibold text-gray-600 w-[35%]">Where</th>
                    <th className="px-4 py-2.5 font-semibold text-gray-600">What happens</th>
                  </tr>
                </thead>
                <tbody>
                  {SUMMARY.map((row, i) => (
                    <tr key={row.action} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                      <td className="px-4 py-2.5 text-gray-800 font-medium">{row.action}</td>
                      <td className="px-4 py-2.5 text-gray-500 font-mono">{row.where}</td>
                      <td className="px-4 py-2.5 text-gray-600">{row.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
