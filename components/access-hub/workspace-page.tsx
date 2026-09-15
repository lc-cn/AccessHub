'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { BookOpen, Boxes, CreditCard, HeartHandshake, History, LayoutDashboard, LogOut, ReceiptText, RefreshCw, Repeat2, Ticket, UserRound, Users, Webhook, Zap } from 'lucide-react'
import { AfdianMappings } from './afadian-mappings'
import { ApiDocs } from './api-docs'
import { CommerceResources } from './commerce-resources'
import { Orders } from './orders'
import { Skus } from './skus'
import { SubscriptionPlanManagement } from './subscription-plans'
import { Overview } from './overview'
import { RedeemCodes } from './redeem-codes'
import type { DashboardData, Sku } from './types'
import { useWorkspaceData } from './workspace-data'
import { authClient } from '@/lib/auth-client'
import { requestJson } from '@/lib/http-client'

export type WorkspaceRoute = 'dashboard' | 'redeem' | 'codes' | 'codes-new' | 'plans' | 'plans-new' | 'plans-edit' | 'skus' | 'skus-new' | 'skus-edit' | 'subscriptions' | 'orders' | 'order-detail' | 'payments' | 'users' | 'logs' | 'afdian' | 'afdian-new' | 'afdian-edit' | 'afdian-orders' | 'afdian-order-detail' | 'afdian-events' | 'docs'
type Props = { route: WorkspaceRoute; resourceId?: string }
type NavItem = { label: string; href: string; active: WorkspaceRoute[]; icon: typeof LayoutDashboard; admin?: boolean }
const navItems: NavItem[] = [
  { label: '概览', href: '/dashboard', active: ['dashboard'], icon: LayoutDashboard },
  { label: '兑换权益', href: '/redeem-codes', active: ['redeem'], icon: Ticket },
  { label: '个人中心', href: '/account', active: [], icon: UserRound },
  { label: '兑换码', href: '/admin/redeem-codes', active: ['codes', 'codes-new'], icon: Ticket, admin: true },
  { label: '订阅计划', href: '/admin/plans', active: ['plans', 'plans-new', 'plans-edit'], icon: Users, admin: true },
  { label: 'SKU', href: '/admin/skus', active: ['skus', 'skus-new', 'skus-edit'], icon: Boxes, admin: true },
  { label: '订阅', href: '/admin/subscriptions', active: ['subscriptions'], icon: Repeat2, admin: true },
  { label: '订单', href: '/admin/orders', active: ['orders', 'order-detail'], icon: ReceiptText, admin: true },
  { label: '支付', href: '/admin/payments', active: ['payments'], icon: CreditCard, admin: true },
  { label: '用户', href: '/admin/users', active: ['users'], icon: UserRound, admin: true },
  { label: '活动日志', href: '/admin/logs', active: ['logs'], icon: History, admin: true },
  { label: '爱发电 · 映射', href: '/admin/afdian/mappings', active: ['afdian', 'afdian-new', 'afdian-edit'], icon: HeartHandshake, admin: true },
  { label: '爱发电 · 订单', href: '/admin/afdian/orders', active: ['afdian-orders', 'afdian-order-detail'], icon: ReceiptText, admin: true },
  { label: '爱发电 · 事件', href: '/admin/afdian/events', active: ['afdian-events'], icon: Webhook, admin: true },
  { label: 'API 文档', href: '/api-docs', active: ['docs'], icon: BookOpen },
]
const routeMeta: Record<WorkspaceRoute, { eyebrow: string; title: string; description: string; admin?: boolean }> = {
  dashboard: { eyebrow: '工作台', title: '概览', description: '查看账户、访问权益与今天的 API 使用情况。' },
  redeem: { eyebrow: '权益中心', title: '兑换权益', description: '为当前账户核销兑换码并立即更新访问权益。' },
  codes: { eyebrow: '管理员', title: '兑换码', description: '查询、筛选并追踪已经生成的兑换码。', admin: true },
  'codes-new': { eyebrow: '管理员 / 兑换码', title: '生成兑换码', description: '创建一批订阅计划权益或 credits 增量包兑换码。', admin: true },
  plans: { eyebrow: '管理员', title: '订阅计划', description: '管理访问频率、周期配额与默认策略。', admin: true },
  'plans-new': { eyebrow: '管理员 / 订阅计划', title: '新建订阅计划', description: '创建新的 API 访问策略。', admin: true },
  'plans-edit': { eyebrow: '管理员 / 订阅计划', title: '编辑订阅计划', description: '调整当前订阅计划的访问能力。', admin: true },
  skus: { eyebrow: '管理员 / 商品目录', title: 'SKU', description: '维护平台自己的可售权益单元。', admin: true },
  'skus-new': { eyebrow: '管理员 / SKU', title: '新增 SKU', description: '创建计划商品或 Credits 增量包。', admin: true },
  'skus-edit': { eyebrow: '管理员 / SKU', title: '编辑 SKU', description: '调整商品定义与在售状态。', admin: true },
  subscriptions: { eyebrow: '管理员 / 商业核心', title: '订阅', description: '查看独立于 PSP 的订阅状态机。', admin: true },
  orders: { eyebrow: '管理员 / 商业核心', title: '订单', description: '查看所有支付服务产生的统一订单。', admin: true },
  'order-detail': { eyebrow: '管理员 / 订单', title: '订单详情', description: '查看支付、SKU 和履约闭环。', admin: true },
  payments: { eyebrow: '管理员 / 商业核心', title: '支付', description: '追踪各 PSP 的资金交易状态。', admin: true },
  users: { eyebrow: '管理员', title: '用户', description: '查看平台账户与角色。', admin: true },
  logs: { eyebrow: '管理员 / 运维', title: '活动日志', description: '审计平台内的重要业务操作。', admin: true },
  afdian: { eyebrow: '管理员', title: '爱发电映射', description: '维护爱发电方案与本地权益之间的自动发码规则。', admin: true },
  'afdian-new': { eyebrow: '管理员 / 爱发电映射', title: '新增映射', description: '关联爱发电方案或 SKU 与本地权益。', admin: true },
  'afdian-edit': { eyebrow: '管理员 / 爱发电映射', title: '编辑映射', description: '修改现有爱发电权益映射。', admin: true },
  'afdian-orders': { eyebrow: '管理员', title: '爱发电订单', description: '追踪订单、兑换码、私信送达和核销状态。', admin: true },
  'afdian-order-detail': { eyebrow: '管理员 / 爱发电订单', title: '订单详情', description: '查看订单对应的权益与兑换码履约闭环。', admin: true },
  'afdian-events': { eyebrow: '管理员 / PSP / 爱发电', title: 'Webhook 事件', description: '追踪爱发电事件的幂等处理结果。', admin: true },
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
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-[#e3e9f3] bg-white px-5 py-6 lg:flex lg:flex-col"><Brand/><nav className="mt-8 min-h-0 flex-1 space-y-1 overflow-y-auto" aria-label="主导航">{initializing ? [1, 2, 3, 4].map((item) => <span key={item} className="block h-11 animate-pulse rounded-xl bg-slate-50"/>) : visibleNav.map((item) => <NavLink key={item.href} item={item} route={route}/>)}</nav><div className="mt-4 rounded-[18px] bg-[#f4f6fa] p-3.5"><div className="flex items-center gap-3"><Avatar user={user}/><div className="min-w-0"><p className="truncate text-sm font-medium">{user?.name || '正在读取账户'}</p><p className="mt-0.5 truncate text-[11px] text-slate-400">{user ? isAdmin ? '管理员' : '普通用户' : '正在验证身份'}</p></div>{user && <button onClick={signOut} aria-label="退出登录" className="ml-auto rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-slate-600"><LogOut size={15}/></button>}</div></div></aside>
    <main id="main-content" className="min-h-screen lg:pl-64"><header className="sticky top-0 z-10 border-b border-[#e3e9f3] bg-white/90 backdrop-blur-xl"><div className="flex h-[76px] items-center justify-between px-5 sm:px-8 lg:px-10"><div><p className="text-[11px] font-medium tracking-[.12em] text-slate-400">{meta.eyebrow}</p><h1 className="mt-1 text-xl font-semibold tracking-tight">{meta.title}</h1></div><div className="flex items-center gap-2 sm:gap-3"><span className="mr-2 hidden items-center gap-2 text-xs text-slate-500 sm:flex"><span className={`size-2 rounded-full ${dashboardError ? 'bg-rose-500' : loading ? 'bg-amber-400' : 'bg-emerald-500'}`}/>{dashboardError ? '同步失败' : loading ? '同步中' : '数据已同步'}</span><button onClick={() => void loadDashboard()} disabled={loading} aria-label="刷新数据" className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/></button><div className="lg:hidden"><Avatar user={user}/></div></div></div>{!initializing && <nav className="flex gap-1 overflow-x-auto px-5 pb-3 lg:hidden" aria-label="移动端导航">{visibleNav.map((item) => <NavLink key={item.href} item={item} route={route} mobile/>)}</nav>}</header>
      <div className="mx-auto max-w-[1320px] px-5 pb-14 pt-8 sm:px-8 lg:px-10 lg:pt-10"><div className="mb-8"><p className="max-w-2xl text-sm leading-6 text-slate-500">{meta.description}</p>{dashboardError && <button onClick={() => void loadDashboard()} className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{dashboardError} 点击重试</button>}</div>{initializing || (meta.admin && !isAdmin) ? <WorkspaceSkeleton/> : <RouteContent route={route} resourceId={resourceId} dashboard={dashboard} loading={loading} copied={copied} refresh={loadDashboard} signIn={signIn} copyId={copyId} router={router}/>}</div>
    </main>
  </div>
}

function RouteContent({ route, resourceId, dashboard, loading, copied, refresh, signIn, copyId, router }: { route: WorkspaceRoute; resourceId?: string; dashboard: DashboardData | null; loading: boolean; copied: boolean; refresh: () => Promise<void>; signIn: () => Promise<void>; copyId: () => Promise<void>; router: ReturnType<typeof useRouter> }) {
  const plans = dashboard?.plans ?? []
  const skus: Sku[] = []
  if (route === 'dashboard') return <Overview dashboard={dashboard} loading={loading} copied={copied} onCopyId={() => void copyId()} onNavigate={(view) => router.push(view === '兑换码' ? '/redeem-codes' : '/admin/plans')}/>
  if (route === 'redeem') return <RedeemCodes authenticated isAdmin={false} skus={skus} onChanged={refresh} onSignIn={signIn} mode="redeem"/>
  if (route === 'codes' || route === 'codes-new') return <RedeemCodes authenticated isAdmin skus={skus} onChanged={refresh} onSignIn={signIn} mode={route === 'codes' ? 'list' : 'new'}/>
  if (route === 'plans' || route === 'plans-new' || route === 'plans-edit') return <SubscriptionPlanManagement plans={plans} onChanged={refresh} mode={route === 'plans' ? 'list' : route === 'plans-new' ? 'new' : 'edit'} planId={resourceId}/>
  if (route === 'skus' || route === 'skus-new' || route === 'skus-edit') return <Skus plans={plans} mode={route === 'skus' ? 'list' : route === 'skus-new' ? 'new' : 'edit'} skuId={resourceId}/>
  if (route === 'subscriptions' || route === 'payments' || route === 'users' || route === 'logs' || route === 'afdian-events') return <CommerceResources resource={route}/>
  if (route === 'orders' || route === 'order-detail') return <Orders mode={route === 'orders' ? 'list' : 'detail'} orderId={resourceId}/>
  if (route === 'afdian' || route === 'afdian-new' || route === 'afdian-edit') return <AfdianMappings skus={skus} mode={route === 'afdian' ? 'list' : route === 'afdian-new' ? 'new' : 'edit'} mappingId={resourceId}/>
  if (route === 'afdian-orders' || route === 'afdian-order-detail') return <Orders provider="afdian" mode={route === 'afdian-orders' ? 'list' : 'detail'} orderId={resourceId}/>
  return <ApiDocs/>
}

function NavLink({ item, route, mobile = false }: { item: NavItem; route: WorkspaceRoute; mobile?: boolean }) { const active = item.active.includes(route); const Icon = item.icon; return <Link href={item.href} aria-current={active ? 'page' : undefined} className={mobile ? `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${active ? 'bg-[#182238] text-white' : 'text-slate-500'}` : `flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${active ? 'bg-[#edf2ff] font-medium text-[#3157d5]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}><Icon size={mobile ? 14 : 17}/>{item.label}</Link> }
function Brand() { return <Link href="/dashboard" className="flex items-center gap-3 px-2"><span className="grid size-9 place-items-center rounded-xl bg-[#3157d5] text-white shadow-[0_8px_22px_rgba(49,87,213,.25)]"><Zap size={17} fill="currentColor"/></span><span><span className="block font-semibold tracking-tight">AccessHub</span><span className="block text-[10px] tracking-wide text-slate-400">API ACCESS CONTROL</span></span></Link> }
function Avatar({ user }: { user: DashboardData['user'] }) { return <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#e7ebf3] text-xs font-semibold text-slate-600">{user?.image ? <img src={user.image} alt={`${user.name} 的头像`} className="size-full object-cover"/> : user?.name?.slice(0, 1) || '?'}</span> }
function WorkspaceSkeleton() { return <div aria-label="正在加载工作区" className="grid animate-pulse gap-6 xl:grid-cols-[minmax(0,1fr)_390px]"><div className="space-y-4"><div className="h-28 rounded-[20px] bg-white"/><div className="h-24 rounded-[18px] bg-white"/><div className="h-24 rounded-[18px] bg-white"/></div><div className="h-[520px] rounded-[22px] bg-white"/></div> }
