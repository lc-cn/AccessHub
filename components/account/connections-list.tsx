'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GitBranch, HeartHandshake, KeyRound, Link2 } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { requestJson } from '@/lib/http-client'
import { Status, formatDate } from './ui'

type Identity = { id: string; provider: string; hasPassword: boolean; createdAt: Date }
const providers = {
  github: { label: 'GitHub', description: '用于登录 AccessHub，不会读取仓库内容。', icon: GitBranch },
  afdian: { label: '爱发电', description: '购买后自动识别订单，并可直接登录。', icon: HeartHandshake },
  credential: { label: '邮箱密码', description: '使用主邮箱和密码登录。', icon: KeyRound },
} as const

export function ConnectionsList({ identities, afdianAvailable }: { identities: Identity[]; afdianAvailable: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState('')
  const [message, setMessage] = useState('')
  const byProvider = new Map(identities.map((item) => [item.provider, item]))
  const link = async (provider: 'github' | 'afdian') => { setPending(provider); setMessage(''); const result = await authClient.linkSocial({ provider, callbackURL: '/account/connections' }); if (result?.error) { setMessage(result.error.message || '开始绑定失败。'); setPending('') } }
  const unlink = async (identity: Identity) => { setPending(identity.id); setMessage(''); try { await requestJson(`/api/account/identities/${encodeURIComponent(identity.id)}`, { method: 'DELETE' }); setMessage('绑定已解除。'); router.refresh() } catch (error) { setMessage(error instanceof Error ? error.message : '解除绑定失败。') } finally { setPending('') } }
  return <div className="space-y-3">{message && <div role="status" className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">{message}</div>}{(['github', 'afdian', 'credential'] as const).map((provider) => { const meta = providers[provider]; const Icon = meta.icon; const identity = byProvider.get(provider); const unavailable = provider === 'afdian' && !afdianAvailable; return <div key={provider} className="flex flex-col gap-4 rounded-2xl border border-slate-100 p-4 sm:flex-row sm:items-center"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-600"><Icon size={19}/></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-sm font-semibold">{meta.label}</p><Status tone={identity ? 'green' : unavailable ? 'slate' : 'amber'}>{identity ? '已绑定' : unavailable ? '暂不可用' : '未绑定'}</Status></div><p className="mt-1 text-xs leading-5 text-slate-400">{identity ? `绑定于 ${formatDate(identity.createdAt)}` : meta.description}</p></div>{identity && provider !== 'credential' ? <button disabled={pending === identity.id || identities.length <= 1} onClick={() => void unlink(identity)} title={identities.length <= 1 ? '至少保留一种登录方式' : undefined} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">{pending === identity.id ? '处理中…' : '解除绑定'}</button> : !identity && provider !== 'credential' ? <button disabled={pending === provider || unavailable} onClick={() => void link(provider)} className="rounded-xl bg-[#182238] px-4 py-2.5 text-xs font-medium text-white disabled:opacity-40">{pending === provider ? '跳转中…' : <span className="inline-flex items-center gap-1.5"><Link2 size={13}/>立即绑定</span>}</button> : <span className="text-xs text-slate-400">在“登录与安全”中管理</span>}</div> })}</div>
}
