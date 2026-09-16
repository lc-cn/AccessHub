'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { AfdianMappings } from './afadian-mappings'
import { ApiDocs } from './api-docs'
import { CommerceResources } from './commerce-resources'
import { Orders } from './orders'
import { Skus } from './skus'
import { Services } from './services'
import { ServiceCatalog } from './service-catalog'
import { SubscriptionPlanManagement } from './subscription-plans'
import { Overview } from './overview'
import { RedeemCodes } from './redeem-codes'
import type { DashboardData, Sku } from './types'
import { requestWorkspaceRefresh, useWorkspaceData } from './workspace-data'
import { type WorkspaceRoute, workspaceRouteMeta } from './workspace-navigation'
import { WorkspaceShell, WorkspaceSkeleton } from './workspace-shell'
import { authClient } from '@/lib/auth-client'
import { requestJson } from '@/lib/http-client'

type Props = { route: WorkspaceRoute; resourceId?: string }

export function WorkspacePage({ route, resourceId }: Props) {
  const router = useRouter()
  const { dashboard, setDashboard, dashboardError, setDashboardError, loading, setLoading, clear } = useWorkspaceData()
  const [copied, setCopied] = useState(false)
  const loadDashboard = useCallback(async () => {
    setLoading(true); setDashboardError('')
    try { setDashboard(await requestJson<DashboardData>('/api/dashboard', { cache: 'no-store' })) }
    catch (error) {
      if (error instanceof Error && 'status' in error && error.status === 401) { clear(); return router.replace('/login') }
      setDashboardError(error instanceof Error ? error.message : '暂时无法读取账户数据')
    } finally { setLoading(false) }
  }, [clear, router, setDashboard, setDashboardError, setLoading])
  useEffect(() => { void loadDashboard() }, [loadDashboard])
  const user = dashboard?.user ?? null
  const isAdmin = user?.role === 'admin'
  const meta = workspaceRouteMeta[route]
  const initializing = loading && !dashboard
  useEffect(() => { document.title = `${meta.title} · AccessHub`; if (!initializing && meta.admin && !isAdmin) router.replace('/dashboard') }, [initializing, isAdmin, meta, router])
  const signOut = async () => { await authClient.signOut(); clear(); router.replace('/login'); router.refresh() }
  const refreshWorkspace = () => { requestWorkspaceRefresh(); void loadDashboard() }
  const signIn = async () => { await authClient.signIn.social({ provider: 'github', callbackURL: '/redeem-codes' }) }
  const copyId = async () => { if (!user?.id) return; await navigator.clipboard?.writeText(user.id); setCopied(true); setTimeout(() => setCopied(false), 1600) }
  return <WorkspaceShell route={route} user={user} isAdmin={isAdmin} initializing={initializing} loading={loading} error={dashboardError} onRefresh={refreshWorkspace} onSignOut={() => void signOut()}>
    {initializing || (meta.admin && !isAdmin) ? <WorkspaceSkeleton/> : <RouteContent route={route} resourceId={resourceId} dashboard={dashboard} loading={loading} copied={copied} refresh={loadDashboard} signIn={signIn} copyId={copyId} router={router}/>}
  </WorkspaceShell>
}

function RouteContent({ route, resourceId, dashboard, loading, copied, refresh, signIn, copyId, router }: { route: WorkspaceRoute; resourceId?: string; dashboard: DashboardData | null; loading: boolean; copied: boolean; refresh: () => Promise<void>; signIn: () => Promise<void>; copyId: () => Promise<void>; router: ReturnType<typeof useRouter> }) {
  const plans = dashboard?.plans ?? []
  const skus: Sku[] = []
  if (route === 'dashboard') return <Overview dashboard={dashboard} loading={loading} copied={copied} onCopyId={() => void copyId()} onNavigate={(view) => router.push(view === '兑换码' ? '/redeem-codes' : '/admin/plans')}/>
  if (route === 'redeem') return <RedeemCodes authenticated isAdmin={false} skus={skus} onChanged={refresh} onSignIn={signIn} mode="redeem"/>
  if (route === 'catalog' || route === 'catalog-service' || route === 'catalog-api') return <ServiceCatalog mode={route === 'catalog' ? 'list' : route === 'catalog-service' ? 'service' : 'api'} resourceId={resourceId}/>
  if (route === 'codes' || route === 'codes-new') return <RedeemCodes authenticated isAdmin skus={skus} onChanged={refresh} onSignIn={signIn} mode={route === 'codes' ? 'list' : 'new'}/>
  if (route === 'plans' || route === 'plans-new' || route === 'plans-edit') return <SubscriptionPlanManagement plans={plans} onChanged={refresh} mode={route === 'plans' ? 'list' : route === 'plans-new' ? 'new' : 'edit'} planId={resourceId}/>
  if (route === 'skus' || route === 'skus-new' || route === 'skus-edit') return <Skus plans={plans} mode={route === 'skus' ? 'list' : route === 'skus-new' ? 'new' : 'edit'} skuId={resourceId}/>
  if (route === 'services' || route === 'services-new' || route === 'services-edit' || route === 'service-api-new' || route === 'service-api-edit') return <Services mode={route === 'services' ? 'list' : route === 'services-new' ? 'new' : route === 'services-edit' ? 'edit' : route === 'service-api-new' ? 'api-new' : 'api-edit'} resourceId={resourceId}/>
  if (route === 'subscriptions' || route === 'payments' || route === 'users' || route === 'logs' || route === 'afdian-events') return <CommerceResources resource={route}/>
  if (route === 'orders' || route === 'order-detail') return <Orders mode={route === 'orders' ? 'list' : 'detail'} orderId={resourceId}/>
  if (route === 'afdian' || route === 'afdian-new' || route === 'afdian-edit') return <AfdianMappings skus={skus} mode={route === 'afdian' ? 'list' : route === 'afdian-new' ? 'new' : 'edit'} mappingId={resourceId}/>
  if (route === 'afdian-orders' || route === 'afdian-order-detail') return <Orders provider="afdian" mode={route === 'afdian-orders' ? 'list' : 'detail'} orderId={resourceId}/>
  return <ApiDocs/>
}
