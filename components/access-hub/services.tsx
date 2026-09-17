'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Braces, CheckCircle2, ChevronRight, CircleOff, KeyRound, Plus, RotateCcw, Save, Search, ServerCog, ShieldCheck, Trash2, Waypoints } from 'lucide-react'
import type { AdminData, ApiService, Permission, ServiceApi, ServiceParameter, WorkerServiceBinding } from './types'
import { useWorkspaceRefresh } from './workspace-data'
import { requestJson } from '@/lib/http-client'

type Mode = 'list' | 'new' | 'edit' | 'api-new' | 'api-edit'
type ServiceForm = { code: string; name: string; description: string; transport: ApiService['transport']; bindingName: string; baseUrl: string; authType: ApiService['authType']; authToken: string; authHeader: string; authQuery: string; authValue: string; authUsername: string; authPassword: string; requiredPermissionId: string; enabled: boolean }
type ApiForm = { code: string; name: string; description: string; path: string; method: ServiceApi['method']; usageUnits: string; timeoutMs: string; enabled: boolean; parameters: ServiceParameter[] }

const emptyService: ServiceForm = { code: '', name: '', description: '', transport: 'http', bindingName: '', baseUrl: '', authType: 'none', authToken: '', authHeader: 'x-api-key', authQuery: 'api_key', authValue: '', authUsername: '', authPassword: '', requiredPermissionId: '', enabled: true }
const emptyApi: ApiForm = { code: '', name: '', description: '', path: '/', method: 'POST', usageUnits: '1', timeoutMs: '30000', enabled: true, parameters: [] }
const emptyParameter: ServiceParameter = { name: '', location: 'body', dataType: 'string', required: false, description: '' }

function serviceFormFor(service: ApiService): ServiceForm { return { ...emptyService, code: service.code, name: service.name, description: service.description, transport: service.transport, bindingName: service.bindingName || '', baseUrl: service.baseUrl, authType: service.authType, authHeader: service.authHeader || emptyService.authHeader, authQuery: service.authQuery || emptyService.authQuery, authUsername: service.authUsername || '', requiredPermissionId: service.requiredPermissionId || '', enabled: service.enabled } }
function apiFormFor(api: ServiceApi): ApiForm { return { code: api.code, name: api.name, description: api.description, path: api.path, method: api.method, usageUnits: String(api.usageUnits), timeoutMs: String(api.timeoutMs), enabled: api.enabled, parameters: api.parameters } }

