'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, CircleAlert, Clock3, Copy, MailCheck, ReceiptText, Search, TicketCheck } from 'lucide-react'
import type { AdminData, Order } from './types'
import { requestJson } from '@/lib/http-client'

export function Orders({ mode, orderId, provider = 'all' }: { mode: 'list' | 'detail'; orderId?: string; provider?: 'all' | 'afdian' }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try { const data = await requestJson<AdminData>(`/api/admin?section=${provider === 'afdian' ? 'afdian-orders' : 'orders'}`, { cache: 'no-store' }); setOrders(data.orders ?? []); setError('') }
    catch (reason) { setError(reason instanceof Error ? reason.message : '订单读取失败') }
    finally { setLoading(false) }
  }, [provider])
  useEffect(() => { void load() }, [load])
  const selected = useMemo(() => orders.find((order) => order.id === orderId) ?? null, [orderId, orders])
  const visible = orders.filter((order) => !query || `${order.externalOrderId} ${order.externalOfferTitle} ${order.externalOfferId} ${order.codes.map((code) => code.code).join(' ')}`.toLowerCase().includes(query.toLowerCase()))
  const copy = async (value: string) => { await navigator.clipboard.writeText(value); setCopied(value); setTimeout(() => setCopied(''), 1400) }
  const basePath = provider === 'afdian' ? '/admin/afdian/orders' : '/admin/orders'
  const title = provider === 'afdian' ? '爱发电订单' : '全部订单'

  if (mode === 'detail') {
    if (loading) return <div className="mx-auto h-[520px] max-w-3xl animate-pulse rounded-[22px] bg-white"/>
    if (!selected) return <Empty text={error || '订单不存在或已被删除'} basePath={basePath}/>
    return <section className="mx-auto max-w-3xl"><Link href={basePath} className="mb-5 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#3157d5]"><ArrowLeft size={15}/>返回订单列表</Link><article className="rounded-[24px] bg-white p-6 shadow-[0_18px_55px_rgba(39,55,92,.06)] sm:p-8"><div className="flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs text-slate-400">{title}</p><h2 className="mt-1 text-xl font-semibold">{selected.externalOfferTitle || selected.skuName || '未命名商品'}</h2><code className="mt-2 block text-xs text-slate-400">{selected.externalOrderId || selected.id}</code></div><MessageBadge status={selected.deliveryStatus}/></div><dl className="grid grid-cols-2 gap-5 border-b border-slate-100 py-6 text-sm sm:grid-cols-4"><Info label="购买周期" value={`${selected.termMonths} 个月`}/><Info label="支付金额" value={selected.amount ? `${selected.currency} ${selected.amount}` : '—'}/><Info label="本地 SKU" value={selected.skuCode || '—'}/><Info label="下单时间" value={formatDate(selected.createdAt)}/></dl><div className="pt-6"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-[#3157d5]">履约闭环</p><h3 className="mt-1 font-semibold">兑换码与核销状态</h3></div><span className="text-xs text-slate-400">{selected.codes.filter((code) => code.redeemedAt).length} / {selected.codes.length} 已核销</span></div><div className="mt-4 space-y-2">{selected.codes.map((code) => <div key={code.id} className="flex flex-col gap-3 rounded-xl bg-[#f5f7fb] px-4 py-3 sm:flex-row sm:items-center"><button onClick={() => void copy(code.code)} className="flex min-w-0 flex-1 items-center gap-2 text-left font-mono text-xs text-slate-700"><span className="truncate">{code.code}</span><Copy size={12} className={copied === code.code ? 'text-emerald-500' : 'text-slate-300'}/></button><span className="text-xs text-slate-500">{code.planName || `${code.credits?.toLocaleString()} credits`}</span><span className={`w-fit rounded-md px-2 py-1 text-[10px] ${code.redeemedAt ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{code.redeemedAt ? `已核销 · ${formatDate(code.redeemedAt)}` : '等待核销'}</span></div>)}</div>{selected.deliveryLastError && <p className="mt-5 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-600">交付错误：{selected.deliveryLastError}</p>}<p className="mt-4 text-xs text-slate-400">交付尝试 {selected.deliveryAttempts} 次{selected.deliveredAt ? ` · ${formatDate(selected.deliveredAt)} 成功` : ''}</p></div></article></section>
  }

  const sent = orders.filter((order) => order.deliveryStatus === 'sent').length
  const waiting = orders.reduce((total, order) => total + order.codes.filter((code) => !code.redeemedAt).length, 0)
  return <section><div className="mb-5"><p className="text-xs font-medium tracking-wide text-[#3157d5]">订单与履约</p><h2 className="mt-1 text-2xl font-semibold">{title}</h2><p className="mt-2 text-sm text-slate-500">统一追踪支付服务、SKU、兑换码交付与最终核销。</p></div><div className="mb-4 grid grid-cols-3 gap-3"><Summary icon={<ReceiptText size={15}/>} label="订单" value={orders.length}/><Summary icon={<MailCheck size={15}/>} label="交付成功" value={sent}/><Summary icon={<TicketCheck size={15}/>} label="等待核销" value={waiting}/></div><label className="mb-4 flex h-11 items-center gap-2 rounded-xl bg-white px-3 text-slate-400 focus-within:ring-2 focus-within:ring-blue-100"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm text-slate-700 outline-none" placeholder="搜索订单号、商品或兑换码"/></label>{error && <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-600">{error}</p>}{loading ? <div className="space-y-3">{[1,2,3].map((item) => <div key={item} className="h-28 animate-pulse rounded-[18px] bg-white"/>)}</div> : visible.length === 0 ? <div className="rounded-[20px] bg-white p-12 text-center text-sm text-slate-400">还没有符合条件的订单</div> : <div className="space-y-3">{visible.map((order) => <Link key={order.id} href={`${basePath}/${order.id}`} className="grid gap-4 rounded-[18px] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(39,55,92,.07)] sm:grid-cols-[1fr_auto]"><div className="min-w-0"><div className="flex items-center gap-2"><h3 className="truncate font-medium">{order.externalOfferTitle || order.skuName || '未命名商品'}</h3><MessageBadge status={order.deliveryStatus}/></div><code className="mt-1.5 block truncate text-[11px] text-slate-400">{order.externalOrderId || order.id}</code><p className="mt-3 text-xs text-slate-500">{order.skuCode || '未关联 SKU'} · {order.codes.length} 个兑换码 · {order.codes.filter((code) => code.redeemedAt).length} 个已核销</p></div><div className="flex items-center gap-2 text-xs text-slate-400"><Clock3 size={13}/>{formatDate(order.createdAt)}</div></Link>)}</div>}</section>
}

