'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { Feedback, primaryButton } from './ui'

export function ResetPasswordForm() {
  const params = useSearchParams()
  const token = params.get('token') || ''
  const invalid = params.get('error') === 'INVALID_TOKEN' || !token
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [visible, setVisible] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState(invalid ? '链接无效或已过期，请重新申请。' : '')
  const [done, setDone] = useState(false)
  const strength = useMemo(() => [password.length >= 8, /[A-Z]/i.test(password), /\d/.test(password), /[^\w]/.test(password)].filter(Boolean).length, [password])
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (password !== confirm) return setMessage('两次输入的密码不一致。'); setPending(true); setMessage(''); const result = await authClient.resetPassword({ newPassword: password, token }); setPending(false); if (result.error) return setMessage(result.error.message || '密码设置失败。'); setDone(true); setMessage('密码已更新，其他设备的登录会话已经失效。') }
  return <form onSubmit={(event) => void submit(event)} className="space-y-4">{!done && !invalid && <><label className="block"><span className="text-xs font-medium text-slate-600">新密码</span><div className="relative mt-2"><input type={visible ? 'text' : 'password'} minLength={8} required autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); setMessage('') }} placeholder="至少 8 位" className="access-input pr-11"/><button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? '隐藏密码' : '显示密码'} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-50">{visible ? <EyeOff size={15}/> : <Eye size={15}/>}</button></div><div className="mt-2 grid grid-cols-4 gap-1">{[1, 2, 3, 4].map((item) => <span key={item} className={`h-1 rounded-full ${strength >= item ? 'bg-[#3157d5]' : 'bg-slate-100'}`}/>)}</div><p className="mt-2 text-[11px] text-slate-400">建议同时包含字母、数字和符号。</p></label><label className="block"><span className="text-xs font-medium text-slate-600">确认新密码</span><input type={visible ? 'text' : 'password'} minLength={8} required autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setMessage('') }} placeholder="再次输入" className="access-input mt-2"/></label><button disabled={pending || password !== confirm} className={`${primaryButton} h-11 w-full`}><KeyRound size={15}/>{pending ? '正在保存…' : '保存新密码'}</button></>}{message && <Feedback tone={done ? 'success' : 'error'}>{message}</Feedback>}<Link href={done || invalid ? '/login' : '/account/security'} className="block text-center text-xs font-medium text-[#3157d5] hover:text-[#2446bb]">{done || invalid ? '返回登录' : '返回账户安全'}</Link></form>
}
