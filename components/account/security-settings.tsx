'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Laptop, MailCheck, MonitorX, Send, X } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { requestJson } from '@/lib/http-client'
import { Feedback, Panel, Status, dangerButton, formatDate, primaryButton, secondaryButton } from './ui'

type SessionItem = { id: string; createdAt: Date; updatedAt: Date; expiresAt: Date; ipAddress: string | null; userAgent: string | null; current: boolean }
type FeedbackState = { tone: 'success' | 'error' | 'info'; text: string } | null

export function SecuritySettings({ email, emailVerified, hasCredential, sessions }: { email: string; emailVerified: boolean; hasCredential: boolean; sessions: SessionItem[] }) {
  const router = useRouter()
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [pending, setPending] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [confirmSession, setConfirmSession] = useState<string | 'all' | null>(null)
  const run = async (key: string, task: () => Promise<void>, success: string) => {
    setPending(key); setFeedback(null)
    try { await task(); setFeedback({ tone: 'success', text: success }); setConfirmSession(null); router.refresh() }
    catch (error) { const message = error instanceof Error ? error.message : '操作失败，请稍后重试。'; setFeedback({ tone: 'error', text: message.includes('近期') ? `${message} 请退出后重新登录。` : message }) }
    finally { setPending('') }
  }
  const verify = () => run('verify', async () => { const result = await authClient.sendVerificationEmail({ email, callbackURL: '/account/security' }); if (result.error) throw new Error(result.error.message) }, '验证邮件已发送，请检查收件箱。')
  const reset = () => run('reset', async () => { const result = await authClient.requestPasswordReset({ email, redirectTo: '/reset-password' }); if (result.error) throw new Error(result.error.message) }, '密码设置邮件已发送。打开邮件中的链接即可继续。')
  const changeEmail = () => run('email', async () => { const result = await authClient.changeEmail({ newEmail: newEmail.trim(), callbackURL: '/account/security' }); if (result.error) throw new Error(result.error.message) }, '确认邮件已发送。完成验证前，仍使用原邮箱登录。')
  const revoke = (id: string) => run(`session:${id}`, async () => { await requestJson(`/api/account/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }) }, '该设备会话已结束。')
  const revokeOthers = () => run('others', async () => { await requestJson('/api/account/sessions/revoke-others', { method: 'POST' }) }, '其他设备会话已全部结束。')

  return <div className="space-y-6">
    {feedback && <Feedback tone={feedback.tone}>{feedback.text}</Feedback>}
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Panel title="主要邮箱" description="用于登录、安全通知和找回账户。"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#edf2ff] text-[#3157d5]"><MailCheck size={18}/></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{email}</p><div className="mt-2"><Status tone={emailVerified ? 'green' : 'amber'}>{emailVerified ? '已验证' : '等待验证'}</Status></div></div>{!emailVerified && <button disabled={pending === 'verify'} onClick={verify} className={secondaryButton}><Send size={13}/>{pending === 'verify' ? '发送中…' : '重新发送'}</button>}</div>{emailVerified ? <form onSubmit={(event) => { event.preventDefault(); void changeEmail() }} className="mt-5 border-t border-slate-100 pt-5"><label className="text-xs font-medium text-slate-600" htmlFor="new-email">更换主要邮箱</label><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input id="new-email" type="email" required autoComplete="email" value={newEmail} onChange={(event) => { setNewEmail(event.target.value); setFeedback(null) }} placeholder="name@example.com" className="access-input min-w-0 flex-1"/><button disabled={pending === 'email' || !newEmail.trim() || newEmail.trim().toLowerCase() === email.toLowerCase()} className={secondaryButton}>{pending === 'email' ? '提交中…' : '发送确认'}</button></div><p className="mt-2 text-[11px] leading-5 text-slate-400">我们会先验证这次变更，权益和订单始终留在当前账户。</p></form> : <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-700">验证当前邮箱后，才能更换邮箱或创建密码。</p>}</Panel>
      <Panel title={hasCredential ? '账户密码' : '创建密码'} description={hasCredential ? '需要修改密码时，我们会向已验证邮箱发送一次性链接。' : '增加一种不依赖 OAuth 的备用登录方式。'}><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-600"><KeyRound size={18}/></span><div className="min-w-0 flex-1"><p className="text-sm font-medium">{hasCredential ? '密码登录已启用' : '尚未设置密码'}</p><p className="mt-1 text-xs leading-5 text-slate-400">密码只由认证服务验证，页面无法读取。</p></div><Status tone={hasCredential ? 'green' : 'slate'}>{hasCredential ? '已设置' : '未设置'}</Status></div><button disabled={pending === 'reset' || !emailVerified} onClick={reset} className={`${primaryButton} mt-6 w-full sm:w-auto`}><KeyRound size={14}/>{pending === 'reset' ? '正在发送…' : hasCredential ? '发送重设链接' : '发送设置链接'}</button>{!emailVerified && <p className="mt-3 text-[11px] text-amber-600">请先完成邮箱验证。</p>}</Panel>
    </div>
    <Panel title="登录设备" description="会话到期后自动失效。发现陌生设备时，先结束会话，再重设密码。"><div className="divide-y divide-slate-100">{sessions.map((item) => <div key={item.id} className="py-4 first:pt-0 last:pb-0"><div className="flex items-center gap-4"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${item.current ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-500'}`}><Laptop size={18}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{deviceName(item.userAgent)}</p>{item.current && <Status tone="green">当前设备</Status>}</div><p className="mt-1 truncate text-[11px] text-slate-400">{browserName(item.userAgent)} · {item.ipAddress || 'IP 未记录'}</p><p className="mt-1 text-[11px] tabular-nums text-slate-400">最近活动 {formatDate(item.updatedAt, true)} · {formatDate(item.expiresAt, true)} 到期</p></div>{!item.current && <button disabled={pending === `session:${item.id}`} onClick={() => setConfirmSession(item.id)} className="rounded-lg px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50 active:translate-y-px"><MonitorX size={14} className="mr-1.5 inline"/>结束</button>}</div>{confirmSession === item.id && <Confirm text="结束后，这台设备需要重新登录。" pending={pending === `session:${item.id}`} onCancel={() => setConfirmSession(null)} onConfirm={() => void revoke(item.id)}/>}</div>)}</div>{sessions.length > 1 && <div className="mt-5 border-t border-slate-100 pt-5">{confirmSession === 'all' ? <Confirm text={`确认结束另外 ${sessions.length - 1} 个设备的会话？当前设备不受影响。`} pending={pending === 'others'} onCancel={() => setConfirmSession(null)} onConfirm={() => void revokeOthers()}/> : <button onClick={() => setConfirmSession('all')} className={dangerButton}><MonitorX size={14}/>结束其他所有会话</button>}</div>}</Panel>
  </div>
}

