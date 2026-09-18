'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Activity, ArrowLeft, Coins, Fingerprint, Gauge, KeyRound, MailCheck, PackageCheck, Save, ShieldCheck, ShoppingBag, UserRound } from 'lucide-react'
import type { AdminUserDetailData } from './types'
import { requestJson } from '@/lib/http-client'
import { useWorkspaceRefresh } from './workspace-data'

export function AdminUserDetail({ userId }: { userId: string }) {
  const [data, setData] = useState<AdminUserDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [grantKind, setGrantKind] = useState<'plan' | 'credits'>('plan')
  const [planId, setPlanId] = useState('')
  const [credits, setCredits] = useState('1000')
  const [durationDays, setDurationDays] = useState('30')
  const [reason, setReason] = useState('')
  const [granting, setGranting] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const next = await requestJson<AdminUserDetailData>(`/api/admin/users/${encodeURIComponent(userId)}`, { cache: 'no-store' })
      setData(next); setPlanId((current) => current || next.plans.find((plan) => !plan.isDefault)?.id || next.plans[0]?.id || ''); setError('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : '用户详情读取失败') }
    finally { setLoading(false) }
  }, [userId])
  useEffect(() => { void load() }, [load])
  useWorkspaceRefresh(load)

  const grant = async (event: React.FormEvent) => {
    event.preventDefault(); setGranting(true); setNotice(null)
    try {
      await requestJson(`/api/admin/users/${encodeURIComponent(userId)}/entitlements`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: grantKind, planId, credits: Number(credits), durationDays: Number(durationDays), reason }) })
      setNotice({ tone: 'success', text: grantKind === 'plan' ? '订阅计划权益已补发并写入审计日志。' : 'Credits 已补发并写入账本和审计日志。' }); setReason(''); await load()
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '补发权益失败'
      if (message.includes('近期')) { window.location.assign(`/reauthenticate?next=${encodeURIComponent(`/admin/users/${userId}`)}`); return }
      setNotice({ tone: 'error', text: message })
    } finally { setGranting(false) }
  }

  if (loading && !data) return <DetailSkeleton/>
  if (!data) return <section><Link href="/admin/users" className="inline-flex items-center gap-2 text-sm text-slate-500"><ArrowLeft size={15}/>返回用户列表</Link><div className="mt-5 rounded-[22px] bg-white p-12 text-center text-sm text-rose-600">{error || '用户不存在'}</div></section>
  const successRate = data.summary.requests30d ? data.summary.successfulRequests30d / data.summary.requests30d * 100 : 0
  const activeEntitlements = data.entitlements.filter((item) => item.active)
  const activeKeys = data.apiKeys.filter((item) => !item.revokedAt && (!item.expiresAt || new Date(item.expiresAt) > new Date()))
  return <section>
    <Link href="/admin/users" className="mb-5 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-[#3157d5]"><ArrowLeft size={15}/>返回用户列表</Link>
    <header className="rounded-[24px] bg-white p-6 shadow-[0_18px_55px_rgba(39,55,92,.05)] sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#edf2ff] text-xl font-semibold text-[#3157d5]">{data.user.image ? <img src={data.user.image} alt={`${data.user.name} 的头像`} className="size-full object-cover"/> : data.user.name?.slice(0, 1) || '?'}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-2xl font-semibold tracking-tight">{data.user.name || '未命名用户'}</h2><Badge tone={data.user.role === 'admin' ? 'blue' : 'slate'}>{data.user.role === 'admin' ? '管理员' : '普通用户'}</Badge><Badge tone={data.user.emailVerified ? 'green' : 'amber'}>{data.user.emailVerified ? '邮箱已验证' : '邮箱未验证'}</Badge></div><p className="mt-2 text-sm text-slate-500">{data.user.email}</p><code className="mt-2 block truncate text-[10px] text-slate-300">{data.user.id}</code></div><div className="text-left sm:text-right"><p className="text-[10px] text-slate-400">注册时间</p><p className="mt-1 text-xs text-slate-600">{formatDate(data.user.createdAt)}</p></div></div></header>

    <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-5"><Metric icon={Gauge} label="有效权益" value={activeEntitlements.length}/><Metric icon={Coins} label="Credits" value={data.summary.creditsRemaining}/><Metric icon={Activity} label="30 天请求" value={data.summary.requests30d} detail={`${successRate.toFixed(1)}% 成功`}/><Metric icon={PackageCheck} label="30 天计费" value={data.summary.chargedUnits30d}/><Metric icon={ShoppingBag} label="订单" value={data.summary.orderCount}/></div>

    <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,.8fr)]">
      <div className="space-y-5">
        <Panel title="账户安全" description="只展示状态，不暴露令牌、密码或凭据材料。"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><SecurityStat icon={MailCheck} label="登录方式" value={`${data.security.identities.length} 种`}/><SecurityStat icon={Fingerprint} label="Passkey" value={`${data.security.passkeyCount} 个`}/><SecurityStat icon={ShieldCheck} label="MFA" value={data.security.hasTotp || data.user.twoFactorEnabled ? '已启用' : '未启用'}/><SecurityStat icon={UserRound} label="活跃会话" value={`${data.security.activeSessionCount} 个`}/></div><div className="mt-4 flex flex-wrap gap-2">{data.security.identities.map((identity) => <Badge key={identity.id} tone="slate">{identity.provider === 'credential' ? '邮箱密码' : identity.provider}</Badge>)}</div></Panel>
        <Panel title="订阅与权益" description="默认计划始终包含；这里列出额外授予和购买产生的权益。"><div className="space-y-2">{data.entitlements.length ? data.entitlements.map((item) => <div key={item.id} className="flex flex-col gap-2 rounded-xl bg-[#f5f7fb] px-4 py-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><strong className="text-xs text-slate-700">{item.planName}</strong><Badge tone={item.active ? 'green' : 'slate'}>{item.active ? '有效' : '已失效'}</Badge></div><p className="mt-1 text-[10px] text-slate-400">来源 {sourceLabel(item.source)} · Tier {item.rank}</p></div><p className="text-[10px] text-slate-400">{item.expiresAt ? `${formatDate(item.expiresAt)} 到期` : '永久有效'}</p></div>) : <Empty text="没有额外订阅权益，当前使用默认计划。"/>}</div></Panel>
        <Panel title="Credits 批次" description="按到期时间优先消耗；历史批次仍保留用于账务追踪。"><div className="space-y-2">{data.credits.length ? data.credits.map((item) => <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-xl bg-[#f5f7fb] px-4 py-3"><div><div className="flex items-center gap-2"><strong className="font-mono text-xs tabular-nums text-slate-700">{item.remainingCredits.toLocaleString()} / {item.credits.toLocaleString()}</strong><Badge tone={item.active ? 'green' : 'slate'}>{item.active ? '可用' : '已失效'}</Badge></div><p className="mt-1 text-[10px] text-slate-400">来源 {sourceLabel(item.source)} · {formatDate(item.createdAt)}</p></div><p className="text-[10px] text-slate-400">{item.expiresAt ? `${formatDate(item.expiresAt)} 到期` : '永久'}</p></div>) : <Empty text="没有 Credits 批次。"/>}</div></Panel>
        <Panel title="最近 API 调用" description="保留调用元数据，不保存请求正文和密钥。"><div className="divide-y divide-slate-100">{data.recentCalls.length ? data.recentCalls.slice(0, 12).map((item) => <div key={item.id} className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto]"><div className="min-w-0"><div className="flex items-center gap-2"><Badge tone={item.outcome === 'success' ? 'green' : item.outcome === 'rejected' ? 'amber' : 'rose'}>{item.outcome === 'success' ? '成功' : item.outcome === 'rejected' ? '拒绝' : '错误'}</Badge><code className="truncate text-[11px] text-slate-600">{item.serviceCode}/{item.apiCode}</code></div><p className="mt-1 text-[10px] text-slate-400">{formatDate(item.createdAt, true)}</p></div><p className="text-[10px] text-slate-400">HTTP {item.responseStatus} · {item.durationMs} ms · {item.chargedUsageUnits} 单位</p></div>) : <Empty text="还没有 API 调用。"/>}</div></Panel>
      </div>

      <div className="space-y-5 xl:sticky xl:top-28">
        <Panel title="人工补发权益" description="只支持正向补发。提交前必须完成近期 Passkey 或 MFA 验证，操作会写入审计日志。"><form onSubmit={(event) => void grant(event)} className="space-y-4"><div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">{(['plan', 'credits'] as const).map((kind) => <button key={kind} type="button" onClick={() => setGrantKind(kind)} className={`rounded-lg px-3 py-2 text-xs font-medium ${grantKind === kind ? 'bg-white text-[#3157d5] shadow-sm' : 'text-slate-400'}`}>{kind === 'plan' ? '订阅计划' : 'Credits'}</button>)}</div>{grantKind === 'plan' ? <Field label="订阅计划"><select value={planId} onChange={(event) => setPlanId(event.target.value)} className="access-input">{data.plans.filter((plan) => !plan.isDefault).map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · Tier {plan.rank}</option>)}</select></Field> : <Field label="Credits 数量"><input type="number" min="1" max="10000000" required value={credits} onChange={(event) => setCredits(event.target.value)} className="access-input tabular-nums"/></Field>}<Field label="有效期"><select value={durationDays} onChange={(event) => setDurationDays(event.target.value)} className="access-input"><option value="7">7 天</option><option value="30">30 天</option><option value="90">90 天</option><option value="365">1 年</option><option value="-1">永久</option></select></Field><Field label="补发原因"><textarea required minLength={4} maxLength={240} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className="access-input resize-none" placeholder="例如：订单异常人工补偿 #工单号"/></Field>{notice && <p className={`rounded-xl px-3 py-2.5 text-xs ${notice.tone === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{notice.text}</p>}<button disabled={granting || reason.trim().length < 4 || (grantKind === 'plan' && !planId)} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#182238] text-xs font-medium text-white disabled:opacity-40"><Save size={14}/>{granting ? '补发中…' : '验证并补发权益'}</button></form></Panel>
        <Panel title="API Keys" description={`${activeKeys.length} 个有效凭据；管理员看不到完整 Key。`}><div className="space-y-2">{data.apiKeys.length ? data.apiKeys.slice(0, 8).map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl bg-[#f5f7fb] px-3 py-3"><KeyRound size={14} className="text-slate-400"/><div className="min-w-0 flex-1"><p className="truncate text-xs text-slate-600">{item.name}</p><code className="text-[9px] text-slate-400">{item.prefix}</code></div><Badge tone={item.revokedAt ? 'slate' : 'green'}>{item.revokedAt ? '已撤销' : '有效'}</Badge></div>) : <Empty text="没有 API Key。"/>}</div></Panel>
        <Panel title="最近订单" description="从用户详情直接进入统一订单闭环。"><div className="space-y-2">{data.orders.length ? data.orders.slice(0, 6).map((item) => <Link key={item.id} href={`/admin/orders/${item.id}`} className="block rounded-xl bg-[#f5f7fb] px-4 py-3 transition hover:bg-[#edf2ff]"><div className="flex items-center justify-between gap-3"><p className="truncate text-xs font-medium text-slate-700">{item.title || '未命名商品'}</p><span className="font-mono text-[10px] text-slate-500">{item.currency} {item.amount || '0'}</span></div><p className="mt-1 truncate text-[9px] text-slate-400">{item.externalOrderId || item.id} · {formatDate(item.createdAt)}</p></Link>) : <Empty text="没有订单。"/>}</div></Panel>
      </div>
    </div>
  </section>
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: number; detail?: string }) { return <article className="rounded-[16px] bg-white p-4"><span className="grid size-8 place-items-center rounded-xl bg-[#edf2ff] text-[#3157d5]"><Icon size={14}/></span><p className="mt-4 font-mono text-xl font-semibold tabular-nums">{value.toLocaleString()}</p><p className="mt-1 text-[10px] text-slate-400">{label}{detail ? ` · ${detail}` : ''}</p></article> }
function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <article className="rounded-[22px] bg-white p-6"><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-[11px] leading-5 text-slate-400">{description}</p><div className="mt-5">{children}</div></article> }
function SecurityStat({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) { return <div className="rounded-xl bg-[#f5f7fb] p-3"><Icon size={14} className="text-slate-400"/><p className="mt-3 text-xs font-medium text-slate-700">{value}</p><p className="mt-1 text-[9px] text-slate-400">{label}</p></div> }
function Badge({ tone, children }: { tone: 'green' | 'blue' | 'amber' | 'rose' | 'slate'; children: React.ReactNode }) { const style = { green: 'bg-emerald-50 text-emerald-700', blue: 'bg-blue-50 text-blue-700', amber: 'bg-amber-50 text-amber-700', rose: 'bg-rose-50 text-rose-700', slate: 'bg-slate-100 text-slate-500' }; return <span className={`w-fit shrink-0 rounded-md px-2 py-1 text-[9px] font-medium ${style[tone]}`}>{children}</span> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[11px] font-medium text-slate-600">{label}</span>{children}</label> }
function Empty({ text }: { text: string }) { return <p className="rounded-xl border border-dashed border-slate-200 px-4 py-7 text-center text-[11px] text-slate-400">{text}</p> }
function DetailSkeleton() { return <div className="animate-pulse space-y-5"><div className="h-32 rounded-[22px] bg-white"/><div className="grid grid-cols-2 gap-3 xl:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-28 rounded-[16px] bg-white"/>)}</div><div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><div className="h-[680px] rounded-[22px] bg-white"/><div className="h-[520px] rounded-[22px] bg-white"/></div></div> }
function sourceLabel(value: string) { return ({ admin: '管理员补发', subscription: '订阅', redeem: '兑换码', default: '默认计划' } as Record<string, string>)[value] || value }
function formatDate(value: string, includeTime = false) { return new Intl.DateTimeFormat('zh-CN', includeTime ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'medium' }).format(new Date(value)) }
