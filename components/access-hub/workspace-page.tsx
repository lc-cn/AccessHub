'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { BookOpen, HeartHandshake, LayoutDashboard, LogOut, ReceiptText, RefreshCw, Ticket, Users, Zap } from 'lucide-react'
import { AfdianMappings } from './afadian-mappings'
import { AfdianOrders } from './afadian-orders'
import { ApiDocs } from './api-docs'
import { GroupManagement } from './group-management'
import { Overview } from './overview'
import { RedeemCodes } from './redeem-codes'
import type { DashboardData } from './types'
import { useWorkspaceData } from './workspace-data'
import { authClient } from '@/lib/auth-client'
import { requestJson } from '@/lib/http-client'

export type WorkspaceRoute = 'dashboard' | 'redeem' | 'codes' | 'codes-new' | 'groups' | 'groups-new' | 'groups-edit' | 'afdian' | 'afdian-new' | 'afdian-edit' | 'afdian-orders' | 'afdian-order-detail' | 'docs'
type Props = { route: WorkspaceRoute; resourceId?: string }
type NavItem = { label: string; href: string; active: WorkspaceRoute[]; icon: typeof LayoutDashboard; admin?: boolean }
const navItems: NavItem[] = [
  { label: '概览', href: '/dashboard', active: ['dashboard'], icon: LayoutDashboard },
  { label: '兑换权益', href: '/redeem-codes', active: ['redeem'], icon: Ticket },
  { label: '兑换码', href: '/admin/redeem-codes', active: ['codes', 'codes-new'], icon: Ticket, admin: true },
  { label: '用户组', href: '/admin/groups', active: ['groups', 'groups-new', 'groups-edit'], icon: Users, admin: true },
  { label: '爱发电映射', href: '/admin/afdian-mappings', active: ['afdian', 'afdian-new', 'afdian-edit'], icon: HeartHandshake, admin: true },
  { label: '爱发电订单', href: '/admin/afdian-orders', active: ['afdian-orders', 'afdian-order-detail'], icon: ReceiptText, admin: true },
  { label: 'API 文档', href: '/api-docs', active: ['docs'], icon: BookOpen },
]
const routeMeta: Record<WorkspaceRoute, { eyebrow: string; title: string; description: string; admin?: boolean }> = {
  dashboard: { eyebrow: '工作台', title: '概览', description: '查看账户、访问权益与今天的 API 使用情况。' },
  redeem: { eyebrow: '权益中心', title: '兑换权益', description: '为当前账户核销兑换码并立即更新访问权益。' },
  codes: { eyebrow: '管理员', title: '兑换码', description: '查询、筛选并追踪已经生成的兑换码。', admin: true },
  'codes-new': { eyebrow: '管理员 / 兑换码', title: '生成兑换码', description: '创建一批用户组权益或 credits 增量包兑换码。', admin: true },
  groups: { eyebrow: '管理员', title: '用户组', description: '管理访问频率、周期配额与默认策略。', admin: true },
  'groups-new': { eyebrow: '管理员 / 用户组', title: '新建用户组', description: '创建新的 API 访问策略。', admin: true },
  'groups-edit': { eyebrow: '管理员 / 用户组', title: '编辑用户组', description: '调整当前用户组的访问能力。', admin: true },
  afdian: { eyebrow: '管理员', title: '爱发电映射', description: '维护爱发电方案与本地权益之间的自动发码规则。', admin: true },
  'afdian-new': { eyebrow: '管理员 / 爱发电映射', title: '新增映射', description: '关联爱发电方案或 SKU 与本地权益。', admin: true },
  'afdian-edit': { eyebrow: '管理员 / 爱发电映射', title: '编辑映射', description: '修改现有爱发电权益映射。', admin: true },
  'afdian-orders': { eyebrow: '管理员', title: '爱发电订单', description: '追踪订单、兑换码、私信送达和核销状态。', admin: true },
  'afdian-order-detail': { eyebrow: '管理员 / 爱发电订单', title: '订单详情', description: '查看订单对应的权益与兑换码履约闭环。', admin: true },
  docs: { eyebrow: '开发者', title: 'API 文档', description: '查看当前可用接口及接入方式。' },
}

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
  const meta = routeMeta[route]
  const initializing = loading && !dashboard
  useEffect(() => { document.title = `${meta.title} · AccessHub`; if (!initializing && meta.admin && !isAdmin) router.replace('/dashboard') }, [initializing, isAdmin, meta, router])
  const signOut = async () => { await authClient.signOut(); clear(); router.replace('/login'); router.refresh() }
  const signIn = async () => { await authClient.signIn.social({ provider: 'github', callbackURL: '/redeem-codes' }) }
  const copyId = async () => { if (!user?.id) return; await navigator.clipboard?.writeText(user.id); setCopied(true); setTimeout(() => setCopied(false), 1600) }
  const visibleNav = navItems.filter((item) => !item.admin || isAdmin)

  return <div className="min-h-screen bg-[#f3f6fb] text-[#172033]"><a href="#main-content" className="sr-only z-50 rounded-lg bg-white px-4 py-2 text-sm focus:not-sr-only focus:fixed focus:left-4 focus:top-4">跳到主要内容</a>
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-[#e3e9f3] bg-white px-5 py-6 lg:flex lg:flex-col"><Brand/><nav className="mt-10 space-y-1" aria-label="主导航">{initializing ? [1, 2, 3, 4].map((item) => <span key={item} className="block h-11 animate-pulse rounded-xl bg-slate-50"/>) : visibleNav.map((item) => <NavLink key={item.href} item={item} route={route}/>)}</nav><div className="mt-auto rounded-[18px] bg-[#f4f6fa] p-3.5"><div className="flex items-center gap-3"><Avatar user={user}/><div className="min-w-0"><p className="truncate text-sm font-medium">{user?.name || '正在读取账户'}</p><p className="mt-0.5 truncate text-[11px] text-slate-400">{user ? isAdmin ? '管理员' : '普通用户' : '正在验证身份'}</p></div>{user && <button onClick={signOut} aria-label="退出登录" className="ml-auto rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-slate-600"><LogOut size={15}/></button>}</div></div></aside>
    <main id="main-content" className="min-h-screen lg:pl-64"><header className="sticky top-0 z-10 border-b border-[#e3e9f3] bg-white/90 backdrop-blur-xl"><div className="flex h-[76px] items-center justify-between px-5 sm:px-8 lg:px-10"><div><p className="text-[11px] font-medium tracking-[.12em] text-slate-400">{meta.eyebrow}</p><h1 className="mt-1 text-xl font-semibold tracking-tight">{meta.title}</h1></div><div className="flex items-center gap-2 sm:gap-3"><span className="mr-2 hidden items-center gap-2 text-xs text-slate-500 sm:flex"><span className={`size-2 rounded-full ${dashboardError ? 'bg-rose-500' : loading ? 'bg-amber-400' : 'bg-emerald-500'}`}/>{dashboardError ? '同步失败' : loading ? '同步中' : '数据已同步'}</span><button onClick={() => void loadDashboard()} disabled={loading} aria-label="刷新数据" className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/></button><div className="lg:hidden"><Avatar user={user}/></div></div></div>{!initializing && <nav className="flex gap-1 overflow-x-auto px-5 pb-3 lg:hidden" aria-label="移动端导航">{visibleNav.map((item) => <NavLink key={item.href} item={item} route={route} mobile/>)}</nav>}</header>
      <div className="mx-auto max-w-[1320px] px-5 pb-14 pt-8 sm:px-8 lg:px-10 lg:pt-10"><div className="mb-8"><p className="max-w-2xl text-sm leading-6 text-slate-500">{meta.description}</p>{dashboardError && <button onClick={() => void loadDashboard()} className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{dashboardError} 点击重试</button>}</div>{initializing || (meta.admin && !isAdmin) ? <WorkspaceSkeleton/> : <RouteContent route={route} resourceId={resourceId} dashboard={dashboard} loading={loading} copied={copied} refresh={loadDashboard} signIn={signIn} copyId={copyId} router={router}/>}</div>
    </main>
  </div>
}

