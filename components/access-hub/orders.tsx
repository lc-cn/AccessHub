'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, CircleAlert, Clock3, Copy, MailCheck, MessageSquareText, PackageCheck, ReceiptText, Search, TicketCheck, Webhook, Workflow } from 'lucide-react'
import type { AdminData, Order } from './types'
import { requestJson } from '@/lib/http-client'
import { useWorkspaceRefresh } from './workspace-data'

type LifecycleState = 'complete' | 'processing' | 'failed' | 'unknown' | 'waiting' | 'unavailable'
type LifecycleStep = { label: string; detail: string; time?: string | null; state: LifecycleState; icon: React.ReactNode }

export function Orders({ mode, orderId, provider = 'all' }: { mode: 'list' | 'detail'; orderId?: string; provider?: 'all' | 'afdian' }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await requestJson<AdminData>(`/api/admin?section=${provider === 'afdian' ? 'afdian-orders' : 'orders'}`, { cache: 'no-store' })
      setOrders(data.orders ?? [])
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '订单读取失败')
    } finally {
      setLoading(false)
    }
  }, [provider])
  useEffect(() => { void load() }, [load])
  useWorkspaceRefresh(load)

  const selected = useMemo(() => orders.find((order) => order.id === orderId) ?? null, [orderId, orders])
  const normalizedQuery = query.trim().toLowerCase()
  const visible = orders.filter((order) => !normalizedQuery || `${order.externalOrderId} ${order.externalOfferTitle} ${order.externalOfferId} ${order.codes.map((code) => code.code).join(' ')}`.toLowerCase().includes(normalizedQuery))
  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(value)
    setTimeout(() => setCopied(''), 1400)
  }
  const basePath = provider === 'afdian' ? '/admin/afdian/orders' : '/admin/orders'
  const title = provider === 'afdian' ? '爱发电订单' : '全部订单'

  if (mode === 'detail') {
    if (loading) return <DetailSkeleton/>
    if (!selected) return <Empty text={error || '订单不存在或已被删除'} basePath={basePath}/>
    const lifecycle = lifecycleOf(selected)
    const redeemed = selected.codes.filter((code) => code.redeemedAt).length
    return <section className="mx-auto max-w-3xl">
      <Link href={basePath} className="mb-5 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-[#3157d5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"><ArrowLeft size={15}/>返回订单列表</Link>
      <article className="overflow-hidden rounded-[24px] bg-white shadow-[0_18px_55px_rgba(39,55,92,.06)]">
        <header className="flex flex-col gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8">
          <div className="min-w-0"><p className="text-xs text-slate-400">{title}</p><h2 className="mt-1 truncate text-xl font-semibold tracking-tight">{selected.externalOfferTitle || selected.skuName || '未命名商品'}</h2><code className="mt-2 block break-all text-xs tabular-nums text-slate-400">{selected.externalOrderId || selected.id}</code></div>
          <LifecycleBadge state={lifecycle}/>
        </header>
        <dl className="grid grid-cols-2 gap-5 border-b border-slate-100 px-6 py-5 text-sm sm:grid-cols-4 sm:px-8"><Info label="购买周期" value={`${selected.termMonths} 个月`}/><Info label="支付金额" value={selected.amount ? `${selected.currency} ${selected.amount}` : '—'}/><Info label="本地 SKU" value={selected.skuCode || '—'}/><Info label="下单时间" value={formatDate(selected.createdAt)}/></dl>

        <section className="border-b border-slate-100 px-6 py-7 sm:px-8" aria-labelledby="fulfillment-timeline-title">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-medium text-[#3157d5]">异步履约</p><h3 id="fulfillment-timeline-title" className="mt-1 font-semibold">订单处理时间线</h3></div>{selected.providerEvent?.workflowInstanceId && <code className="max-w-full truncate text-[10px] tabular-nums text-slate-400" title={selected.providerEvent.workflowInstanceId}>Workflow {selected.providerEvent.workflowInstanceId}</code>}</div>
          <FulfillmentTimeline order={selected}/>
          <LifecycleNotice order={selected} lifecycle={lifecycle}/>
        </section>

        <section className="px-6 py-7 sm:px-8" aria-labelledby="order-codes-title">
          <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-medium text-[#3157d5]">权益交付</p><h3 id="order-codes-title" className="mt-1 font-semibold">兑换码与核销</h3></div><span className="text-xs tabular-nums text-slate-400">{redeemed} / {selected.codes.length} 已核销</span></div>
          {selected.codes.length ? <div className="mt-4 space-y-2">{selected.codes.map((code) => <div key={code.id} className="flex flex-col gap-3 rounded-xl bg-[#f5f7fb] px-4 py-3 sm:flex-row sm:items-center"><button onClick={() => void copy(code.code)} aria-label={`复制兑换码 ${code.code}`} className="flex min-w-0 flex-1 items-center gap-2 rounded text-left font-mono text-xs tabular-nums text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"><span className="truncate">{code.code}</span><Copy size={12} className={copied === code.code ? 'text-emerald-500' : 'text-slate-300'}/></button><span className="text-xs text-slate-500">{code.planName || `${code.credits?.toLocaleString()} credits`}</span><span className={`w-fit rounded-md px-2 py-1 text-[10px] ${code.redeemedAt ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{code.redeemedAt ? `已核销 · ${formatDate(code.redeemedAt)}` : '等待核销'}</span></div>)}</div> : <div className="mt-4 rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-400">尚未生成兑换码。可在上方时间线查看当前处理阶段。</div>}
        </section>
      </article>
    </section>
  }

  const successful = orders.filter((order) => lifecycleOf(order) === 'complete').length
  const processing = orders.filter((order) => lifecycleOf(order) === 'processing').length
  const attention = orders.filter((order) => ['failed', 'unknown'].includes(lifecycleOf(order))).length
  return <section>
    <div className="mb-5"><p className="text-xs font-medium tracking-wide text-[#3157d5]">订单与履约</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2><p className="mt-2 text-sm text-slate-500">追踪 Webhook、队列、Workflow、兑换码交付与最终核销。</p></div>
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Summary icon={<ReceiptText size={15}/>} label="订单" value={orders.length}/><Summary icon={<MailCheck size={15}/>} label="履约完成" value={successful}/><Summary icon={<Clock3 size={15}/>} label="处理中" value={processing}/><Summary icon={<CircleAlert size={15}/>} label="需关注" value={attention} alert={attention > 0}/></div>
    <label className="mb-4 flex h-11 items-center gap-2 rounded-xl bg-white px-3 text-slate-400 focus-within:ring-2 focus-within:ring-blue-100"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm text-slate-700 outline-none" placeholder="搜索订单号、商品或兑换码"/>{query && <button type="button" onClick={() => setQuery('')} className="text-xs hover:text-slate-600">清除</button>}</label>
    {error && <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-600">{error}</p>}
    {loading ? <ListSkeleton/> : visible.length === 0 ? <div className="rounded-[20px] bg-white p-12 text-center text-sm text-slate-400">{query ? `没有匹配“${query}”的订单` : '还没有订单'}</div> : <div className="space-y-3">{visible.map((order) => {
      const lifecycle = lifecycleOf(order)
      return <Link key={order.id} href={`${basePath}/${order.id}`} className="grid gap-4 rounded-[18px] bg-white p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(39,55,92,.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 sm:grid-cols-[1fr_auto]"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="min-w-0 truncate font-medium">{order.externalOfferTitle || order.skuName || '未命名商品'}</h3><LifecycleBadge state={lifecycle}/></div><code className="mt-1.5 block truncate text-[11px] tabular-nums text-slate-400">{order.externalOrderId || order.id}</code><p className="mt-3 text-xs text-slate-500">{order.skuCode || '未关联 SKU'} · {order.codes.length} 个兑换码 · {order.codes.filter((code) => code.redeemedAt).length} 个已核销</p>{lifecycle === 'failed' && <p className="mt-2 truncate text-[11px] text-rose-600">{order.providerEvent?.error || order.deliveryLastError || '异步履约失败，请查看详情'}</p>}{lifecycle === 'unknown' && <p className="mt-2 text-[11px] text-amber-700">外部调用结果未知，请先人工核对，避免重复发送。</p>}</div><div className="flex items-center gap-2 text-xs tabular-nums text-slate-400"><Clock3 size={13}/>{formatDate(order.createdAt)}</div></Link>
    })}</div>}
  </section>
}

function FulfillmentTimeline({ order }: { order: Order }) {
  const steps = timelineOf(order)
  return <ol className="mt-6 grid gap-0 sm:grid-cols-6" aria-label="订单履约进度">{steps.map((step, index) => <li key={step.label} className="relative grid grid-cols-[32px_1fr] gap-3 pb-5 last:pb-0 sm:block sm:pb-0 sm:pr-3">{index < steps.length - 1 && <span aria-hidden className="absolute bottom-0 left-[15px] top-8 w-px bg-slate-200 sm:bottom-auto sm:left-8 sm:right-0 sm:top-[15px] sm:h-px sm:w-auto"/>}<span className={`relative z-[1] grid size-8 place-items-center rounded-full ring-4 ring-white ${stepTone(step.state)}`}>{step.icon}</span><div className="min-w-0 sm:mt-3"><div className="flex flex-wrap items-center gap-1.5 sm:block"><p className="text-xs font-medium text-slate-700">{step.label}</p><StepState state={step.state}/></div><p className="mt-1 text-[10px] leading-4 text-slate-400">{step.detail}</p>{step.time && <time className="mt-1 block text-[9px] tabular-nums text-slate-400">{formatDate(step.time)}</time>}</div></li>)}</ol>
}

function LifecycleNotice({ order, lifecycle }: { order: Order; lifecycle: LifecycleState }) {
  if (lifecycle === 'failed') return <div className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700"><strong className="font-medium">处理失败</strong><span className="block text-rose-600">{order.providerEvent?.error || order.deliveryLastError || '异步任务未完成。请从事件日志核对失败原因与重试记录。'}</span>{order.providerEvent?.nextAttemptAt && <span className="mt-1 block">计划重试：{formatDate(order.providerEvent.nextAttemptAt)}</span>}</div>
  if (lifecycle === 'unknown') return <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800"><strong className="font-medium">外部结果未知</strong><span className="block text-amber-700">系统不会据此判断私信发送成功。请先核对爱发电侧记录，避免重复通知用户。</span></div>
  if (lifecycle === 'processing') return <div className="mt-5 rounded-xl bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-700"><strong className="font-medium">异步处理中</strong><span className="block text-blue-600">任务由队列与 Workflow 继续处理，页面刷新后会展示最新状态。</span></div>
  return null
}

function timelineOf(order: Order): LifecycleStep[] {
  const event = order.providerEvent
  const eventFailed = event?.status === 'failed'
  const eventIgnored = event?.status === 'ignored'
  const workflowStarted = Boolean(event?.workflowInstanceId || ['workflow_started', 'processed'].includes(event?.status ?? ''))
  const queueStarted = Boolean(event?.queuedAt || ['queued', 'processing', 'workflow_started', 'processed'].includes(event?.status ?? ''))
  const codesCreatedAt = order.codes.map((code) => code.createdAt).find(Boolean)
  const redeemed = order.codes.filter((code) => code.redeemedAt)
  return [
    { label: 'Webhook', detail: event ? eventIgnored ? '事件已接收并忽略' : '支付事件已接收' : '事件遥测尚未关联', time: event?.createdAt, state: event ? 'complete' : 'unavailable', icon: <Webhook size={14}/> },
    { label: '进入队列', detail: event?.queuedAt ? `已投递${event.attemptCount ? ` · 第 ${event.attemptCount} 次尝试` : ''}` : eventFailed && !queueStarted ? '入队前处理失败' : '等待队列遥测', time: event?.queuedAt, state: eventFailed && !queueStarted ? 'failed' : queueStarted ? 'complete' : event?.status === 'received' ? 'processing' : 'waiting', icon: <PackageCheck size={14}/> },
    { label: 'Workflow', detail: event?.workflowInstanceId ? '履约实例已启动' : eventFailed && queueStarted ? '异步处理失败' : '等待执行记录', time: workflowStarted ? event?.processingStartedAt : null, state: eventFailed && queueStarted ? 'failed' : event?.status === 'processed' ? 'complete' : workflowStarted ? 'processing' : 'waiting', icon: <Workflow size={14}/> },
    { label: '生成权益', detail: order.codes.length ? `已生成 ${order.codes.length} 个兑换码` : eventFailed ? '未完成发码' : '等待生成兑换码', time: codesCreatedAt, state: order.codes.length ? 'complete' : eventFailed ? 'failed' : 'waiting', icon: <TicketCheck size={14}/> },
    { label: '发送私信', detail: deliveryDetail(order), time: order.deliveredAt || order.deliveryAttemptedAt, state: deliveryState(order.deliveryStatus), icon: <MessageSquareText size={14}/> },
    { label: '用户核销', detail: redeemed.length === order.codes.length && order.codes.length ? '全部兑换码已核销' : redeemed.length ? `${redeemed.length} / ${order.codes.length} 已核销` : order.codes.length ? '等待用户核销' : '尚无可核销权益', time: redeemed.map((code) => code.redeemedAt).filter(Boolean).at(-1), state: redeemed.length === order.codes.length && order.codes.length ? 'complete' : redeemed.length ? 'processing' : 'waiting', icon: <CheckCircle2 size={14}/> },
  ]
}

function lifecycleOf(order: Order): LifecycleState {
  if (order.deliveryStatus === 'unknown') return 'unknown'
  if (order.providerEvent?.status === 'failed' || order.deliveryStatus === 'failed') return 'failed'
  if (order.providerEvent?.status === 'ignored' || order.deliveryStatus === 'not_requested') return order.codes.length ? 'complete' : 'unavailable'
  if (order.deliveryStatus === 'sent') return 'complete'
  if (order.deliveryStatus === 'sending' || ['received', 'queued', 'processing', 'workflow_started'].includes(order.providerEvent?.status ?? '')) return 'processing'
  if (order.codes.length || order.deliveryStatus === 'pending') return 'processing'
  return 'waiting'
}

function deliveryState(status: Order['deliveryStatus']): LifecycleState {
  if (status === 'sent') return 'complete'
  if (status === 'sending') return 'processing'
  if (status === 'failed') return 'failed'
  if (status === 'unknown') return 'unknown'
  if (status === 'not_requested') return 'unavailable'
  return 'waiting'
}

function deliveryDetail(order: Order) {
  if (order.deliveryStatus === 'sent') return '爱发电私信已发送'
  if (order.deliveryStatus === 'sending') return '正在调用私信服务'
  if (order.deliveryStatus === 'failed') return `发送失败${order.deliveryAttempts ? ` · 已尝试 ${order.deliveryAttempts} 次` : ''}`
  if (order.deliveryStatus === 'unknown') return '调用结果未知，已停止自动重试'
  if (order.deliveryStatus === 'not_requested') return '历史订单，无发送记录'
  return order.codes.length ? '等待发送兑换码' : '等待发码完成'
}

function LifecycleBadge({ state }: { state: LifecycleState }) {
  const meta: Record<LifecycleState, { label: string; className: string; icon: React.ReactNode }> = {
    complete: { label: '履约完成', className: 'bg-emerald-50 text-emerald-700', icon: <CheckCircle2 size={11}/> }, processing: { label: '处理中', className: 'bg-blue-50 text-blue-700', icon: <Clock3 size={11}/> }, failed: { label: '履约失败', className: 'bg-rose-50 text-rose-700', icon: <CircleAlert size={11}/> }, unknown: { label: '结果未知', className: 'bg-amber-50 text-amber-800', icon: <CircleAlert size={11}/> }, waiting: { label: '等待处理', className: 'bg-slate-100 text-slate-600', icon: <Clock3 size={11}/> }, unavailable: { label: '历史记录', className: 'bg-slate-100 text-slate-500', icon: <ReceiptText size={11}/> },
  }
  const item = meta[state]
  return <span className={`inline-flex w-fit shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium ${item.className}`}>{item.icon}{item.label}</span>
}

function StepState({ state }: { state: LifecycleState }) { const label = ({ complete: '完成', processing: '处理中', failed: '失败', unknown: '未知', waiting: '等待', unavailable: '无记录' } satisfies Record<LifecycleState, string>)[state]; return <span className={`text-[9px] sm:mt-1 sm:block ${state === 'failed' ? 'text-rose-600' : state === 'unknown' ? 'text-amber-700' : state === 'processing' ? 'text-blue-600' : state === 'complete' ? 'text-emerald-600' : 'text-slate-400'}`}>{label}</span> }
function stepTone(state: LifecycleState) { if (state === 'complete') return 'bg-emerald-50 text-emerald-600'; if (state === 'processing') return 'bg-blue-50 text-blue-600'; if (state === 'failed') return 'bg-rose-50 text-rose-600'; if (state === 'unknown') return 'bg-amber-50 text-amber-700'; return 'bg-slate-100 text-slate-400' }
function Summary({ icon, label, value, alert = false }: { icon: React.ReactNode; label: string; value: number; alert?: boolean }) { return <div className="rounded-xl bg-white px-4 py-3"><div className={`flex items-center gap-2 ${alert ? 'text-rose-500' : 'text-slate-400'}`}>{icon}<span className="text-[10px]">{label}</span></div><p className={`mt-2 font-mono text-lg font-semibold tabular-nums ${alert ? 'text-rose-700' : ''}`}>{value}</p></div> }
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-[10px] text-slate-400">{label}</dt><dd className="mt-1 truncate text-xs font-medium tabular-nums text-slate-600" title={value}>{value}</dd></div> }
function Empty({ text, basePath }: { text: string; basePath: string }) { return <div className="mx-auto max-w-2xl rounded-[22px] bg-white p-10 text-center"><p className="text-sm text-slate-500">{text}</p><Link href={basePath} className="mt-5 inline-flex text-sm text-[#3157d5]">返回订单列表</Link></div> }
function DetailSkeleton() { return <div className="mx-auto max-w-3xl space-y-3"><div className="h-5 w-28 animate-pulse rounded bg-slate-100"/><div className="h-[620px] animate-pulse rounded-[22px] bg-white"/></div> }
function ListSkeleton() { return <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-32 animate-pulse rounded-[18px] bg-white"/>)}</div> }
function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
