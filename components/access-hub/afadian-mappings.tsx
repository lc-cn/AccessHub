'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, CircleOff, ExternalLink, HeartHandshake, Plus, RotateCcw, Save, Search, Trash2, X } from 'lucide-react'
import type { AdminData, AfdianMapping, Sku } from './types'
import { requestJson } from '@/lib/http-client'
import { useWorkspaceRefresh } from './workspace-data'

type MappingForm = { name: string; sourceType: 'plan' | 'sku'; sourceId: string; skuId: string; codesPerItem: string; enabled: boolean }
type Props = { skus: Sku[]; mode: 'list' | 'new' | 'edit'; mappingId?: string }
const emptyForm: MappingForm = { name: '', sourceType: 'plan', sourceId: '', skuId: '', codesPerItem: '1', enabled: true }
function formFor(mapping: AfdianMapping, fallbackSkuId = ''): MappingForm { return { name: mapping.name, sourceType: mapping.externalOfferType, sourceId: mapping.externalOfferId, skuId: mapping.skuId || fallbackSkuId, codesPerItem: String(mapping.codesPerItem), enabled: mapping.enabled } }

export function AfdianMappings({ skus, mode, mappingId }: Props) {
  const router = useRouter()
  const [mappings, setMappings] = useState<AfdianMapping[]>([])
  const [catalog, setCatalog] = useState<Sku[]>(skus)
  const [webhookConfigured, setWebhookConfigured] = useState(false)
  const [messengerConfigured, setMessengerConfigured] = useState(false)
  const [form, setForm] = useState<MappingForm>({ ...emptyForm, skuId: skus[0]?.id || '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [showDisabled, setShowDisabled] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const load = useCallback(async () => {
    setLoading(true)
    try { const result = await requestJson<AdminData>('/api/admin?section=afdian', { cache: 'no-store' }); setMappings(result.afdianMappings ?? []); setCatalog(result.skus ?? []); setWebhookConfigured(Boolean(result.afadianWebhookConfigured)); setMessengerConfigured(Boolean(result.afadianMessengerConfigured)) }
    catch (error) { setNotice({ tone: 'error', text: error instanceof Error ? error.message : '读取爱发电映射失败' }) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  useWorkspaceRefresh(load)
  const activeSkus = useMemo(() => catalog.filter((sku) => sku.active), [catalog])
  const selected = useMemo(() => mappings.find((mapping) => mapping.id === mappingId) ?? null, [mappingId, mappings])
  useEffect(() => {
    const fallback = activeSkus[0]?.id || ''
    if (mode === 'edit' && selected) setForm(formFor(selected, fallback))
    if (mode === 'new') setForm((current) => current.skuId ? current : { ...emptyForm, skuId: fallback })
  }, [activeSkus, mode, selected])
  const baseline = selected ? formFor(selected, activeSkus[0]?.id) : { ...emptyForm, skuId: activeSkus[0]?.id || '' }
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline)
  const save = async () => {
    if (!form.sourceId.trim()) return setNotice({ tone: 'error', text: '请输入爱发电方案 ID 或 SKU ID' })
    if (!form.skuId) return setNotice({ tone: 'error', text: '请选择本地 SKU' })
    setSaving(true)
    try {
      const result = await requestJson<{ mapping: AfdianMapping }>('/api/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'afadian-mapping', externalOfferType: form.sourceType, externalOfferId: form.sourceId.trim(), name: form.name, skuId: form.skuId, codesPerItem: form.codesPerItem, enabled: form.enabled }) })
      setNotice({ tone: 'success', text: selected ? '映射已更新' : '映射已创建' }); await load()
      if (mode === 'new') router.replace(`/admin/afdian/mappings/${result.mapping.id}`)
    } catch (error) { setNotice({ tone: 'error', text: error instanceof Error ? error.message : '保存映射失败' }) }
    finally { setSaving(false) }
  }
  const remove = async (mapping: AfdianMapping) => {
    if (deletingId !== mapping.id) return setDeletingId(mapping.id)
    try { await requestJson(`/api/admin?mappingId=${encodeURIComponent(mapping.id)}`, { method: 'DELETE' }); await load() }
    catch (error) { setNotice({ tone: 'error', text: error instanceof Error ? error.message : '删除映射失败' }) }
    finally { setDeletingId(null) }
  }
  const visibleMappings = mappings.filter((mapping) => (showDisabled || mapping.enabled) && (!query || `${mapping.name} ${mapping.externalOfferType} ${mapping.externalOfferId} ${mapping.skuCode} ${mapping.skuName}`.toLowerCase().includes(query.toLowerCase())))

  if (mode !== 'list') {
    if (loading) return <div className="mx-auto h-[520px] max-w-2xl animate-pulse rounded-[22px] bg-white"/>
    if (mode === 'edit' && !selected) return <Empty/>
    return <div className="mx-auto max-w-2xl"><Link href="/admin/afdian/mappings" className="mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[#3157d5]"><ArrowLeft size={14}/>返回映射列表</Link><section className="rounded-[24px] bg-white p-6 shadow-[0_18px_55px_rgba(39,55,92,.06)] sm:p-8"><div className="flex items-center justify-between gap-4"><div><p className="text-xs text-slate-400">{selected ? '编辑商品映射' : '新建商品映射'}</p><h2 className="mt-1 text-xl font-semibold">{selected?.name || '连接爱发电与本地目录'}</h2></div>{dirty && <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-700">未保存</span>}</div><div className="mt-8 space-y-5"><Field label="显示名称"><input className="access-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如：爱发电专业版月卡"/></Field><div className="grid gap-4 sm:grid-cols-[150px_1fr]"><Field label="爱发电商品类型"><select className="access-input" value={form.sourceType} onChange={(event) => setForm({ ...form, sourceType: event.target.value as MappingForm['sourceType'] })}><option value="plan">爱发电方案</option><option value="sku">爱发电 SKU</option></select></Field><Field label="爱发电商品 ID"><input className="access-input font-mono" value={form.sourceId} onChange={(event) => setForm({ ...form, sourceId: event.target.value })} placeholder="粘贴爱发电 ID"/></Field></div><Field label="AccessHub SKU"><select className="access-input" value={form.skuId} onChange={(event) => setForm({ ...form, skuId: event.target.value })}>{activeSkus.map((sku) => <option key={sku.id} value={sku.id}>{sku.code} · {sku.name}</option>)}</select></Field><div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs leading-5 text-blue-700"><strong className="font-medium">映射只负责连接商品</strong><span className="mt-0.5 block text-blue-600/80">权益类型、数量与有效期由本地 SKU 定义；爱发电订单的 month 会覆盖计划类 SKU 的购买周期。</span></div><Field label="每件商品发码数"><input type="number" min="1" max="1000" className="access-input" value={form.codesPerItem} onChange={(event) => setForm({ ...form, codesPerItem: event.target.value })}/></Field><label className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${form.enabled ? 'border-[#b9c9ff] bg-[#f3f6ff]' : 'border-slate-200'}`}><span><strong className="block font-medium">启用映射</strong><span className="mt-1 block text-[11px] text-slate-400">停用后不再接收该商品的自动履约</span></span><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} className="size-4 accent-[#3157d5]"/></label>{notice && <Notice value={notice}/>}<div className="flex justify-end gap-2">{dirty && <button onClick={() => setForm(baseline)} className="flex h-11 items-center gap-1.5 rounded-xl px-4 text-sm text-slate-500"><RotateCcw size={14}/>重置</button>}<button onClick={() => void save()} disabled={saving || !dirty || !activeSkus.length} className="flex h-11 items-center gap-2 rounded-xl bg-[#182238] px-6 text-sm font-medium text-white disabled:opacity-40"><Save size={15}/>{saving ? '保存中…' : '保存映射'}</button></div></div></section></div>
  }

  return <div className="space-y-7"><section className="grid gap-4 md:grid-cols-2"><article className="rounded-[20px] bg-[#182238] p-6 text-white"><div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-xl bg-white/10"><HeartHandshake size={19}/></span><div className="flex gap-1.5"><ConfigBadge configured={webhookConfigured} label="回调"/><ConfigBadge configured={messengerConfigured} label="私信"/></div></div><h2 className="mt-6 text-xl font-semibold">爱发电支付服务</h2><p className="mt-2 text-sm leading-6 text-slate-300">爱发电负责结算和支付事件，AccessHub SKU 与订阅状态机负责最终履约。</p><a href="https://afdian.com/dashboard/dev" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1.5 text-xs text-[#a9baf5]">打开爱发电开发者后台 <ExternalLink size={13}/></a></article><article className="rounded-[20px] bg-white p-6"><p className="text-xs font-medium text-[#3157d5]">匹配顺序</p><ol className="mt-5 space-y-4 text-sm"><li><strong className="mr-3 font-mono text-slate-300">01</strong>爱发电 SKU ID</li><li><strong className="mr-3 font-mono text-slate-300">02</strong>爱发电方案 ID</li><li><strong className="mr-3 font-mono text-slate-300">03</strong>映射到一个本地 SKU</li></ol></article></section><section><div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-medium text-[#3157d5]">爱发电 / 映射</p><h2 className="mt-1 text-2xl font-semibold">跨平台商品映射</h2><p className="mt-2 text-xs text-slate-400">{mappings.filter((mapping) => mapping.enabled).length} 条启用 · {mappings.length} 条总计</p></div><Link href="/admin/afdian/mappings/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#3157d5] px-4 text-sm font-medium text-white"><Plus size={15}/>新增映射</Link></div><div className="mb-4 flex gap-2"><label className="flex h-10 flex-1 items-center gap-2 rounded-xl bg-white px-3 text-slate-400"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs outline-none" placeholder="搜索爱发电商品或本地 SKU"/></label><button onClick={() => setShowDisabled((value) => !value)} className={`rounded-xl px-3 text-xs ${showDisabled ? 'bg-white text-slate-500' : 'bg-[#182238] text-white'}`}>{showDisabled ? '含停用' : '仅启用'}</button></div>{notice && <Notice value={notice}/>} {loading ? <div className="h-40 animate-pulse rounded-[20px] bg-white"/> : visibleMappings.length === 0 ? <div className="rounded-[20px] bg-white p-12 text-center text-sm text-slate-400">还没有符合条件的商品映射</div> : <div className="grid gap-3 lg:grid-cols-2">{visibleMappings.map((mapping) => <article key={mapping.id} className={`rounded-[18px] bg-white p-5 ${deletingId === mapping.id ? 'ring-1 ring-rose-200' : ''}`}><div className="flex items-start gap-4"><Link href={`/admin/afdian/mappings/${mapping.id}`} className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="truncate font-medium">{mapping.name || `${mapping.externalOfferType}:${mapping.externalOfferId}`}</h3><span className={`rounded-md px-2 py-0.5 text-[10px] ${mapping.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{mapping.enabled ? '启用' : '停用'}</span></div><code className="mt-1.5 block truncate text-[11px] text-slate-400">{mapping.externalOfferType}:{mapping.externalOfferId}</code><p className="mt-4 text-xs text-slate-500">→ {mapping.skuCode} · {mapping.skuName} · 每件 {mapping.codesPerItem} 码</p></Link>{deletingId !== mapping.id && <button onClick={() => setDeletingId(mapping.id)} aria-label={`删除映射 ${mapping.name}`} className="rounded-lg p-2 text-slate-300 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={15}/></button>}</div>{deletingId === mapping.id && <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2.5"><p className="min-w-0 flex-1 text-xs text-rose-700">删除后新订单将无法通过此规则履约。</p><button onClick={() => setDeletingId(null)} aria-label="取消删除" className="rounded-lg p-1.5 text-rose-400 hover:bg-white"><X size={14}/></button><button onClick={() => void remove(mapping)} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white">确认删除</button></div>}</article>)}</div>}</section></div>
}

function Empty() { return <div className="mx-auto max-w-2xl rounded-[22px] bg-white p-10 text-center"><CircleOff className="mx-auto text-slate-300"/><h2 className="mt-4 font-semibold">映射不存在</h2><Link href="/admin/afdian/mappings" className="mt-5 inline-flex text-sm text-[#3157d5]">返回映射列表</Link></div> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-medium text-slate-500">{label}</span>{children}</label> }
function Notice({ value }: { value: { tone: 'success' | 'error'; text: string } }) { return <p className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs ${value.tone === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>{value.tone === 'success' ? <CheckCircle2 size={14}/> : <CircleOff size={14}/>} {value.text}</p> }
function ConfigBadge({ configured, label }: { configured: boolean; label: string }) { return <span className={`rounded-md px-2 py-1 text-[10px] ${configured ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-200'}`}>{label}{configured ? '已配置' : '未配置'}</span> }
