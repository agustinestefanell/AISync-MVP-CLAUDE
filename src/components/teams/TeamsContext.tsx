'use client'

import { createContext, useContext } from 'react'

interface TeamsContextValue {
  onOpen: (workspaceId: string) => void
  onEdit: (teamId: string) => void
}

export const TeamsContext = createContext<TeamsContextValue>({
  onOpen: () => {},
  onEdit: () => {},
})

export function useTeamsContext() {
  return useContext(TeamsContext)
}
