import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'

export function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[11px] font-semibold tracking-[.14em] text-[#3157d5]">{eyebrow}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.035em] sm:text-3xl">{title}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{description}</p></div>{action}</div>
}

export function Panel({ title, description, children, className = '' }: { title?: string; description?: string; children: ReactNode; className?: string }) {
  return <section className={`rounded-[20px] border border-[#e3e9f2] bg-white p-5 shadow-[0_14px_42px_rgba(37,53,84,.045)] sm:p-6 ${className}`}>{title && <div className="mb-5"><h3 className="font-semibold tracking-tight text-slate-800">{title}</h3>{description && <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400 text-pretty">{description}</p>}</div>}{children}</section>
}

export function EmptyState({ children }: { children: ReactNode }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center text-sm text-slate-400">{children}</div> }

export function Status({ children, tone = 'slate' }: { children: ReactNode; tone?: 'green' | 'blue' | 'amber' | 'rose' | 'slate' }) {
  const colors = { green: 'bg-emerald-50 text-emerald-700', blue: 'bg-blue-50 text-blue-700', amber: 'bg-amber-50 text-amber-700', rose: 'bg-rose-50 text-rose-700', slate: 'bg-slate-100 text-slate-600' }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${colors[tone]}`}>{children}</span>
}

export function Feedback({ tone, children }: { tone: 'success' | 'error' | 'info'; children: ReactNode }) {
  const styles = { success: 'border-emerald-100 bg-emerald-50 text-emerald-700', error: 'border-rose-100 bg-rose-50 text-rose-700', info: 'border-blue-100 bg-blue-50 text-blue-700' }
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'error' ? AlertCircle : Info
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs leading-5 ${styles[tone]}`}><Icon size={15} className="mt-0.5 shrink-0"/>{children}</div>
}

export const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#182238] px-4 py-2.5 text-xs font-medium text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#23304b] active:translate-y-px disabled:pointer-events-none disabled:opacity-45'
export const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-600 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 active:translate-y-px disabled:pointer-events-none disabled:opacity-45'
export const dangerButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-xs font-medium text-rose-600 transition duration-200 hover:bg-rose-50 active:translate-y-px disabled:pointer-events-none disabled:opacity-45'

export function formatDate(value: Date | string | null | undefined, includeTime = false) {
  if (!value) return '无限期'
  return new Intl.DateTimeFormat('zh-CN', includeTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(new Date(value))
}

export function formatLimit(value: number, suffix = '次') { return value === -1 ? '无限制' : `${value.toLocaleString('zh-CN')} ${suffix}` }