export function Services({ mode, resourceId }: { mode: Mode; resourceId?: string }) {
  const router = useRouter()
  const [services, setServices] = useState<ApiService[]>([])
  const [workerBindings, setWorkerBindings] = useState<WorkerServiceBinding[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [serviceForm, setServiceForm] = useState<ServiceForm>(emptyService)
  const [apiForm, setApiForm] = useState<ApiForm>(emptyApi)
  const [serviceId, apiId] = mode === 'api-edit' ? String(resourceId || '').split(':', 2) : [resourceId, undefined]
  const selectedService = useMemo(() => services.find((item) => item.id === serviceId) ?? null, [serviceId, services])
  const selectedApi = useMemo(() => selectedService?.apis.find((item) => item.id === apiId) ?? null, [apiId, selectedService])

  const load = useCallback(async () => {
    setLoading(true)
    try { const data = await requestJson<AdminData>('/api/admin/services', { cache: 'no-store' }); setServices(data.services ?? []); setWorkerBindings(data.workerBindings ?? []); setPermissions(data.permissions ?? []); setNotice(null) }
    catch (error) { setNotice({ tone: 'error', text: error instanceof Error ? error.message : '服务目录读取失败' }) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  useWorkspaceRefresh(load)
  useEffect(() => {
    if (mode === 'new') setServiceForm(emptyService)
    if (mode === 'edit' && selectedService) setServiceForm(serviceFormFor(selectedService))
    if (mode === 'api-new') setApiForm(emptyApi)
    if (mode === 'api-edit' && selectedApi) setApiForm(apiFormFor(selectedApi))
  }, [mode, selectedApi, selectedService])

  const visible = services.filter((service) => !query || `${service.code} ${service.name} ${service.description} ${service.baseUrl} ${service.bindingName || ''}`.toLowerCase().includes(query.toLowerCase()))
  const serviceBaseline = selectedService ? serviceFormFor(selectedService) : emptyService
  const apiBaseline = selectedApi ? apiFormFor(selectedApi) : emptyApi
  const serviceDirty = JSON.stringify(serviceForm) !== JSON.stringify(serviceBaseline)
  const apiDirty = JSON.stringify(apiForm) !== JSON.stringify(apiBaseline)

  const saveService = async () => {
    setSaving(true); setNotice(null)
    try {
      const result = await requestJson<{ service: ApiService }>(mode === 'new' ? '/api/admin/services' : `/api/admin/services/${encodeURIComponent(serviceId || '')}`, { method: mode === 'new' ? 'POST' : 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(serviceForm) })
      if (mode === 'new') {
        setServices((current) => [...current, result.service])
        router.replace(`/admin/services/${result.service.id}`)
      } else {
        setServices((current) => current.map((service) => service.id === result.service.id ? { ...service, ...result.service, apis: service.apis } : service))
        setServiceForm(serviceFormFor(result.service))
        setNotice({ tone: 'success', text: '服务连接已保存，鉴权密钥不会回显。' })
      }
    } catch (error) { setNotice({ tone: 'error', text: error instanceof Error ? error.message : '服务保存失败' }) }
    finally { setSaving(false) }
  }

  const saveApi = async () => {
    if (!serviceId) return
    setSaving(true); setNotice(null)
    try {
      const base = `/api/admin/services/${encodeURIComponent(serviceId || '')}/apis`
      const result = await requestJson<{ api: ServiceApi }>(mode === 'api-new' ? base : `${base}/${encodeURIComponent(apiId || '')}`, { method: mode === 'api-new' ? 'POST' : 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(apiForm) })
      setServices((current) => current.map((service) => service.id === serviceId ? {
        ...service,
        apis: mode === 'api-new' ? [...service.apis, result.api] : service.apis.map((api) => api.id === result.api.id ? result.api : api),
      } : service))
      if (mode === 'api-new') router.replace(`/admin/services/${serviceId}/apis/${result.api.id}`)
      else { setApiForm(apiFormFor(result.api)); setNotice({ tone: 'success', text: 'API 契约已保存' }) }
    } catch (error) { setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'API 保存失败' }) }
    finally { setSaving(false) }
  }

  if (mode === 'list') return <ServiceList services={visible} total={services.length} query={query} setQuery={setQuery} loading={loading} notice={notice}/>
  if (loading) return <div className="mx-auto h-[620px] max-w-4xl animate-pulse rounded-[24px] bg-white"/>
  if (mode === 'edit' && !selectedService) return <Missing text="服务不存在或已被删除"/>
  if ((mode === 'api-new' || mode === 'api-edit') && !selectedService) return <Missing text="所属服务不存在或已被删除"/>
  if (mode === 'api-edit' && !selectedApi) return <Missing text="API 不存在或已被删除"/>

  if (mode === 'new' || mode === 'edit') return <ServiceEditor mode={mode} service={selectedService} workerBindings={workerBindings} permissions={permissions} form={serviceForm} setForm={setServiceForm} dirty={serviceDirty} saving={saving} notice={notice} onReset={() => setServiceForm(serviceBaseline)} onSave={saveService}/>
  return <ApiEditor mode={mode} service={selectedService!} form={apiForm} setForm={setApiForm} dirty={apiDirty} saving={saving} notice={notice} onReset={() => setApiForm(apiBaseline)} onSave={saveApi}/>
}

function ServiceList({ services, total, query, setQuery, loading, notice }: { services: ApiService[]; total: number; query: string; setQuery: (value: string) => void; loading: boolean; notice: { tone: 'success' | 'error'; text: string } | null }) {
  return <section>
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-medium text-[#3157d5]">API 网关</p><h2 className="mt-1 text-2xl font-semibold">上游服务</h2><p className="mt-2 text-sm text-slate-500">从服务卡片直接定义 API，服务详情只负责连接与鉴权。</p></div>
      <Link href="/admin/services/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#3157d5] px-4 text-sm font-medium text-white transition hover:bg-[#284bc0] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3157d5]/30"><Plus size={15}/>新增服务</Link>
    </div>
    <div className="mb-4 grid grid-cols-3 gap-3"><Metric icon={<ServerCog size={15}/>} label="服务" value={total}/><Metric icon={<Waypoints size={15}/>} label="API" value={services.reduce((sum, item) => sum + item.apis.length, 0)}/><Metric icon={<CheckCircle2 size={15}/>} label="启用" value={services.filter((item) => item.enabled).length}/></div>
    <label className="mb-4 flex h-11 items-center gap-2 rounded-xl bg-white px-3 text-slate-400 focus-within:ring-2 focus-within:ring-blue-100"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="搜索服务名称、编码或 Base URL"/>{query && <button type="button" onClick={() => setQuery('')} className="text-xs hover:text-slate-600">清除</button>}</label>
    {notice && <Notice value={notice}/>} {loading ? <div className="h-40 animate-pulse rounded-[20px] bg-white"/> : services.length === 0 ? <div className="rounded-[20px] bg-white p-12 text-center"><ServerCog className="mx-auto text-slate-300"/><p className="mt-4 text-sm text-slate-400">{query ? '没有匹配的服务' : '还没有上游服务'}</p>{!query && <Link href="/admin/services/new" className="mt-3 inline-flex text-xs font-medium text-[#3157d5]">连接第一个服务</Link>}</div> : <div className="grid gap-4 xl:grid-cols-2">{services.map((service) => <ServiceCard key={service.id} service={service}/>)}</div>}
  </section>
}

function ServiceCard({ service }: { service: ApiService }) {
  const previewApis = service.apis.slice(0, 3)
  return <article className="group rounded-[20px] bg-white p-5 shadow-[0_1px_0_rgba(39,55,92,.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(39,55,92,.08)]">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2"><h3 className="truncate font-semibold">{service.name}</h3><Status enabled={service.enabled}/></div>
        <code className="mt-1.5 block truncate text-[11px] text-[#3157d5]">{service.code}</code>
      </div>
      <Link href={`/admin/services/${service.id}/apis/new`} aria-label={`为 ${service.name} 新增 API`} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#182238] px-3 text-xs font-medium text-white transition hover:bg-[#24314c] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#182238]/30"><Plus size={14}/>新增 API</Link>
    </div>
    <p className="mt-3 truncate font-mono text-[11px] text-slate-400">{service.transport === 'worker_binding' ? `Worker Binding · ${service.bindingName}` : service.baseUrl}</p>
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
      <span>{service.apis.length} 个 API</span><span>{service.requiredPermissionName ? `权限 · ${service.requiredPermissionName}` : '所有登录用户可见'}</span>
      <span className="flex items-center gap-1"><KeyRound size={12}/>{authLabel(service.authType)}{service.authType !== 'none' && (service.authConfigured ? ' · 已配置' : ' · 缺失')}</span>
      <Link href={`/admin/services/${service.id}`} className="ml-auto inline-flex items-center gap-1 font-medium text-[#3157d5] hover:text-[#2448bd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3157d5]/30">编辑服务<ChevronRight size={13}/></Link>
    </div>
    <div className="mt-4 border-t border-slate-100 pt-3">
      {previewApis.length === 0 ? <Link href={`/admin/services/${service.id}/apis/new`} className="flex min-h-12 items-center justify-between rounded-xl bg-[#f7f8fb] px-3 text-xs text-slate-400 transition hover:bg-[#f1f4fa] hover:text-[#3157d5]"><span>还没有 API，直接定义第一个端点</span><Plus size={14}/></Link> : <div className="space-y-1">{previewApis.map((api) => <Link key={api.id} href={`/admin/services/${service.id}/apis/${api.id}`} className="grid min-h-10 grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 text-xs transition hover:bg-[#f5f7fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3157d5]/20"><span className="font-mono text-[10px] font-semibold text-[#3157d5]">{api.method}</span><span className="truncate text-slate-600">{api.name}</span><span className="font-mono text-[10px] text-slate-400">{api.usageUnits === 0 ? '免费' : `${api.usageUnits} 次`}</span></Link>)}{service.apis.length > previewApis.length && <Link href={`/admin/services/${service.id}`} className="inline-flex px-2 pt-2 text-[11px] font-medium text-slate-400 hover:text-[#3157d5]">查看另外 {service.apis.length - previewApis.length} 个 API</Link>}</div>}
    </div>
  </article>
}

function ServiceEditor({ mode, service, workerBindings, permissions, form, setForm, dirty, saving, notice, onReset, onSave }: { mode: 'new' | 'edit'; service: ApiService | null; workerBindings: WorkerServiceBinding[]; permissions: Permission[]; form: ServiceForm; setForm: (value: ServiceForm) => void; dirty: boolean; saving: boolean; notice: { tone: 'success' | 'error'; text: string } | null; onReset: () => void; onSave: () => Promise<void> }) {
  const selectedBinding = workerBindings.find((item) => item.binding === form.bindingName)
  const missingCurrentBinding = form.bindingName && !selectedBinding
  return <div className="mx-auto max-w-4xl"><Link href="/admin/services" className="mb-5 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#3157d5]"><ArrowLeft size={15}/>返回服务列表</Link><form onSubmit={(event) => { event.preventDefault(); void onSave() }} className="rounded-[24px] bg-white p-6 shadow-[0_18px_55px_rgba(39,55,92,.06)] sm:p-8"><EditorHeading eyebrow={mode === 'new' ? '新服务' : '服务连接'} title={mode === 'new' ? '连接真实 API 服务' : service?.name || ''} dirty={dirty}/><div className="mt-8 grid gap-5 sm:grid-cols-2"><Field label="服务编码" hint="用于用户调用路径，保存后仍可修改"><input className="access-input font-mono lowercase" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toLowerCase() })} placeholder="example-ai"/></Field><Field label="服务名称"><input className="access-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="示例 AI 服务"/></Field><div className="sm:col-span-2"><Field label="连接方式" hint="同一 Cloudflare 账户内优先使用 Worker Binding，调用不经过公网 DNS"><select className="access-input" value={form.transport} onChange={(event) => { const transport = event.target.value as ApiService['transport']; setForm({ ...form, transport, bindingName: transport === 'worker_binding' ? form.bindingName || workerBindings[0]?.binding || '' : form.bindingName, baseUrl: form.transport === 'worker_binding' && transport === 'http' ? '' : form.baseUrl }) }}><option value="http">公网 HTTP</option><option value="worker_binding" disabled={workerBindings.length === 0}>Cloudflare Worker Binding</option></select></Field></div>{form.transport === 'http' ? <div className="sm:col-span-2"><Field label="Base URL" hint="生产环境仅允许 HTTPS，且不能指向本机或私有网络"><input className="access-input font-mono" value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} placeholder="https://api.example.com/v1"/></Field></div> : <div className="sm:col-span-2"><Field label="Cloudflare Worker 服务" hint="列表来自 AccessHub 当前部署中已声明的 Service Bindings"><select className="access-input font-mono" value={form.bindingName} onChange={(event) => setForm({ ...form, bindingName: event.target.value })}><option value="" disabled>请选择 Worker 服务</option>{missingCurrentBinding && <option value={form.bindingName}>{form.bindingName}（当前部署不可用）</option>}{workerBindings.map((item) => <option key={item.binding} value={item.binding}>{item.label} · {item.service} ({item.binding})</option>)}</select></Field><div className="mt-2 rounded-xl bg-[#f4f7ff] px-4 py-3 text-xs leading-5 text-slate-500">{selectedBinding ? <>请求将通过 Cloudflare 内部绑定 <strong className="font-mono text-[#3157d5]">{selectedBinding.binding}</strong> 直达 <strong className="font-mono text-[#3157d5]">{selectedBinding.service}</strong>，不经过公网 DNS。</> : '请选择当前部署中可用的 Worker 服务。'} API 的相对路径仍在下方端点中维护。</div></div>}<div className="sm:col-span-2"><Field label="说明"><textarea rows={3} className="access-input resize-none" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="说明此服务的能力和适用场景"/></Field></div></div>
      <section className="mt-7 rounded-2xl border border-slate-200 p-5"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#edf2ff] text-[#3157d5]"><KeyRound size={16}/></span><div><h3 className="text-sm font-medium">访问权限</h3><p className="mt-0.5 text-xs text-slate-400">服务目录展示和网关调用使用同一权限校验。</p></div></div><div className="mt-5"><Field label="可见性"><select className="access-input" value={form.requiredPermissionId} onChange={(event) => setForm({ ...form, requiredPermissionId: event.target.value })}><option value="">所有已登录用户</option>{permissions.map((permission) => <option key={permission.id} value={permission.id}>需要权限 · {permission.name} ({permission.code})</option>)}</select></Field>{permissions.length === 0 && <p className="mt-2 text-[10px] text-amber-600">还没有权限定义。可先在“权限”页面创建并分配给订阅计划。</p>}</div></section>
      <ServiceAuthEditor service={service} form={form} setForm={setForm}/>
      <Toggle checked={form.enabled} onChange={(enabled) => setForm({ ...form, enabled })} title="启用服务" detail="停用后，此服务下的全部 API 将立即停止接受用户请求。"/>{notice && <div className="mt-5"><Notice value={notice}/></div>}<EditorActions dirty={dirty} saving={saving} onReset={onReset} label={mode === 'new' ? '创建服务' : '保存服务'}/>
    </form>{mode === 'edit' && service && <ApiCatalog service={service}/>}</div>
}

