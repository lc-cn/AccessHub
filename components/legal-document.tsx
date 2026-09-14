import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeft, ShieldCheck, Zap } from 'lucide-react'

export type LegalSection = {
  id: string
  title: string
  content: ReactNode
}

export function LegalDocument({ eyebrow, title, summary, sections }: {
  eyebrow: string
  title: string
  summary: string
  sections: LegalSection[]
}) {
  return <main className="min-h-dvh bg-[#f3f6fb] text-slate-800">
    <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 lg:px-8">
        <Link href="/login" className="flex items-center gap-3" aria-label="返回 AccessHub">
          <span className="grid size-9 place-items-center rounded-xl bg-[#3157d5] text-white"><Zap size={16} fill="currentColor"/></span>
          <span><strong className="block text-sm font-semibold text-slate-900">AccessHub</strong><span className="block text-[9px] tracking-[.15em] text-slate-400">L2CL API ACCESS</span></span>
        </Link>
        <Link href="/login" className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-[#3157d5]"><ArrowLeft size={14}/>返回登录</Link>
      </div>
    </header>

    <div className="mx-auto max-w-6xl px-6 py-12 lg:px-8 lg:py-16">
      <section className="overflow-hidden rounded-[28px] bg-[#182238] px-7 py-10 text-white shadow-[0_24px_70px_rgba(24,34,56,.14)] sm:px-10 lg:px-12">
        <div className="flex items-center gap-2 text-xs font-medium tracking-[.16em] text-[#9eb1f5]"><ShieldCheck size={15}/>{eyebrow}</div>
        <h1 className="mt-5 text-3xl font-semibold tracking-[-.04em] sm:text-5xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300">{summary}</p>
        <p className="mt-8 text-xs text-slate-500">生效日期：2026 年 9 月 14 日 · 最近更新：2026 年 9 月 14 日</p>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="h-fit rounded-[20px] bg-white p-5 shadow-[0_14px_40px_rgba(39,55,92,.05)] lg:sticky lg:top-6">
          <p className="text-[11px] font-medium tracking-[.12em] text-[#3157d5]">目录</p>
          <nav className="mt-4 space-y-1" aria-label={`${title}目录`}>
            {sections.map((section, index) => <a key={section.id} href={`#${section.id}`} className="flex gap-3 rounded-lg px-2 py-2 text-xs leading-5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"><span className="font-mono text-slate-300">{String(index + 1).padStart(2, '0')}</span>{section.title}</a>)}
          </nav>
        </aside>

        <article className="rounded-[24px] bg-white px-6 py-3 shadow-[0_14px_40px_rgba(39,55,92,.05)] sm:px-9">
          {sections.map((section) => <section key={section.id} id={section.id} className="scroll-mt-8 border-b border-slate-100 py-8 last:border-0">
            <h2 className="text-lg font-semibold tracking-[-.02em] text-slate-900">{section.title}</h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600 [&_a]:font-medium [&_a]:text-[#3157d5] [&_a]:underline-offset-4 hover:[&_a]:underline [&_li]:pl-1 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-2">{section.content}</div>
          </section>)}
        </article>
      </div>

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-6 text-xs text-slate-400">
        <span>© 2026 L2CL AccessHub</span>
        <div className="flex gap-5"><Link href="/privacy" className="hover:text-slate-700">隐私政策</Link><Link href="/terms" className="hover:text-slate-700">服务条款</Link><a href="https://afdian.com/a/lc-cn" target="_blank" rel="noreferrer" className="hover:text-slate-700">联系运营者</a></div>
      </footer>
    </div>
  </main>
}
