import { Activity, ArrowRight, Check, Copy, Ticket, Users } from 'lucide-react'
import type { DashboardData } from './types'

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
  const authenticated = dashboard?.authenticated === true
  const registrationDate = user?.createdAt ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long' }).format(new Date(user.createdAt)) : '—'
  const expiresAt = group?.expiresAt ? new Intl.DateTimeFormat('zh-CN').format(new Date(group.expiresAt)) : '长期有效'

  return <div className="space-y-7">
    <section className="grid gap-4 md:grid-cols-3">
      <Metric icon={<Users size={18}/>} label="当前用户组" value={loading ? '读取中…' : group?.groupName || '—'} detail={group ? expiresAt : '登录后显示'}/>
      <Metric icon={<Activity size={18}/>} label="今日 API 调用" value={loading ? '—' : (dashboard?.todayUsage ?? 0).toLocaleString()} detail={group ? `每日上限 ${group.dailyLimit?.toLocaleString() ?? '不限'}` : '登录后显示'}/>
      <Metric icon={<Ticket size={18}/>} label="有效兑换权益" value={loading ? '—' : String(dashboard?.activeBenefits ?? 0)} detail={authenticated ? '当前仍在有效期内' : '登录后显示'}/>
    </section>

    <section className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
      <article className="rounded-[22px] bg-white p-6 shadow-[0_18px_55px_rgba(39,55,92,.06)] sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-medium tracking-wide text-slate-400">账户身份</p><h3 className="mt-1 text-lg font-semibold">调用凭据归属</h3></div><span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-500">UID</span></div>
        <div className="mt-6 flex items-center justify-between gap-3 rounded-xl bg-[#f5f7fb] px-4 py-3.5"><code className="min-w-0 truncate text-sm text-slate-600">{user?.id || '登录后显示真实身份 ID'}</code><button onClick={onCopyId} disabled={!user} className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-[#3157d5] transition hover:bg-white active:translate-y-px disabled:text-slate-300">{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? '已复制' : '复制'}</button></div>
        <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-slate-100 pt-6 sm:grid-cols-4"><Info label="登录方式" value={authenticated ? 'GitHub OAuth' : '—'}/><Info label="注册时间" value={registrationDate}/><Info label="当前组" value={group?.groupName || '—'}/><Info label="组内有效期" value={group ? expiresAt : '—'}/></dl>
      </article>

      <article className="rounded-[22px] bg-[#182238] p-6 text-white shadow-[0_20px_55px_rgba(24,34,56,.18)] sm:p-7">
        <p className="text-xs font-medium text-slate-400">快捷操作</p><h3 className="mt-2 text-xl font-semibold tracking-tight">管理访问权限</h3><p className="mt-2 max-w-sm text-sm leading-6 text-slate-300">兑换权益与用户组策略已经拆分为独立工作区，修改和查找都更清楚。</p>
        <div className="mt-7 space-y-2"><QuickAction label="核销或管理兑换码" onClick={() => onNavigate('兑换码')}/>{user?.role === 'admin' && <QuickAction label="配置用户组策略" onClick={() => onNavigate('用户组')}/>}</div>
      </article>
    </section>
  </div>
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <article className="rounded-[20px] bg-white p-5 shadow-[0_14px_40px_rgba(39,55,92,.055)]"><div className="flex items-center justify-between"><span className="grid size-9 place-items-center rounded-xl bg-[#edf2ff] text-[#3157d5]">{icon}</span><span className="text-[11px] text-slate-400">实时数据</span></div><p className="mt-5 text-xs text-slate-400">{label}</p><p className="mt-1 truncate text-2xl font-semibold tracking-tight tabular-nums">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></article>
}

function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-[11px] text-slate-400">{label}</dt><dd className="mt-1 truncate text-sm font-medium text-slate-600">{value}</dd></div> }
function QuickAction({ label, onClick }: { label: string; onClick: () => void }) { return <button onClick={onClick} className="flex w-full items-center justify-between rounded-xl bg-white/[0.07] px-4 py-3 text-left text-sm transition hover:bg-white/[0.12] active:translate-y-px">{label}<ArrowRight size={15} className="text-slate-400"/></button> }
