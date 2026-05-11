'use client'

import type { SMCheckpoint } from './SMPanel'

interface Props {
  results:  SMCheckpoint[]
  onSelect: (id: string) => void
  onClose:  () => void
}

export default function SMDisambiguationModal({ results, onSelect, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl mx-4 shadow-2xl flex flex-col max-h-[80vh]">

        {/* Header */}
        <div className="shrink-0 px-6 py-4 border-b border-gray-800 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-white">Multiple results found</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {results.length > 50
                ? `Showing 50 of ${results.length} results — select one to open`
                : 'Select one to open'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-sm px-2 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-900 border-b border-gray-800 z-10">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-semibold uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-gray-500 font-semibold uppercase tracking-wider">Team</th>
                <th className="text-left px-4 py-3 text-gray-500 font-semibold uppercase tracking-wider">Workspace</th>
                <th className="text-left px-4 py-3 text-gray-500 font-semibold uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-gray-500 font-semibold uppercase tracking-wider">Purpose</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {results.slice(0, 50).map(r => (
                <tr key={r.id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="px-4 py-3 text-white font-medium max-w-[200px]">
                    <span className="block truncate" title={r.name}>{r.name}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{r.team ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{r.workspace ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.date ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{r.purpose ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { onSelect(r.id); onClose() }}
                      className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
