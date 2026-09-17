'use client'

import { useCallback, useEffect, useState } from 'react'
import { CircleAlert, Clock3, DatabaseZap, RefreshCw, RotateCcw } from 'lucide-react'
import type { CommerceDeadLetter, CommerceOperationsData } from './types'
import { requestJson } from '@/lib/http-client'
import { useWorkspaceRefresh } from './workspace-data'

export function Operations() {
  const [data, setData] = useState<CommerceOperationsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [replaying, setReplaying] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await requestJson<CommerceOperationsData>('/api/admin/operations', { cache: 'no-store' }))
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '读取运行状态失败')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])
  useWorkspaceRefresh(load)

  const replay = async (item: CommerceDeadLetter) => {
    if (!window.confirm(`确认重放消息 ${item.messageId}？任务仍须依赖业务幂等保证安全。`)) return
    setReplaying(item.id); setError('')
    try {
      await requestJson(`/api/admin/operations/${encodeURIComponent(item.id)}/replay`, { method: 'POST' })
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '死信重放失败')
    } finally {
      setReplaying('')
    }
  }

  const summary = data?.summary
  return <section>
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-medium tracking-wide text-[#3157d5]">异步任务与人工恢复</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">运行中心</h2><p className="mt-2 text-sm text-slate-500">集中查看死信、失败事件和外部调用结果未知的订单。</p></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-medium text-slate-600 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>刷新</button></div>
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><Summary label="待处理死信" value={summary?.pendingDeadLetters ?? 0}/><Summary label="私信结果未知" value={summary?.unknownDeliveries ?? 0}/><Summary label="Outbox 失败" value={summary?.failedOutbox ?? 0}/><Summary label="Webhook 失败" value={summary?.failedProviderEvents ?? 0}/></div>
    {error && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</p>}
    <article className="overflow-hidden rounded-[20px] bg-white shadow-[0_18px_55px_rgba(39,55,92,.05)]"><header className="flex items-center gap-3 border-b border-slate-100 px-5 py-4"><span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-700"><DatabaseZap size={17}/></span><div><h3 className="text-sm font-semibold">持久化死信</h3><p className="mt-0.5 text-[11px] text-slate-400">只有通过消息结构校验的记录可以重放。</p></div></header>
      {loading && !data ? <div className="h-48 animate-pulse bg-slate-50"/> : !data?.deadLetters.length ? <div className="px-6 py-14 text-center text-sm text-slate-400">没有死信记录</div> : <div className="divide-y divide-slate-100">{data.deadLetters.map((item) => <div key={item.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><code className="truncate text-xs text-slate-700">{item.messageId}</code><Status item={item}/></div><p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400"><span>{item.queueName}</span><span className="inline-flex items-center gap-1"><Clock3 size={11}/>{formatDate(item.failedAt)}</span><span>投递 {item.deliveryAttempts} 次</span></p>{item.lastError && <p className="mt-2 flex items-start gap-1.5 text-[11px] text-rose-600"><CircleAlert size={12} className="mt-0.5 shrink-0"/>{item.lastError}</p>}</div><button type="button" disabled={!item.replayable || item.status !== 'pending' || Boolean(replaying)} onClick={() => void replay(item)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#182238] px-3 text-xs font-medium text-white disabled:bg-slate-100 disabled:text-slate-400"><RotateCcw size={13}/>{replaying === item.id ? '重放中…' : item.replayable ? item.status === 'pending' ? '重放' : '已重放' : '不可重放'}</button></div>)}</div>}
    </article>
  </section>
}

function Summary({ label, value }: { label: string; value: number }) { const alert = value > 0; return <div className="rounded-xl bg-white px-4 py-3"><p className="text-[10px] text-slate-400">{label}</p><p className={`mt-2 font-mono text-lg font-semibold tabular-nums ${alert ? 'text-amber-700' : 'text-slate-700'}`}>{value}</p></div> }
function Status({ item }: { item: CommerceDeadLetter }) { const styles = item.status === 'pending' ? 'bg-amber-50 text-amber-700' : item.status === 'replaying' ? 'bg-blue-50 text-blue-700' : item.status === 'replayed' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'; const label = item.status === 'pending' ? '待处理' : item.status === 'replaying' ? '重放中' : item.status === 'replayed' ? '已重放' : '已忽略'; return <span className={`rounded-md px-2 py-1 text-[10px] font-medium ${styles}`}>{label}</span> }
function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
