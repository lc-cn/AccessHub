'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, CircleOff, ExternalLink, HeartHandshake, Plus, RotateCcw, Save, Search, Trash2 } from 'lucide-react'
import type { AdminData, AfdianRule, DashboardGroup } from './types'
import { requestJson } from '@/lib/http-client'

type RuleForm = { name: string; sourceType: 'plan' | 'sku'; sourceId: string; kind: 'group' | 'credits'; groupId: string; credits: string; durationValue: string; durationUnit: 'day' | 'month' | 'quarter' | 'year'; codesPerItem: string; enabled: boolean }
type Props = { groups: DashboardGroup[]; mode: 'list' | 'new' | 'edit'; ruleId?: string }
const emptyForm: RuleForm = { name: '', sourceType: 'plan', sourceId: '', kind: 'group', groupId: '', credits: '10000', durationValue: '1', durationUnit: 'month', codesPerItem: '1', enabled: true }
function formFor(rule: AfdianRule, fallbackGroupId = ''): RuleForm { const [sourceType, ...idParts] = rule.benefitKey.split(':'); return { name: rule.name, sourceType: sourceType as 'plan' | 'sku', sourceId: idParts.join(':'), kind: rule.kind, groupId: rule.groupId || fallbackGroupId, credits: String(rule.credits ?? 10000), durationValue: String(rule.durationValue), durationUnit: rule.durationUnit, codesPerItem: String(rule.codesPerItem), enabled: rule.enabled } }