function ServiceAuthEditor({ service, form, setForm }: { service: ApiService | null; form: ServiceForm; setForm: (value: ServiceForm) => void }) {
  const configuredHint = service?.authConfigured ? '留空则保留现有密钥值' : undefined
  return <section className="mt-7 rounded-2xl border border-slate-200 p-5">
    <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#edf2ff] text-[#3157d5]"><ShieldCheck size={16}/></span><div><h3 className="text-sm font-medium">上游鉴权</h3><p className="mt-0.5 text-xs text-slate-400">密钥加密保存，保存后不会在页面或 API 中回显。</p></div></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <Field label="鉴权方式"><select className="access-input" value={form.authType} onChange={(event) => setForm({ ...form, authType: event.target.value as ApiService['authType'] })}><option value="none">无需鉴权</option><option value="bearer">Bearer Token</option><option value="header">自定义 Header</option><option value="query">Query 参数</option><option value="basic">Basic Auth</option></select></Field>
      {form.authType === 'bearer' && <Field label="Token" hint={service?.authConfigured ? '留空则保留现有 Token' : undefined}><input type="password" autoComplete="new-password" className="access-input" value={form.authToken} onChange={(event) => setForm({ ...form, authToken: event.target.value })} placeholder={service?.authConfigured ? '已安全配置' : '输入上游 Token'}/></Field>}
      {form.authType === 'header' && <><Field label="Header 名称"><input className="access-input font-mono" value={form.authHeader} onChange={(event) => setForm({ ...form, authHeader: event.target.value })} placeholder="x-api-key"/></Field><Field label="Header 值" hint={configuredHint}><input type="password" autoComplete="new-password" className="access-input" value={form.authValue} onChange={(event) => setForm({ ...form, authValue: event.target.value })} placeholder={service?.authConfigured ? '已安全配置' : '输入密钥'}/></Field></>}
      {form.authType === 'query' && <><Field label="Query 参数名"><input className="access-input font-mono" value={form.authQuery} onChange={(event) => setForm({ ...form, authQuery: event.target.value })} placeholder="api_key"/></Field><Field label="Query 参数值" hint={configuredHint || '调用上游时由网关自动注入'}><input type="password" autoComplete="new-password" className="access-input" value={form.authValue} onChange={(event) => setForm({ ...form, authValue: event.target.value })} placeholder={service?.authConfigured ? '已安全配置' : '输入密钥'}/></Field></>}
      {form.authType === 'basic' && <><Field label="用户名"><input className="access-input" value={form.authUsername} onChange={(event) => setForm({ ...form, authUsername: event.target.value })}/></Field><Field label="密码" hint={service?.authConfigured ? '留空则保留现有密码' : undefined}><input type="password" autoComplete="new-password" className="access-input" value={form.authPassword} onChange={(event) => setForm({ ...form, authPassword: event.target.value })}/></Field></>}
    </div>
  </section>
}

