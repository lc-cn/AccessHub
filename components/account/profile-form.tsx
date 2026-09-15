'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

export function ProfileForm({ initialName, initialImage }: { initialName: string; initialImage: string }) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [image, setImage] = useState(initialImage)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setPending(true); setMessage('')
    const result = await authClient.updateUser({ name: name.trim(), image: image.trim() || null })
    setPending(false)
    if (result.error) return setMessage(result.error.message || '保存失败，请稍后重试。')
    setMessage('个人资料已更新。'); router.refresh()
  }
  return <form onSubmit={(event) => void submit(event)} className="space-y-5"><label className="block"><span className="text-xs font-medium text-slate-600">显示名称</span><input required minLength={1} maxLength={64} value={name} onChange={(event) => setName(event.target.value)} className="access-input mt-2 w-full"/></label><label className="block"><span className="text-xs font-medium text-slate-600">头像 URL</span><input type="url" value={image} onChange={(event) => setImage(event.target.value)} placeholder="https://example.com/avatar.png" className="access-input mt-2 w-full"/><span className="mt-2 block text-[11px] text-slate-400">留空会继续使用名称首字母作为头像。</span></label><div className="flex items-center gap-3"><button disabled={pending || !name.trim()} className="rounded-xl bg-[#182238] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50">{pending ? '保存中…' : '保存资料'}</button>{message && <p role="status" className="text-xs text-slate-500">{message}</p>}</div></form>
}
