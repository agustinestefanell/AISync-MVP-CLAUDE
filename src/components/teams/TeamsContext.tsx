'use client'

import { createContext, useContext } from 'react'
import type { TeamWithWorkspaces } from '@/lib/db/types'

interface TeamsContextValue {
  onOpen: (workspaceId: string) => void
  onEdit: (team: TeamWithWorkspaces) => void
}

export const TeamsContext = createContext<TeamsContextValue>({
  onOpen: () => {},
  onEdit: () => {},
})

export function useTeamsContext() {
  return useContext(TeamsContext)
}
