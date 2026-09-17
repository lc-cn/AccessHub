'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GitBranch, HeartHandshake, KeyRound, Link2, ShieldCheck, Unlink } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { requestJson } from '@/lib/http-client'
import { Feedback, Status, dangerButton, formatDate, primaryButton, secondaryButton } from './ui'

type Identity = { id: string; provider: string; hasPassword: boolean; createdAt: Date }
type FeedbackState = { tone: 'success' | 'error' | 'info'; text: string } | null
const providers = {
  profilehub: { label: 'ProfileHub', description: '使用统一身份登录，账号权限仍由 AccessHub 独立管理。', icon: ShieldCheck },
  github: { label: 'GitHub', description: '用于登录 AccessHub，不会读取仓库内容。', icon: GitBranch },
  afdian: { label: '爱发电', description: '识别你的购买订单，并允许使用爱发电身份登录。', icon: HeartHandshake },
  credential: { label: '邮箱密码', description: '使用已验证的主邮箱和密码登录。', icon: KeyRound },
} as const

export function ConnectionsList({ identities, profileHubAvailable, afdianAvailable }: { identities: Identity[]; profileHubAvailable: boolean; afdianAvailable: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState('')
  const [confirming, setConfirming] = useState<Identity | null>(null)
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const byProvider = new Map(identities.map((item) => [item.provider, item]))

  const link = async (provider: 'profilehub' | 'github' | 'afdian') => {
    setPending(provider); setFeedback({ tone: 'info', text: `正在前往 ${providers[provider].label} 确认绑定…` })
    try {
      const result = await authClient.linkSocial({ provider, callbackURL: '/account/connections' })
      if (result?.error) throw new Error(result.error.message || '开始绑定失败。')
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : '开始绑定失败。' })
      setPending('')
    }
  }
  const unlink = async (identity: Identity) => {
    setPending(identity.id); setFeedback(null)
    try {
      await requestJson(`/api/account/identities/${encodeURIComponent(identity.id)}`, { method: 'DELETE' })
      setFeedback({ tone: 'success', text: `${providers[identity.provider as keyof typeof providers]?.label || '登录方式'}绑定已解除。` })
      setConfirming(null); router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : '解除绑定失败。'
      if (message.includes('近期')) { window.location.assign('/reauthenticate?next=/account/connections'); return }
      setFeedback({ tone: 'error', text: message })
    } finally { setPending('') }
  }

  return <div className="space-y-4">{feedback && <Feedback tone={feedback.tone}>{feedback.text}</Feedback>}{(['profilehub', 'github', 'afdian', 'credential'] as const).map((provider) => {
    const meta = providers[provider]
    const Icon = meta.icon
    const identity = byProvider.get(provider)
    const unavailable = (provider === 'profilehub' && !profileHubAvailable) || (provider === 'afdian' && !afdianAvailable)
    const lastIdentity = identities.length <= 1
    const isConfirming = confirming?.id === identity?.id
    return <article key={provider} className={`rounded-2xl border p-4 transition duration-200 ${identity ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50/60'}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center"><span className={`grid size-11 shrink-0 place-items-center rounded-xl ${identity ? 'bg-[#edf2ff] text-[#3157d5]' : 'bg-white text-slate-400 ring-1 ring-slate-200'}`}><Icon size={19} strokeWidth={1.8}/></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="text-sm font-semibold">{meta.label}</h3><Status tone={identity ? 'green' : unavailable ? 'slate' : 'amber'}>{identity ? '已绑定' : unavailable ? '未配置' : '未绑定'}</Status></div><p className="mt-1 text-xs leading-5 text-slate-400">{identity ? `${meta.description} · 绑定于 ${formatDate(identity.createdAt)}` : meta.description}</p></div>{identity && provider !== 'credential' ? <button disabled={pending === identity.id || lastIdentity} onClick={() => setConfirming(identity)} title={lastIdentity ? '这是最后一种登录方式，无法解除' : undefined} className={secondaryButton}><Unlink size={14}/>解除绑定</button> : !identity && provider === 'credential' ? <Link href="/account/security" className={primaryButton}><KeyRound size={14}/>去绑定</Link> : !identity ? <button disabled={pending === provider || unavailable} onClick={() => { if (provider !== 'credential') void link(provider) }} className={primaryButton}><Link2 size={14}/>{unavailable ? '暂不可用' : pending === provider ? '跳转中…' : '去绑定'}</button> : <Link href="/account/security" className={secondaryButton}><KeyRound size={14}/>管理</Link>}</div>
      {isConfirming && identity && <div className="mt-4 flex flex-col gap-3 rounded-xl border border-rose-100 bg-rose-50/70 p-4 sm:flex-row sm:items-center"><p className="flex-1 text-xs leading-5 text-rose-700">解除后不能再使用 {meta.label} 登录。已有订单和权益不会被删除。</p><div className="flex gap-2"><button onClick={() => setConfirming(null)} className={secondaryButton}>取消</button><button disabled={pending === identity.id} onClick={() => void unlink(identity)} className={dangerButton}>{pending === identity.id ? '正在解除…' : '确认解除'}</button></div></div>}
    </article>
  })}</div>
}
