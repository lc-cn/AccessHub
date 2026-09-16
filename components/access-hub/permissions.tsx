'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, ChevronRight, CircleOff, KeyRound, Plus, RotateCcw, Save, Search, ShieldCheck } from 'lucide-react'
import { requestJson } from '@/lib/http-client'
import type { AdminData, AdminPlan, Permission } from './types'
import { useWorkspaceRefresh } from './workspace-data'

type Mode = 'list' | 'new' | 'edit'
type PermissionForm = { code: string; name: string; description: string; planIds: string[] }
const emptyForm: PermissionForm = { code: '', name: '', description: '', planIds: [] }
const formFor = (permission: Permission): PermissionForm => ({ code: permission.code, name: permission.name, description: permission.description, planIds: permission.planIds })

export function Permissions({ mode, permissionId }: { mode: Mode; permissionId?: string }) {
  const router = useRouter()
  const [items, setItems] = useState<Permission[]>([])
  const [plans, setPlans] = useState<AdminPlan[]>([])
  const [form, setForm] = useState<PermissionForm>(emptyForm)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const selected = useMemo(() => items.find((item) => item.id === permissionId) ?? null, [items, permissionId])
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await requestJson<AdminData>('/api/admin?section=permissions', { cache: 'no-store' })
      setItems(data.permissions ?? []); setPlans(data.plans ?? []); setNotice(null)
    } catch (error) { setNotice({ tone: 'error', text: error instanceof Error ? error.message : '权限目录读取失败' }) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  useWorkspaceRefresh(load)
  useEffect(() => { if (mode === 'new') setForm(emptyForm); if (mode === 'edit' && selected) setForm(formFor(selected)) }, [mode, selected])

  const baseline = selected ? formFor(selected) : emptyForm
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline)
  const save = async () => {
    setSaving(true); setNotice(null)
    try {
      const result = await requestJson<{ permission: Permission }>('/api/admin', { method: mode === 'new' ? 'POST' : 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'permission', permissionId, ...form }) })
      await load()
      if (mode === 'new') router.replace(`/admin/permissions/${result.permission.id}`)
      else { setForm(formFor(result.permission)); setNotice({ tone: 'success', text: '权限及计划授权已保存' }) }
    } catch (error) { setNotice({ tone: 'error', text: error instanceof Error ? error.message : '权限保存失败' }) }
    finally { setSaving(false) }
  }

  if (mode === 'list') {
    const visible = items.filter((item) => !query || `${item.code} ${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase()))
    return <section><div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-medium text-[#3157d5]">授权模型</p><h2 className="mt-1 text-2xl font-semibold">权限</h2><p className="mt-2 text-sm text-slate-500">先定义稳定能力，再由订阅计划授予；服务只声明自己需要哪项权限。</p></div><Link href="/admin/permissions/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#3157d5] px-4 text-sm font-medium text-white"><Plus size={15}/>新增权限</Link></div><div className="mb-4 grid grid-cols-3 gap-3"><Metric label="权限" value={items.length}/><Metric label="已授权计划" value={new Set(items.flatMap((item) => item.planIds)).size}/><Metric label="受保护服务" value={items.reduce((sum, item) => sum + item.serviceCount, 0)}/></div><label className="mb-4 flex h-11 items-center gap-2 rounded-xl bg-white px-3 text-slate-400"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="搜索权限编码、名称或说明"/></label>{notice && <Notice value={notice}/>} {loading ? <div className="h-40 animate-pulse rounded-[20px] bg-white"/> : visible.length === 0 ? <div className="rounded-[20px] bg-white p-12 text-center text-sm text-slate-400">还没有权限定义</div> : <div className="space-y-3">{visible.map((item) => <Link key={item.id} href={`/admin/permissions/${item.id}`} className="grid gap-3 rounded-[18px] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(39,55,92,.07)] sm:grid-cols-[auto_1fr_auto] sm:items-center"><span className="grid size-10 place-items-center rounded-xl bg-[#edf2ff] text-[#3157d5]"><ShieldCheck size={18}/></span><span className="min-w-0"><strong className="block text-sm font-medium">{item.name}</strong><code className="mt-1 block text-[11px] text-[#3157d5]">{item.code}</code><span className="mt-2 block truncate text-xs text-slate-400">{item.description || '暂无说明'}</span></span><span className="flex items-center gap-4 text-xs text-slate-400"><span>{item.planIds.length} 个计划</span><span>{item.serviceCount} 个服务</span><ChevronRight size={15}/></span></Link>)}</div>}</section>
  }
  if (loading) return <div className="mx-auto h-[560px] max-w-4xl animate-pulse rounded-[24px] bg-white"/>
  if (mode === 'edit' && !selected) return <div className="rounded-[22px] bg-white p-10 text-center text-sm text-slate-500">权限不存在</div>
  const togglePlan = (planId: string) => setForm({ ...form, planIds: form.planIds.includes(planId) ? form.planIds.filter((id) => id !== planId) : [...form.planIds, planId] })
  return <div className="mx-auto max-w-4xl"><Link href="/admin/permissions" className="mb-5 inline-flex items-center gap-2 text-sm text-slate-500"><ArrowLeft size={15}/>返回权限列表</Link><form onSubmit={(event) => { event.preventDefault(); void save() }} className="rounded-[24px] bg-white p-6 shadow-[0_18px_55px_rgba(39,55,92,.06)] sm:p-8"><div><p className="text-xs text-slate-400">{mode === 'new' ? '新权限' : '权限定义'}</p><h2 className="mt-1 text-2xl font-semibold">{mode === 'new' ? '定义一项能力' : selected?.name}</h2></div><div className="mt-8 grid gap-5 sm:grid-cols-2"><Field label="权限编码" hint="稳定机器标识；建议使用 resource.action 形式"><input className="access-input font-mono lowercase" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toLowerCase() })} placeholder="service.qsign.invoke"/></Field><Field label="权限名称"><input className="access-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="调用 QQSign"/></Field><div className="sm:col-span-2"><Field label="说明"><textarea rows={3} className="access-input resize-none" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="说明该权限允许用户做什么"/></Field></div></div><section className="mt-7 rounded-2xl border border-slate-200 p-5"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#edf2ff] text-[#3157d5]"><KeyRound size={16}/></span><div><h3 className="text-sm font-medium">订阅计划授权</h3><p className="mt-0.5 text-xs text-slate-400">用户获得任一已选计划时拥有此权限；默认计划权限对所有用户生效。</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{plans.map((plan) => <label key={plan.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${form.planIds.includes(plan.id) ? 'border-[#9db2fb] bg-[#f3f6ff]' : 'border-slate-200'}`}><input type="checkbox" className="mt-0.5 size-4 accent-[#3157d5]" checked={form.planIds.includes(plan.id)} onChange={() => togglePlan(plan.id)}/><span><strong className="block text-sm font-medium">{plan.name}{plan.isDefault && <span className="ml-2 text-[10px] text-[#3157d5]">默认</span>}</strong><span className="mt-1 block text-[10px] text-slate-400">Tier {plan.rank}</span></span></label>)}</div></section>{notice && <div className="mt-5"><Notice value={notice}/></div>}<div className="mt-7 flex justify-end gap-2 border-t border-slate-100 pt-5">{dirty && <button type="button" onClick={() => setForm(baseline)} className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm text-slate-500"><RotateCcw size={14}/>重置</button>}<button disabled={!dirty || saving} className="inline-flex items-center gap-2 rounded-xl bg-[#182238] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"><Save size={15}/>{saving ? '保存中…' : mode === 'new' ? '创建权限' : '保存权限'}</button></div></form></div>
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-medium text-slate-500">{label}</span>{children}{hint && <span className="mt-1.5 block text-[10px] leading-4 text-slate-400">{hint}</span>}</label> }
function Notice({ value }: { value: { tone: 'success' | 'error'; text: string } }) { return <p className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs ${value.tone === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>{value.tone === 'success' ? <CheckCircle2 size={14}/> : <CircleOff size={14}/>} {value.text}</p> }
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-white px-4 py-3"><p className="text-[10px] text-slate-400">{label}</p><p className="mt-2 font-mono text-lg font-semibold">{value}</p></div> }
