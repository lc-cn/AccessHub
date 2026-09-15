'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { DashboardData } from './types'

type WorkspaceDataContextValue = {
  dashboard: DashboardData | null
  setDashboard: Dispatch<SetStateAction<DashboardData | null>>
  dashboardError: string
  setDashboardError: Dispatch<SetStateAction<string>>
  loading: boolean
  setLoading: Dispatch<SetStateAction<boolean>>
  clear: () => void
}

const WorkspaceDataContext = createContext<WorkspaceDataContextValue | null>(null)

export function WorkspaceDataProvider({ children }: { children: ReactNode }) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [dashboardError, setDashboardError] = useState('')
  const [loading, setLoading] = useState(true)
  const clear = useCallback(() => { setDashboard(null); setDashboardError(''); setLoading(true) }, [])
  const value = useMemo(() => ({ dashboard, setDashboard, dashboardError, setDashboardError, loading, setLoading, clear }), [clear, dashboard, dashboardError, loading])
  return <WorkspaceDataContext.Provider value={value}>{children}</WorkspaceDataContext.Provider>
}

export function useWorkspaceData() {
  const value = useContext(WorkspaceDataContext)
  if (!value) throw new Error('useWorkspaceData must be used inside WorkspaceDataProvider')
  return value
}
