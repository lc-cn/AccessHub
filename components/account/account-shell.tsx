'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Activity, ArrowLeft, BadgeCheck, CreditCard, Link2, LogOut, ReceiptText, ShieldCheck, UserRound, Zap } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

const items = [
  { href: '/account', label: '账户概览', icon: UserRound },
  { href: '/account/profile', label: '个人资料', icon: BadgeCheck },
  { href: '/account/security', label: '登录与安全', icon: ShieldCheck },
  { href: '/account/connections', label: '账号绑定', icon: Link2 },
  { href: '/account/entitlements', label: '我的权益', icon: CreditCard },
  { href: '/account/usage', label: '用量明细', icon: Activity },
  { href: '/account/orders', label: '我的订单', icon: ReceiptText },
]

export function AccountShell({ user, children }: { user: { name: string; email: string; image?: string | null }; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const signOut = async () => { await authClient.signOut(); router.replace('/login'); router.refresh() }
  return <div className="account-canvas min-h-dvh bg-[#f3f6fb] text-[#172033]">
    <a href="#account-content" className="sr-only z-50 rounded-lg bg-white px-4 py-2 text-sm focus:not-sr-only focus:fixed focus:left-4 focus:top-4">跳到主要内容</a>
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-[#e3e9f3] bg-white px-5 py-6 lg:flex lg:flex-col">
      <Link href="/dashboard" className="flex items-center gap-3 px-2"><span className="grid size-9 place-items-center rounded-xl bg-[#3157d5] text-white shadow-[0_8px_22px_rgba(49,87,213,.25)]"><Zap size={17} fill="currentColor"/></span><span><strong className="block font-semibold tracking-tight">AccessHub</strong><span className="block text-[10px] tracking-wide text-slate-400">PERSONAL ACCOUNT</span></span></Link>
      <Link href="/dashboard" className="mt-7 flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"><ArrowLeft size={15}/>返回控制台</Link>
      <nav className="mt-4 flex-1 space-y-1" aria-label="个人中心导航">{items.map((item) => { const Icon = item.icon; const active = pathname === item.href; return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition duration-200 active:translate-y-px ${active ? 'bg-[#edf2ff] font-medium text-[#3157d5]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>{active && <span className="absolute -left-5 h-5 w-0.5 rounded-r bg-[#3157d5]"/>}<Icon size={17} strokeWidth={1.8}/>{item.label}</Link> })}</nav>
      <div className="mb-3 flex gap-3 px-2 text-[10px] text-slate-400"><Link href="/privacy" className="hover:text-slate-600">隐私政策</Link><Link href="/terms" className="hover:text-slate-600">服务条款</Link></div><div className="rounded-[18px] bg-[#f4f6fa] p-3.5"><div className="flex items-center gap-3"><Avatar user={user}/><div className="min-w-0"><p className="truncate text-sm font-medium">{user.name}</p><p className="mt-0.5 truncate text-[11px] text-slate-400">{user.email}</p></div><button onClick={() => void signOut()} aria-label="退出登录" className="ml-auto rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-slate-600 active:translate-y-px"><LogOut size={15}/></button></div></div>
    </aside>
    <main id="account-content" className="relative min-h-dvh lg:pl-64"><header className="sticky top-0 z-10 border-b border-[#e3e9f3] bg-white/90 backdrop-blur-xl lg:hidden"><div className="flex min-h-[68px] items-center justify-between gap-4 px-5 py-3"><div><p className="text-[10px] font-medium tracking-[.12em] text-slate-400">个人中心</p><h1 className="mt-0.5 text-lg font-semibold tracking-tight">管理你的账户</h1></div><div className="flex items-center gap-3"><Link href="/dashboard" aria-label="返回控制台" className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-500"><ArrowLeft size={16}/></Link><Avatar user={user}/></div></div><nav className="flex gap-1 overflow-x-auto px-5 pb-3" aria-label="个人中心导航">{items.map((item) => <Link key={item.href} href={item.href} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${pathname === item.href ? 'bg-[#182238] text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{item.label}</Link>)}</nav></header><div className="relative mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">{children}</div></main>
  </div>
}

function Avatar({ user }: { user: { name: string; image?: string | null } }) { return <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#e7ebf3] text-xs font-semibold text-slate-600 ring-1 ring-white">{user.image ? <img src={user.image} alt={`${user.name} 的头像`} className="size-full object-cover"/> : user.name.slice(0, 1).toUpperCase()}</span> }
