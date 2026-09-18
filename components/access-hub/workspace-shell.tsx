'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChevronDown, LogOut, Menu, RefreshCw, X, Zap } from 'lucide-react'
import type { DashboardData } from './types'
import type { WorkspaceNavItem, WorkspaceRoute } from './workspace-navigation'
import { activeWorkspaceGroup, visibleWorkspaceGroups, workspaceRouteMeta } from './workspace-navigation'

type Props = {
  route: WorkspaceRoute
  user: DashboardData['user']
  isAdmin: boolean
  initializing: boolean
  loading: boolean
  error: string
  onRefresh: () => void
  onSignOut: () => void
  children: React.ReactNode
}

export function WorkspaceShell({ route, user, isAdmin, initializing, loading, error, onRefresh, onSignOut, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const meta = workspaceRouteMeta[route]
  const groups = visibleWorkspaceGroups(isAdmin)
  const activeGroup = activeWorkspaceGroup(route, isAdmin)

  return <div className="min-h-dvh bg-[#f3f6fb] text-[#172033]">
    <a href="#main-content" className="sr-only z-50 rounded-lg bg-white px-4 py-2 text-sm focus:not-sr-only focus:fixed focus:left-4 focus:top-4">跳到主要内容</a>
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[272px] border-r border-[#e3e9f3] bg-white px-5 py-6 lg:flex lg:flex-col">
      <Brand isAdmin={isAdmin}/>
      <nav className="mt-7 min-h-0 flex-1 space-y-6 overflow-y-auto pr-1" aria-label="主导航">
        {initializing ? <NavigationSkeleton/> : groups.map((group) => <div key={group.label}>
          <p className="mb-2 px-3 text-[10px] font-semibold tracking-[.14em] text-slate-300">{group.label.toUpperCase()}</p>
          <div className="space-y-1">{group.items.map((item) => <NavLink key={item.href} item={item} route={route}/>)}</div>
        </div>)}
      </nav>
      <div className="mt-4 rounded-[18px] bg-[#f4f6fa] p-3.5"><div className="flex items-center gap-3"><Avatar user={user}/><div className="min-w-0"><p className="truncate text-sm font-medium">{user?.name || '正在读取账户'}</p><p className="mt-0.5 truncate text-[11px] text-slate-400">{user ? isAdmin ? '管理员工作区' : '个人工作区' : '正在验证身份'}</p></div>{user && <button onClick={onSignOut} aria-label="退出登录" className="ml-auto rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-slate-600 active:translate-y-px"><LogOut size={15}/></button>}</div></div>
    </aside>

    <main id="main-content" className="min-h-dvh lg:pl-[272px]">
      <header className="sticky top-0 z-20 border-b border-[#e3e9f3] bg-white/90 backdrop-blur-xl">
        <div className="flex h-[76px] items-center justify-between px-5 sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setMobileOpen((open) => !open)} className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 lg:hidden" aria-label={mobileOpen ? '关闭导航' : '打开导航'} aria-expanded={mobileOpen}>{mobileOpen ? <X size={17}/> : <Menu size={17}/>}</button>
            <div className="min-w-0"><p className="truncate text-[10px] font-medium tracking-[.12em] text-slate-400 sm:text-[11px]">{meta.eyebrow}</p><h1 className="mt-1 truncate text-lg font-semibold tracking-tight sm:text-xl">{meta.title}</h1></div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3"><span className="mr-1 hidden items-center gap-2 text-xs text-slate-500 sm:flex"><span className={`size-2 rounded-full ${error ? 'bg-rose-500' : loading ? 'bg-amber-400' : 'bg-emerald-500'}`}/>{error ? '账户数据异常' : loading ? '读取账户数据' : '账户数据就绪'}</span><button onClick={onRefresh} disabled={loading} aria-label="刷新账户数据" className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/></button><div className="lg:hidden"><Avatar user={user}/></div></div>
        </div>
        {!initializing && !mobileOpen && <div className="flex items-center gap-2 px-5 pb-3 lg:hidden"><span className="text-[11px] text-slate-400">当前分区</span><button onClick={() => setMobileOpen(true)} className="flex min-w-0 items-center gap-1 rounded-lg bg-[#edf2ff] px-2.5 py-1.5 text-xs font-medium text-[#3157d5]"><span className="truncate">{activeGroup?.label || '快速导航'}</span><ChevronDown size={13}/></button></div>}
        {mobileOpen && <MobileNavigation groups={groups} route={route} onNavigate={() => setMobileOpen(false)}/>} 
      </header>
      <div className="mx-auto max-w-[1320px] px-5 pb-14 pt-7 sm:px-8 lg:px-10 lg:pt-10">
        <div className="mb-7"><p className="max-w-2xl text-sm leading-6 text-slate-500">{meta.description}</p>{error && <button onClick={onRefresh} className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-left text-xs text-rose-600">{error} · 点击重试</button>}</div>
        {children}
      </div>
    </main>
  </div>
}

function MobileNavigation({ groups, route, onNavigate }: { groups: ReturnType<typeof visibleWorkspaceGroups>; route: WorkspaceRoute; onNavigate: () => void }) {
  return <nav className="max-h-[calc(100dvh-76px)] overflow-y-auto border-t border-slate-100 bg-white px-5 py-5 shadow-[0_18px_40px_rgba(39,55,92,.12)] lg:hidden" aria-label="移动端导航">
    <div className="grid gap-5 sm:grid-cols-2">{groups.map((group) => <section key={group.label}><p className="mb-2 text-[10px] font-semibold tracking-[.14em] text-slate-300">{group.label.toUpperCase()}</p><div className="grid gap-1">{group.items.map((item) => <NavLink key={item.href} item={item} route={route} onClick={onNavigate} detailed/>)}</div></section>)}</div>
  </nav>
}

function NavLink({ item, route, onClick, detailed = false }: { item: WorkspaceNavItem; route: WorkspaceRoute; onClick?: () => void; detailed?: boolean }) {
  const active = item.active.includes(route)
  const Icon = item.icon
  return <Link href={item.href} onClick={onClick} aria-current={active ? 'page' : undefined} className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition active:translate-y-px ${active ? 'bg-[#edf2ff] font-medium text-[#3157d5]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>
    {active && !detailed && <span className="absolute -left-5 h-5 w-0.5 rounded-r bg-[#3157d5]"/>}<Icon size={17} strokeWidth={1.8}/><span className="min-w-0"><span className="block truncate">{item.label}</span>{detailed && <span className="mt-0.5 block truncate text-[10px] font-normal text-slate-400">{item.description}</span>}</span>
  </Link>
}

function Brand({ isAdmin }: { isAdmin: boolean }) { return <Link href={isAdmin ? '/admin' : '/dashboard'} className="flex items-center gap-3 px-2"><span className="grid size-9 place-items-center rounded-xl bg-[#3157d5] text-white shadow-[0_8px_22px_rgba(49,87,213,.25)]"><Zap size={17} fill="currentColor"/></span><span><span className="block font-semibold tracking-tight">AccessHub</span><span className="block text-[10px] tracking-wide text-slate-400">ACCESS CONTROL</span></span></Link> }
function Avatar({ user }: { user: DashboardData['user'] }) { return <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#e7ebf3] text-xs font-semibold text-slate-600">{user?.image ? <img src={user.image} alt={`${user.name} 的头像`} className="size-full object-cover"/> : user?.name?.slice(0, 1) || '?'}</span> }
function NavigationSkeleton() { return <div className="space-y-6">{[2, 3, 2].map((count, index) => <div key={index}><span className="mb-2 block h-2.5 w-16 animate-pulse rounded bg-slate-100"/><div className="space-y-1">{Array.from({ length: count }).map((_, item) => <span key={item} className="block h-10 animate-pulse rounded-xl bg-slate-50"/>)}</div></div>)}</div> }

export function WorkspaceSkeleton() { return <div aria-label="正在加载工作区" className="grid animate-pulse gap-6 xl:grid-cols-[minmax(0,1fr)_390px]"><div className="space-y-4"><div className="h-28 rounded-[20px] bg-white"/><div className="h-24 rounded-[18px] bg-white"/><div className="h-24 rounded-[18px] bg-white"/></div><div className="h-[520px] rounded-[22px] bg-white"/></div> }