export function AfdianMappings({ groups, mode, ruleId }: Props) {
  const router = useRouter()
  const [rules, setRules] = useState<AfdianRule[]>([])
  const [webhookConfigured, setWebhookConfigured] = useState(false)
  const [messengerConfigured, setMessengerConfigured] = useState(false)
  const [form, setForm] = useState<RuleForm>({ ...emptyForm, groupId: groups[0]?.id || '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [showDisabled, setShowDisabled] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { const result = await requestJson<AdminData>('/api/admin?section=afdian', { cache: 'no-store' }); setRules(result.afdianRules ?? []); setWebhookConfigured(Boolean(result.afadianWebhookConfigured)); setMessengerConfigured(Boolean(result.afadianMessengerConfigured)) }
    catch (error) { setNotice({ tone: 'error', text: error instanceof Error ? error.message : '读取爱发电映射失败' }) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const selected = useMemo(() => rules.find((rule) => rule.id === ruleId) ?? null, [ruleId, rules])
  useEffect(() => {
    if (mode === 'edit' && selected) setForm(formFor(selected, groups[0]?.id))
    if (mode === 'new') setForm((current) => current.groupId ? current : { ...emptyForm, groupId: groups[0]?.id || '' })
  }, [groups, mode, selected])

  const baseline = selected ? formFor(selected, groups[0]?.id) : { ...emptyForm, groupId: groups[0]?.id || '' }
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline)
  const save = async () => {
    if (!form.sourceId.trim()) return setNotice({ tone: 'error', text: '请输入爱发电方案 ID 或 SKU ID' })
    setSaving(true)
    try {
      const result = await requestJson<{ rule: AfdianRule }>('/api/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'afadian-rule', benefitKey: `${form.sourceType}:${form.sourceId.trim()}`, name: form.name, kind: form.kind, groupId: form.groupId, credits: form.credits, durationValue: form.durationValue, durationUnit: form.durationUnit, codesPerItem: form.codesPerItem, enabled: form.enabled }) })
      setNotice({ tone: 'success', text: selected ? '映射已更新' : '映射已创建' }); await load()
      if (mode === 'new') router.replace(`/admin/afdian-mappings/${result.rule.id}`)
    } catch (error) { setNotice({ tone: 'error', text: error instanceof Error ? error.message : '保存映射失败' }) }
    finally { setSaving(false) }
  }
  const remove = async (rule: AfdianRule) => {
    if (deletingId !== rule.id) return setDeletingId(rule.id)
    try { await requestJson(`/api/admin?ruleId=${encodeURIComponent(rule.id)}`, { method: 'DELETE' }); await load() }
    catch (error) { setNotice({ tone: 'error', text: error instanceof Error ? error.message : '删除映射失败' }) }
    finally { setDeletingId(null) }
  }
  const visibleRules = rules.filter((rule) => (showDisabled || rule.enabled) && (!query || `${rule.name} ${rule.benefitKey} ${rule.groupName || ''}`.toLowerCase().includes(query.toLowerCase())))

  if (mode !== 'list') {
    if (loading) return <div className="mx-auto h-[520px] max-w-2xl animate-pulse rounded-[22px] bg-white"/>
    if (mode === 'edit' && !selected) return <div className="mx-auto max-w-2xl rounded-[22px] bg-white p-10 text-center"><CircleOff className="mx-auto text-slate-300"/><h2 className="mt-4 font-semibold">映射不存在</h2><p className="mt-2 text-sm text-slate-400">它可能已经被删除，或 URL 中的资源 ID 不正确。</p><Link href="/admin/afdian-mappings" className="mt-5 inline-flex text-sm text-[#3157d5]">返回映射列表</Link></div>
    return <div className="mx-auto max-w-2xl"><Link href="/admin/afdian-mappings" className="mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[#3157d5]"><ArrowLeft size={14}/>返回映射列表</Link><section className="rounded-[24px] bg-white p-6 shadow-[0_18px_55px_rgba(39,55,92,.06)] sm:p-8"><div className="flex items-center justify-between gap-4"><div><p className="text-xs text-slate-400">{selected ? '编辑权益映射' : '新建权益映射'}</p><h2 className="mt-1 text-xl font-semibold">{selected?.name || '配置自动发码规则'}</h2></div>{dirty && <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-700">未保存</span>}</div><div className="mt-8 space-y-5"><Field label="显示名称"><input className="access-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如：专业版月卡"/></Field><div className="grid gap-4 sm:grid-cols-[140px_1fr]"><Field label="来源类型"><select className="access-input" value={form.sourceType} onChange={(event) => setForm({ ...form, sourceType: event.target.value as RuleForm['sourceType'] })}><option value="plan">方案</option><option value="sku">SKU</option></select></Field><Field label="方案 / SKU ID"><input className="access-input font-mono" value={form.sourceId} onChange={(event) => setForm({ ...form, sourceId: event.target.value })} placeholder="粘贴 ID"/></Field></div><Field label="权益类型"><select className="access-input" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as RuleForm['kind'] })}><option value="group">用户组权益</option><option value="credits">credits 增量包</option></select></Field>{form.kind === 'group' ? <Field label="用户组"><select className="access-input" value={form.groupId} onChange={(event) => setForm({ ...form, groupId: event.target.value })}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></Field> : <Field label="每份 credits"><input type="number" min="1" className="access-input" value={form.credits} onChange={(event) => setForm({ ...form, credits: event.target.value })}/></Field>}<div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs leading-5 text-blue-700"><strong className="font-medium">权益周期由订单决定</strong><span className="mt-0.5 block text-blue-600/80">Webhook 使用订单的 month 生成对应月数的兑换码，权益从用户成功核销时开始计时。</span></div><Field label="每件权益份数"><input type="number" min="1" max="1000" className="access-input" value={form.codesPerItem} onChange={(event) => setForm({ ...form, codesPerItem: event.target.value })}/></Field><label className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${form.enabled ? 'border-[#b9c9ff] bg-[#f3f6ff]' : 'border-slate-200'}`}><span><strong className="block font-medium">启用规则</strong><span className="mt-1 block text-[11px] text-slate-400">停用后保留配置但不再发放</span></span><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} className="size-4 accent-[#3157d5]"/></label>{notice && <p className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs ${notice.tone === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>{notice.tone === 'success' ? <CheckCircle2 size={14}/> : <CircleOff size={14}/>} {notice.text}</p>}<div className="flex justify-end gap-2">{dirty && <button onClick={() => { setForm(baseline); setNotice(null) }} className="flex h-11 items-center gap-1.5 rounded-xl px-4 text-sm text-slate-500 hover:bg-slate-50"><RotateCcw size={14}/>重置</button>}<button onClick={() => void save()} disabled={saving || !dirty || (form.kind === 'group' && groups.length === 0)} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#182238] px-6 text-sm font-medium text-white disabled:opacity-40"><Save size={15}/>{saving ? '保存中…' : '保存映射'}</button></div></div></section></div>
  }

  return <div className="space-y-7"><section className="grid gap-4 md:grid-cols-2"><article className="rounded-[20px] bg-[#182238] p-6 text-white"><div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-xl bg-white/10"><HeartHandshake size={19}/></span><div className="flex gap-1.5"><ConfigBadge configured={webhookConfigured} label="回调"/><ConfigBadge configured={messengerConfigured} label="私信"/></div></div><h2 className="mt-6 text-xl font-semibold">爱发电自动发码</h2><p className="mt-2 text-sm leading-6 text-slate-300">支付成功后，Webhook 按订单月数生成兑换码并私信买家。订单、发码、私信和核销状态会完整留档，重复回调不会重复发码。</p><a href="https://afdian.com/dashboard/dev" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1.5 text-xs text-[#a9baf5]">打开爱发电开发者后台 <ExternalLink size={13}/></a></article><article className="rounded-[20px] bg-white p-6 shadow-[0_14px_40px_rgba(39,55,92,.055)]"><p className="text-xs font-medium text-[#3157d5]">匹配顺序</p><ol className="mt-5 space-y-4 text-sm"><li><strong className="mr-3 font-mono text-slate-300">01</strong>优先匹配订单中的 SKU ID</li><li><strong className="mr-3 font-mono text-slate-300">02</strong>没有 SKU 规则时匹配方案 ID</li><li><strong className="mr-3 font-mono text-slate-300">03</strong>停用或未匹配的订单不生成权益</li></ol></article></section><section><div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-medium tracking-wide text-[#3157d5]">权益映射</p><h2 className="mt-1 text-2xl font-semibold">方案与商品</h2><p className="mt-2 text-xs text-slate-400">{rules.filter((rule) => rule.enabled).length} 条启用 · {rules.length} 条总计</p></div><Link href="/admin/afdian-mappings/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#3157d5] px-4 text-sm font-medium text-white"><Plus size={15}/>新增映射</Link></div><div className="mb-4 flex gap-2"><label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl bg-white px-3 text-slate-400 focus-within:ring-2 focus-within:ring-blue-100"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none" placeholder="搜索名称、方案或 SKU"/></label><button onClick={() => setShowDisabled((value) => !value)} className={`shrink-0 rounded-xl px-3 text-xs transition ${showDisabled ? 'bg-white text-slate-500' : 'bg-[#182238] text-white'}`}>{showDisabled ? '含停用' : '仅启用'}</button></div>{notice && <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-600">{notice.text}</p>}{loading ? <div className="h-40 animate-pulse rounded-[20px] bg-white"/> : rules.length === 0 ? <Link href="/admin/afdian-mappings/new" className="block w-full rounded-[20px] border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-400">还没有映射，点击创建第一条规则</Link> : visibleRules.length === 0 ? <p className="rounded-[18px] bg-white px-5 py-12 text-center text-sm text-slate-400">没有匹配的映射规则</p> : <div className="grid gap-3 lg:grid-cols-2">{visibleRules.map((rule) => <article key={rule.id} className="rounded-[18px] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_14px_35px_rgba(39,55,92,.07)]"><div className="flex items-start gap-4"><Link href={`/admin/afdian-mappings/${rule.id}`} className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="truncate font-medium">{rule.name || rule.benefitKey}</h3>{rule.enabled ? <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">启用</span> : <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">停用</span>}</div><code className="mt-1.5 block truncate text-[11px] text-slate-400">{rule.benefitKey}</code><p className="mt-4 text-xs text-slate-500">{rule.kind === 'credits' ? `${rule.credits?.toLocaleString()} credits` : rule.groupName || '未知用户组'} · 订单 month 决定周期 · 每件 {rule.codesPerItem} 份</p></Link><button onClick={() => void remove(rule)} aria-label={deletingId === rule.id ? '再次点击确认删除' : '删除映射'} className={`rounded-lg p-2 transition ${deletingId === rule.id ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200' : 'text-slate-300 hover:bg-rose-50 hover:text-rose-500'}`}>{deletingId === rule.id ? <span className="text-[10px] font-medium">确认</span> : <Trash2 size={15}/>}</button></div></article>)}</div>}</section></div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-medium text-slate-500">{label}</span>{children}</label> }
function ConfigBadge({ configured, label }: { configured: boolean; label: string }) { return <span className={`rounded-md px-2 py-1 text-[10px] ${configured ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-200'}`}>{label}{configured ? '已配置' : '未配置'}</span> }
