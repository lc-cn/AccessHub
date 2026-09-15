'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, CircleOff, ExternalLink, HeartHandshake, Plus, RotateCcw, Save, Search, Trash2 } from 'lucide-react'
import type { AdminData, AfdianRule, DashboardGroup } from './types'
import { requestJson } from '@/lib/http-client'

type RuleForm = {
  name: string
  sourceType: 'plan' | 'sku'
  sourceId: string
  kind: 'group' | 'credits'
  groupId: string
  credits: string
  durationValue: string
  durationUnit: 'day' | 'month' | 'quarter' | 'year'
  codesPerItem: string
  enabled: boolean
}

const emptyForm: RuleForm = { name: '', sourceType: 'plan', sourceId: '', kind: 'group', groupId: '', credits: '10000', durationValue: '1', durationUnit: 'month', codesPerItem: '1', enabled: true }
function formFor(rule: AfdianRule, fallbackGroupId = ''): RuleForm { const [sourceType, ...idParts] = rule.benefitKey.split(':'); return { name: rule.name, sourceType: sourceType as 'plan' | 'sku', sourceId: idParts.join(':'), kind: rule.kind, groupId: rule.groupId || fallbackGroupId, credits: String(rule.credits ?? 10000), durationValue: String(rule.durationValue), durationUnit: rule.durationUnit, codesPerItem: String(rule.codesPerItem), enabled: rule.enabled } }

