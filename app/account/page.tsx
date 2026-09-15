import Link from 'next/link'
import { Activity, ArrowRight, CreditCard, Link2, ReceiptText, ShieldCheck } from 'lucide-react'
import { requireSession } from '@/lib/account'
import { getAccountOverview, getAccountSecurity, getAccountUsage } from '@/lib/account/read-models'
import { PageIntro, Panel, Status, formatDate } from '@/components/account/ui'

export default async function AccountPage() {
  const authSession = await requireSession()
  const [data, security, usage] = await Promise.all([
    getAccountOverview(authSession.user.id),
    getAccountSecurity(authSession.user.id, authSession.session.id),
    getAccountUsage(authSession.user.id, 7),
  ])
  const weekUsage = usage.reduce((sum, item) => sum + item.count, 0)
  return <><PageIntro eyebrow="ACCOUNT OVERVIEW" title={`你好，${data.profile?.name || authSession.user.name}`} description="资料、登录方式、订阅权益和消费记录都汇总在这里。"/>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="当前计划" value={data.activePlan?.name || '默认计划'} hint={data.activePlan?.expiresAt ? `至 ${formatDate(data.activePlan.expiresAt)}` : '基础权益持续可用'} icon={<CreditCard size={17}/>}/><Metric label="近 7 日调用" value={weekUsage.toLocaleString('zh-CN')} hint="所有计划合计" icon={<Activity size={17}/>}/><Metric label="Credits 余额" value={data.creditsRemaining.toLocaleString('zh-CN')} hint="优先使用计划额度" icon={<CreditCard size={17}/>}/><Metric label="订单" value={data.orderCount.toLocaleString('zh-CN')} hint="仅展示你的订单" icon={<ReceiptText size={17}/>}/></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_.85fr]"><Panel title="账户状态" description="建议完成邮箱验证，并保留至少两种登录方式。"><div className="divide-y divide-slate-100"><Row label="主要邮箱" value={data.profile?.email || authSession.user.email} status={<Status tone={data.profile?.emailVerified ? 'green' : 'amber'}>{data.profile?.emailVerified ? '已验证' : '待验证'}</Status>}/><Row label="登录方式" value={`${security.identities.length} 种`} status={<Link href="/account/connections" className="text-xs font-medium text-[#3157d5]">管理绑定</Link>}/><Row label="活跃会话" value={`${security.sessions.length} 个设备`} status={<Link href="/account/security" className="text-xs font-medium text-[#3157d5]">检查安全</Link>}/></div></Panel><Panel title="常用入口" description="快速前往账户最常用的自助功能。"><div className="space-y-2"><QuickLink href="/account/security" icon={<ShieldCheck size={17}/>} title="登录与安全"/><QuickLink href="/account/connections" icon={<Link2 size={17}/>} title="绑定 GitHub 或爱发电"/><QuickLink href="/account/entitlements" icon={<CreditCard size={17}/>} title="查看权益有效期"/><QuickLink href="/account/orders" icon={<ReceiptText size={17}/>} title="查看订单和兑换码"/></div></Panel></div>
  </>
}

function Metric({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: React.ReactNode }) { return <Panel><div className="flex items-center justify-between text-slate-400"><p className="text-xs font-medium">{label}</p><span>{icon}</span></div><p className="mt-5 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-slate-400">{hint}</p></Panel> }
function Row({ label, value, status }: { label: string; value: string; status: React.ReactNode }) { return <div className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"><div className="min-w-0 flex-1"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 truncate text-sm font-medium">{value}</p></div>{status}</div> }
function QuickLink({ href, icon, title }: { href: string; icon: React.ReactNode; title: string }) { return <Link href={href} className="flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-200 hover:bg-slate-50"><span className="text-[#3157d5]">{icon}</span>{title}<ArrowRight size={15} className="ml-auto text-slate-300"/></Link> }
