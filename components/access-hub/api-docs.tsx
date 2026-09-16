'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowUpRight, Braces, Coins, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react'
import type { ServiceParameter } from './types'
import { useWorkspaceRefresh } from './workspace-data'
import { requestJson } from '@/lib/http-client'

type CatalogService = { code: string; name: string; description: string; apis: Array<{ code: string; name: string; description: string; method: string; path: string; parameters: ServiceParameter[]; usageUnits: number }> }

export function ApiDocs() {
  const [services, setServices] = useState<CatalogService[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => { setLoading(true); try { const data = await requestJson<{ services: CatalogService[] }>('/api/services', { cache: 'no-store' }); setServices(data.services); setError('') } catch (reason) { setError(reason instanceof Error ? reason.message : 'API 目录读取失败') } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])
  useWorkspaceRefresh(load)
  const first = services[0]?.apis[0]
  const example = first ? [`const response = await fetch(`, `  '${first.path}',`, `  {`, `    method: '${first.method}',`, `    headers: { 'content-type': 'application/json' },`, `    body: JSON.stringify({ /* 请求参数 */ })`, `  }`, `)`, ``, `console.log(response.headers.get(`, `  'x-accesshub-usage-units'`, `))`, `const result = await response.json()`].join('\n') : '// 管理员发布服务 API 后，\n// 这里会显示可直接使用的调用示例。'

  return <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_380px]">
    <section><p className="text-xs font-medium tracking-wide text-[#3157d5]">API CATALOG</p><h2 className="mt-1 text-3xl font-semibold tracking-[-.03em]">调用 AccessHub 服务</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">使用当前登录会话调用统一网关。每个端点会按配置预留对应次数的配额，并由服务端安全注入上游鉴权信息。</p>
      {error && <button onClick={() => void load()} className="mt-5 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">{error} · 点击重试</button>}
      {loading ? <div className="mt-8 h-60 animate-pulse rounded-[20px] bg-white"/> : services.length === 0 ? <div className="mt-8 rounded-[20px] bg-white p-12 text-center"><Braces className="mx-auto text-slate-300"/><p className="mt-4 text-sm text-slate-400">管理员还没有发布可调用的 API</p></div> : <div className="mt-8 space-y-7">{services.map((service) => <section key={service.code}><div className="mb-3"><div className="flex items-center gap-2"><h3 className="text-lg font-semibold">{service.name}</h3><code className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{service.code}</code></div><p className="mt-1 text-xs text-slate-400">{service.description || `${service.apis.length} 个可调用端点`}</p></div><div className="space-y-3">{service.apis.map((api) => <article key={api.code} className="rounded-[18px] bg-white p-5"><div className="flex items-start gap-4"><span className={`mt-0.5 rounded-md px-2 py-1 font-mono text-[10px] font-semibold ${api.method === 'GET' ? 'bg-emerald-50 text-emerald-700' : 'bg-[#edf2ff] text-[#3157d5]'}`}>{api.method}</span><div className="min-w-0 flex-1"><code className="break-all text-sm font-semibold text-slate-700">{api.path}</code><div className="mt-3 flex items-center gap-2"><h4 className="text-sm font-medium">{api.name}</h4><span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700"><Coins size={10}/>{api.usageUnits} 次</span></div><p className="mt-1 text-xs leading-5 text-slate-400">{api.description || '暂无说明'}</p>{api.parameters.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{api.parameters.map((parameter) => <span key={`${parameter.location}:${parameter.name}`} title={parameter.description} className="rounded-md bg-slate-50 px-2 py-1 font-mono text-[10px] text-slate-500">{parameter.location}.{parameter.name}{parameter.required ? ' *' : ''}</span>)}</div>}</div><ArrowUpRight size={15} className="text-slate-300"/></div></article>)}</div></section>)}</div>}
    </section>
    <aside className="space-y-4 xl:sticky xl:top-28 xl:self-start"><article className="rounded-[22px] bg-[#182238] p-6 text-white"><Braces size={20} className="text-[#91a7f3]"/><h3 className="mt-5 font-semibold">请求示例</h3><pre className="mt-4 overflow-x-auto rounded-xl bg-black/15 p-4 text-xs leading-6 text-slate-300"><code>{example}</code></pre></article><article className="rounded-[20px] bg-white p-5"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><ShieldCheck size={17}/></span><div><h3 className="text-sm font-medium">会话鉴权</h3><p className="mt-0.5 text-xs text-slate-400">浏览器 Cookie 由 Better Auth 管理</p></div></div></article><article className="rounded-[20px] bg-white p-5"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#edf2ff] text-[#3157d5]"><KeyRound size={17}/></span><div><h3 className="text-sm font-medium">上游密钥隔离</h3><p className="mt-0.5 text-xs text-slate-400">真实鉴权信息只在服务端解密注入</p></div></div></article><button onClick={() => void load()} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-xs text-slate-500"><RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>刷新 API 目录</button></aside>
  </div>
}
