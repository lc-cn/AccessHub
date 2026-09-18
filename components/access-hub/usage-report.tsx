'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, BarChart3, CheckCircle2, Clock3, Coins, RefreshCw, ServerCog, UsersRound, XCircle } from 'lucide-react'
import type { GatewayUsageApi, GatewayUsageReport, GatewayUsageService } from './types'
import { requestJson } from '@/lib/http-client'
import { useWorkspaceRefresh } from './workspace-data'

const ranges = [7, 30, 90] as const

export function UsageReport() {
  const [days, setDays] = useState<(typeof ranges)[number]>(30)
  const [data, setData] = useState<GatewayUsageReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await requestJson<GatewayUsageReport>(`/api/admin/usage?days=${days}`, { cache: 'no-store' }))
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '用量报表读取失败')
    } finally {
      setLoading(false)
    }
  }, [days])
  useEffect(() => { void load() }, [load])
  useWorkspaceRefresh(load)

  const summary = data?.summary
  const successRate = summary?.requests ? summary.successes / summary.requests * 100 : 0
  return <section>
    <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-medium tracking-wide text-[#3157d5]">API TRAFFIC</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">用量统计</h2><p className="mt-2 text-sm text-slate-500">查看真实网关调用、成功率、计费量以及用户和端点分布。</p></div>
      <div className="flex items-center gap-2"><div className="flex rounded-xl bg-white p-1">{ranges.map((range) => <button key={range} type="button" onClick={() => setDays(range)} className={`rounded-lg px-3 py-2 text-xs font-medium transition ${days === range ? 'bg-[#182238] text-white' : 'text-slate-400 hover:text-slate-700'}`}>{range} 天</button>)}</div><button type="button" onClick={() => void load()} disabled={loading} className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 disabled:opacity-50" aria-label="刷新用量报表"><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/></button></div>
    </header>
    {error && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</p>}
    {loading && !data ? <ReportSkeleton/> : <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><Metric icon={Activity} label="总请求" value={formatNumber(summary?.requests)} detail={`${summary?.activeUsers ?? 0} 位活跃用户`}/><Metric icon={CheckCircle2} label="成功率" value={`${successRate.toFixed(1)}%`} detail={`${summary?.successes ?? 0} 次 2xx`}/><Metric icon={Coins} label="实际计费" value={formatNumber(summary?.chargedUnits)} detail="仅按成功计费规则结算"/><Metric icon={Clock3} label="P95 延迟" value={`${formatNumber(summary?.p95DurationMs)} ms`} detail={`平均 ${formatNumber(summary?.averageDurationMs)} ms`}/></div>
      {!summary?.requests ? <EmptyReport/> : <>
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,.6fr)]"><DailyTraffic data={data?.daily ?? []} days={days}/><Health summary={summary!}/></div>
        <div className="mt-5 grid gap-5 xl:grid-cols-2"><Ranking title="服务调用排行" description="按所选周期内的请求量排序" items={data?.services ?? []}/><Ranking title="API 端点排行" description="识别最常用和最慢的接口" items={data?.apis ?? []}/></div>
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]"><ActiveUsers data={data!}/><RecentCalls data={data!}/></div>
      </>}
    </>}
  </section>
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: string; detail: string }) { return <article className="rounded-[18px] bg-white p-5 shadow-[0_14px_38px_rgba(39,55,92,.04)]"><div className="flex items-center justify-between"><span className="grid size-9 place-items-center rounded-xl bg-[#edf2ff] text-[#3157d5]"><Icon size={16}/></span><span className="text-[10px] text-slate-300">{label}</span></div><p className="mt-5 font-mono text-2xl font-semibold tabular-nums text-slate-800">{value}</p><p className="mt-1 text-[11px] text-slate-400">{detail}</p></article> }

function DailyTraffic({ data, days }: { data: GatewayUsageReport['daily']; days: number }) {
  const byDate = useMemo(() => new Map(data.map((item) => [item.date, item])), [data])
  const dates = useMemo(() => {
    const end = new Date(); end.setUTCHours(0, 0, 0, 0); const start = new Date(end.getTime() - (days - 1) * 86_400_000); const result: string[] = []
    for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + 86_400_000)) result.push(cursor.toISOString().slice(0, 10))
    return result
  }, [days])
  const max = Math.max(1, ...data.map((item) => item.requests))
  return <article className="rounded-[20px] bg-white p-6"><SectionTitle icon={BarChart3} title="每日请求趋势" description="蓝色为总请求，绿色为成功请求；日期按 UTC 聚合。"/><div className="mt-7 flex h-52 items-end gap-1.5 overflow-hidden">{dates.map((date) => { const item = byDate.get(date); const requests = item?.requests ?? 0; const successes = item?.successes ?? 0; return <div key={date} className="group flex h-full min-w-0 flex-1 items-end justify-center gap-px" title={`${date} · ${requests} 请求 · ${successes} 成功`}><span className="w-1/2 min-w-[2px] rounded-t bg-[#b7c7fb] transition group-hover:bg-[#7893ee]" style={{ height: `${Math.max(requests ? 5 : 0, requests / max * 100)}%` }}/><span className="w-1/2 min-w-[2px] rounded-t bg-emerald-300 transition group-hover:bg-emerald-500" style={{ height: `${Math.max(successes ? 5 : 0, successes / max * 100)}%` }}/></div>})}</div><div className="mt-3 flex justify-between text-[10px] text-slate-300"><span>{dates[0]?.slice(5)}</span><span>{dates.at(-1)?.slice(5)}</span></div></article>
}