function ApiCatalog({ service }: { service: ApiService }) { return <section className="mt-7"><div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-medium text-[#3157d5]">API 目录</p><h2 className="mt-1 text-xl font-semibold">用户可调用端点</h2></div><Link href={`/admin/services/${service.id}/apis/new`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#3157d5] px-4 text-sm font-medium text-white"><Plus size={15}/>新增 API</Link></div>{service.apis.length === 0 ? <Link href={`/admin/services/${service.id}/apis/new`} className="block rounded-[20px] border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">此服务还没有 API，点击定义第一个端点</Link> : <div className="space-y-3">{service.apis.map((api) => <Link key={api.id} href={`/admin/services/${service.id}/apis/${api.id}`} className="grid gap-3 rounded-[18px] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(39,55,92,.07)] sm:grid-cols-[auto_1fr_auto] sm:items-center"><span className="w-fit rounded-md bg-[#edf2ff] px-2 py-1 font-mono text-[10px] font-semibold text-[#3157d5]">{api.method}</span><span className="min-w-0"><strong className="block truncate text-sm font-medium">{api.name}</strong><code className="mt-1 block truncate text-[11px] text-slate-400">/api/gateway/{service.code}/{api.code} → {api.path}</code></span><span className="flex items-center gap-3 text-xs text-slate-400"><Status enabled={api.enabled}/><strong className="font-mono text-slate-600">{api.usageUnits === 0 ? '免费调用' : `${api.usageUnits} 次/请求`}</strong><ChevronRight size={15}/></span></Link>)}</div>}</section> }

function ApiEditor({ mode, service, form, setForm, dirty, saving, notice, onReset, onSave }: { mode: 'api-new' | 'api-edit'; service: ApiService; form: ApiForm; setForm: (value: ApiForm) => void; dirty: boolean; saving: boolean; notice: { tone: 'success' | 'error'; text: string } | null; onReset: () => void; onSave: () => Promise<void> }) {
  const updateParameter = (index: number, patch: Partial<ServiceParameter>) => setForm({ ...form, parameters: form.parameters.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) })
  return <div className="mx-auto max-w-4xl"><Link href={`/admin/services/${service.id}`} className="mb-5 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#3157d5]"><ArrowLeft size={15}/>返回 {service.name}</Link><form onSubmit={(event) => { event.preventDefault(); void onSave() }} className="rounded-[24px] bg-white p-6 shadow-[0_18px_55px_rgba(39,55,92,.06)] sm:p-8"><EditorHeading eyebrow={`${service.code} / API`} title={mode === 'api-new' ? '定义用户调用端点' : form.name} dirty={dirty}/><div className="mt-8 grid gap-5 sm:grid-cols-2"><Field label="API 编码" hint="组成公开网关路径"><input className="access-input font-mono lowercase" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toLowerCase() })} placeholder="chat"/></Field><Field label="API 名称"><input className="access-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="对话生成"/></Field><Field label="请求方式"><select className="access-input" value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value as ServiceApi['method'] })}>{['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => <option key={method}>{method}</option>)}</select></Field><Field label="上游路径" hint="路径参数使用 {id} 占位"><input className="access-input font-mono" value={form.path} onChange={(event) => setForm({ ...form, path: event.target.value })} placeholder="/chat/completions"/></Field><Field label="单次计费次数" hint="0 表示免费调用，不消耗任何配额"><input type="number" min="0" max="10000" className="access-input tabular-nums" value={form.usageUnits} onChange={(event) => setForm({ ...form, usageUnits: event.target.value })}/></Field><Field label="上游超时（毫秒）"><input type="number" min="1000" max="120000" step="1000" className="access-input tabular-nums" value={form.timeoutMs} onChange={(event) => setForm({ ...form, timeoutMs: event.target.value })}/></Field><div className="sm:col-span-2"><Field label="说明"><textarea rows={3} className="access-input resize-none" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })}/></Field></div></div>
      <section className="mt-7 rounded-2xl border border-slate-200 p-5"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#edf2ff] text-[#3157d5]"><Braces size={16}/></span><div><h3 className="text-sm font-medium">请求参数</h3><p className="mt-0.5 text-xs text-slate-400">只有列出的参数会被转发到上游。</p></div></div><button type="button" onClick={() => setForm({ ...form, parameters: [...form.parameters, { ...emptyParameter }] })} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600"><Plus size={13}/>添加参数</button></div><div className="mt-5 space-y-3">{form.parameters.length === 0 ? <p className="rounded-xl bg-[#f5f7fb] px-4 py-6 text-center text-xs text-slate-400">暂无参数；无参数 API 可以直接保存。</p> : form.parameters.map((parameter, index) => <div key={index} className="grid gap-2 rounded-xl bg-[#f5f7fb] p-3 sm:grid-cols-[1.2fr_.8fr_.8fr_auto_auto]"><input aria-label={`参数 ${index + 1} 名称`} className="access-input bg-white font-mono" value={parameter.name} onChange={(event) => updateParameter(index, { name: event.target.value })} placeholder="参数名"/><select aria-label={`参数 ${index + 1} 位置`} className="access-input bg-white" value={parameter.location} onChange={(event) => updateParameter(index, { location: event.target.value as ServiceParameter['location'] })}><option value="query">Query</option><option value="path">Path</option><option value="header">Header</option><option value="body">Body</option></select><select aria-label={`参数 ${index + 1} 类型`} className="access-input bg-white" value={parameter.dataType} onChange={(event) => updateParameter(index, { dataType: event.target.value as ServiceParameter['dataType'] })}><option value="string">String</option><option value="number">Number</option><option value="boolean">Boolean</option><option value="json">JSON</option></select><label className="flex items-center gap-1.5 px-2 text-xs text-slate-500"><input type="checkbox" checked={parameter.required} onChange={(event) => updateParameter(index, { required: event.target.checked })}/>必填</label><button type="button" onClick={() => setForm({ ...form, parameters: form.parameters.filter((_, itemIndex) => itemIndex !== index) })} aria-label={`删除参数 ${parameter.name || index + 1}`} className="grid size-10 place-items-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={14}/></button><input className="access-input bg-white sm:col-span-5" value={parameter.description} onChange={(event) => updateParameter(index, { description: event.target.value })} placeholder="参数说明（可选）"/></div>)}</div></section>
      <div className="mt-5 rounded-xl bg-blue-50/70 px-4 py-3 text-xs leading-5 text-blue-700"><strong>公开调用路径</strong><code className="ml-2">{form.method} /api/gateway/{service.code}/{form.code || '{api}'}</code><span className="mt-1 block text-blue-600/80">{Number(form.usageUnits) === 0 ? '该 API 免费调用，不检查或消耗计划配额。' : `调用前校验可用额度；仅上游正常返回 HTTP 200 后扣除 ${form.usageUnits || '1'} 次。超时、网络错误或非 200 响应均不计费。`}</span></div><Toggle checked={form.enabled} onChange={(enabled) => setForm({ ...form, enabled })} title="启用 API" detail="停用后网关返回 404，不再接受新的用户调用。"/>{notice && <div className="mt-5"><Notice value={notice}/></div>}<EditorActions dirty={dirty} saving={saving} onReset={onReset} label={mode === 'api-new' ? '创建 API' : '保存 API'}/>
    </form></div>
}

