'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

export function ResetPasswordForm() {
  const params = useSearchParams()
  const token = params.get('token') || ''
  const invalid = params.get('error') === 'INVALID_TOKEN' || !token
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState(invalid ? '链接无效或已过期，请重新申请。' : '')
  const [done, setDone] = useState(false)
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (password !== confirm) return setMessage('两次输入的密码不一致。'); const result = await authClient.resetPassword({ newPassword: password, token }); if (result.error) return setMessage(result.error.message || '密码设置失败。'); setDone(true); setMessage('密码已更新，现在可以返回登录。') }
  return <form onSubmit={(event) => void submit(event)} className="space-y-4">{!done && !invalid && <><input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="新密码（至少 8 位）" className="access-input w-full"/><input type="password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="再次输入新密码" className="access-input w-full"/><button className="h-11 w-full rounded-xl bg-[#182238] text-sm font-medium text-white">保存新密码</button></>}{message && <p role="status" className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">{message}</p>}<Link href={done ? '/login' : '/account/security'} className="block text-center text-xs font-medium text-[#3157d5]">{done ? '返回登录' : '返回账户安全'}</Link></form>
}
