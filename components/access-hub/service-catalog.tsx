'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Braces, CheckCircle2, Clock3, Coins, FlaskConical, Gauge, Search, ServerCog, Waypoints } from 'lucide-react'
import type { ServiceParameter } from './types'
import { requestWorkspaceRefresh, useWorkspaceRefresh } from './workspace-data'
import { requestJson } from '@/lib/http-client'

type CatalogApi = { code: string; name: string; description: string; method: string; path: string; parameters: ServiceParameter[]; usageUnits: number }
type CatalogService = { code: string; name: string; description: string; apis: CatalogApi[] }
type TestResult = { status: number; statusText: string; durationMs: number; usageUnits: string | null; contentType: string; body: string }

export function ServiceCatalog({ mode, resourceId }: { mode: 'list' | 'service' | 'api'; resourceId?: string }) {
  const [services, setServices] = useState<CatalogService[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [serviceCode, apiCode] = mode === 'api' ? String(resourceId || '').split(':', 2) : [resourceId, undefined]
  const service = useMemo(() => services.find((item) => item.code === serviceCode) ?? null, [serviceCode, services])
  const api = useMemo(() => service?.apis.find((item) => item.code === apiCode) ?? null, [apiCode, service])
  const load = useCallback(async () => { setLoading(true); try { const data = await requestJson<{ services: CatalogService[] }>('/api/services', { cache: 'no-store' }); setServices(data.services); setError('') } catch (reason) { setError(reason instanceof Error ? reason.message : '服务目录读取失败') } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])
  useWorkspaceRefresh(load)

  if (loading) return <CatalogSkeleton/>
  if (error) return <Message title="暂时无法读取服务" detail={error} action={<button onClick={() => void load()} className="text-sm font-medium text-[#3157d5]">重新加载</button>}/>
  if (mode === 'service' && !service) return <Message title="服务不存在" detail="它可能已经停用，或服务编码已经发生变化。" action={<Link href="/services" className="text-sm font-medium text-[#3157d5]">返回服务中心</Link>}/>
  if (mode === 'api' && (!service || !api)) return <Message title="API 不存在" detail="它可能已经停用，或所属服务已经发生变化。" action={<Link href="/services" className="text-sm font-medium text-[#3157d5]">返回服务中心</Link>}/>
  if (mode === 'service') return <ServiceDetail service={service!}/>
  if (mode === 'api') return <ApiDetail service={service!} api={api!}/>

  const visible = services.filter((item) => !query || `${item.code} ${item.name} ${item.description} ${item.apis.map((apiItem) => apiItem.name).join(' ')}`.toLowerCase().includes(query.toLowerCase()))
  return <section><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"><div className="rounded-[24px] bg-[#182238] p-7 text-white"><span className="grid size-11 place-items-center rounded-xl bg-white/10"><Waypoints size={20}/></span><p className="mt-8 text-xs font-medium text-[#9fb0ee]">统一 API 网关</p><h2 className="mt-2 text-2xl font-semibold">选择服务，直接开始调用</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">AccessHub 负责额度校验和上游鉴权。你只需要使用当前会话，真实服务密钥不会进入浏览器。</p></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-1"><Metric icon={<ServerCog size={16}/>} label="可用服务" value={services.length}/><Metric icon={<Braces size={16}/>} label="公开 API" value={services.reduce((sum, item) => sum + item.apis.length, 0)}/></div></div>
    <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-medium text-[#3157d5]">服务目录</p><h3 className="mt-1 text-xl font-semibold">全部可调用服务</h3></div><label className="flex h-10 items-center gap-2 rounded-xl bg-white px-3 text-slate-400 focus-within:ring-2 focus-within:ring-blue-100 sm:w-80"><Search size={14}/><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none" placeholder="搜索服务或 API"/>{query && <button onClick={() => setQuery('')} className="text-[10px]">清除</button>}</label></div>
    {visible.length === 0 ? <div className="mt-4 rounded-[20px] bg-white p-12 text-center text-sm text-slate-400">{query ? '没有匹配的服务' : '管理员还没有发布可调用服务'}</div> : <div className="mt-4 grid gap-4 lg:grid-cols-2">{visible.map((item) => <Link key={item.code} href={`/services/${item.code}`} className="group rounded-[20px] bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(39,55,92,.08)]"><div className="flex items-start justify-between gap-4"><span className="grid size-10 place-items-center rounded-xl bg-[#edf2ff] text-[#3157d5]"><ServerCog size={18}/></span><span className="flex items-center gap-1 text-xs text-slate-400 transition group-hover:text-[#3157d5]">查看服务 <ArrowRight size={13}/></span></div><h3 className="mt-5 font-semibold">{item.name}</h3><code className="mt-1 block text-[10px] text-[#3157d5]">{item.code}</code><p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-400">{item.description || '该服务暂未添加说明。'}</p><div className="mt-5 flex items-center gap-2 text-xs text-slate-500"><Braces size={13}/>{item.apis.length} 个可调用 API</div></Link>)}</div>}
  </section>
}

function ServiceDetail({ service }: { service: CatalogService }) {
  return <section><Link href="/services" className="mb-5 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#3157d5]"><ArrowLeft size={15}/>返回服务中心</Link><div className="rounded-[24px] bg-white p-7"><div className="flex items-start gap-4"><span className="grid size-11 place-items-center rounded-xl bg-[#edf2ff] text-[#3157d5]"><ServerCog size={20}/></span><div><div className="flex items-center gap-2"><h2 className="text-2xl font-semibold">{service.name}</h2><code className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{service.code}</code></div><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{service.description || '该服务暂未添加说明。'}</p></div></div></div><div className="mt-7"><p className="text-xs font-medium text-[#3157d5]">API 端点</p><h3 className="mt-1 text-xl font-semibold">选择一个 API 查看详情</h3><div className="mt-4 space-y-3">{service.apis.map((api) => <Link key={api.code} href={`/services/${service.code}/${api.code}`} className="grid gap-4 rounded-[18px] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(39,55,92,.07)] sm:grid-cols-[auto_1fr_auto] sm:items-center"><Method value={api.method}/><div className="min-w-0"><h4 className="truncate text-sm font-medium">{api.name}</h4><code className="mt-1 block truncate text-[11px] text-slate-400">{api.path}</code><p className="mt-2 truncate text-xs text-slate-400">{api.description || '暂无说明'}</p></div><div className="flex items-center gap-3"><span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700"><Coins size={12}/>{api.usageUnits === 0 ? '免费' : `${api.usageUnits} 次`}</span><ArrowRight size={15} className="text-slate-300"/></div></Link>)}</div></div></section>
}

function ApiDetail({ service, api }: { service: CatalogService; api: CatalogApi }) {
  return <section><Link href={`/services/${service.code}`} className="mb-5 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#3157d5]"><ArrowLeft size={15}/>返回 {service.name}</Link><div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]"><div className="space-y-6"><article className="rounded-[24px] bg-white p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-3"><Method value={api.method}/><code className="text-sm font-semibold text-slate-700">{api.path}</code></div><h2 className="mt-5 text-2xl font-semibold">{api.name}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{api.description || '该 API 暂未添加说明。'}</p></div><span className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700"><Coins size={14}/>{api.usageUnits === 0 ? '免费调用' : `每次请求计费 ${api.usageUnits} 次`}</span></div><div className="mt-6 rounded-xl bg-[#f5f7fb] px-4 py-3"><p className="text-[10px] text-slate-400">网关调用地址</p><code className="mt-1 block break-all text-xs text-slate-700">{api.method} {api.path}</code></div></article><ParameterDetails parameters={api.parameters}/></div><TestConsole api={api}/></div></section>
}

function ParameterDetails({ parameters }: { parameters: ServiceParameter[] }) { return <article className="rounded-[22px] bg-white p-6"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#edf2ff] text-[#3157d5]"><Braces size={16}/></span><div><h3 className="font-semibold">参数详情</h3><p className="mt-0.5 text-xs text-slate-400">参数之外的字段不会被网关转发。</p></div></div>{parameters.length === 0 ? <p className="mt-5 rounded-xl bg-[#f5f7fb] px-4 py-6 text-center text-xs text-slate-400">此 API 无需参数</p> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[560px] text-left"><thead><tr className="border-b border-slate-100 text-[10px] text-slate-400"><th className="pb-3">参数</th><th className="pb-3">位置</th><th className="pb-3">类型</th><th className="pb-3">要求</th><th className="pb-3">说明</th></tr></thead><tbody>{parameters.map((item) => <tr key={`${item.location}:${item.name}`} className="border-b border-slate-50 text-xs last:border-0"><td className="py-3 font-mono font-medium text-slate-700">{item.name}</td><td className="py-3 text-slate-500">{locationLabel(item.location)}</td><td className="py-3 font-mono text-slate-500">{item.dataType}</td><td className="py-3">{item.required ? <span className="text-rose-600">必填</span> : <span className="text-slate-400">可选</span>}</td><td className="py-3 text-slate-400">{item.description || '—'}</td></tr>)}</tbody></table></div>}</article> }

function TestConsole({ api }: { api: CatalogApi }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<TestResult | null>(null)
  const [defaultApiKey, setDefaultApiKey] = useState('')
  const run = async () => {
    setError(''); setResult(null)
    const missing = api.parameters.find((item) => item.required && !values[parameterKey(item)]?.trim())
    if (missing) return setError(`请填写必填参数：${missing.name}`)
    const target = new URL(api.path, window.location.origin)
    const headers = new Headers({ accept: 'application/json' })
    const body: Record<string, unknown> = {}
    try {
      for (const parameter of api.parameters) {
        const raw = values[parameterKey(parameter)]?.trim()
        if (!raw) continue
        const value = parseValue(raw, parameter.dataType)
        if (parameter.location === 'header') headers.set(parameter.name, String(value))
        else if (parameter.location === 'body') body[parameter.name] = value
        else target.searchParams.set(parameter.name, String(value))
      }
    } catch (reason) { return setError(reason instanceof Error ? reason.message : '参数格式无效') }
    const hasBody = Object.keys(body).length > 0
    if (hasBody) headers.set('content-type', 'application/json')
    setRunning(true)
    const startedAt = performance.now()
    try {
      const token = defaultApiKey || (await requestJson<{ token: string }>('/api/account/api-keys/default', { cache: 'no-store' })).token
      if (!defaultApiKey) setDefaultApiKey(token)
      headers.set('authorization', `Bearer ${token}`)
      const response = await fetch(target, { method: api.method, headers, body: ['GET', 'HEAD'].includes(api.method) ? undefined : hasBody ? JSON.stringify(body) : undefined })
      const text = await response.text()
      setResult({ status: response.status, statusText: response.statusText, durationMs: Math.round(performance.now() - startedAt), usageUnits: response.headers.get('x-accesshub-usage-units'), contentType: response.headers.get('content-type') || 'text/plain', body: formatResponse(text, response.headers.get('content-type')) })
      requestWorkspaceRefresh()
    } catch (reason) { setError(reason instanceof Error ? reason.message : '测试请求失败') }
    finally { setRunning(false) }
  }
  return <aside className="rounded-[24px] bg-[#182238] p-6 text-white xl:sticky xl:top-28 xl:self-start"><div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-xl bg-white/10"><FlaskConical size={18}/></span><span className="rounded-lg bg-amber-400/15 px-2.5 py-1.5 text-[10px] text-amber-200">{api.usageUnits === 0 ? '免费测试' : '成功后计费'}</span></div><h3 className="mt-5 text-lg font-semibold">测试调用</h3><p className="mt-1 text-xs leading-5 text-slate-400">{api.usageUnits === 0 ? '使用默认 API Key 请求真实上游，不会检查或消耗计划配额。' : `使用默认 API Key 请求真实上游；仅 HTTP 200 时消耗 ${api.usageUnits} 次配额，错误响应不计费。`}</p><div className="mt-5 space-y-3">{api.parameters.length === 0 ? <p className="rounded-xl bg-white/[0.06] px-4 py-4 text-xs text-slate-400">此 API 无需输入参数</p> : api.parameters.map((parameter) => <label key={parameterKey(parameter)} className="block"><span className="mb-1.5 flex items-center justify-between text-[11px] text-slate-300"><span>{parameter.name}{parameter.required && <span className="ml-1 text-rose-300">*</span>}</span><span className="font-mono text-[9px] text-slate-500">{parameter.location} · {parameter.dataType}</span></span>{parameter.dataType === 'json' ? <textarea rows={4} value={values[parameterKey(parameter)] || ''} onChange={(event) => setValues({ ...values, [parameterKey(parameter)]: event.target.value })} className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2.5 font-mono text-xs text-white outline-none focus:border-[#7893ee]" placeholder={parameter.description || '{ "key": "value" }'}/> : <input value={values[parameterKey(parameter)] || ''} onChange={(event) => setValues({ ...values, [parameterKey(parameter)]: event.target.value })} className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.07] px-3 text-xs text-white outline-none focus:border-[#7893ee]" placeholder={parameter.dataType === 'boolean' ? 'true 或 false' : parameter.description}/>}</label>)}</div>{error && <p className="mt-4 rounded-xl bg-rose-400/10 px-3 py-2.5 text-xs text-rose-200">{error}</p>}<button onClick={() => void run()} disabled={running} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-[#182238] transition hover:bg-slate-100 disabled:opacity-60"><FlaskConical size={15}/>{running ? '请求中…' : api.usageUnits === 0 ? '使用默认 Key 免费测试' : `使用默认 Key 测试 · 成功扣 ${api.usageUnits} 次`}</button>{result && <div className="mt-5 overflow-hidden rounded-xl bg-black/20"><div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-3 py-2 text-[10px]"><span className={result.status >= 200 && result.status < 300 ? 'text-emerald-300' : 'text-rose-300'}>{result.status} {result.statusText}</span><span className="flex items-center gap-1 text-slate-400"><Clock3 size={10}/>{result.durationMs}ms</span>{result.usageUnits !== null && <span className="flex items-center gap-1 text-amber-200"><Gauge size={10}/>{result.usageUnits === '0' ? result.status === 200 && api.usageUnits === 0 ? '免费' : '未计费' : `${result.usageUnits} 次`}</span>}</div><pre className="max-h-80 overflow-auto p-3 text-[11px] leading-5 text-slate-300"><code>{result.body}</code></pre></div>}</aside>
}

function parseValue(raw: string, type: ServiceParameter['dataType']) { if (type === 'number') { const value = Number(raw); if (!Number.isFinite(value)) throw new Error('数字参数格式无效'); return value } if (type === 'boolean') { if (!['true', 'false'].includes(raw)) throw new Error('布尔参数只能填写 true 或 false'); return raw === 'true' } if (type === 'json') { try { return JSON.parse(raw) } catch { throw new Error('JSON 参数格式无效') } } return raw }
function formatResponse(value: string, contentType: string | null) { let formatted = value; if (contentType?.includes('json')) { try { formatted = JSON.stringify(JSON.parse(value), null, 2) } catch {} } return formatted.length > 20000 ? `${formatted.slice(0, 20000)}\n…响应已截断` : formatted }
function parameterKey(parameter: ServiceParameter) { return `${parameter.location}:${parameter.name}` }
function locationLabel(value: ServiceParameter['location']) { return ({ query: 'Query', header: 'Header', path: 'Path', body: 'JSON Body' })[value] }
function Method({ value }: { value: string }) { return <span className={`w-fit rounded-md px-2 py-1 font-mono text-[10px] font-semibold ${value === 'GET' ? 'bg-emerald-50 text-emerald-700' : 'bg-[#edf2ff] text-[#3157d5]'}`}>{value}</span> }
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <div className="rounded-[18px] bg-white p-5"><span className="grid size-9 place-items-center rounded-xl bg-[#edf2ff] text-[#3157d5]">{icon}</span><p className="mt-4 font-mono text-xl font-semibold">{value}</p><p className="mt-1 text-[10px] text-slate-400">{label}</p></div> }
function Message({ title, detail, action }: { title: string; detail: string; action: React.ReactNode }) { return <div className="mx-auto max-w-2xl rounded-[22px] bg-white p-10 text-center"><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm text-slate-400">{detail}</p><div className="mt-5">{action}</div></div> }
function CatalogSkeleton() { return <div className="grid animate-pulse gap-5 lg:grid-cols-2"><div className="h-56 rounded-[24px] bg-white"/><div className="h-56 rounded-[24px] bg-white"/><div className="h-44 rounded-[20px] bg-white"/><div className="h-44 rounded-[20px] bg-white"/></div> }
