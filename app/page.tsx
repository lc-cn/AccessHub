'use client'

import { useCallback, useEffect, useState } from 'react'
import { BookOpen, HeartHandshake, LayoutDashboard, LogOut, RefreshCw, Ticket, Users, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ApiDocs } from '@/components/access-hub/api-docs'
import { AfdianMappings } from '@/components/access-hub/afadian-mappings'
import { GroupManagement } from '@/components/access-hub/group-management'
import { Overview } from '@/components/access-hub/overview'
import { RedeemCodes } from '@/components/access-hub/redeem-codes'
import type { DashboardData } from '@/components/access-hub/types'
import { authClient } from '@/lib/auth-client'

type View = '概览' | '兑换码' | '用户组' | '爱发电' | 'API 文档'
const viewMeta: Record<View, { eyebrow: string; description: string }> = {
  '概览': { eyebrow: '工作台', description: '查看账户、访问权益与今天的 API 使用情况。' },
  '兑换码': { eyebrow: '权益中心', description: '核销兑换码；管理员可以在这里生成并追踪兑换码。' },
  '用户组': { eyebrow: '管理员', description: '配置用户组的频率、每日配额和默认策略。' },
  '爱发电': { eyebrow: '管理员', description: '维护爱发电方案与用户组或 credits 权益之间的自动发码规则。' },
  'API 文档': { eyebrow: '开发者', description: '查看当前可用接口及接入方式。' },
}

export default function Page() {
  const router = useRouter()
  const [active, setActive] = useState<View>('概览')
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [dashboardError, setDashboardError] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setDashboardError('')
    try {
      const response = await fetch('/api/dashboard', { cache: 'no-store' })
      if (response.status === 401) {
        router.replace('/login')
        return
      }
      if (!response.ok) throw new Error('dashboard request failed')
      setDashboard(await response.json())
    } catch {
      setDashboardError('暂时无法读取账户数据，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { void loadDashboard() }, [loadDashboard])

  const signIn = async () => { await authClient.signIn.social({ provider: 'github', callbackURL: window.location.origin }) }
  const signOut = async () => {
    await authClient.signOut()
    router.replace('/login')
    router.refresh()
  }
  const copyId = async () => {
    if (!dashboard?.user?.id) return
    await navigator.clipboard?.writeText(dashboard.user.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const user = dashboard?.user ?? null
  const isAuthenticated = dashboard?.authenticated === true
  const isAdmin = user?.role === 'admin'
  const views: View[] = isAdmin ? ['概览', '兑换码', '用户组', '爱发电', 'API 文档'] : ['概览', '兑换码', 'API 文档']

  return <div className="min-h-screen bg-[#f3f6fb] text-[#172033]">
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-[#e3e9f3] bg-white px-5 py-6 lg:flex lg:flex-col">
      <Brand/>
      <nav className="mt-10 space-y-1" aria-label="主导航">{views.map((view) => <NavButton key={view} view={view} active={active === view} onClick={() => setActive(view)}/>)}</nav>
      <div className="mt-auto rounded-[18px] bg-[#f4f6fa] p-3.5"><div className="flex items-center gap-3"><Avatar user={user}/><div className="min-w-0"><p className="truncate text-sm font-medium">{user?.name || '尚未登录'}</p><p className="mt-0.5 truncate text-[11px] text-slate-400">{isAdmin ? '管理员' : isAuthenticated ? '普通用户' : '登录后查看账户'}</p></div>{isAuthenticated && <button onClick={signOut} aria-label="退出登录" className="ml-auto rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-slate-600 active:translate-y-px"><LogOut size={15}/></button>}</div></div>
    </aside>

    <main className="min-h-screen lg:pl-64">
      <header className="sticky top-0 z-10 border-b border-[#e3e9f3] bg-white/90 backdrop-blur-xl"><div className="flex h-[76px] items-center justify-between px-5 sm:px-8 lg:px-10"><div><p className="text-[11px] font-medium tracking-[.12em] text-slate-400">{viewMeta[active].eyebrow}</p><h1 className="mt-1 text-xl font-semibold tracking-tight">{active}</h1></div><div className="flex items-center gap-2 sm:gap-3"><span className="mr-2 hidden items-center gap-2 text-xs text-slate-500 sm:flex"><span className={`size-2 rounded-full ${dashboardError ? 'bg-rose-500' : loading ? 'bg-amber-400' : 'bg-emerald-500'}`}/>{dashboardError ? '同步失败' : loading ? '同步中' : '数据已同步'}</span><button onClick={() => void loadDashboard()} disabled={loading} aria-label="刷新数据" className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 active:translate-y-px disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/></button><div className="lg:hidden"><Avatar user={user}/></div></div></div>
        <nav className="flex gap-1 overflow-x-auto px-5 pb-3 lg:hidden" aria-label="移动端导航">{views.map((view) => <button key={view} onClick={() => setActive(view)} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${active === view ? 'bg-[#182238] text-white' : 'text-slate-500'}`}>{view}</button>)}</nav>
      </header>

      <div className="mx-auto max-w-[1320px] px-5 pb-14 pt-8 sm:px-8 lg:px-10 lg:pt-10">
        <div className="mb-8"><p className="max-w-2xl text-sm leading-6 text-slate-500">{viewMeta[active].description}</p>{dashboardError && <button onClick={() => void loadDashboard()} className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{dashboardError} 点击重试</button>}</div>
        {active === '概览' && <Overview dashboard={dashboard} loading={loading} copied={copied} onCopyId={() => void copyId()} onNavigate={setActive}/>}
        {active === '兑换码' && <RedeemCodes authenticated={isAuthenticated} isAdmin={isAdmin} groups={dashboard?.groups ?? []} onChanged={loadDashboard} onSignIn={signIn}/>}
        {active === '用户组' && isAdmin && <GroupManagement groups={dashboard?.groups ?? []} onChanged={loadDashboard}/>}
        {active === '爱发电' && isAdmin && <AfdianMappings groups={dashboard?.groups ?? []}/>}
        {active === 'API 文档' && <ApiDocs/>}
      </div>
    </main>
  </div>
}

function Brand() { return <div className="flex items-center gap-3 px-2"><span className="grid size-9 place-items-center rounded-xl bg-[#3157d5] text-white shadow-[0_8px_22px_rgba(49,87,213,.25)]"><Zap size={17} fill="currentColor"/></span><span><span className="block font-semibold tracking-tight">AccessHub</span><span className="block text-[10px] tracking-wide text-slate-400">API ACCESS CONTROL</span></span></div> }

function Avatar({ user }: { user: DashboardData['user'] }) { return <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#e7ebf3] text-xs font-semibold text-slate-600">{user?.image ? <img src={user.image} alt={`${user.name} 的头像`} className="size-full object-cover"/> : user?.name?.slice(0, 1) || '?'}</span> }

function NavButton({ view, active, onClick }: { view: View; active: boolean; onClick: () => void }) {
  const Icon = view === '概览' ? LayoutDashboard : view === '兑换码' ? Ticket : view === '用户组' ? Users : view === '爱发电' ? HeartHandshake : BookOpen
  return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition active:translate-y-px ${active ? 'bg-[#edf2ff] font-medium text-[#3157d5]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}><Icon size={17}/>{view}</button>
}