function Health({ summary }: { summary: GatewayUsageReport['summary'] }) { const rows = [{ label: '成功', value: summary.successes, color: 'bg-emerald-400' }, { label: '请求被拒绝', value: summary.rejected, color: 'bg-amber-400' }, { label: '上游或网关错误', value: summary.upstreamErrors, color: 'bg-rose-400' }]; return <article className="rounded-[20px] bg-[#182238] p-6 text-white"><SectionTitle icon={Activity} title="请求健康度" description="区分正常响应、权限/配额拒绝与服务错误。" dark/><div className="mt-7 space-y-5">{rows.map((row) => { const ratio = summary.requests ? row.value / summary.requests * 100 : 0; return <div key={row.label}><div className="flex justify-between text-xs"><span className="text-slate-300">{row.label}</span><span className="font-mono tabular-nums">{row.value} · {ratio.toFixed(1)}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${row.color}`} style={{ width: `${ratio}%` }}/></div></div>})}</div></article> }

function Ranking({ title, description, items }: { title: string; description: string; items: Array<GatewayUsageService | GatewayUsageApi> }) { const max = Math.max(1, ...items.map((item) => item.requests)); return <article className="rounded-[20px] bg-white p-6"><SectionTitle icon={ServerCog} title={title} description={description}/><div className="mt-5 space-y-4">{items.length ? items.map((item) => { const api = 'apiCode' in item; const label = api ? `${item.serviceCode} / ${item.apiCode}` : item.serviceName; const rate = item.requests ? item.successes / item.requests * 100 : 0; return <div key={api ? item.apiId : item.serviceId}><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-medium text-slate-700">{label}</p><p className="mt-1 text-[10px] text-slate-400">{rate.toFixed(1)}% 成功 · 平均 {item.averageDurationMs} ms · {item.chargedUnits} 单位</p></div><strong className="font-mono text-sm tabular-nums text-slate-700">{item.requests}</strong></div><div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#7893ee]" style={{ width: `${item.requests / max * 100}%` }}/></div></div>}) : <p className="py-10 text-center text-xs text-slate-400">暂无排行数据</p>}</div></article> }

function ActiveUsers({ data }: { data: GatewayUsageReport }) { return <article className="overflow-hidden rounded-[20px] bg-white"><div className="p-6 pb-4"><SectionTitle icon={UsersRound} title="活跃用户" description="谁在调用，以及实际消耗了多少。"/></div><div className="divide-y divide-slate-100">{data.users.length ? data.users.map((item) => <div key={item.userId} className="flex items-center gap-3 px-6 py-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-xs font-semibold text-slate-500">{item.userName?.slice(0, 1) || '?'}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-slate-700">{item.userName}</p><p className="mt-1 truncate text-[10px] text-slate-400">{item.userEmail}</p></div><div className="text-right"><p className="font-mono text-sm font-semibold tabular-nums">{item.requests}</p><p className="mt-1 text-[10px] text-slate-400">{item.chargedUnits} 单位</p></div></div>) : <p className="px-6 py-12 text-center text-xs text-slate-400">暂无活跃用户</p>}</div></article> }

function RecentCalls({ data }: { data: GatewayUsageReport }) { return <article className="overflow-hidden rounded-[20px] bg-white"><div className="p-6 pb-4"><SectionTitle icon={Clock3} title="最近调用" description="仅记录元数据，不保存参数、正文或密钥。"/></div><div className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto">{data.recent.map((item) => <div key={item.id} className="grid gap-3 px-6 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><div className="flex items-center gap-2"><Outcome value={item.outcome}/><code className="truncate text-[11px] text-slate-700">{item.method} {item.serviceCode}/{item.apiCode}</code></div><p className="mt-1.5 truncate text-[10px] text-slate-400">{item.userName} · {formatDate(item.createdAt)}{item.errorCode ? ` · ${item.errorCode}` : ''}</p></div><div className="flex items-center gap-3 text-[10px] text-slate-400"><span className="font-mono">HTTP {item.responseStatus}</span><span>{item.durationMs} ms</span><span className="text-amber-700">{item.chargedUsageUnits}/{item.configuredUsageUnits} 单位</span></div></div>)}</div></article> }

function Outcome({ value }: { value: 'success' | 'rejected' | 'upstream_error' }) { const ok = value === 'success'; return <span className={`grid size-6 shrink-0 place-items-center rounded-lg ${ok ? 'bg-emerald-50 text-emerald-600' : value === 'rejected' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>{ok ? <CheckCircle2 size={12}/> : <XCircle size={12}/>}</span> }
function SectionTitle({ icon: Icon, title, description, dark = false }: { icon: typeof Activity; title: string; description: string; dark?: boolean }) { return <div className="flex items-start gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${dark ? 'bg-white/10 text-[#9fb0ee]' : 'bg-[#edf2ff] text-[#3157d5]'}`}><Icon size={16}/></span><div><h3 className={`text-sm font-semibold ${dark ? 'text-white' : 'text-slate-800'}`}>{title}</h3><p className={`mt-1 text-[11px] leading-5 ${dark ? 'text-slate-400' : 'text-slate-400'}`}>{description}</p></div></div> }
function EmptyReport() { return <div className="mt-5 rounded-[22px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><BarChart3 size={24} className="mx-auto text-slate-300"/><h3 className="mt-4 text-sm font-medium text-slate-600">还没有 API 调用记录</h3><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-400">报表从本次网关观测迁移上线后开始累计。用户通过服务中心测试或使用 API Key 调用后，这里会出现趋势和明细。</p></div> }
function ReportSkeleton() { return <div className="animate-pulse space-y-5"><div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-36 rounded-[18px] bg-white"/>)}</div><div className="h-72 rounded-[20px] bg-white"/></div> }
function formatNumber(value?: number) { return new Intl.NumberFormat('zh-CN').format(value ?? 0) }
function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value)) }
