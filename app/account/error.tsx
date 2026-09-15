'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { PageIntro, Panel, primaryButton } from '@/components/account/ui'

export default function AccountError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <><PageIntro eyebrow="ACCOUNT" title="暂时无法读取账户信息" description="你的登录状态仍然保留。可以重新加载；若问题持续，请返回控制台后再试。"/><Panel className="max-w-xl"><div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600"><AlertTriangle size={19}/></span><div><p className="text-sm font-medium text-slate-700">账户数据加载失败</p><p className="mt-1 text-xs leading-5 text-slate-400">系统没有修改你的资料、权益或安全设置。</p><button onClick={reset} className={`${primaryButton} mt-5`}><RefreshCw size={14}/>重新加载</button></div></div></Panel></>
}
