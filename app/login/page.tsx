'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Activity, ArrowRight, GitBranch, HeartHandshake, KeyRound, TicketCheck, Zap } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

export default function LoginPage() {
  const [pending, setPending] = useState<'github' | 'afdian' | 'email' | 'forgot' | null>(null)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const signIn = async (provider: 'github' | 'afdian') => {
    setPending(provider)
    setError('')
    const next = new URLSearchParams(window.location.search).get('next')
    const callbackURL = next?.startsWith('/') && !next.startsWith('//') ? next : '/'
    const result = await authClient.signIn.social({ provider, callbackURL })
    if (result?.error) {
      setError(provider === 'afdian' ? '爱发电登录暂时不可用；首次使用请先通过 GitHub 登录并绑定。' : 'GitHub 登录暂时不可用，请稍后重试。')
      setPending(null)
    }
  }

  const signInWithEmail = async (event: React.FormEvent) => {
    event.preventDefault(); setPending('email'); setError('')
    const next = new URLSearchParams(window.location.search).get('next')
    const callbackURL = next?.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
    const result = await authClient.signIn.email({ email, password, callbackURL })
    if (result.error) { setError('邮箱或密码不正确，或邮箱尚未完成验证。'); setPending(null) }
  }

  const forgotPassword = async () => {
    if (!email) return setError('请先输入要找回的邮箱。')
    setPending('forgot'); setError('')
    const result = await authClient.requestPasswordReset({ email, redirectTo: '/reset-password' })
    setPending(null)
    setError(result.error ? '暂时无法发送重置邮件，请稍后重试。' : '如果该邮箱已注册，重置邮件已经发送。')
  }

  return <main className="grid min-h-dvh bg-[#f3f6fb] lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,.95fr)]">
    <section className="relative hidden overflow-hidden bg-[#182238] p-12 text-white lg:flex lg:flex-col xl:p-16"><div className="absolute -left-32 top-1/4 size-96 rounded-full bg-[#3157d5]/25 blur-3xl"/><div className="relative flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#3157d5]"><Zap size={18} fill="currentColor"/></span><span><strong className="block font-semibold">AccessHub</strong><span className="text-[10px] tracking-[.15em] text-slate-400">API ACCESS CONTROL</span></span></div><div className="relative my-auto max-w-xl"><p className="text-xs font-medium tracking-[.16em] text-[#91a7f3]">ACCESS BY POLICY</p><h1 className="mt-5 text-5xl font-semibold leading-[1.08] tracking-[-.045em] xl:text-6xl">清楚地知道<br/>每一次调用的边界。</h1><p className="mt-6 max-w-md text-sm leading-7 text-slate-300">登录后查看分钟、每日、每周与每月配额，在需要时通过兑换码升级访问权益。</p><div className="mt-12 grid grid-cols-3 gap-3"><Feature icon={<Activity size={17}/>} label="周期用量"/><Feature icon={<KeyRound size={17}/>} label="身份凭据"/><Feature icon={<TicketCheck size={17}/>} label="权益兑换"/></div></div><p className="relative text-xs text-slate-500">AccessHub 使用 GitHub 验证账户身份</p></section>

    <section className="flex items-center justify-center px-6 py-12 sm:px-12"><div className="w-full max-w-md"><div className="mb-12 flex items-center gap-3 lg:hidden"><span className="grid size-10 place-items-center rounded-xl bg-[#3157d5] text-white"><Zap size={18} fill="currentColor"/></span><strong>AccessHub</strong></div><p className="text-xs font-medium tracking-wide text-[#3157d5]">欢迎回来</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.035em]">登录访问控制台</h2><p className="mt-3 text-sm leading-6 text-slate-500">首次使用请通过 GitHub 创建账户；绑定爱发电后，也可以直接使用爱发电登录。</p><div className="mt-9 space-y-3"><button onClick={() => void signIn('github')} disabled={pending !== null} className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#182238] text-sm font-medium text-white shadow-[0_16px_36px_rgba(24,34,56,.16)] transition hover:-translate-y-0.5 hover:bg-slate-800 active:translate-y-px disabled:opacity-60"><GitBranch size={18}/>{pending === 'github' ? '正在前往 GitHub…' : '使用 GitHub 登录'}<ArrowRight size={15}/></button><button onClick={() => void signIn('afdian')} disabled={pending !== null} className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 active:translate-y-px disabled:opacity-60"><HeartHandshake size={18}/>{pending === 'afdian' ? '正在前往爱发电…' : '使用爱发电登录'}<ArrowRight size={15}/></button></div><div className="my-6 flex items-center gap-3 text-[11px] text-slate-400"><span className="h-px flex-1 bg-slate-200"/>或使用邮箱密码<span className="h-px flex-1 bg-slate-200"/></div><form onSubmit={(event) => void signInWithEmail(event)} className="space-y-3"><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="邮箱" className="access-input h-12 w-full"/><input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="密码" className="access-input h-12 w-full"/><button disabled={pending !== null} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"><KeyRound size={17}/>{pending === 'email' ? '正在登录…' : '使用邮箱登录'}</button><button type="button" disabled={pending !== null} onClick={() => void forgotPassword()} className="w-full text-center text-xs text-slate-400 hover:text-[#3157d5]">{pending === 'forgot' ? '正在发送重置邮件…' : '忘记密码？'}</button></form>{error && <p className={`mt-4 rounded-xl px-4 py-3 text-xs ${error.includes('已经发送') ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-600'}`}>{error}</p>}<div className="mt-10 border-t border-slate-200 pt-6"><p className="text-xs leading-5 text-slate-400">继续即表示你同意完成身份验证，并同意<Link href="/terms" className="mx-1 font-medium text-slate-600 underline underline-offset-2 hover:text-[#3157d5]">服务条款</Link>、已阅读<Link href="/privacy" className="ml-1 font-medium text-slate-600 underline underline-offset-2 hover:text-[#3157d5]">隐私政策</Link>。AccessHub 不会读取你的仓库内容。</p></div></div></section>
  </main>
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) { return <div className="rounded-xl bg-white/[0.06] p-4"><span className="text-[#91a7f3]">{icon}</span><p className="mt-3 text-xs text-slate-300">{label}</p></div> }
