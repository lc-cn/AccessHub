'use client'

import { useCallback, useEffect, useState } from 'react'
import { Activity, ArrowUpRight, Check, Copy, GitBranch, KeyRound, LayoutDashboard, LogOut, RefreshCw, Settings2, ShieldCheck, Ticket, Users, Zap } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

type DashboardData = {
  authenticated: boolean
  user: { id: string; name: string; image: string | null; role: string; createdAt: string } | null
  currentGroup?: { groupId: string; groupName: string; rateLimit: number; dailyLimit: number | null; expiresAt: string | null } | null
  todayUsage?: number
  activeBenefits?: number
  groups: { id: string; name: string; description: string; rateLimit: number; dailyLimit: number | null; isDefault: boolean; memberCount: number }[]
}

export default function Page() {
  const [active, setActive] = useState('概览')
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [redeemed, setRedeemed] = useState(false)
  const [message, setMessage] = useState('')
  const [adminData, setAdminData] = useState<{ groups: { id: string; name: string; rateLimit: number; dailyLimit: number | null; isDefault: boolean }[]; codes: { code: string; redeemedAt: string | null }[] } | null>(null)
  const [newGroup, setNewGroup] = useState({ name: '', rateLimit: '60', dailyLimit: '10000' })
  const [codeCount, setCodeCount] = useState('10')
  const [durationDays, setDurationDays] = useState('30')
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [dashboardError, setDashboardError] = useState('')
  const [loading, setLoading] = useState(true)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setDashboardError('')
    try {
      const response = await fetch('/api/dashboard', { cache: 'no-store' })
      if (!response.ok) throw new Error('dashboard request failed')
      setDashboard(await response.json())
    } catch {
      setDashboardError('暂时无法读取账户数据，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadDashboard() }, [loadDashboard])

  const signIn = async () => {
    await authClient.signIn.social({ provider: 'github', callbackURL: window.location.origin })
  }

  const signOut = async () => {
    await authClient.signOut()
    setAdminData(null)
    await loadDashboard()
  }

  const loadAdmin = async () => {
    const response = await fetch('/api/admin')
    if (response.ok) setAdminData(await response.json())
    else {
      setAdminData(null)
      setMessage(response.status === 401 ? '请先登录' : '仅管理员可以访问后台')
    }
  }

  const redeem = async () => {
    if (!code) return
    const response = await fetch('/api/redeem', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) })
    const result = await response.json()
    setMessage(response.ok ? `兑换成功：${result.group}` : result.error)
    if (response.ok) {
      setRedeemed(true)
      await loadDashboard()
    }
  }

  const copyId = async () => {
    if (!dashboard?.user?.id) return
    await navigator.clipboard?.writeText(dashboard.user.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const currentGroup = dashboard?.currentGroup
  const currentUser = dashboard?.user
  const isAuthenticated = dashboard?.authenticated === true
  const registrationDate = currentUser?.createdAt
    ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long' }).format(new Date(currentUser.createdAt))
    : '—'

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-[#172033]">
      <aside className="fixed inset-y-0 left-0 hidden w-[248px] border-r border-[#e5eaf2] bg-white px-5 py-6 lg:block">
        <div className="mb-10 flex items-center gap-3 px-2"><div className="grid size-9 place-items-center rounded-xl bg-[#3157d5] text-white shadow-lg shadow-blue-200"><Zap size={18} fill="currentColor" /></div><div><div className="font-semibold tracking-tight">AccessHub</div><div className="text-[11px] text-slate-400">API access control</div></div></div>
        <div className="space-y-1">{['概览', '兑换码', 'API 文档'].map((item, i) => <button key={item} onClick={() => setActive(item)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${active === item ? 'bg-[#eef2ff] font-medium text-[#3157d5]' : 'text-slate-500 hover:bg-slate-50'}`}>{i === 0 ? <LayoutDashboard size={17} /> : i === 1 ? <Ticket size={17} /> : <KeyRound size={17} />}{item}</button>)}</div>
        <div className="mt-8 border-t border-slate-100 pt-7"><div className="px-3 pb-3 text-[11px] font-medium uppercase tracking-widest text-slate-400">管理</div><button onClick={() => { setActive('管理后台'); loadAdmin() }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm ${active === '管理后台' ? 'bg-[#eef2ff] text-[#3157d5]' : 'text-slate-500 hover:bg-slate-50'}`}><Settings2 size={17} />管理后台</button></div>
        <div className="absolute bottom-6 left-5 right-5 rounded-2xl bg-[#f7f8fc] p-3"><div className="flex items-center gap-2"><div className="grid size-8 place-items-center overflow-hidden rounded-full bg-slate-200 text-xs font-semibold">{currentUser?.image ? <img src={currentUser.image} alt="" className="size-full object-cover" /> : currentUser?.name?.slice(0, 1) || '?'}</div><div className="min-w-0"><div className="truncate text-xs font-medium">{currentUser?.name || '尚未登录'}</div><div className="truncate text-[11px] text-slate-400">{currentUser?.role === 'admin' ? '管理员' : isAuthenticated ? '用户' : '登录后查看账户'}</div></div>{isAuthenticated && <button onClick={signOut} aria-label="退出登录" className="ml-auto text-slate-400 hover:text-slate-600"><LogOut size={15} /></button>}</div></div>
      </aside>

      <main className="lg:pl-[248px]"><header className="flex h-[76px] items-center justify-between border-b border-[#e5eaf2] bg-white px-6 lg:px-10"><div><p className="text-xs text-slate-400">工作台 / {active}</p><h1 className="mt-1 text-xl font-semibold tracking-tight">{active}</h1></div><div className="flex items-center gap-4"><span className="hidden items-center gap-2 text-xs text-slate-500 sm:flex"><span className={`size-2 rounded-full ${dashboardError ? 'bg-rose-500' : loading ? 'bg-amber-400' : 'bg-emerald-500'}`} />{dashboardError ? '数据服务异常' : loading ? '正在同步数据' : '数据已同步'}</span><button onClick={loadDashboard} disabled={loading} aria-label="刷新数据" className="grid size-9 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button><button onClick={signIn} aria-label="GitHub 登录" className="grid size-9 place-items-center rounded-full bg-[#3157d5] text-white"><GitBranch size={17} /></button></div></header>
        <div className="mx-auto max-w-[1280px] px-6 py-8 lg:px-10">
          <section className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className={`mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${isAuthenticated ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}><ShieldCheck size={13} />{isAuthenticated ? '账户已验证' : '尚未登录'}</div><h2 className="text-3xl font-semibold tracking-[-0.03em]">{isAuthenticated ? `你好，${currentUser?.name}` : '欢迎使用 AccessHub'}</h2><p className="mt-2 text-sm text-slate-500">{dashboardError || (isAuthenticated ? '查看你的 API 访问权限与兑换权益' : '登录后查看你的真实账户数据')}</p></div>{!isAuthenticated && <button onClick={signIn} className="flex items-center justify-center gap-2 rounded-xl bg-[#3157d5] px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-blue-200 transition hover:bg-[#284bc2]"><GitBranch size={16} /> GitHub 登录</button>}</section>
          <section className="grid gap-4 md:grid-cols-3"><Stat icon={<Users size={18}/>} label="当前用户组" value={loading ? '读取中…' : currentGroup?.groupName || '—'} sub={currentGroup ? (currentGroup.expiresAt ? `有效至 ${new Intl.DateTimeFormat('zh-CN').format(new Date(currentGroup.expiresAt))}` : '长期有效') : '登录后显示'} tone="blue"/><Stat icon={<Activity size={18}/>} label="今日 API 调用" value={loading ? '—' : (dashboard?.todayUsage ?? 0).toLocaleString()} sub={currentGroup ? `/ ${currentGroup.dailyLimit?.toLocaleString() ?? '不限额'} 次` : '登录后显示'} tone="violet"/><Stat icon={<Ticket size={18}/>} label="有效兑换权益" value={loading ? '—' : String(dashboard?.activeBenefits ?? 0)} sub={isAuthenticated ? '已生效的兑换权益' : '登录后显示'} tone="amber"/></section>
          {active === '管理后台' && <section className="mt-8 rounded-2xl border border-[#e5eaf2] bg-white p-6"><div className="mb-5"><h3 className="font-semibold">管理后台</h3><p className="mt-1 text-xs text-slate-400">首位登录用户自动成为管理员，可配置用户组策略与批量兑换码</p></div>{adminData ? <div className="grid gap-6 lg:grid-cols-2"><div><h4 className="mb-3 text-sm font-medium">用户组策略</h4><div className="space-y-2">{adminData.groups.map(group => <div key={group.id} className="flex items-center justify-between rounded-xl bg-[#f7f8fc] px-4 py-3 text-sm"><span>{group.name}{group.isDefault && <span className="ml-2 text-xs text-[#3157d5]">默认组</span>}</span><span className="text-xs text-slate-500">{group.rateLimit}/分钟 · {group.dailyLimit ?? '不限'}/日</span></div>)}</div><div className="mt-4 grid grid-cols-3 gap-2"><input aria-label="用户组名称" value={newGroup.name} onChange={e => setNewGroup({ ...newGroup, name: e.target.value })} placeholder="组名称" className="rounded-lg border px-3 py-2 text-xs"/><input aria-label="频率限制" value={newGroup.rateLimit} onChange={e => setNewGroup({ ...newGroup, rateLimit: e.target.value })} placeholder="频率/分钟" className="rounded-lg border px-3 py-2 text-xs"/><button onClick={async () => { const r = await fetch('/api/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'group', name: newGroup.name, rateLimit: newGroup.rateLimit, dailyLimit: newGroup.dailyLimit }) }); if (r.ok) loadAdmin() }} className="rounded-lg bg-[#3157d5] px-3 py-2 text-xs font-medium text-white">新建用户组</button></div></div><div><h4 className="mb-3 text-sm font-medium">生成兑换码</h4><div className="grid gap-2"><select aria-label="兑换码用户组" id="code-group" className="rounded-lg border px-3 py-2 text-sm">{adminData.groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select><div className="grid grid-cols-2 gap-2"><input aria-label="生成数量" value={codeCount} onChange={e => setCodeCount(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="数量"/><input aria-label="有效天数" value={durationDays} onChange={e => setDurationDays(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="有效天数"/></div><button onClick={async () => { const groupId = (document.getElementById('code-group') as HTMLSelectElement).value; const r = await fetch('/api/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'codes', groupId, count: codeCount, durationDays }) }); const data = await r.json(); setMessage(r.ok ? `已生成 ${data.codes.length} 个兑换码` : data.error); if (r.ok) loadAdmin() }} className="rounded-lg bg-[#172033] px-3 py-2 text-sm font-medium text-white">批量生成</button></div><div className="mt-4 max-h-32 overflow-auto rounded-lg bg-[#f7f8fc] p-3 font-mono text-xs text-slate-500">{adminData.codes.map(item => <div key={item.code}>{item.code} {item.redeemedAt ? '· 已核销' : ''}</div>)}</div></div></div> : <p className="text-sm text-slate-500">{message || '正在加载管理员权限…'}</p>}</section>}
          <section className="mt-8 grid gap-6 xl:grid-cols-[1.3fr_1fr]"><div className="rounded-2xl border border-[#e5eaf2] bg-white p-6"><div className="mb-5 flex items-center justify-between"><div><h3 className="font-semibold">身份信息</h3><p className="mt-1 text-xs text-slate-400">你的唯一身份 ID 用于调用 API</p></div><span className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs text-slate-500">UID</span></div><div className="flex items-center justify-between rounded-xl bg-[#f7f8fc] px-4 py-3"><code className="min-w-0 truncate text-sm text-slate-600">{currentUser?.id || '登录后显示真实身份 ID'}</code><button onClick={copyId} disabled={!currentUser} className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-[#3157d5] disabled:text-slate-300">{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? '已复制' : '复制'}</button></div><div className="mt-6 grid grid-cols-2 gap-4"><Info label="登录方式" value={isAuthenticated ? 'GitHub OAuth' : '—'}/><Info label="注册时间" value={registrationDate}/><Info label="当前组" value={currentGroup?.groupName || '—'}/><Info label="组内有效期" value={currentGroup ? (currentGroup.expiresAt ? new Intl.DateTimeFormat('zh-CN').format(new Date(currentGroup.expiresAt)) : '长期有效') : '—'}/></div></div><div className="rounded-2xl border border-[#e5eaf2] bg-white p-6"><div className="mb-5 flex items-center justify-between"><div><h3 className="font-semibold">核销兑换码</h3><p className="mt-1 text-xs text-slate-400">输入兑换码获得专属用户组权益</p></div><Ticket size={19} className="text-[#3157d5]" /></div><input value={code} onChange={e => setCode(e.target.value.toUpperCase())} disabled={!isAuthenticated} placeholder={isAuthenticated ? '例如：ACCS-XXXX-XXXX' : '请先登录后兑换'} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition placeholder:text-slate-300 focus:border-[#3157d5] focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50"/><button onClick={isAuthenticated ? redeem : signIn} className="mt-3 h-11 w-full rounded-xl bg-[#172033] text-sm font-medium text-white transition hover:bg-slate-800">{!isAuthenticated ? '使用 GitHub 登录' : redeemed ? '兑换成功，权益已到账' : '立即核销'}</button>{message && <p className="mt-3 text-center text-xs text-emerald-600">{message}</p>}</div></section>
          <section className="mt-8"><div className="mb-4 flex items-end justify-between"><div><h3 className="font-semibold">用户组与访问策略</h3><p className="mt-1 text-sm text-slate-500">直接来自当前数据库的用户组配置与有效成员数</p></div><button onClick={loadDashboard} className="hidden items-center gap-1 text-xs font-medium text-[#3157d5] sm:flex">刷新数据 <ArrowUpRight size={14}/></button></div>{!loading && dashboard?.groups.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">尚未配置用户组</div> : <div className="grid gap-4 md:grid-cols-3">{dashboard?.groups.map((group, index) => <div key={group.id} className="rounded-2xl border border-[#e5eaf2] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-100"><div className="mb-5 flex items-start justify-between"><div className={`grid size-10 place-items-center rounded-xl ${index % 3 === 0 ? 'bg-blue-50 text-blue-600' : index % 3 === 1 ? 'bg-violet-50 text-violet-600' : 'bg-amber-50 text-amber-600'}`}><Users size={18}/></div><span className="rounded-full bg-slate-50 px-2 py-1 text-[11px] text-slate-500">{group.isDefault ? '默认组' : '用户组'}</span></div><h4 className="font-medium">{group.name}</h4><p className="mt-1 text-xs text-slate-400">{group.description || '暂无描述'}</p><div className="mt-5 space-y-3 border-t border-slate-100 pt-4"><div className="flex justify-between text-xs"><span className="text-slate-400">频率限制</span><span className="font-medium text-slate-600">{group.rateLimit.toLocaleString()} 次/分钟</span></div><div className="flex justify-between text-xs"><span className="text-slate-400">每日配额</span><span className="font-medium text-slate-600">{group.dailyLimit?.toLocaleString() ?? '不限额'}</span></div><div className="flex justify-between text-xs"><span className="text-slate-400">有效成员</span><span className="font-medium text-slate-600">{group.memberCount.toLocaleString()}</span></div></div></div>)}</div>}</section>
        </div>
      </main>
    </div>
  )
}

function Stat({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub: string; tone: string }) { return <div className="rounded-2xl border border-[#e5eaf2] bg-white p-5"><div className="flex items-center justify-between"><div className={`grid size-9 place-items-center rounded-xl ${tone === 'blue' ? 'bg-blue-50 text-blue-600' : tone === 'violet' ? 'bg-violet-50 text-violet-600' : 'bg-amber-50 text-amber-600'}`}>{icon}</div><span className="text-xs text-slate-400">实时数据</span></div><p className="mt-5 text-xs text-slate-400">{label}</p><div className="mt-1 flex items-baseline gap-2"><span className="text-2xl font-semibold tracking-tight">{value}</span><span className="text-xs text-slate-400">{sub}</span></div></div> }
function Info({ label, value }: { label: string; value: string }) { return <div><div className="text-[11px] text-slate-400">{label}</div><div className="mt-1 text-sm font-medium text-slate-600">{value}</div></div> }
