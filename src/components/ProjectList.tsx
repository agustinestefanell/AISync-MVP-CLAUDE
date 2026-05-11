'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createProjectAction } from '@/app/actions'
import type { ProjectWithTeams } from '@/lib/db/types'

const AGENT_META: Record<string, { label: string; color: string }> = {
  manager: { label: 'Manager', color: 'text-blue-400' },
  worker1: { label: 'Worker 1', color: 'text-teal-400' },
  worker2: { label: 'Worker 2', color: 'text-orange-400' },
}

export default function ProjectList({ projects }: { projects: ProjectWithTeams[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')

  function handleCreate() {
    if (!name.trim() || isPending) return
    startTransition(async () => {
      await createProjectAction(name)
      setName('')
      setShowForm(false)
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      {/* Encabezado de sección */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Mis Proyectos</h2>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <span aria-hidden>+</span> Nuevo Proyecto
        </button>
      </div>

      {/* Formulario inline */}
      {showForm && (
        <div className="bg-gray-900 border border-indigo-800 rounded-xl p-4 flex items-center gap-3">
          <input
            autoFocus
            type="text"
            placeholder="Nombre del proyecto..."
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            onClick={handleCreate}
            disabled={!name.trim() || isPending}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            {isPending ? 'Creando…' : 'Crear'}
          </button>
          <button
            onClick={() => { setShowForm(false); setName('') }}
            className="text-gray-500 hover:text-gray-300 text-sm px-2"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Estado vacío */}
      {projects.length === 0 && (
        <div className="bg-gray-900 border border-dashed border-gray-700 rounded-xl p-10 text-center">
          <p className="text-gray-500 text-sm">No tenés proyectos todavía.</p>
          <p className="text-gray-600 text-xs mt-1">Creá el primero con el botón de arriba.</p>
        </div>
      )}

      {/* Tarjetas */}
      {projects.map(project => (
        <div key={project.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          {/* Cabecera del proyecto */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">{project.name}</h3>
            <span className="text-xs font-medium text-green-400 bg-green-950 border border-green-900 px-2.5 py-1 rounded-full">
              activo
            </span>
          </div>

          {/* Jerarquía */}
          <div className="space-y-3 text-sm">
            {project.teams.map((team, ti) => (
              <div key={team.id} className="space-y-2">
                {/* Team */}
                <div className="flex items-center gap-2 text-gray-300">
                  <span className="text-gray-600 font-mono text-xs">
                    {ti < project.teams.length - 1 ? '├──' : '└──'}
                  </span>
                  <span className="font-medium">{team.name}</span>
                  <span className="text-xs text-gray-500 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded">
                    {team.type}
                  </span>
                </div>

                {/* Workspaces */}
                {team.workspaces.map(ws => (
                  <div key={ws.id} className="pl-7 space-y-1.5">
                    <div className="flex items-center gap-2 text-gray-400">
                      <span className="text-gray-700 font-mono text-xs">└──</span>
                      <span>{ws.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded border ${
                        ws.lock_state === 'locked'
                          ? 'text-red-400 bg-red-950 border-red-900'
                          : 'text-gray-600 bg-gray-800 border-gray-700'
                      }`}>
                        {ws.lock_state === 'locked' ? 'bloqueado' : 'libre'}
                      </span>
                      <Link
                        href={`/workspace/${ws.id}`}
                        className="ml-auto text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-900 hover:border-indigo-700 bg-indigo-950 hover:bg-indigo-900 px-2.5 py-0.5 rounded transition-colors"
                      >
                        Abrir →
                      </Link>
                    </div>

                    {/* Agent Sessions */}
                    {ws.agent_sessions.map(agent => {
                      const meta = AGENT_META[agent.agent_role] ?? { label: agent.agent_role, color: 'text-gray-400' }
                      return (
                        <div key={agent.id} className="pl-12 flex items-center gap-2 text-xs text-gray-500">
                          <span className="text-gray-700">•</span>
                          <span className={`font-medium ${meta.color}`}>{meta.label}</span>
                          <span className="text-gray-700">·</span>
                          <span>{agent.model}</span>
                          <span className="text-gray-700">({agent.provider})</span>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
