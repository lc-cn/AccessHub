import { Activity, ArrowRight, Check, Clock3, Coins, Copy, ExternalLink, Ticket, Users } from 'lucide-react'
import type { DashboardData, DashboardGroup } from './types'

type Props = {
  dashboard: DashboardData | null
  loading: boolean
  copied: boolean
  onCopyId: () => void
  onNavigate: (view: '兑换码' | '用户组') => void
}

export function Overview({ dashboard, loading, copied, onCopyId, onNavigate }: Props) {
  const user = dashboard?.user
  const group = dashboard?.currentGroup
  const usage = dashboard?.usage ?? { daily: 0, weekly: 0, monthly: 0 }
  const registrationDate = user?.createdAt ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long' }).format(new Date(user.createdAt)) : '—'
  const expiresAt = group?.expiresAt ? new Intl.DateTimeFormat('zh-CN').format(new Date(group.expiresAt)) : '长期有效'

  return <div className="space-y-7">
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Metric icon={<Users size={18}/>} label="当前用户组" value={loading ? '读取中…' : group?.groupName || '—'} detail={group ? expiresAt : '正在读取策略'}/>
      <Metric icon={<Activity size={18}/>} label="今日 API 调用" value={loading ? '—' : usage.daily.toLocaleString()} detail={limitLabel(group?.dailyLimit, '每日')}/>
      <Metric icon={<Ticket size={18}/>} label="有效兑换权益" value={loading ? '—' : String(dashboard?.activeBenefits ?? 0)} detail="当前仍在有效期内"/>
      <Metric icon={<Coins size={18}/>} label="可用 credits" value={loading ? '—' : (dashboard?.creditsRemaining ?? 0).toLocaleString()} detail="基础周期配额耗尽后抵扣"/>
    </section>

    <section className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
      <article className="rounded-[22px] bg-white p-6 shadow-[0_18px_55px_rgba(39,55,92,.06)] sm:p-7">
        <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-medium tracking-wide text-[#3157d5]">用量周期</p><h3 className="mt-1 text-lg font-semibold">配额使用进度</h3><p className="mt-1 text-xs text-slate-400">周期按 UTC 自然日、周一和每月一日重置。</p></div><Clock3 size={18} className="text-slate-300"/></div>
        <div className="mt-7 space-y-6"><UsageBar label="今日" used={usage.daily} limit={group?.dailyLimit}/><UsageBar label="本周" used={usage.weekly} limit={group?.weeklyLimit}/><UsageBar label="本月" used={usage.monthly} limit={group?.monthlyLimit}/></div>
        <div className="mt-7 flex items-center justify-between rounded-xl bg-[#f5f7fb] px-4 py-3"><span><span className="block text-xs font-medium text-slate-600">瞬时访问频率</span><span className="mt-0.5 block text-[11px] text-slate-400">滚动 60 秒窗口</span></span><strong className="font-mono text-sm text-[#3157d5]">{quotaText(group?.rateLimit)} 次/分钟</strong></div>
      </article>

      <article className="rounded-[22px] bg-[#182238] p-6 text-white shadow-[0_20px_55px_rgba(24,34,56,.18)] sm:p-7">
        <p className="text-xs font-medium text-slate-400">升级权益</p><h3 className="mt-2 text-xl font-semibold tracking-tight">需要更多 API 配额？</h3><p className="mt-2 max-w-sm text-sm leading-6 text-slate-300">绑定爱发电后，购买成功即可自动到账；未绑定的订单仍会生成兑换码。</p>
        <div className="mt-7 space-y-2"><UpgradeAction afdian={dashboard?.afdian} onNavigate={() => onNavigate('兑换码')}/>{user?.role === 'admin' && <QuickAction label="配置用户组策略" onClick={() => onNavigate('用户组')}/>}</div>
      </article>
    </section>

    <section><div className="mb-4"><p className="text-xs font-medium tracking-wide text-[#3157d5]">权益阶梯</p><h3 className="mt-1 text-lg font-semibold">各用户组配额</h3><p className="mt-1 text-xs text-slate-400">对比访问能力，选择适合当前调用规模的权益。</p></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{dashboard?.groups.map((item) => <GroupTier key={item.id} group={item} current={item.id === group?.groupId} onRedeem={() => onNavigate('兑换码')}/>)}</div></section>

    <section className="rounded-[22px] bg-white p-6 shadow-[0_18px_55px_rgba(39,55,92,.06)] sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-medium tracking-wide text-slate-400">账户身份</p><h3 className="mt-1 text-lg font-semibold">调用凭据归属</h3></div><span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-500">UID</span></div>
      <div className="mt-6 flex items-center justify-between gap-3 rounded-xl bg-[#f5f7fb] px-4 py-3.5"><code className="min-w-0 truncate text-sm text-slate-600">{user?.id || '正在读取身份 ID'}</code><button onClick={onCopyId} disabled={!user} className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-[#3157d5] transition hover:bg-white active:translate-y-px disabled:text-slate-300">{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? '已复制' : '复制'}</button></div>
      <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-slate-100 pt-6 sm:grid-cols-5"><Info label="登录方式" value="GitHub OAuth"/><Info label="爱发电" value={dashboard?.afdian?.linked ? '已绑定 · 自动到账' : dashboard?.afdian?.oauthConfigured ? '购买时绑定' : '等待 OAuth 开通'}/><Info label="注册时间" value={registrationDate}/><Info label="当前组" value={group?.groupName || '—'}/><Info label="组内有效期" value={group ? expiresAt : '—'}/></dl>
    </section>
  </div>
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) { return <article className="rounded-[20px] bg-white p-5 shadow-[0_14px_40px_rgba(39,55,92,.055)]"><div className="flex items-center justify-between"><span className="grid size-9 place-items-center rounded-xl bg-[#edf2ff] text-[#3157d5]">{icon}</span><span className="text-[11px] text-slate-400">实时数据</span></div><p className="mt-5 text-xs text-slate-400">{label}</p><p className="mt-1 truncate text-2xl font-semibold tracking-tight tabular-nums">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></article> }

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null | undefined }) {
  const limited = limit != null && limit !== -1
  const percentage = limited ? Math.min(100, Math.round(used / limit * 100)) : 0
  return <div><div className="mb-2 flex items-baseline justify-between"><span className="text-xs font-medium text-slate-600">{label}</span><span className="font-mono text-xs text-slate-400"><strong className="font-semibold text-slate-700">{used.toLocaleString()}</strong> / {quotaText(limit)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-[width] duration-500 ${percentage >= 90 ? 'bg-rose-500' : percentage >= 70 ? 'bg-amber-500' : 'bg-[#3157d5]'}`} style={{ width: limited ? `${percentage}%` : '4%' }}/></div></div>
}

function GroupTier({ group, current, onRedeem }: { group: DashboardGroup; current: boolean; onRedeem: () => void }) { return <article className={`rounded-[18px] p-5 ${current ? 'bg-[#edf2ff] ring-1 ring-[#bdcaff]' : 'bg-white'}`}><div className="flex items-start justify-between"><div><h4 className="font-semibold">{group.name}</h4><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{group.description || '适用于不同规模的 API 调用。'}</p></div>{current && <span className="rounded-md bg-[#3157d5] px-2 py-1 text-[10px] font-medium text-white">当前</span>}</div><dl className="mt-5 grid grid-cols-2 gap-3 text-xs"><Quota label="分钟" value={group.rateLimit}/><Quota label="每日" value={group.dailyLimit}/><Quota label="每周" value={group.weeklyLimit}/><Quota label="每月" value={group.monthlyLimit}/></dl>{!current && <button onClick={onRedeem} className="mt-5 flex items-center gap-1.5 text-xs font-medium text-[#3157d5] transition hover:gap-2.5">兑换此权益 <ArrowRight size={13}/></button>}</article> }
function Quota({ label, value }: { label: string; value: number | null }) { return <div><dt className="text-[10px] text-slate-400">{label}</dt><dd className="mt-0.5 font-mono font-medium text-slate-600">{quotaText(value)}</dd></div> }
function quotaText(value: number | null | undefined) { return value == null || value === -1 ? '不限' : value.toLocaleString() }
function limitLabel(limit: number | null | undefined, period: string) { return limit == null || limit === -1 ? `${period}不限额` : `${period}上限 ${limit.toLocaleString()}` }
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-[11px] text-slate-400">{label}</dt><dd className="mt-1 truncate text-sm font-medium text-slate-600">{value}</dd></div> }
function UpgradeAction({ afdian, onNavigate }: { afdian?: DashboardData['afdian']; onNavigate: () => void }) { return process.env.NEXT_PUBLIC_AFDIAN_URL ? <a href="/api/afadian/purchase" className="flex w-full items-center justify-between rounded-xl bg-white px-4 py-3 text-sm font-medium text-[#182238] transition hover:bg-slate-100 active:translate-y-px">{afdian?.linked ? '前往爱发电购买权益' : afdian?.oauthConfigured ? '绑定爱发电并购买' : '前往爱发电获取兑换码'}<ExternalLink size={15}/></a> : <QuickAction label="前往兑换权益" onClick={onNavigate}/> }
function QuickAction({ label, onClick }: { label: string; onClick: () => void }) { return <button onClick={onClick} className="flex w-full items-center justify-between rounded-xl bg-white/[0.07] px-4 py-3 text-left text-sm transition hover:bg-white/[0.12] active:translate-y-px">{label}<ArrowRight size={15} className="text-slate-400"/></button> }
