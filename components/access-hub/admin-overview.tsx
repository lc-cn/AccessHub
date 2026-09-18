'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Activity, ArrowRight, Boxes, CheckCircle2, CircleAlert, Gauge, ReceiptText, RefreshCw, ServerCog, UsersRound } from 'lucide-react'
import type { AdminOverviewAttention, AdminOverviewData, AdminOverviewOrder } from './types'
import { requestJson } from '@/lib/http-client'
import { useWorkspaceRefresh } from './workspace-data'

export function AdminOverview() {
  const [data, setData] = useState<AdminOverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await requestJson<AdminOverviewData>('/api/admin/overview', { cache: 'no-store' }))
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '运营总览读取失败')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])
  useWorkspaceRefresh(load)

  if (loading && !data) return <OverviewSkeleton/>
  if (!data) return <div className="rounded-[22px] bg-white px-6 py-14 text-center"><CircleAlert size={24} className="mx-auto text-rose-400"/><p className="mt-4 text-sm text-slate-600">{error || '暂时无法读取运营总览'}</p><button type="button" onClick={() => void load()} className="mt-5 rounded-xl bg-[#182238] px-4 py-2.5 text-xs font-medium text-white">重新加载</button></div>

  const successRate = data.traffic.requests24h ? data.traffic.successes24h / data.traffic.requests24h * 100 : 0
  const fulfillmentRate = data.commerce.orders24h ? data.commerce.fulfilledOrders24h / data.commerce.orders24h * 100 : 0
  return <section>
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-medium tracking-wide text-[#3157d5]">OPERATIONS</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">今天需要关注什么</h2><p className="mt-2 text-sm text-slate-500">业务指标使用滚动 24 小时窗口；客户增长和到期提醒使用 7 天窗口。</p></div>
      <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-medium text-slate-600 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>刷新总览</button>
    </div>
    {error && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</p>}

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Metric href="/admin/usage" icon={Activity} label="API 请求 · 24h" value={formatNumber(data.traffic.requests24h)} detail={`${successRate.toFixed(1)}% 成功 · ${data.traffic.activeUsers24h} 位用户`} tone="blue"/>
      <Metric href="/admin/users" icon={UsersRound} label="平台用户" value={formatNumber(data.customers.total)} detail={`近 7 天新增 ${data.customers.new7d} 位`} tone="violet"/>
      <Metric href="/admin/subscriptions" icon={Gauge} label="生效订阅" value={formatNumber(data.commerce.activeSubscriptions)} detail={`${data.commerce.expiring7d} 个将在 7 天内到期`} tone="emerald"/>
      <Metric href="/admin/operations" icon={CircleAlert} label="需要处理" value={formatNumber(data.operations.totalAttention)} detail="履约、事件、队列与事务消息" tone={data.operations.totalAttention ? 'rose' : 'slate'}/>
    </div>

    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,.65fr)]">
      <AttentionPanel items={data.attention} total={data.operations.totalAttention}/>
      <article className="rounded-[22px] bg-[#182238] p-6 text-white">
        <div className="flex items-start justify-between"><div><p className="text-[10px] font-medium tracking-[.14em] text-[#9fb0ee]">SYSTEM PULSE</p><h3 className="mt-2 text-lg font-semibold">平台脉搏</h3></div><span className={`mt-1 size-2.5 rounded-full ${data.operations.totalAttention ? 'bg-amber-400' : 'bg-emerald-400'}`}/></div>
        <div className="mt-7 space-y-5">
          <Pulse label="API 成功率" value={`${successRate.toFixed(1)}%`} ratio={successRate}/>
          <Pulse label="订单履约率 · 24h" value={`${fulfillmentRate.toFixed(1)}%`} ratio={fulfillmentRate}/>
        </div>
        <dl className="mt-7 grid grid-cols-2 gap-3 border-t border-white/10 pt-6">
          <DarkStat label="实际计费" value={`${formatNumber(data.traffic.chargedUnits24h)} 单位`}/>
          <DarkStat label="P95 延迟" value={`${formatNumber(data.traffic.p95DurationMs24h)} ms`}/>
          <DarkStat label="启用服务" value={`${data.catalog.enabledServices} 个`}/>
          <DarkStat label="启用 API" value={`${data.catalog.enabledApis} 个`}/>
        </dl>
        <Link href="/admin/usage" className="mt-7 inline-flex items-center gap-2 text-xs font-medium text-[#b9c7f7] transition hover:text-white">打开完整用量报表<ArrowRight size={13}/></Link>
      </article>
    </div>

    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
      <RecentOrders orders={data.recentOrders}/>
      <QuickActions/>
    </div>
    <p className="mt-4 text-right text-[10px] text-slate-300">数据更新于 {formatDate(data.generatedAt)}</p>
  </section>
}

