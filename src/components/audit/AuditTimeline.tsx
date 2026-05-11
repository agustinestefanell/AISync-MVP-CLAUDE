'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { AuditEventRow } from '@/lib/db/audit'

interface CheckpointMsg {
  session_id: string
  role: 'user' | 'assistant'
  content: string
  position: number
  agent_sessions: { agent_role: string; provider: string; model: string } | null
}

const EVENT_CONFIG: Record<string, {
  label: string
  dotColor: string
  badgeClass: string
}> = {
  save_version:   { label: 'Checkpoint guardado',    dotColor: 'bg-green-500',  badgeClass: 'text-green-400 bg-green-950 border-green-900' },
  session_backup: { label: 'Session Backup',          dotColor: 'bg-blue-500',   badgeClass: 'text-blue-400 bg-blue-950 border-blue-900' },
  resume_work:    { label: 'Resume Work',             dotColor: 'bg-indigo-500', badgeClass: 'text-indigo-400 bg-indigo-950 border-indigo-900' },
  lock:           { label: 'Workspace bloqueado',     dotColor: 'bg-red-500',    badgeClass: 'text-red-400 bg-red-950 border-red-900' },
  unlock:         { label: 'Workspace desbloqueado',  dotColor: 'bg-gray-500',   badgeClass: 'text-gray-400 bg-gray-800 border-gray-700' },
  review_forward: { label: 'Review & Forward',        dotColor: 'bg-purple-500', badgeClass: 'text-purple-400 bg-purple-950 border-purple-900' },
}

const AGENT_LABEL: Record<string, string> = {
  manager: 'Manager',
  worker1: 'Worker 1',
  worker2: 'Worker 2',
}

function hasCheckpoint(e: AuditEventRow) {
  return (e.event_type === 'save_version' || e.event_type === 'resume_work') &&
    !!e.metadata?.checkpoint_id
}

function eventTitle(e: AuditEventRow): string {
  const m = e.metadata ?? {}
  switch (e.event_type) {
    case 'save_version':   return (m.name as string) ?? 'Checkpoint sin nombre'
    case 'session_backup': return 'Backup descargado'
    case 'resume_work':    return `Retomó "${(m.name as string) ?? 'checkpoint'}"`
    case 'lock':           return 'Workspace bloqueado'
    case 'unlock':         return 'Workspace desbloqueado'
    case 'review_forward': return `Reenviado a ${(m.to_agent as string) ?? 'agente'}`
    default:               return e.event_type
  }
}

