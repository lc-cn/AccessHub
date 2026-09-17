'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CircleUserRound, CreditCard, History, RefreshCw, Search, Webhook } from 'lucide-react'
import type { ActivityLog, AdminData, AdminUser, Payment, ProviderEvent, Subscription } from './types'
import { requestJson } from '@/lib/http-client'
import { useWorkspaceRefresh } from './workspace-data'

type Resource = 'subscriptions' | 'payments' | 'users' | 'logs' | 'afdian-events'
const meta = {
  subscriptions: { title: '订阅', description: '维护独立于支付服务的订阅生命周期。', icon: RefreshCw },
  payments: { title: '支付', description: '查看所有 PSP 返回的资金交易结果。', icon: CreditCard },
  users: { title: '用户', description: '查看账户身份以及系统角色。', icon: CircleUserRound },
  logs: { title: '活动日志', description: '追踪管理员操作、兑换和履约事件。', icon: History },
  'afdian-events': { title: '爱发电事件', description: '查看爱发电 Webhook 的接收与处理结果。', icon: Webhook },
} satisfies Record<Resource, { title: string; description: string; icon: typeof Search }>

export function CommerceResources({ resource }: { resource: Resource }) {
  const [data, setData] = useState<AdminData | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const load = useCallback(async () => { setLoading(true); try { setData(await requestJson<AdminData>(`/api/admin/${resource}`, { cache: 'no-store' })); setError('') } catch (reason) { setError(reason instanceof Error ? reason.message : '读取失败') } finally { setLoading(false) } }, [resource])
  useEffect(() => { void load() }, [load])
  useWorkspaceRefresh(load)
  const config = meta[resource]
  const Icon = config.icon
  const rows = useMemo(() => {
    const source = resource === 'subscriptions' ? data?.subscriptions : resource === 'payments' ? data?.payments : resource === 'users' ? data?.users : resource === 'logs' ? data?.logs : data?.providerEvents
    return (source ?? []).filter((row) => !query || JSON.stringify(row).toLowerCase().includes(query.toLowerCase()))
  }, [data, query, resource])
  const transition = async (subscriptionId: string, status: Subscription['status']) => {
    setUpdatingId(subscriptionId)
    try {
      await requestJson(`/api/admin/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) })
      await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : '订阅状态更新失败') }
    finally { setUpdatingId(null) }
  }
  const total = resource === 'subscriptions' ? data?.subscriptions.length : resource === 'payments' ? data?.payments.length : resource === 'users' ? data?.users.length : resource === 'logs' ? data?.logs.length : data?.providerEvents.length
  return <section><div className="mb-5 flex items-start justify-between gap-4"><div><span className="grid size-10 place-items-center rounded-xl bg-[#edf2ff] text-[#3157d5]"><Icon size={18}/></span><h2 className="mt-5 text-2xl font-semibold">{config.title}</h2><p className="mt-2 text-sm text-slate-500">{config.description}</p></div><span className="rounded-xl bg-white px-3 py-2 text-xs text-slate-400"><strong className="mr-1 font-mono text-sm text-slate-700">{total ?? '—'}</strong>条记录</span></div><label className="mb-4 flex h-11 items-center gap-2 rounded-xl bg-white px-3 text-slate-400 focus-within:ring-2 focus-within:ring-blue-100"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder={`搜索${config.title}`}/>{query && <button type="button" onClick={() => setQuery('')} className="text-xs text-slate-400 hover:text-slate-600">清除</button>}</label>{error && <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}{loading ? <div className="h-48 animate-pulse rounded-[20px] bg-white"/> : rows.length === 0 ? <div className="rounded-[20px] bg-white p-12 text-center"><p className="text-sm text-slate-400">{query ? `没有匹配“${query}”的记录` : '暂无记录'}</p>{query && <button onClick={() => setQuery('')} className="mt-3 text-xs font-medium text-[#3157d5]">清除搜索条件</button>}</div> : <div className="space-y-2">{rows.map((row) => <ResourceRow key={row.id} resource={resource} row={row} updating={updatingId === row.id} onTransition={transition}/>)}</div>}</section>
}

function ResourceRow({ resource, row, updating, onTransition }: { resource: Resource; row: Subscription | Payment | AdminUser | ActivityLog | ProviderEvent; updating: boolean; onTransition: (id: string, status: Subscription['status']) => Promise<void> }) {
  if (resource === 'subscriptions') { const item = row as Subscription; return <SubscriptionRow item={item} updating={updating} onTransition={onTransition}/> }
  if (resource === 'payments') { const item = row as Payment; return <Card title={`${item.currency} ${item.amount || '0'}`} code={item.externalPaymentId || item.id} badge={<Status value={item.status}/>} detail={`订单 ${item.orderId}`} time={formatDate(item.paidAt || item.createdAt)}/> }
  if (resource === 'users') { const item = row as AdminUser; return <Card title={item.name || '未命名用户'} code={item.email} badge={<Status value={item.role}/>} detail={item.id} time={`注册于 ${formatDate(item.createdAt)}`}/> }
  if (resource === 'logs') { const item = row as ActivityLog; return <Card title={item.action} code={item.resourceId || item.id} badge={<Status value={item.resourceType}/>} detail={item.detail || '无补充信息'} time={formatDate(item.createdAt)}/> }
  const item = row as ProviderEvent
  return <Card title={item.type} code={item.externalEventId} badge={<Status value={item.status}/>} detail={item.error || `Provider: ${item.providerId}`} time={formatDate(item.processedAt || item.createdAt)}/>
}
const nextStatuses: Record<Subscription['status'], Subscription['status'][]> = {
  pending_activation: ['canceled', 'expired'], trialing: ['active', 'past_due', 'paused', 'canceled', 'expired'], active: ['past_due', 'paused', 'canceled', 'expired'], past_due: ['active', 'paused', 'canceled', 'expired'], paused: ['active', 'canceled', 'expired'], canceled: [], expired: [],
}
function SubscriptionRow({ item, updating, onTransition }: { item: Subscription; updating: boolean; onTransition: (id: string, status: Subscription['status']) => Promise<void> }) {
  const [next, setNext] = useState<Subscription['status'] | ''>('')
  const options = nextStatuses[item.status]
  return <article className="rounded-[16px] bg-white px-5 py-4"><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><div className="flex items-center gap-2"><h3 className="truncate text-sm font-medium">{item.userName || item.userId || '等待用户激活'}</h3><Status value={item.status}/></div><code className="mt-1 block truncate text-[10px] text-slate-400">{item.id}</code><p className="mt-2 truncate text-xs text-slate-500">{item.planName}{item.skuCode ? ` · ${item.skuCode}` : ''}</p></div><time className="text-[11px] text-slate-400">{item.currentPeriodEnd ? `当前周期至 ${formatDate(item.currentPeriodEnd)}` : '尚未开始计费周期'}</time></div>{options.length > 0 && <div className="mt-4 border-t border-slate-100 pt-3"><div className="flex flex-col justify-end gap-2 sm:flex-row"><select aria-label="新的订阅状态" value={next} onChange={(event) => setNext(event.target.value as Subscription['status'] | '')} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none"><option value="">选择状态操作</option>{options.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select><button disabled={!next || updating} onClick={() => next && void onTransition(item.id, next).then(() => setNext(''))} className="h-9 rounded-lg bg-[#182238] px-3 text-xs text-white disabled:opacity-40">{updating ? '处理中…' : next ? `变更为${statusLabel(next)}` : '确认变更'}</button></div>{next && <p className="mt-2 text-right text-[10px] text-amber-600">此操作会立即改变订阅状态，请确认状态机流转符合预期。</p>}</div>}</article>
}
function Card({ title, code, badge, detail, time }: { title: string; code: string; badge: React.ReactNode; detail: string; time: string }) { return <article className="grid gap-3 rounded-[16px] bg-white px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><div className="flex items-center gap-2"><h3 className="truncate text-sm font-medium">{title}</h3>{badge}</div><code className="mt-1 block truncate text-[10px] text-slate-400">{code}</code><p className="mt-2 truncate text-xs text-slate-500">{detail}</p></div><time className="text-[11px] text-slate-400">{time}</time></article> }
function Status({ value }: { value: string }) { const good = ['active', 'succeeded', 'processed', 'ignored', 'admin'].includes(value); const bad = ['failed', 'past_due', 'canceled', 'expired'].includes(value); return <span className={`rounded-md px-2 py-0.5 text-[10px] ${good ? 'bg-emerald-50 text-emerald-700' : bad ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'}`}>{statusLabel(value)}</span> }
function statusLabel(value: string) { return ({ pending_activation: '待激活', trialing: '试用中', active: '生效中', past_due: '逾期', paused: '已暂停', canceled: '已取消', expired: '已过期', succeeded: '成功', processed: '已处理', ignored: '已忽略', failed: '失败', admin: '管理员', user: '普通用户' } as Record<string, string>)[value] || value }
function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
