'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw, Save } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { Feedback, primaryButton, secondaryButton } from './ui'

type FeedbackState = { tone: 'success' | 'error'; text: string } | null

export function ProfileForm({ initialName, initialImage }: { initialName: string; initialImage: string }) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [image, setImage] = useState(initialImage)
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [pending, setPending] = useState(false)
  const dirty = name.trim() !== initialName || image.trim() !== initialImage
  const preview = useMemo(() => image.trim(), [image])

  const reset = () => { setName(initialName); setImage(initialImage); setFeedback(null) }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (image.trim()) {
      try { const url = new URL(image.trim()); if (!['http:', 'https:'].includes(url.protocol)) throw new Error() }
      catch { return setFeedback({ tone: 'error', text: '头像地址必须是有效的 HTTP(S) URL。' }) }
    }
    setPending(true)
    setFeedback(null)
    const result = await authClient.updateUser({ name: name.trim(), image: image.trim() || null })
    setPending(false)
    if (result.error) return setFeedback({ tone: 'error', text: result.error.message || '保存失败，请稍后重试。' })
    setFeedback({ tone: 'success', text: '个人资料已更新。' })
    router.refresh()
  }

  return <form onSubmit={(event) => void submit(event)} className="space-y-6">
    <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4"><span className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white text-xl font-semibold text-slate-500 ring-1 ring-slate-200">{name.trim().slice(0, 1).toUpperCase() || '?'}{preview && <img src={preview} alt="新头像预览" onError={(event) => { event.currentTarget.style.display = 'none' }} className="absolute inset-0 size-full object-cover"/>}</span><div><p className="text-sm font-medium text-slate-700">头像预览</p><p className="mt-1 text-xs leading-5 text-slate-400">建议使用正方形图片，至少 160 × 160 像素。</p></div></div>
    <label className="block"><span className="flex items-center justify-between text-xs font-medium text-slate-600"><span>显示名称</span><span className="font-normal tabular-nums text-slate-400">{name.length}/64</span></span><input required minLength={1} maxLength={64} autoComplete="name" value={name} onChange={(event) => { setName(event.target.value); setFeedback(null) }} className="access-input mt-2"/></label>
    <label className="block"><span className="text-xs font-medium text-slate-600">头像 URL</span><input type="url" inputMode="url" value={image} onChange={(event) => { setImage(event.target.value); setFeedback(null) }} placeholder="https://example.com/avatar.png" className="access-input mt-2"/><span className="mt-2 block text-[11px] leading-5 text-slate-400">仅支持 HTTP(S) 图片地址。留空后使用名称首字母。</span></label>
    {feedback && <Feedback tone={feedback.tone}>{feedback.text}</Feedback>}
    <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5"><button disabled={pending || !dirty || !name.trim()} className={primaryButton}><Save size={14}/>{pending ? '正在保存…' : dirty ? '保存资料' : '已保存'}</button><button type="button" disabled={pending || !dirty} onClick={reset} className={secondaryButton}><RotateCcw size={14}/>撤销修改</button></div>
  </form>
}