function eventDetail(e: AuditEventRow): string | null {
  const m = e.metadata ?? {}
  switch (e.event_type) {
    case 'save_version':   return [m.purpose, `${m.message_count ?? 0} mensajes`].filter(Boolean).join(' · ')
    case 'session_backup': return `${m.total_messages ?? 0} mensajes exportados`
    case 'review_forward': return `${m.message_count ?? ''} mensaje(s)`
    default:               return null
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AuditTimeline({ events, externalDetailCpId, onFilterChange }: {
  events:              AuditEventRow[]
  externalDetailCpId?: string | null
  onFilterChange?:    (filtered: AuditEventRow[]) => void
}) {
  const router = useRouter()

  const [detailCpId, setDetailCpId]       = useState<string | null>(null)
  const [detailWsId, setDetailWsId]       = useState<string | null>(null)
  const [detailName, setDetailName]       = useState('')
  const [detailMsgs, setDetailMsgs]       = useState<CheckpointMsg[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  // Open modal when SMPanel selects a checkpoint by ID
  useEffect(() => {
    if (!externalDetailCpId) return
    const ev = events.find(e => (e.metadata?.checkpoint_id as string) === externalDetailCpId)
    if (ev) openDetail(ev)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalDetailCpId])

  // Report current event list to parent for filter-aware SM context
  // AuditTimeline has no filters yet — always reports the full list
  useEffect(() => {
    onFilterChange?.(events)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events])

  async function openDetail(e: AuditEventRow) {
    const cpId = e.metadata?.checkpoint_id as string
    if (!cpId) return
    setDetailCpId(cpId)
    setDetailWsId(e.workspace_id)
    setDetailName(eventTitle(e))
    setDetailLoading(true)
    setDetailMsgs([])
    const res  = await fetch(`/api/checkpoint/${cpId}`)
    const data = await res.json()
    setDetailMsgs(data)
    setDetailLoading(false)
  }

  function closeDetail() {
    setDetailCpId(null)
    setDetailMsgs([])
  }

  function retomar(e: AuditEventRow) {
    const cpId = e.metadata?.checkpoint_id as string
    if (!cpId || !e.workspace_id) return
    router.push(`/workspace/${e.workspace_id}?checkpoint=${cpId}`)
  }

  // Agrupar mensajes del detalle por sesión
  const groups: Record<string, {
    agentRole: string; provider: string; model: string
    messages: { role: string; content: string }[]
  }> = {}
  for (const msg of detailMsgs) {
    if (!groups[msg.session_id]) {
      groups[msg.session_id] = {
        agentRole: msg.agent_sessions?.agent_role ?? 'unknown',
        provider:  msg.agent_sessions?.provider  ?? '',
        model:     msg.agent_sessions?.model     ?? '',
        messages:  [],
      }
    }
    groups[msg.session_id].messages.push({ role: msg.role, content: msg.content })
  }
  const groupsArr = Object.values(groups)

  if (events.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 text-sm">No hay eventos registrados todavía.</p>
        <p className="text-gray-700 text-xs mt-1">
          Los eventos aparecen al usar Save Version, Lock/Unlock, Review &amp; Forward o Session Backup.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* ── Timeline ── */}
      <div className="relative">
        {/* Línea vertical */}
        <div className="absolute left-[18px] top-0 bottom-0 w-px bg-gray-800" />

        <div className="space-y-1">
          {events.map(e => {
            const cfg = EVENT_CONFIG[e.event_type] ?? {
              label: e.event_type,
              dotColor: 'bg-gray-600',
              badgeClass: 'text-gray-400 bg-gray-800 border-gray-700',
            }
            const title  = eventTitle(e)
            const detail = eventDetail(e)
            const canCp  = hasCheckpoint(e)

            return (
              <div
                key={e.id}
                className="relative flex gap-4 pl-10 pr-4 py-4 rounded-xl hover:bg-gray-900/60 transition-colors"
              >
                {/* Dot */}
                <div className={`absolute left-3 top-5 w-3 h-3 rounded-full ring-2 ring-gray-950 ${cfg.dotColor}`} />

                <div className="flex-1 min-w-0">
                  {/* Tipo + workspace */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.badgeClass}`}>
                      {cfg.label}
                    </span>
                    {e.workspaces?.name && (
                      <span className="text-xs text-gray-600">{e.workspaces.name}</span>
                    )}
                  </div>

                  {/* Título */}
                  <p className="text-sm font-medium text-white mt-1.5">{title}</p>

                  {/* Detalle secundario */}
                  {detail && <p className="text-xs text-gray-500 mt-0.5">{detail}</p>}

                  {/* Timestamp + acciones */}
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <span className="text-xs text-gray-600" suppressHydrationWarning>{formatDate(e.created_at)}</span>

                    {canCp && (
                      <>
                        <button
                          onClick={() => openDetail(e)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          Ver detalle →
                        </button>
                        <button
                          onClick={() => retomar(e)}
                          className="text-xs text-green-400 hover:text-green-300 font-medium transition-colors"
                        >
                          Retomar →
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Modal de detalle ── */}
      {detailCpId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) closeDetail() }}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl mx-4 max-h-[85vh] flex flex-col shadow-2xl">

            {/* Header */}
            <div className="shrink-0 px-6 py-4 border-b border-gray-800 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-white truncate">{detailName}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {detailLoading
                    ? 'Cargando…'
                    : `${detailMsgs.length} mensajes · ${groupsArr.length} agente${groupsArr.length !== 1 ? 's' : ''}`
                  }
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {detailWsId && (
                  <button
                    onClick={() => {
                      router.push(`/workspace/${detailWsId}?checkpoint=${detailCpId}`)
                      closeDetail()
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Retomar →
                  </button>
                )}
                <button
                  onClick={closeDetail}
                  className="text-gray-500 hover:text-gray-300 text-sm px-2 transition-colors"
                >
                  Cerrar ✕
                </button>
              </div>
            </div>

            {/* Cuerpo */}
            <div className="flex-1 overflow-y-auto p-4">
              {detailLoading ? (
                <div className="flex items-center justify-center h-32">
                  <span className="text-gray-500 text-sm animate-pulse">Cargando mensajes…</span>
                </div>
              ) : groupsArr.length === 0 ? (
                <p className="text-center text-gray-600 text-sm py-8">
                  No hay mensajes en este checkpoint.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {groupsArr.map((g, gi) => (
                    <div key={gi} className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden flex flex-col">
                      <div className="px-3 py-2 border-b border-gray-700 bg-gray-800 shrink-0">
                        <p className="text-xs font-semibold text-gray-300">
                          {AGENT_LABEL[g.agentRole] ?? g.agentRole}
                        </p>
                        <p className="text-xs text-gray-500">{g.provider} · {g.model}</p>
                      </div>
                      <div className="p-3 space-y-2 overflow-y-auto max-h-72">
                        {g.messages.map((msg, i) => (
                          <div
                            key={i}
                            className={`text-xs rounded-lg px-3 py-2 leading-relaxed whitespace-pre-wrap ${
                              msg.role === 'user'
                                ? 'bg-indigo-900/50 text-indigo-100 ml-3'
                                : 'bg-gray-700 text-gray-200 mr-3'
                            }`}
                          >
                            <span className="font-medium text-gray-400 block mb-0.5">
                              {msg.role === 'user' ? 'Usuario' : 'Agente'}
                            </span>
                            {msg.content}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
