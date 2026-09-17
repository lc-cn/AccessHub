'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, Gauge, InfinityIcon, Plus, RotateCcw, Save, Search, Star, Users } from 'lucide-react'
import type { AdminData, AdminPlan, DashboardPlan } from './types'
import { requestJson } from '@/lib/http-client'
import { useWorkspaceRefresh } from './workspace-data'

type PlanForm = { name: string; description: string; rank: string; rateLimit: string; dailyLimit: string; weeklyLimit: string; monthlyLimit: string; isDefault: boolean }
type Props = { plans: DashboardPlan[]; mode: 'list' | 'new' | 'edit'; planId?: string; onChanged: () => Promise<void> }
const emptyForm: PlanForm = { name: '', description: '', rank: '100', rateLimit: '60', dailyLimit: '10000', weeklyLimit: '50000', monthlyLimit: '150000', isDefault: false }
function formFor(plan: AdminPlan): PlanForm { return { name: plan.name, description: plan.description, rank: String(plan.rank), rateLimit: String(plan.rateLimit), dailyLimit: String(plan.dailyLimit ?? -1), weeklyLimit: String(plan.weeklyLimit ?? -1), monthlyLimit: String(plan.monthlyLimit ?? -1), isDefault: plan.isDefault } }

export function SubscriptionPlanManagement({ plans, mode, planId, onChanged }: Props) {
  const router = useRouter()
  const [adminPlans, setAdminPlans] = useState<AdminPlan[]>([])
  const [form, setForm] = useState<PlanForm>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await requestJson<AdminData>('/api/admin/plans', { cache: 'no-store' })
      setAdminPlans(data.plans)
    } catch (error) { setNotice({ tone: 'error', text: error instanceof Error ? error.message : '订阅计划读取失败' }) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])
  useWorkspaceRefresh(load)
  const selected = useMemo(() => adminPlans.find((plan) => plan.id === planId) ?? null, [adminPlans, planId])
  useEffect(() => {
    if (mode === 'new') setForm(emptyForm)
    if (mode === 'edit' && selected) setForm(formFor(selected))
  }, [mode, selected])

  const baseline = mode === 'new' ? emptyForm : selected ? formFor(selected) : null
  const dirty = Boolean(baseline && JSON.stringify(form) !== JSON.stringify(baseline))
  const visiblePlans = adminPlans.filter((plan) => !query || `${plan.name} ${plan.description}`.toLowerCase().includes(query.toLowerCase()))
  const totalSubscribers = plans.reduce((sum, plan) => sum + plan.subscriberCount, 0)
  const unlimitedPlans = adminPlans.filter((plan) => [plan.rateLimit, plan.dailyLimit, plan.weeklyLimit, plan.monthlyLimit].some((value) => value === -1)).length

  const submit = async () => {
    if (!form.name.trim()) return setNotice({ tone: 'error', text: '请填写订阅计划名称' })
    setSaving(true)
    setNotice(null)
    try {
      const result = await requestJson<{ plan: AdminPlan }>(mode === 'new' ? '/api/admin/plans' : `/api/admin/plans/${encodeURIComponent(planId || '')}`, { method: mode === 'new' ? 'POST' : 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) })
      await Promise.all([load(), onChanged()])
      if (mode === 'new') router.replace(`/admin/plans/${result.plan.id}`)
      else { setForm(formFor(result.plan)); setNotice({ tone: 'success', text: '策略已保存' }) }
    } catch (error) { setNotice({ tone: 'error', text: error instanceof Error ? error.message : '保存失败' }) }
    finally { setSaving(false) }
  }

  if (mode === 'list') return <section>
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-medium tracking-wide text-[#3157d5]">访问策略</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">订阅计划</h2><p className="mt-2 text-sm text-slate-500">每个策略单独维护，修改时进入对应详情页。</p></div><Link href="/admin/plans/new" className="flex items-center justify-center gap-2 rounded-xl bg-[#3157d5] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#284bc2] active:translate-y-px"><Plus size={16}/>新建订阅计划</Link></div>
    <div className="mb-4 grid grid-cols-3 gap-3"><Summary icon={<Users size={15}/>} value={adminPlans.length} label="策略数"/><Summary icon={<Gauge size={15}/>} value={totalSubscribers} label="有效订阅"/><Summary icon={<InfinityIcon size={15}/>} value={unlimitedPlans} label="含无限配额"/></div>
    <label className="mb-4 flex h-11 items-center gap-2 rounded-xl bg-white px-3 text-slate-400 shadow-[0_8px_24px_rgba(39,55,92,.04)] focus-within:ring-2 focus-within:ring-blue-100"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm text-slate-700 outline-none" placeholder="搜索订阅计划或说明"/></label>
    {loading ? <PlanSkeleton/> : adminPlans.length === 0 ? <Link href="/admin/plans/new" className="block w-full rounded-[22px] border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">还没有订阅计划，创建第一个订阅计划</Link> : visiblePlans.length === 0 ? <p className="rounded-[18px] bg-white px-5 py-12 text-center text-sm text-slate-400">没有匹配的订阅计划</p> : <div className="space-y-3">{visiblePlans.map((plan) => {
      const subscriberCount = plans.find((item) => item.id === plan.id)?.subscriberCount ?? 0
      return <Link key={plan.id} href={`/admin/plans/${plan.id}`} className="grid w-full grid-cols-[1fr_auto] gap-5 rounded-[18px] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(39,55,92,.07)] active:translate-y-px"><div className="min-w-0"><div className="flex items-center gap-2"><h3 className="truncate font-semibold">{plan.name}</h3><span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-500">Tier {plan.rank}</span>{plan.isDefault && <span className="rounded-md bg-[#edf2ff] px-2 py-0.5 text-[10px] font-medium text-[#3157d5]">默认</span>}</div><p className="mt-1 truncate text-xs text-slate-400">{plan.description || '暂无描述'}</p><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500"><span className="flex items-center gap-1.5"><Gauge size={13}/>{quotaText(plan.rateLimit)} 次/分钟</span><span>{quotaText(plan.dailyLimit)} / 日</span><span>{quotaText(plan.weeklyLimit)} / 周</span><span>{quotaText(plan.monthlyLimit)} / 月</span></div></div><div className="text-right"><p className="text-2xl font-semibold tabular-nums">{subscriberCount.toLocaleString()}</p><p className="mt-1 text-[11px] text-slate-400">有效订阅</p></div></Link>
    })}</div>}
  </section>

  if (loading || (mode === 'edit' && !selected && !notice)) return <EditorSkeleton/>
  if (mode === 'edit' && !selected) return <EmptyEditor message="这个订阅计划不存在或已被删除"/>
  const subscriberCount = plans.find((plan) => plan.id === planId)?.subscriberCount ?? 0

  return <section className="mx-auto max-w-3xl">
    <Link href="/admin/plans" className="mb-5 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-[#3157d5]"><ArrowLeft size={15}/>返回订阅计划</Link>
    <form onSubmit={(event) => { event.preventDefault(); void submit() }} className="rounded-[24px] bg-white p-6 shadow-[0_18px_55px_rgba(39,55,92,.06)] sm:p-8">
      <div className="flex items-start justify-between"><div><div className="flex items-center gap-2"><p className="text-xs text-slate-400">{mode === 'new' ? '新策略' : '策略详情'}</p>{dirty && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">未保存</span>}</div><h2 className="mt-1 text-2xl font-semibold">{mode === 'new' ? '创建订阅计划' : selected?.name}</h2></div>{mode === 'edit' && <div className="text-right"><p className="text-xl font-semibold tabular-nums">{subscriberCount}</p><p className="text-[10px] text-slate-400">有效订阅</p></div>}</div>
      <div className="mt-8 space-y-5"><Field label="订阅计划名称"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={80} className="access-input" placeholder="例如：专业用户"/></Field><Field label="说明"><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={240} rows={3} className="access-input resize-none" placeholder="说明适用对象和使用场景"/></Field><Field label="阶梯等级"><input type="number" min="0" value={form.rank} onChange={(event) => setForm({ ...form, rank: event.target.value })} className="access-input tabular-nums" placeholder="数值越大，计划等级越高"/><span className="mt-1.5 block text-[11px] text-slate-400">用于判断 Upgrade / Downgrade；建议默认计划为 0，其余按 100 递增。</span></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="每分钟请求"><QuotaInput value={form.rateLimit} onChange={(value) => setForm({ ...form, rateLimit: value })}/></Field><Field label="每日请求"><QuotaInput value={form.dailyLimit} onChange={(value) => setForm({ ...form, dailyLimit: value })}/></Field><Field label="每周请求"><QuotaInput value={form.weeklyLimit} onChange={(value) => setForm({ ...form, weeklyLimit: value })}/></Field><Field label="每月请求"><QuotaInput value={form.monthlyLimit} onChange={(value) => setForm({ ...form, monthlyLimit: value })}/></Field></div><p className="text-[11px] text-slate-400">填写 -1 表示对应周期无限制。</p><label className={`flex items-center justify-between rounded-xl border px-4 py-3 ${form.isDefault ? 'border-[#b9c9ff] bg-[#f3f6ff]' : 'border-slate-200'}`}><span><span className="flex items-center gap-2 text-sm font-medium"><Star size={15} className={form.isDefault ? 'fill-[#3157d5] text-[#3157d5]' : 'text-slate-400'}/>默认订阅计划</span><span className="mt-1 block text-xs text-slate-400">所有用户均包含此计划，并在付费额度耗尽后回落使用</span></span><input type="checkbox" checked={form.isDefault} disabled={selected?.isDefault} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} className="size-4 accent-[#3157d5]"/></label>{notice && <p className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs ${notice.tone === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>{notice.tone === 'success' && <CheckCircle2 size={14}/>} {notice.text}</p>}</div>
      <div className="mt-7 flex gap-2 border-t border-slate-100 pt-5">{dirty && <button type="button" onClick={() => baseline && setForm(baseline)} className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-50"><RotateCcw size={14}/>重置</button>}<button disabled={saving || !dirty} className="ml-auto flex items-center gap-2 rounded-xl bg-[#182238] px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"><Save size={15}/>{saving ? '保存中…' : mode === 'new' ? '创建订阅计划' : '保存策略'}</button></div>
    </form>
  </section>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-medium text-slate-500">{label}</span>{children}</label> }
function QuotaInput({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <input type="number" min="-1" value={value} onChange={(event) => onChange(event.target.value)} className="access-input tabular-nums" placeholder="-1 为无限"/> }
function PlanSkeleton() { return <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-[18px] bg-white"/>)}</div> }
function EditorSkeleton() { return <div className="mx-auto h-[620px] max-w-3xl animate-pulse rounded-[24px] bg-white"/> }
function EmptyEditor({ message }: { message: string }) { return <div className="mx-auto max-w-2xl rounded-[22px] bg-white p-10 text-center"><p className="text-sm text-slate-500">{message}</p><Link href="/admin/plans" className="mt-5 inline-flex text-sm font-medium text-[#3157d5]">返回订阅计划列表</Link></div> }
function Summary({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) { return <div className="rounded-xl bg-white px-3 py-3"><div className="flex items-center gap-2 text-slate-400">{icon}<span className="text-[10px]">{label}</span></div><p className="mt-2 font-mono text-lg font-semibold tabular-nums text-slate-700">{value.toLocaleString()}</p></div> }
function quotaText(value: number | null) { return value == null || value === -1 ? '不限额' : value.toLocaleString() }