function Confirm({ text, pending, onCancel, onConfirm }: { text: string; pending: boolean; onCancel: () => void; onConfirm: () => void }) { return <div className="mt-4 flex flex-col gap-3 rounded-xl border border-rose-100 bg-rose-50/70 p-4 sm:flex-row sm:items-center"><p className="flex-1 text-xs leading-5 text-rose-700">{text}</p><div className="flex gap-2"><button disabled={pending} onClick={onCancel} className={secondaryButton}><X size={13}/>取消</button><button disabled={pending} onClick={onConfirm} className={dangerButton}>{pending ? '处理中…' : '确认结束'}</button></div></div> }
function deviceName(userAgent: string | null) { if (!userAgent) return '未知设备'; if (/iPhone|iPad/i.test(userAgent)) return 'iPhone / iPad'; if (/Android/i.test(userAgent)) return 'Android 设备'; if (/Macintosh/i.test(userAgent)) return 'Mac'; if (/Windows/i.test(userAgent)) return 'Windows 设备'; if (/Linux/i.test(userAgent)) return 'Linux 设备'; return '浏览器设备' }
function browserName(userAgent: string | null) { if (!userAgent) return '浏览器未知'; if (/Edg\//.test(userAgent)) return 'Microsoft Edge'; if (/Chrome\//.test(userAgent)) return 'Google Chrome'; if (/Firefox\//.test(userAgent)) return 'Firefox'; if (/Safari\//.test(userAgent)) return 'Safari'; return '浏览器未知' }
