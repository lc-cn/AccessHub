'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Copy, Download, KeyRound, Plus, Search, Sparkles, TicketCheck } from 'lucide-react'
import type { AdminData, DashboardPlan, RedeemCode } from './types'
import { requestJson } from '@/lib/http-client'

type StatusFilter = '全部' | '可使用' | '已核销' | '已过期'
type Props = { authenticated: boolean; isAdmin: boolean; plans: DashboardPlan[]; onChanged: () => Promise<void>; onSignIn: () => Promise<void>; mode: 'redeem' | 'list' | 'new' }

export function RedeemCodes({ authenticated, isAdmin, plans, onChanged, onSignIn, mode }: Props) {
  const [code, setCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [redeemNotice, setRedeemNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [adminData, setAdminData] = useState<AdminData | null>(null)
  const [adminError, setAdminError] = useState('')
  const [adminLoading, setAdminLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState<string[]>([])
  const [generator, setGenerator] = useState({ kind: 'plan' as 'plan' | 'credits', planId: '', credits: '1000', count: '10', durationValue: '1', durationUnit: 'month' as 'day' | 'month' | 'quarter' | 'year' })
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('全部')
  const [copied, setCopied] = useState('')

  const loadAdmin = useCallback(async () => {
    if (!isAdmin || mode === 'redeem') return
    setAdminLoading(true)
    try {
      const data = await requestJson<AdminData>('/api/admin?section=codes', { cache: 'no-store' })
      setAdminData(data)
      setGenerator((current) => ({ ...current, planId: current.planId || data.plans[0]?.id || '' }))
      setAdminError('')
    } catch (error) { setAdminError(error instanceof Error ? error.message : '兑换码台账读取失败，请稍后重试') }
    finally { setAdminLoading(false) }
  }, [isAdmin, mode])

  useEffect(() => { void loadAdmin() }, [loadAdmin])

  const redeem = async () => {
    if (!authenticated) return onSignIn()
    if (!code.trim()) return setRedeemNotice({ tone: 'error', text: '请输入兑换码' })
    setRedeeming(true); setRedeemNotice(null)
    try {
      const result = await requestJson<{ kind: 'credits' | 'plan'; credits?: number; plan?: string }>('/api/redeem', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) })
      setRedeemNotice({ tone: 'success', text: result.kind === 'credits' ? `已增加 ${Number(result.credits).toLocaleString()} credits` : `已加入「${result.plan}」，权益立即生效` })
      setCode(''); await onChanged()
    } catch (error) { setRedeemNotice({ tone: 'error', text: error instanceof Error ? error.message : '核销失败，请检查兑换码' }) }
    finally { setRedeeming(false) }
  }

  const generate = async () => {
    if (generator.kind === 'plan' && !generator.planId) return setAdminError('请先选择订阅计划')
    setGenerating(true); setGenerated([])
    try {
      const result = await requestJson<{ codes: string[] }>('/api/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'codes', ...generator }) })
      setGenerated(result.codes); setAdminError(''); await Promise.all([loadAdmin(), onChanged()])
    } catch (error) { setAdminError(error instanceof Error ? error.message : '生成失败，请检查配置') }
    finally { setGenerating(false) }
  }

  const statusOf = (item: RedeemCode): Exclude<StatusFilter, '全部'> => item.redeemedAt ? '已核销' : item.expiresAt && new Date(item.expiresAt) < new Date() ? '已过期' : '可使用'
  const visibleCodes = useMemo(() => (adminData?.codes ?? []).filter((item) => {
    const matchesText = !query || item.code.toLowerCase().includes(query.toLowerCase()) || (item.planName || 'credits 增量包').toLowerCase().includes(query.toLowerCase())
    return matchesText && (filter === '全部' || statusOf(item) === filter)
  }), [adminData, filter, query])
  const counts = useMemo(() => ({ total: adminData?.codes.length ?? 0, available: adminData?.codes.filter((item) => statusOf(item) === '可使用').length ?? 0, redeemed: adminData?.codes.filter((item) => statusOf(item) === '已核销').length ?? 0 }), [adminData])
  const copy = async (value: string, key = value) => { await navigator.clipboard?.writeText(value); setCopied(key); setTimeout(() => setCopied(''), 1500) }
  const downloadGenerated = () => { const blob = new Blob([`${generated.join('\n')}\n`], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `accesshub-codes-${new Date().toISOString().slice(0, 10)}.txt`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url) }

  if (mode === 'redeem') return <RedeemPanel authenticated={authenticated} code={code} setCode={setCode} redeeming={redeeming} notice={redeemNotice} redeem={redeem}/>
  if (mode === 'new') return <div className="mx-auto max-w-2xl"><Link href="/admin/redeem-codes" className="mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[#3157d5]"><ArrowLeft size={14}/>返回兑换码列表</Link><section className="rounded-[24px] bg-white p-6 shadow-[0_18px_55px_rgba(39,55,92,.06)] sm:p-8"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#edf2ff] text-[#3157d5]"><Sparkles size={18}/></span><div><h2 className="text-lg font-semibold">配置兑换码批次</h2><p className="mt-1 text-xs text-slate-400">生成后可复制或下载，已签发的兑换码不可修改。</p></div></div><div className="mt-8 grid gap-5 sm:grid-cols-2"><Field label="权益类型"><select value={generator.kind} onChange={(event) => setGenerator({ ...generator, kind: event.target.value as 'plan' | 'credits' })} className="access-input"><option value="plan">订阅计划权益</option><option value="credits">credits 增量包</option></select></Field>{generator.kind === 'plan' ? <Field label="权益订阅计划"><select value={generator.planId} onChange={(event) => setGenerator({ ...generator, planId: event.target.value })} className="access-input">{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></Field> : <Field label="每码 credits"><input type="number" min="1" value={generator.credits} onChange={(event) => setGenerator({ ...generator, credits: event.target.value })} className="access-input tabular-nums"/></Field>}<Field label="生成数量"><input type="number" min="1" max="1000" value={generator.count} onChange={(event) => setGenerator({ ...generator, count: event.target.value })} className="access-input tabular-nums"/></Field><Field label="权益时长"><input type="number" min="-1" value={generator.durationValue} onChange={(event) => setGenerator({ ...generator, durationValue: event.target.value })} className="access-input tabular-nums" placeholder="-1 为永久"/></Field><Field label="权益周期"><select value={generator.durationUnit} disabled={generator.durationValue === '-1'} onChange={(event) => setGenerator({ ...generator, durationUnit: event.target.value as typeof generator.durationUnit })} className="access-input"><option value="day">天</option><option value="month">月</option><option value="quarter">季</option><option value="year">年</option></select></Field></div><p className="mt-4 text-[11px] leading-5 text-slate-400">权益时长填 -1 表示永久；credits 会在基础用量达到限制后自动抵扣。</p>{adminError && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-600">{adminError}</p>}<div className="mt-6 flex justify-end"><button onClick={() => void generate()} disabled={generating || (generator.kind === 'plan' && plans.length === 0)} className="h-11 rounded-xl bg-[#3157d5] px-6 text-sm font-medium text-white transition hover:bg-[#284bc2] disabled:opacity-50">{generating ? '生成中…' : '生成兑换码'}</button></div>{generated.length > 0 && <div className="mt-6 rounded-2xl bg-[#f5f7fb] p-5"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-slate-700">本次生成 {generated.length} 个</p><div className="flex items-center gap-3"><button onClick={downloadGenerated} className="flex items-center gap-1 text-xs text-slate-500"><Download size={13}/>下载</button><button onClick={() => void copy(generated.join('\n'), 'batch')} className="flex items-center gap-1 text-xs text-[#3157d5]">{copied === 'batch' ? <Check size={13}/> : <Copy size={13}/>}复制全部</button></div></div><div className="mt-4 max-h-48 space-y-2 overflow-y-auto">{generated.map((item) => <code key={item} className="block rounded-lg bg-white px-3 py-2 text-xs text-slate-600">{item}</code>)}</div></div>}</section></div>

  return <section className="rounded-[22px] bg-white shadow-[0_18px_55px_rgba(39,55,92,.06)]"><div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-6"><MiniMetric value={counts.total} label="总计"/><MiniMetric value={counts.available} label="可使用"/><MiniMetric value={counts.redeemed} label="已核销"/></div><Link href="/admin/redeem-codes/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#3157d5] px-4 text-sm font-medium text-white"><Plus size={15}/>生成兑换码</Link></div><div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-1 overflow-x-auto">{(['全部', '可使用', '已核销', '已过期'] as StatusFilter[]).map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-lg px-3 py-1.5 text-xs transition ${filter === item ? 'bg-[#182238] text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{item}</button>)}</div><label className="flex h-10 items-center gap-2 rounded-xl bg-[#f5f7fb] px-3 text-slate-400 focus-within:ring-2 focus-within:ring-blue-100"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-xs text-slate-700 outline-none" placeholder="搜索兑换码或订阅计划"/></label></div>{adminError && <p className="m-5 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">{adminError}</p>}<div className="overflow-x-auto">{adminLoading && !adminData ? <div className="space-y-2 p-5">{[1, 2, 3, 4].map((item) => <div key={item} className="h-11 animate-pulse rounded-lg bg-slate-50"/>)}</div> : <><table className="w-full min-w-[680px] text-left"><thead><tr className="border-b border-slate-100 text-[11px] font-medium text-slate-400"><th className="px-5 py-3">兑换码</th><th className="px-4 py-3">权益类型</th><th className="px-4 py-3">周期</th><th className="px-4 py-3">状态</th><th className="px-5 py-3 text-right">创建时间</th></tr></thead><tbody>{visibleCodes.map((item) => { const status = statusOf(item); return <tr key={item.id} className="border-b border-slate-50 text-xs last:border-0 hover:bg-slate-50/70"><td className="px-5 py-3.5"><button onClick={() => void copy(item.code)} className="flex items-center gap-2 font-mono text-slate-700 hover:text-[#3157d5]">{item.code}{copied === item.code ? <Check size={12}/> : <Copy size={12} className="text-slate-300"/>}</button></td><td className="px-4 py-3.5 text-slate-600">{item.kind === 'credits' ? `${item.credits?.toLocaleString()} credits` : item.planName}</td><td className="px-4 py-3.5 text-slate-500">{durationText(item.durationValue, item.durationUnit)}</td><td className="px-4 py-3.5"><StatusBadge status={status}/></td><td className="px-5 py-3.5 text-right text-slate-400">{new Intl.DateTimeFormat('zh-CN').format(new Date(item.createdAt))}</td></tr>})}</tbody></table>{visibleCodes.length === 0 && <div className="px-5 py-12 text-center text-sm text-slate-400">没有符合条件的兑换码</div>}</>}</div></section>
}

function RedeemPanel({ authenticated, code, setCode, redeeming, notice, redeem }: { authenticated: boolean; code: string; setCode: (code: string) => void; redeeming: boolean; notice: { tone: 'error' | 'success'; text: string } | null; redeem: () => Promise<void> }) { return <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,.9fr)]"><article className="relative overflow-hidden rounded-[24px] bg-[#182238] p-7 text-white shadow-[0_22px_55px_rgba(24,34,56,.18)]"><div className="absolute -right-12 -top-16 size-52 rounded-full bg-[#3157d5]/30 blur-3xl"/><div className="relative"><span className="grid size-10 place-items-center rounded-xl bg-white/10"><TicketCheck size={19}/></span><p className="mt-8 text-xs font-medium text-slate-400">核销兑换码</p><h2 className="mt-2 max-w-lg text-2xl font-semibold tracking-tight">为当前账户添加访问权益</h2><p className="mt-2 text-sm leading-6 text-slate-300">每个兑换码只能核销一次。权益期限从成功核销这一刻开始计算。</p><div className="mt-7 flex flex-col gap-2 sm:flex-row"><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} onKeyDown={(event) => { if (event.key === 'Enter') void redeem() }} disabled={!authenticated || redeeming} className="h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.08] px-4 font-mono text-sm tracking-wide text-white outline-none transition placeholder:text-slate-500 focus:border-[#7893ee] focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60" placeholder={authenticated ? 'AFD-XXXXXXXX-XXXXXXXX' : '登录后输入兑换码'}/><button onClick={() => void redeem()} disabled={redeeming} className="h-12 rounded-xl bg-white px-5 text-sm font-semibold text-[#182238] transition hover:bg-slate-100 disabled:opacity-60">{!authenticated ? '使用 GitHub 登录' : redeeming ? '核销中…' : '立即核销'}</button></div>{notice && <p className={`mt-3 text-xs ${notice.tone === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>{notice.text}</p>}</div></article><article className="rounded-[24px] bg-white p-6 shadow-[0_18px_55px_rgba(39,55,92,.06)]"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-[#3157d5]">获取方式</p><h3 className="mt-1 text-lg font-semibold">如何从爱发电获取兑换码</h3></div><KeyRound size={19} className="text-slate-300"/></div><ol className="mt-6 space-y-5">{[['01', '在概览选择权益', '点击对应 Plan 的“立即购买此权益”，直接进入爱发电结算。'], ['02', '支付后查看爱发电私信', '订单确认有效后，系统会把专属兑换码发送到你的爱发电私信。'], ['03', '返回这里完成核销', '登录 AccessHub 并输入兑换码，权益期限从核销成功时开始。']].map(([index, title, detail]) => <li key={index} className="grid grid-cols-[32px_1fr] gap-3"><span className="font-mono text-xs text-slate-300">{index}</span><span><strong className="block text-sm font-medium">{title}</strong><span className="mt-1 block text-xs leading-5 text-slate-400">{detail}</span></span></li>)}</ol><a href="https://afdian.com/message" target="_blank" rel="noreferrer" className="mt-6 inline-flex text-xs font-medium text-[#3157d5]">打开爱发电私信 →</a></article></section> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-medium text-slate-500">{label}</span>{children}</label> }
function MiniMetric({ value, label }: { value: number; label: string }) { return <div><p className="font-mono text-lg font-semibold tabular-nums">{value}</p><p className="text-[10px] text-slate-400">{label}</p></div> }
function StatusBadge({ status }: { status: Exclude<StatusFilter, '全部'> }) { return <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-medium ${status === '可使用' ? 'bg-emerald-50 text-emerald-700' : status === '已核销' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>{status}</span> }
function durationText(value: number, unit: RedeemCode['durationUnit']) { return value === -1 ? '永久' : `${value} ${unit === 'day' ? '天' : unit === 'month' ? '月' : unit === 'quarter' ? '季' : '年'}` }