function MessageBadge({ status }: { status: Order['deliveryStatus'] }) { const sent = status === 'sent'; const risky = status === 'failed' || status === 'unknown'; return <span className={`inline-flex w-fit items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium ${sent ? 'bg-emerald-50 text-emerald-700' : risky ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'}`}>{sent ? <CheckCircle2 size={11}/> : risky ? <CircleAlert size={11}/> : <Clock3 size={11}/>} {statusText(status)}</span> }
function statusText(status: Order['deliveryStatus']) { return ({ pending: '待发送', sending: '发送中', sent: '已私信', failed: '发送失败', unknown: '结果未知', not_requested: '历史订单' })[status] }
function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <div className="rounded-xl bg-white px-4 py-3"><div className="flex items-center gap-2 text-slate-400">{icon}<span className="text-[10px]">{label}</span></div><p className="mt-2 font-mono text-lg font-semibold">{value}</p></div> }
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-[10px] text-slate-400">{label}</dt><dd className="mt-1 truncate text-xs font-medium text-slate-600">{value}</dd></div> }
function Empty({ text, basePath }: { text: string; basePath: string }) { return <div className="mx-auto max-w-2xl rounded-[22px] bg-white p-10 text-center"><p className="text-sm text-slate-500">{text}</p><Link href={basePath} className="mt-5 inline-flex text-sm text-[#3157d5]">返回订单列表</Link></div> }
function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