function RouteContent({ route, resourceId, dashboard, loading, copied, refresh, signIn, copyId, router }: { route: WorkspaceRoute; resourceId?: string; dashboard: DashboardData | null; loading: boolean; copied: boolean; refresh: () => Promise<void>; signIn: () => Promise<void>; copyId: () => Promise<void>; router: ReturnType<typeof useRouter> }) {
  const groups = dashboard?.groups ?? []
  if (route === 'dashboard') return <Overview dashboard={dashboard} loading={loading} copied={copied} onCopyId={() => void copyId()} onNavigate={(view) => router.push(view === '兑换码' ? '/redeem-codes' : '/admin/groups')}/>
  if (route === 'redeem') return <RedeemCodes authenticated isAdmin={false} groups={groups} onChanged={refresh} onSignIn={signIn} mode="redeem"/>
  if (route === 'codes' || route === 'codes-new') return <RedeemCodes authenticated isAdmin groups={groups} onChanged={refresh} onSignIn={signIn} mode={route === 'codes' ? 'list' : 'new'}/>
  if (route === 'groups' || route === 'groups-new' || route === 'groups-edit') return <GroupManagement groups={groups} onChanged={refresh} mode={route === 'groups' ? 'list' : route === 'groups-new' ? 'new' : 'edit'} groupId={resourceId}/>
  if (route === 'afdian' || route === 'afdian-new' || route === 'afdian-edit') return <AfdianMappings groups={groups} mode={route === 'afdian' ? 'list' : route === 'afdian-new' ? 'new' : 'edit'} ruleId={resourceId}/>
  if (route === 'afdian-orders' || route === 'afdian-order-detail') return <AfdianOrders mode={route === 'afdian-orders' ? 'list' : 'detail'} orderId={resourceId}/>
  return <ApiDocs/>
}

