'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, KeyRound, Search, Sparkles, TicketCheck } from 'lucide-react'
import type { AdminData, DashboardGroup, RedeemCode } from './types'

type StatusFilter = '全部' | '可使用' | '已核销' | '已过期'

export function RedeemCodes({ authenticated, isAdmin, groups, onChanged, onSignIn }: { authenticated: boolean; isAdmin: boolean; groups: DashboardGroup[]; onChanged: () => Promise<void>; onSignIn: () => Promise<void> }) {
  const [code, setCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [redeemNotice, setRedeemNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [adminData, setAdminData] = useState<AdminData | null>(null)
  const [adminError, setAdminError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState<string[]>([])
  const [generator, setGenerator] = useState({ groupId: '', count: '10', durationDays: '30' })
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('全部')
  const [copied, setCopied] = useState('')

  const loadAdmin = useCallback(async () => {
    if (!isAdmin) return
    const response = await fetch('/api/admin', { cache: 'no-store' })
    if (!response.ok) return setAdminError('兑换码台账读取失败，请稍后重试')
    const data: AdminData = await response.json()
    setAdminData(data)
    setGenerator((current) => ({ ...current, groupId: current.groupId || data.groups[0]?.id || '' }))
    setAdminError('')
  }, [isAdmin])

  useEffect(() => { void loadAdmin() }, [loadAdmin])

  const redeem = async () => {
    if (!authenticated) return onSignIn()
    if (!code.trim()) return setRedeemNotice({ tone: 'error', text: '请输入兑换码' })
    setRedeeming(true)
    setRedeemNotice(null)
    const response = await fetch('/api/redeem', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) })
    const result = await response.json().catch(() => ({}))
    if (response.ok) {
      setRedeemNotice({ tone: 'success', text: `已加入「${result.group}」，权益立即生效` })
      setCode('')
      await Promise.all([onChanged(), loadAdmin()])
    } else setRedeemNotice({ tone: 'error', text: result.error || '核销失败，请检查兑换码' })
    setRedeeming(false)
  }

  const generate = async () => {
    if (!generator.groupId) return setAdminError('请先选择用户组')
    setGenerating(true)
    setGenerated([])
    const response = await fetch('/api/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'codes', ...generator }) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) setAdminError(result.error || '生成失败，请检查配置')
    else {
      setGenerated(result.codes)
      setAdminError('')
      await loadAdmin()
    }
    setGenerating(false)
  }

  const statusOf = (item: RedeemCode): Exclude<StatusFilter, '全部'> => item.redeemedAt ? '已核销' : item.expiresAt && new Date(item.expiresAt) < new Date() ? '已过期' : '可使用'
  const visibleCodes = useMemo(() => (adminData?.codes ?? []).filter((item) => {
    const matchesText = !query || item.code.toLowerCase().includes(query.toLowerCase()) || item.groupName.toLowerCase().includes(query.toLowerCase())
    return matchesText && (filter === '全部' || statusOf(item) === filter)
  }), [adminData, filter, query])
  const counts = useMemo(() => ({ total: adminData?.codes.length ?? 0, available: adminData?.codes.filter((item) => statusOf(item) === '可使用').length ?? 0, redeemed: adminData?.codes.filter((item) => statusOf(item) === '已核销').length ?? 0 }), [adminData])

  const copy = async (value: string, key = value) => {
    await navigator.clipboard?.writeText(value)
    setCopied(key)
    setTimeout(() => setCopied(''), 1500)
  }

  return <div className="space-y-7">
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,.9fr)]">
      <article className="relative overflow-hidden rounded-[24px] bg-[#182238] p-7 text-white shadow-[0_22px_55px_rgba(24,34,56,.18)]">
        <div className="absolute -right-12 -top-16 size-52 rounded-full bg-[#3157d5]/30 blur-3xl"/>
        <div className="relative"><span className="grid size-10 place-items-center rounded-xl bg-white/10"><TicketCheck size={19}/></span><p className="mt-8 text-xs font-medium text-slate-400">核销兑换码</p><h2 className="mt-2 max-w-lg text-2xl font-semibold tracking-tight">为当前账户添加访问权益</h2><p className="mt-2 text-sm leading-6 text-slate-300">每个兑换码只能核销一次。成功后，工作台配额与有效期会立即更新。</p>
          <div className="mt-7 flex flex-col gap-2 sm:flex-row"><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} onKeyDown={(event) => { if (event.key === 'Enter') void redeem() }} disabled={!authenticated || redeeming} className="h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.08] px-4 font-mono text-sm tracking-wide text-white outline-none transition placeholder:text-slate-500 focus:border-[#7893ee] focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60" placeholder={authenticated ? 'ACCS-XXXXXX-XXXXXX' : '登录后输入兑换码'}/><button onClick={() => void redeem()} disabled={redeeming} className="h-12 rounded-xl bg-white px-5 text-sm font-semibold text-[#182238] transition hover:bg-slate-100 active:translate-y-px disabled:opacity-60">{!authenticated ? '使用 GitHub 登录' : redeeming ? '核销中…' : '立即核销'}</button></div>
          {redeemNotice && <p className={`mt-3 text-xs ${redeemNotice.tone === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>{redeemNotice.text}</p>}
        </div>
      </article>

      <article className="rounded-[24px] bg-white p-6 shadow-[0_18px_55px_rgba(39,55,92,.06)]">
        <div className="flex items-start justify-between"><div><p className="text-xs font-medium text-[#3157d5]">使用说明</p><h3 className="mt-1 text-lg font-semibold">核销前请确认</h3></div><KeyRound size={19} className="text-slate-300"/></div>
        <ol className="mt-6 space-y-5">{[['01', '确认当前登录账户', '权益会绑定到当前 UID，核销后无法转移。'], ['02', '检查权益用户组', '不同兑换码对应不同配额和有效期。'], ['03', '核销后刷新凭据', '新的访问策略会在下一次 API 调用时生效。']].map(([index, title, detail]) => <li key={index} className="grid grid-cols-[32px_1fr] gap-3"><span className="font-mono text-xs text-slate-300">{index}</span><span><strong className="block text-sm font-medium">{title}</strong><span className="mt-1 block text-xs leading-5 text-slate-400">{detail}</span></span></li>)}</ol>
      </article>
    </section>

    {isAdmin && <section className="space-y-6 border-t border-slate-200 pt-8">
      <div><p className="text-xs font-medium tracking-wide text-[#3157d5]">管理员工具</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">兑换码管理</h2><p className="mt-2 text-sm text-slate-500">批量生成、复制和追踪最近 200 个兑换码。</p></div>
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <aside className="h-fit rounded-[22px] bg-white p-6 shadow-[0_18px_55px_rgba(39,55,92,.06)]"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#edf2ff] text-[#3157d5]"><Sparkles size={17}/></span><div><h3 className="font-semibold">批量生成</h3><p className="text-xs text-slate-400">单次最多 1,000 个</p></div></div><div className="mt-6 space-y-4"><Field label="权益用户组"><select value={generator.groupId} onChange={(event) => setGenerator({ ...generator, groupId: event.target.value })} className="access-input">{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></Field><div className="grid grid-cols-2 gap-3"><Field label="生成数量"><input type="number" min="1" max="1000" value={generator.count} onChange={(event) => setGenerator({ ...generator, count: event.target.value })} className="access-input tabular-nums"/></Field><Field label="权益天数"><input type="number" min="1" value={generator.durationDays} onChange={(event) => setGenerator({ ...generator, durationDays: event.target.value })} className="access-input tabular-nums"/></Field></div><button onClick={() => void generate()} disabled={generating || groups.length === 0} className="h-11 w-full rounded-xl bg-[#3157d5] text-sm font-medium text-white transition hover:bg-[#284bc2] active:translate-y-px disabled:opacity-50">{generating ? '生成中…' : '生成兑换码'}</button>{adminError && <p className="text-xs text-rose-600">{adminError}</p>}</div>
          {generated.length > 0 && <div className="mt-5 rounded-xl bg-[#f5f7fb] p-4"><div className="flex items-center justify-between"><p className="text-xs font-medium text-slate-600">本次生成 {generated.length} 个</p><button onClick={() => void copy(generated.join('\n'), 'batch')} className="flex items-center gap-1 text-xs text-[#3157d5]">{copied === 'batch' ? <Check size={13}/> : <Copy size={13}/>}复制全部</button></div><p className="mt-3 truncate font-mono text-xs text-slate-400">{generated[0]}</p></div>}
        </aside>

        <div className="min-w-0 rounded-[22px] bg-white shadow-[0_18px_55px_rgba(39,55,92,.06)]"><div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-5"><MiniMetric value={counts.total} label="总计"/><MiniMetric value={counts.available} label="可使用"/><MiniMetric value={counts.redeemed} label="已核销"/></div><label className="flex h-10 items-center gap-2 rounded-xl bg-[#f5f7fb] px-3 text-slate-400 focus-within:ring-2 focus-within:ring-blue-100"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-xs text-slate-700 outline-none" placeholder="搜索兑换码或用户组"/></label></div>
          <div className="flex gap-1 overflow-x-auto px-5 py-3">{(['全部', '可使用', '已核销', '已过期'] as StatusFilter[]).map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-lg px-3 py-1.5 text-xs transition ${filter === item ? 'bg-[#182238] text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{item}</button>)}</div>
          <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead><tr className="border-y border-slate-100 text-[11px] font-medium text-slate-400"><th className="px-5 py-3">兑换码</th><th className="px-4 py-3">用户组</th><th className="px-4 py-3">权益</th><th className="px-4 py-3">状态</th><th className="px-5 py-3 text-right">创建时间</th></tr></thead><tbody>{visibleCodes.map((item) => { const status = statusOf(item); return <tr key={item.id} className="border-b border-slate-50 text-xs last:border-0 hover:bg-slate-50/70"><td className="px-5 py-3.5"><button onClick={() => void copy(item.code)} className="flex items-center gap-2 font-mono text-slate-700 hover:text-[#3157d5]">{item.code}{copied === item.code ? <Check size={12}/> : <Copy size={12} className="text-slate-300"/>}</button></td><td className="px-4 py-3.5 text-slate-600">{item.groupName}</td><td className="px-4 py-3.5 text-slate-500">{item.durationDays} 天</td><td className="px-4 py-3.5"><StatusBadge status={status}/></td><td className="px-5 py-3.5 text-right text-slate-400">{new Intl.DateTimeFormat('zh-CN').format(new Date(item.createdAt))}</td></tr>})}</tbody></table>{visibleCodes.length === 0 && <div className="px-5 py-12 text-center text-sm text-slate-400">没有符合条件的兑换码</div>}</div>
        </div>
      </div>
    </section>}
  </div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-medium text-slate-500">{label}</span>{children}</label> }
function MiniMetric({ value, label }: { value: number; label: string }) { return <div><p className="font-mono text-lg font-semibold tabular-nums">{value}</p><p className="text-[10px] text-slate-400">{label}</p></div> }
function StatusBadge({ status }: { status: Exclude<StatusFilter, '全部'> }) { return <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-medium ${status === '可使用' ? 'bg-emerald-50 text-emerald-700' : status === '已核销' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>{status}</span> }