function EditorHeading({ eyebrow, title, dirty }: { eyebrow: string; title: string; dirty: boolean }) { return <div className="flex items-start justify-between gap-4"><div><p className="text-xs text-slate-400">{eyebrow}</p><h2 className="mt-1 text-2xl font-semibold">{title}</h2></div>{dirty && <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-700">未保存</span>}</div> }
function EditorActions({ dirty, saving, onReset, label }: { dirty: boolean; saving: boolean; onReset: () => void; label: string }) { return <div className="mt-7 flex justify-end gap-2 border-t border-slate-100 pt-5">{dirty && <button type="button" onClick={onReset} className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm text-slate-500"><RotateCcw size={14}/>重置</button>}<button disabled={!dirty || saving} className="inline-flex items-center gap-2 rounded-xl bg-[#182238] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"><Save size={15}/>{saving ? '保存中…' : label}</button></div> }
function Toggle({ checked, onChange, title, detail }: { checked: boolean; onChange: (value: boolean) => void; title: string; detail: string }) { return <label className={`mt-5 flex items-center justify-between rounded-xl border px-4 py-3 ${checked ? 'border-[#b9c9ff] bg-[#f3f6ff]' : 'border-slate-200'}`}><span><strong className="block text-sm font-medium">{title}</strong><span className="mt-1 block text-xs text-slate-400">{detail}</span></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-[#3157d5]"/></label> }
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-medium text-slate-500">{label}</span>{children}{hint && <span className="mt-1.5 block text-[10px] leading-4 text-slate-400">{hint}</span>}</label> }
function Notice({ value }: { value: { tone: 'success' | 'error'; text: string } }) { return <p className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs ${value.tone === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>{value.tone === 'success' ? <CheckCircle2 size={14}/> : <CircleOff size={14}/>} {value.text}</p> }
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <div className="rounded-xl bg-white px-4 py-3"><div className="flex items-center gap-2 text-slate-400">{icon}<span className="text-[10px]">{label}</span></div><p className="mt-2 font-mono text-lg font-semibold">{value}</p></div> }
function Status({ enabled }: { enabled: boolean }) { return <span className={`w-fit rounded-md px-2 py-0.5 text-[10px] ${enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{enabled ? '启用' : '停用'}</span> }
function authLabel(type: ApiService['authType']) { return ({ none: '无鉴权', bearer: 'Bearer', header: 'Header', query: 'Query 参数', basic: 'Basic Auth' })[type] }
function Missing({ text }: { text: string }) { return <div className="mx-auto max-w-2xl rounded-[22px] bg-white p-10 text-center"><CircleOff className="mx-auto text-slate-300"/><p className="mt-4 text-sm text-slate-500">{text}</p><Link href="/admin/services" className="mt-4 inline-flex text-sm font-medium text-[#3157d5]">返回服务列表</Link></div> }
