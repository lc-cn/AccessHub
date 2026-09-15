'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, TicketCheck } from 'lucide-react'
import { primaryButton, secondaryButton } from './ui'

export function OrderCodeActions({ code }: { code: string }) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle')
  const copy = async () => { try { await navigator.clipboard.writeText(code); setState('copied'); window.setTimeout(() => setState('idle'), 1800) } catch { setState('error') } }
  const redeem = () => { sessionStorage.setItem('accesshub:pending-redeem-code', code); router.push('/redeem-codes') }
  return <div className="flex flex-wrap gap-2"><button onClick={() => void copy()} className={secondaryButton}>{state === 'copied' ? <Check size={13}/> : <Copy size={13}/>} {state === 'copied' ? '已复制' : state === 'error' ? '复制失败' : '复制兑换码'}</button><button onClick={redeem} className={primaryButton}><TicketCheck size={13}/>立即核销</button></div>
}