export function AfdianMappings({ groups }: { groups: DashboardGroup[] }) {
  const [rules, setRules] = useState<AfdianRule[]>([])
  const [configured, setConfigured] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<RuleForm>({ ...emptyForm, groupId: groups[0]?.id || '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [showDisabled, setShowDisabled] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await requestJson<AdminData>('/api/admin?section=afdian', { cache: 'no-store' })
      setRules(result.afdianRules ?? [])
      setConfigured(Boolean(result.afadianWebhookConfigured))
    } catch (error) { setNotice({ tone: 'error', text: error instanceof Error ? error.message : '读取爱发电映射失败' }) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const selected = useMemo(() => rules.find((rule) => rule.id === selectedId) ?? null, [rules, selectedId])

  const edit = (rule: AfdianRule) => {
    setDeletingId(null)
    setSelectedId(rule.id)
    setForm(formFor(rule, groups[0]?.id))
    setNotice(null)
  }

  const create = () => {
    setSelectedId(null)
    setDeletingId(null)
    setForm({ ...emptyForm, groupId: groups[0]?.id || '' })
    setNotice(null)
  }

  const save = async () => {
    if (!form.sourceId.trim()) return setNotice({ tone: 'error', text: '请输入爱发电方案 ID 或 SKU ID' })
    setSaving(true)
    try {
      const result = await requestJson<{ rule: AfdianRule }>('/api/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'afadian-rule', benefitKey: `${form.sourceType}:${form.sourceId.trim()}`, name: form.name, kind: form.kind, groupId: form.groupId, credits: form.credits, durationValue: form.durationValue, durationUnit: form.durationUnit, codesPerItem: form.codesPerItem, enabled: form.enabled }) })
      setNotice({ tone: 'success', text: selected ? '映射已更新' : '映射已创建' })
      setSelectedId(result.rule.id)
      await load()
    } catch (error) { setNotice({ tone: 'error', text: error instanceof Error ? error.message : '保存映射失败' }) }
    finally { setSaving(false) }
  }

  const remove = async (rule: AfdianRule) => {
    if (deletingId !== rule.id) return setDeletingId(rule.id)
    try {
      await requestJson(`/api/admin?ruleId=${encodeURIComponent(rule.id)}`, { method: 'DELETE' })
      if (selectedId === rule.id) create()
      await load()
    } catch (error) { setNotice({ tone: 'error', text: error instanceof Error ? error.message : '删除映射失败' }) }
    finally { setDeletingId(null) }
  }

  const baseline = selected ? formFor(selected, groups[0]?.id) : { ...emptyForm, groupId: groups[0]?.id || '' }
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline)
  const visibleRules = rules.filter((rule) => (showDisabled || rule.enabled) && (!query || `${rule.name} ${rule.benefitKey} ${rule.groupName || ''}`.toLowerCase().includes(query.toLowerCase())))

  return <div className="space-y-7">
    <section className="grid gap-4 md:grid-cols-2">
      <article className="rounded-[20px] bg-[#182238] p-6 text-white"><div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-xl bg-white/10"><HeartHandshake size={19}/></span><span className={`rounded-md px-2 py-1 text-[10px] ${configured ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-200'}`}>{configured ? '密钥已配置' : '缺少回调密钥'}</span></div><h2 className="mt-6 text-xl font-semibold">爱发电自动到账</h2><p className="mt-2 text-sm leading-6 text-slate-300">支付成功后，Webhook 会为已绑定用户直接发放权益；未绑定订单生成兑换码作为兜底。重复订单不会重复发放。</p><a href="https://afdian.com/dashboard/dev" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1.5 text-xs text-[#a9baf5]">打开爱发电开发者后台 <ExternalLink size={13}/></a></article>
      <article className="rounded-[20px] bg-white p-6 shadow-[0_14px_40px_rgba(39,55,92,.055)]"><p className="text-xs font-medium text-[#3157d5]">匹配顺序</p><ol className="mt-5 space-y-4 text-sm"><li><strong className="mr-3 font-mono text-slate-300">01</strong>优先匹配订单中的 SKU ID</li><li><strong className="mr-3 font-mono text-slate-300">02</strong>没有 SKU 规则时匹配方案 ID</li><li><strong className="mr-3 font-mono text-slate-300">03</strong>停用或未匹配的订单不生成权益</li></ol></article>
    </section>

    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
      <div><div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-medium tracking-wide text-[#3157d5]">权益映射</p><h2 className="mt-1 text-2xl font-semibold">方案与商品</h2><p className="mt-2 text-xs text-slate-400">{rules.filter((rule) => rule.enabled).length} 条启用 · {rules.length} 条总计</p></div><button onClick={create} className="flex items-center gap-2 rounded-xl bg-[#3157d5] px-4 py-2.5 text-sm font-medium text-white"><Plus size={15}/>新增映射</button></div>
        <div className="mb-4 flex gap-2"><label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl bg-white px-3 text-slate-400 focus-within:ring-2 focus-within:ring-blue-100"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none" placeholder="搜索名称、方案或 SKU"/></label><button onClick={() => setShowDisabled((value) => !value)} className={`shrink-0 rounded-xl px-3 text-xs transition ${showDisabled ? 'bg-white text-slate-500' : 'bg-[#182238] text-white'}`}>{showDisabled ? '含停用' : '仅启用'}</button></div>
        {loading ? <div className="h-40 animate-pulse rounded-[20px] bg-white"/> : rules.length === 0 ? <button onClick={create} className="w-full rounded-[20px] border border-dashed border-slate-300 bg-white p-12 text-sm text-slate-400">还没有映射，点击创建第一条规则</button> : visibleRules.length === 0 ? <p className="rounded-[18px] bg-white px-5 py-12 text-center text-sm text-slate-400">没有匹配的映射规则</p> : <div className="space-y-3">{visibleRules.map((rule) => <article key={rule.id} className={`rounded-[18px] bg-white p-5 transition ${selectedId === rule.id ? 'ring-2 ring-[#b9c9ff]' : ''}`}><div className="flex items-start gap-4"><button onClick={() => edit(rule)} className="min-w-0 flex-1 text-left"><div className="flex items-center gap-2"><h3 className="truncate font-medium">{rule.name || rule.benefitKey}</h3>{rule.enabled ? <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">启用</span> : <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">停用</span>}</div><code className="mt-1.5 block truncate text-[11px] text-slate-400">{rule.benefitKey}</code><p className="mt-4 text-xs text-slate-500">{rule.kind === 'credits' ? `${rule.credits?.toLocaleString()} credits` : rule.groupName || '未知用户组'} · {durationText(rule.durationValue, rule.durationUnit)} · 每件 {rule.codesPerItem} 份</p></button><button onClick={() => void remove(rule)} aria-label={deletingId === rule.id ? '再次点击确认删除' : '删除映射'} className={`rounded-lg p-2 transition ${deletingId === rule.id ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200' : 'text-slate-300 hover:bg-rose-50 hover:text-rose-500'}`}>{deletingId === rule.id ? <span className="text-[10px] font-medium">确认</span> : <Trash2 size={15}/>}</button></div></article>)}</div>}
      </div>

      <aside className="h-fit rounded-[22px] bg-white p-6 shadow-[0_18px_55px_rgba(39,55,92,.06)] xl:sticky xl:top-24"><div className="flex items-center gap-2"><p className="text-xs text-slate-400">{selected ? '编辑映射' : '新映射'}</p>{dirty && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">未保存</span>}</div><h3 className="mt-1 text-lg font-semibold">{selected?.name || '配置权益规则'}</h3><div className="mt-6 space-y-4"><Field label="显示名称"><input className="access-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如：专业版月卡"/></Field><div className="grid grid-cols-[120px_1fr] gap-3"><Field label="来源类型"><select className="access-input" value={form.sourceType} onChange={(event) => setForm({ ...form, sourceType: event.target.value as RuleForm['sourceType'] })}><option value="plan">方案</option><option value="sku">SKU</option></select></Field><Field label="方案 / SKU ID"><input className="access-input font-mono" value={form.sourceId} onChange={(event) => setForm({ ...form, sourceId: event.target.value })} placeholder="粘贴 ID"/></Field></div><Field label="权益类型"><select className="access-input" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as RuleForm['kind'] })}><option value="group">用户组权益</option><option value="credits">credits 增量包</option></select></Field>{form.kind === 'group' ? <Field label="用户组"><select className="access-input" value={form.groupId} onChange={(event) => setForm({ ...form, groupId: event.target.value })}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></Field> : <Field label="每份 credits"><input type="number" min="1" className="access-input" value={form.credits} onChange={(event) => setForm({ ...form, credits: event.target.value })}/></Field>}<div className="grid grid-cols-2 gap-3"><Field label="权益时长"><input type="number" min="-1" className="access-input" value={form.durationValue} onChange={(event) => setForm({ ...form, durationValue: event.target.value })}/></Field><Field label="周期"><select disabled={form.durationValue === '-1'} className="access-input" value={form.durationUnit} onChange={(event) => setForm({ ...form, durationUnit: event.target.value as RuleForm['durationUnit'] })}><option value="day">天</option><option value="month">月</option><option value="quarter">季</option><option value="year">年</option></select></Field></div><Field label="每件权益份数"><input type="number" min="1" max="1000" className="access-input" value={form.codesPerItem} onChange={(event) => setForm({ ...form, codesPerItem: event.target.value })}/></Field><label className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${form.enabled ? 'border-[#b9c9ff] bg-[#f3f6ff]' : 'border-slate-200'}`}><span><strong className="block font-medium">启用规则</strong><span className="mt-1 block text-[11px] text-slate-400">停用后保留配置但不再发放</span></span><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} className="size-4 accent-[#3157d5]"/></label>{notice && <p className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs ${notice.tone === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>{notice.tone === 'success' ? <CheckCircle2 size={14}/> : <CircleOff size={14}/>} {notice.text}</p>}<div className="flex gap-2">{dirty && <button onClick={() => { setForm(baseline); setNotice(null) }} className="flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm text-slate-500 hover:bg-slate-50"><RotateCcw size={14}/>重置</button>}<button onClick={() => void save()} disabled={saving || !dirty || (form.kind === 'group' && groups.length === 0)} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#182238] text-sm font-medium text-white disabled:opacity-40"><Save size={15}/>{saving ? '保存中…' : '保存映射'}</button></div></div></aside>
    </section>
  </div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-medium text-slate-500">{label}</span>{children}</label> }
function durationText(value: number, unit: AfdianRule['durationUnit']) { return value === -1 ? '永久' : `${value} ${unit === 'day' ? '天' : unit === 'month' ? '月' : unit === 'quarter' ? '季' : '年'}` }