function Metric({ href, icon: Icon, label, value, detail, tone }: { href: string; icon: typeof Activity; label: string; value: string; detail: string; tone: 'blue' | 'violet' | 'emerald' | 'rose' | 'slate' }) {
  const colors = { blue: 'bg-blue-50 text-blue-600', violet: 'bg-violet-50 text-violet-600', emerald: 'bg-emerald-50 text-emerald-600', rose: 'bg-rose-50 text-rose-600', slate: 'bg-slate-100 text-slate-500' }
  return <Link href={href} className="group rounded-[18px] bg-white p-5 shadow-[0_14px_38px_rgba(39,55,92,.04)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(39,55,92,.08)]"><div className="flex items-center justify-between"><span className={`grid size-9 place-items-center rounded-xl ${colors[tone]}`}><Icon size={16}/></span><ArrowRight size={14} className="text-slate-200 transition group-hover:translate-x-0.5 group-hover:text-[#3157d5]"/></div><p className="mt-5 font-mono text-2xl font-semibold tabular-nums text-slate-800">{value}</p><p className="mt-1 text-[10px] font-medium text-slate-400">{label}</p><p className="mt-3 truncate text-[11px] text-slate-400">{detail}</p></Link>
}

function AttentionPanel({ items, total }: { items: AdminOverviewAttention[]; total: number }) {
  return <article className="overflow-hidden rounded-[22px] bg-white"><div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6"><div><p className="text-xs font-medium text-[#3157d5]">人工待办</p><h3 className="mt-1 text-lg font-semibold">异常与恢复</h3><p className="mt-1 text-xs text-slate-400">这里只聚合需要人工判断或恢复的事项。</p></div><span className={`rounded-xl px-3 py-2 font-mono text-sm font-semibold ${total ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{total}</span></div>{items.length ? <div className="divide-y divide-slate-100">{items.map((item) => <AttentionRow key={`${item.kind}:${item.id}`} item={item}/>)}</div> : <div className="px-6 py-14 text-center"><CheckCircle2 size={24} className="mx-auto text-emerald-400"/><p className="mt-4 text-sm font-medium text-slate-600">当前没有待处理异常</p><p className="mt-1 text-xs text-slate-400">履约、事件和异步任务状态正常。</p></div>}</article>
}

function AttentionRow({ item }: { item: AdminOverviewAttention }) {
  const style = item.kind === 'delivery_unknown' ? 'bg-amber-50 text-amber-700' : item.kind === 'provider_event_failed' ? 'bg-rose-50 text-rose-700' : 'bg-violet-50 text-violet-700'
  return <Link href={item.href} className="group flex gap-3 px-6 py-4 transition hover:bg-slate-50"><span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl ${style}`}><CircleAlert size={14}/></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-3"><strong className="truncate text-xs font-medium text-slate-700">{item.title}</strong><time className="shrink-0 text-[9px] tabular-nums text-slate-300">{formatRelative(item.occurredAt)}</time></span><span className="mt-1 block truncate text-[10px] text-slate-400">{item.detail}</span></span><ArrowRight size={13} className="mt-2 shrink-0 text-slate-200 transition group-hover:translate-x-0.5 group-hover:text-[#3157d5]"/></Link>
}

function RecentOrders({ orders }: { orders: AdminOverviewOrder[] }) {
  return <article className="overflow-hidden rounded-[22px] bg-white"><div className="flex items-end justify-between gap-4 border-b border-slate-100 p-6"><div><p className="text-xs font-medium text-[#3157d5]">商业动态</p><h3 className="mt-1 text-lg font-semibold">最近订单</h3></div><Link href="/admin/orders" className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-[#3157d5]">查看全部<ArrowRight size={12}/></Link></div>{orders.length ? <div className="divide-y divide-slate-100">{orders.map((order) => <Link key={order.id} href={`/admin/orders/${order.id}`} className="grid gap-3 px-6 py-4 transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-xs font-medium text-slate-700">{order.externalOfferTitle || '未命名商品'}</p><OrderStatus value={order.deliveryStatus}/></div><code className="mt-1 block truncate text-[9px] text-slate-400">{order.externalOrderId || order.id}</code></div><div className="flex items-center justify-between gap-4 sm:block sm:text-right"><p className="font-mono text-xs font-semibold tabular-nums text-slate-600">{order.amount ? `${order.currency} ${order.amount}` : '—'}</p><time className="mt-1 block text-[9px] text-slate-300">{formatDate(order.createdAt)}</time></div></Link>)}</div> : <p className="px-6 py-14 text-center text-xs text-slate-400">还没有订单</p>}</article>
}

function QuickActions() {
  const actions = [
    { href: '/admin/services/new', icon: ServerCog, title: '接入 API 服务', detail: '配置上游、鉴权和传输方式' },
    { href: '/admin/plans/new', icon: Gauge, title: '创建订阅计划', detail: '定义限速、配额与权限阶梯' },
    { href: '/admin/redeem-codes/new', icon: ReceiptText, title: '生成兑换码', detail: '按 SKU 批量签发权益' },
    { href: '/admin/skus/new', icon: Boxes, title: '新增商品 SKU', detail: '配置计划商品或增量包' },
  ]
  return <article className="rounded-[22px] bg-white p-6"><p className="text-xs font-medium text-[#3157d5]">快捷操作</p><h3 className="mt-1 text-lg font-semibold">继续配置平台</h3><div className="mt-5 grid gap-2">{actions.map(({ href, icon: Icon, title, detail }) => <Link key={href} href={href} className="group flex items-center gap-3 rounded-xl border border-slate-100 p-3.5 transition hover:border-blue-100 hover:bg-blue-50/40"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 transition group-hover:bg-white group-hover:text-[#3157d5]"><Icon size={15}/></span><span className="min-w-0 flex-1"><strong className="block text-xs font-medium text-slate-700">{title}</strong><span className="mt-1 block truncate text-[10px] text-slate-400">{detail}</span></span><ArrowRight size={13} className="text-slate-200 group-hover:text-[#3157d5]"/></Link>)}</div></article>
}

function Pulse({ label, value, ratio }: { label: string; value: string; ratio: number }) { return <div><div className="flex items-center justify-between text-xs"><span className="text-slate-400">{label}</span><strong className="font-mono tabular-nums">{value}</strong></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#7893ee]" style={{ width: `${Math.max(0, Math.min(100, ratio))}%` }}/></div></div> }
function DarkStat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white/[0.05] px-3 py-3"><dt className="text-[9px] text-slate-500">{label}</dt><dd className="mt-1.5 font-mono text-xs font-medium tabular-nums text-slate-200">{value}</dd></div> }
function OrderStatus({ value }: { value: string }) { const good = value === 'sent'; const bad = ['failed', 'unknown'].includes(value); const label = ({ sent: '已履约', failed: '失败', unknown: '待核对', sending: '发送中', pending: '待处理', not_requested: '无交付' } as Record<string, string>)[value] || value; return <span className={`shrink-0 rounded-md px-2 py-0.5 text-[9px] ${good ? 'bg-emerald-50 text-emerald-700' : bad ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>{label}</span> }
function OverviewSkeleton() { return <div className="animate-pulse space-y-5"><div className="h-16 w-96 max-w-full rounded-xl bg-white"/><div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-40 rounded-[18px] bg-white"/>)}</div><div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]"><div className="h-96 rounded-[22px] bg-white"/><div className="h-96 rounded-[22px] bg-white"/></div></div> }
function formatNumber(value: number) { return new Intl.NumberFormat('zh-CN').format(value) }
function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) }
function formatRelative(value: string) { const minutes = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 60_000)); if (minutes < 1) return '刚刚'; if (minutes < 60) return `${minutes} 分钟前`; const hours = Math.round(minutes / 60); if (hours < 24) return `${hours} 小时前`; return `${Math.round(hours / 24)} 天前` }