function NavLink({ item, route, mobile = false }: { item: NavItem; route: WorkspaceRoute; mobile?: boolean }) { const active = item.active.includes(route); const Icon = item.icon; return <Link href={item.href} aria-current={active ? 'page' : undefined} className={mobile ? `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${active ? 'bg-[#182238] text-white' : 'text-slate-500'}` : `flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${active ? 'bg-[#edf2ff] font-medium text-[#3157d5]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}><Icon size={mobile ? 14 : 17}/>{item.label}</Link> }
function Brand() { return <Link href="/dashboard" className="flex items-center gap-3 px-2"><span className="grid size-9 place-items-center rounded-xl bg-[#3157d5] text-white shadow-[0_8px_22px_rgba(49,87,213,.25)]"><Zap size={17} fill="currentColor"/></span><span><span className="block font-semibold tracking-tight">AccessHub</span><span className="block text-[10px] tracking-wide text-slate-400">API ACCESS CONTROL</span></span></Link> }
function Avatar({ user }: { user: DashboardData['user'] }) { return <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#e7ebf3] text-xs font-semibold text-slate-600">{user?.image ? <img src={user.image} alt={`${user.name} 的头像`} className="size-full object-cover"/> : user?.name?.slice(0, 1) || '?'}</span> }
function WorkspaceSkeleton() { return <div aria-label="正在加载工作区" className="grid animate-pulse gap-6 xl:grid-cols-[minmax(0,1fr)_390px]"><div className="space-y-4"><div className="h-28 rounded-[20px] bg-white"/><div className="h-24 rounded-[18px] bg-white"/><div className="h-24 rounded-[18px] bg-white"/></div><div className="h-[520px] rounded-[22px] bg-white"/></div> }
