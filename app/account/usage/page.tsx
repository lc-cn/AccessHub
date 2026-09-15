import Link from 'next/link'
import { requireSession } from '@/lib/account'
import { getAccountUsage } from '@/lib/account/read-models'
import { PageIntro, Panel } from '@/components/account/ui'

export default async function UsagePage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const session = await requireSession()
  const requested = Number((await searchParams).days)
  const days: 7 | 30 | 90 = requested === 7 || requested === 90 ? requested : 30
  const rows = await getAccountUsage(session.user.id, days)
  const total = rows.reduce((sum, item) => sum + item.count, 0)
  const max = Math.max(...rows.map((item) => item.count), 1)
  const average = Math.round(total / days)
  return <><PageIntro eyebrow="USAGE" title="用量明细" description="这里展示所有计划产生的 API 调用。日期按 UTC 统计，与网关配额桶保持一致。" action={<div className="flex rounded-xl border border-slate-200 bg-white p-1">{[7, 30, 90].map((value) => <Link key={value} href={`/account/usage?days=${value}`} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${days === value ? 'bg-[#182238] text-white' : 'text-slate-500'}`}>{value} 天</Link>)}</div>}/><div className="mb-6 grid gap-4 sm:grid-cols-3"><Metric label="期间调用" value={total}/><Metric label="日均调用" value={average}/><Metric label="单日峰值" value={max === 1 && total === 0 ? 0 : max}/></div><Panel title="每日调用趋势" description={`最近 ${days} 天`}><div className="flex h-56 items-end gap-1 overflow-hidden pt-5" aria-label={`最近 ${days} 天 API 调用柱状图`}>{rows.map((item, index) => <div key={item.date} className="group relative flex min-w-0 flex-1 flex-col items-center justify-end"><span className="pointer-events-none absolute bottom-full z-10 mb-2 hidden whitespace-nowrap rounded-lg bg-[#182238] px-2 py-1 text-[10px] text-white group-hover:block">{item.date} · {item.count} 次</span><div className="w-full min-w-[3px] rounded-t-sm bg-[#3157d5] transition hover:bg-[#2446bb]" style={{ height: `${Math.max(item.count ? 5 : 1, item.count / max * 100)}%`, opacity: item.count ? 1 : .12 }}/>{(days === 7 || index % Math.ceil(days / 7) === 0) && <span className="mt-2 hidden text-[9px] text-slate-400 sm:block">{item.date.slice(5)}</span>}</div>)}</div></Panel></>
}
function Metric({ label, value }: { label: string; value: number }) { return <Panel><p className="text-xs text-slate-400">{label}</p><p className="mt-3 text-2xl font-semibold tracking-tight">{value.toLocaleString('zh-CN')}</p></Panel> }
