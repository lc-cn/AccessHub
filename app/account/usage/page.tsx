import Link from 'next/link'
import { ArrowUpRight, BarChart3 } from 'lucide-react'
import { requireSession } from '@/lib/account'
import { getAccountUsage } from '@/lib/account/read-models'
import { PageIntro, Panel } from '@/components/account/ui'

export default async function UsagePage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const session = await requireSession()
  const requested = Number((await searchParams).days)
  const days: 7 | 30 | 90 = requested === 7 || requested === 90 ? requested : 30
  const usage = await getAccountUsage(session.user.id, days)
  const rows = usage.daily
  const total = rows.reduce((sum, item) => sum + item.count, 0)
  const max = Math.max(...rows.map((item) => item.count), 1)
  const average = Math.round(total / days)
  const activeDays = rows.filter((item) => item.count > 0).length
  return <><PageIntro eyebrow="用量明细" title="每一次调用都有出处" description="统计包含订阅计划、默认计划和 Credits 消耗。日期与网关配额桶统一使用 UTC。" action={<div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">{[7, 30, 90].map((value) => <Link key={value} scroll={false} href={`/account/usage?days=${value}`} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${days === value ? 'bg-[#182238] text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{value} 天</Link>)}</div>}/>
    <div className="mb-6 grid gap-4 sm:grid-cols-3"><Metric label="期间调用" value={total}/><Metric label="日均调用" value={average}/><Metric label="活跃天数" value={activeDays} suffix={`/ ${days}`}/></div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]"><Panel title="每日调用趋势" description={`最近 ${days} 天，共 ${total.toLocaleString('zh-CN')} 次调用。`}><div className="relative"><div className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-6"><span className="border-t border-dashed border-slate-100"/><span className="border-t border-dashed border-slate-100"/><span className="border-t border-dashed border-slate-100"/></div><div className="relative flex h-60 items-end gap-1 overflow-hidden pt-5" aria-label={`最近 ${days} 天 API 调用柱状图`}>{rows.map((item, index) => <div key={item.date} className="group relative flex min-w-0 flex-1 flex-col items-center justify-end"><span className="pointer-events-none absolute bottom-full z-10 mb-2 hidden whitespace-nowrap rounded-lg bg-[#182238] px-2 py-1 text-[10px] text-white shadow-lg group-hover:block">{item.date} · {item.count} 次</span><div className="w-full min-w-[3px] rounded-t-[3px] bg-[#3157d5] transition duration-200 group-hover:bg-[#2446bb]" style={{ height: `${Math.max(item.count ? 5 : 1, item.count / max * 100)}%`, opacity: item.count ? 1 : .1 }}/>{(days === 7 || index % Math.ceil(days / 7) === 0) && <span className="mt-2 hidden text-[9px] tabular-nums text-slate-400 sm:block">{item.date.slice(5)}</span>}</div>)}</div></div>{total === 0 && <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><p className="text-xs text-slate-500">还没有调用记录，可先阅读接口文档完成首次请求。</p><Link href="/api-docs" className="inline-flex items-center gap-1 text-xs font-medium text-[#3157d5]">接口文档<ArrowUpRight size={13}/></Link></div>}</Panel><Panel title="额度来源" description="帮助判断调用使用了哪一层权益。">{usage.bySource.length ? <div className="space-y-4">{usage.bySource.map((source) => <div key={source.id}><div className="flex items-center justify-between gap-3 text-xs"><span className="truncate font-medium text-slate-600">{source.name}</span><span className="tabular-nums text-slate-400">{source.count.toLocaleString('zh-CN')} 次</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#7893ee]" style={{ width: `${source.count / total * 100}%` }}/></div></div>)}</div> : <div className="grid min-h-44 place-items-center text-center"><div><span className="mx-auto grid size-10 place-items-center rounded-xl bg-slate-50 text-slate-400"><BarChart3 size={18}/></span><p className="mt-3 text-xs text-slate-400">暂无额度消耗</p></div></div>}</Panel></div>
  </>
}
function Metric({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) { return <Panel><p className="text-xs text-slate-400">{label}</p><p className="mt-3 text-3xl font-semibold tracking-[-.035em] tabular-nums">{value.toLocaleString('zh-CN')}<span className="ml-1 text-sm font-normal text-slate-400">{suffix}</span></p></Panel> }
