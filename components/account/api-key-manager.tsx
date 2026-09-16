'use client'

import { useMemo, useState } from 'react'
import { Check, Copy, KeyRound, Plus, ShieldCheck, Trash2, X } from 'lucide-react'
import { requestJson } from '@/lib/http-client'
import { EmptyState, Feedback, Panel, Status, dangerButton, formatDate, primaryButton, secondaryButton } from './ui'

export type ApiKeyItem = { id: string; name: string; kind: 'default' | 'custom'; prefix: string; serviceScopes: string[]; expiresAt: Date | string | null; lastUsedAt: Date | string | null; revokedAt: Date | string | null; createdAt: Date | string }
export type ServiceOption = { code: string; name: string }
type CreatedResponse = { apiKey: ApiKeyItem; token: string }

export function ApiKeyManager({ initialKeys, services }: { initialKeys: ApiKeyItem[]; services: ServiceOption[] }) {
  const [keys, setKeys] = useState(initialKeys)
  const [name, setName] = useState('')
  const [expiresInDays, setExpiresInDays] = useState('90')
  const [allServices, setAllServices] = useState(true)
  const [scopes, setScopes] = useState<string[]>([])
  const [pending, setPending] = useState('')
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [revealed, setRevealed] = useState<{ token: string; name: string; copied: boolean } | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null)
  const activeKeys = useMemo(() => keys.filter((item) => !item.revokedAt && (!item.expiresAt || new Date(item.expiresAt) > new Date())), [keys])

  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setPending('create'); setFeedback(null)
    try {
      const result = await requestJson<CreatedResponse>('/api/account/api-keys', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, expiresInDays: Number(expiresInDays), serviceScopes: allServices ? ['*'] : scopes }) })
      setKeys((current) => [result.apiKey, ...current]); setRevealed({ token: result.token, name: result.apiKey.name, copied: false }); setName(''); setScopes([]); setAllServices(true)
    } catch (error) { setFeedback({ tone: 'error', text: error instanceof Error ? error.message : '创建 API Key 失败，请稍后重试。' }) }
    finally { setPending('') }
  }
  const copy = async () => {
    if (!revealed) return
    try { await navigator.clipboard.writeText(revealed.token); setRevealed({ ...revealed, copied: true }) }
    catch { setFeedback({ tone: 'error', text: '复制失败，请手动选择 Key。' }) }
  }
  const revoke = async (id: string) => {
    setPending(`revoke:${id}`); setFeedback(null)
    try {
      const result = await requestJson<{ revokedAt: string }>(`/api/account/api-keys/${encodeURIComponent(id)}`, { method: 'DELETE' })
      setKeys((current) => current.map((item) => item.id === id ? { ...item, revokedAt: result.revokedAt } : item)); setConfirmRevoke(null); setFeedback({ tone: 'success', text: 'API Key 已撤销，后续请求将立即被拒绝。' })
    } catch (error) { setFeedback({ tone: 'error', text: error instanceof Error ? error.message : '撤销 API Key 失败，请稍后重试。' }) }
    finally { setPending('') }
  }
  const toggleScope = (code: string) => setScopes((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code])

  return <div className="space-y-6">
    {revealed && <section role="status" className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-emerald-800"><ShieldCheck size={17}/><h3 className="font-semibold">保存 {revealed.name} 的 API Key</h3></div><p className="mt-2 text-xs leading-5 text-emerald-700">这是唯一一次显示完整 Key。关闭后无法再次查看，只能创建新 Key。</p></div><button type="button" onClick={() => setRevealed(null)} aria-label="关闭 API Key 提示" className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-100"><X size={15}/></button></div><div className="mt-4 flex flex-col gap-2 rounded-xl bg-white p-3 sm:flex-row sm:items-center"><code className="min-w-0 flex-1 break-all text-xs text-slate-700" translate="no">{revealed.token}</code><button type="button" onClick={() => void copy()} className={secondaryButton}>{revealed.copied ? <Check size={14}/> : <Copy size={14}/>} {revealed.copied ? '已复制' : '复制 Key'}</button></div></section>}
    {feedback && <Feedback tone={feedback.tone}>{feedback.text}</Feedback>}
    <div className="grid items-start gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Panel title="创建 API Key" description="建议为每个应用或部署环境创建独立 Key，便于单独撤销。">
        <form onSubmit={(event) => void create(event)} className="space-y-5">
          <label className="block"><span className="mb-2 block text-xs font-medium text-slate-600">名称</span><input name="name" required maxLength={64} autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} className="access-input" placeholder="例如：生产服务器…"/></label>
          <label className="block"><span className="mb-2 block text-xs font-medium text-slate-600">有效期</span><select name="expiresInDays" value={expiresInDays} onChange={(event) => setExpiresInDays(event.target.value)} className="access-input"><option value="30">30 天</option><option value="90">90 天</option><option value="365">1 年</option><option value="-1">永不过期</option></select></label>
          <fieldset><legend className="text-xs font-medium text-slate-600">服务范围</legend><label className="mt-2 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3"><input type="checkbox" checked={allServices} onChange={(event) => { setAllServices(event.target.checked); if (event.target.checked) setScopes([]) }} className="mt-0.5 size-4 accent-[#3157d5]"/><span><strong className="block text-xs font-medium text-slate-700">全部服务</strong><span className="mt-1 block text-[11px] leading-4 text-slate-400">也包含以后新增并发布的服务</span></span></label>{!allServices && <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl bg-slate-50 p-2">{services.length ? services.map((service) => <label key={service.code} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-white"><input type="checkbox" checked={scopes.includes(service.code)} onChange={() => toggleScope(service.code)} className="size-4 accent-[#3157d5]"/><span className="min-w-0 flex-1 truncate text-xs text-slate-600">{service.name}</span><code className="text-[10px] text-slate-400" translate="no">{service.code}</code></label>) : <p className="px-2 py-4 text-center text-xs text-slate-400">暂无已启用服务</p>}</div>} {!allServices && <button type="button" onClick={() => setAllServices(true)} className="mt-2 text-[11px] text-[#3157d5]">改为全部服务</button>}</fieldset>
          <button disabled={pending === 'create' || !name.trim() || (!allServices && scopes.length === 0)} className={`${primaryButton} w-full`}><Plus size={14}/>{pending === 'create' ? '创建中…' : '创建 API Key'}</button>
          <p className="text-[11px] leading-5 text-slate-400">创建凭据属于敏感操作，需要最近 15 分钟内完成登录。</p>
        </form>
      </Panel>
      <Panel title="现有 API Keys" description={`${activeKeys.length} 个有效凭据。自定义 Key 仅在创建时显示；默认 Key 由 Test Console 安全使用。`}>
        {keys.length === 0 ? <EmptyState><KeyRound size={20} className="mx-auto mb-3"/>还没有 API Key</EmptyState> : <div className="divide-y divide-slate-100">{keys.map((item) => { const revoked = Boolean(item.revokedAt); const expired = !revoked && item.expiresAt && new Date(item.expiresAt) <= new Date(); return <article key={item.id} className="py-4 first:pt-0 last:pb-0"><div className="flex items-start gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${revoked || expired ? 'bg-slate-100 text-slate-400' : 'bg-[#edf2ff] text-[#3157d5]'}`}><KeyRound size={17}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="truncate text-sm font-medium text-slate-700">{item.name}</h4>{item.kind === 'default' && <Status tone="blue">系统默认</Status>}<Status tone={revoked || expired ? 'slate' : 'green'}>{revoked ? '已撤销' : expired ? '已过期' : '有效'}</Status></div><code className="mt-1.5 block text-[11px] text-slate-500" translate="no">{item.prefix}</code><p className="mt-2 text-[11px] leading-5 text-slate-400">范围：{item.serviceScopes.includes('*') ? '全部服务' : item.serviceScopes.join('、')} · {item.expiresAt ? `${formatDate(item.expiresAt)} 到期` : '永不过期'}</p><p className="text-[11px] text-slate-400">{item.lastUsedAt ? `最近使用 ${formatDate(item.lastUsedAt, true)}` : item.kind === 'default' ? '由 Test Console 自动使用' : `创建于 ${formatDate(item.createdAt, true)} · 尚未使用`}</p></div>{item.kind === 'custom' && !revoked && !expired && <button type="button" onClick={() => setConfirmRevoke(item.id)} className="rounded-lg p-2 text-slate-300 transition hover:bg-rose-50 hover:text-rose-600" aria-label={`撤销 ${item.name}`}><Trash2 size={15}/></button>}</div>{confirmRevoke === item.id && <div className="mt-4 flex flex-col gap-3 rounded-xl border border-rose-100 bg-rose-50/70 p-4 sm:flex-row sm:items-center"><p className="flex-1 text-xs leading-5 text-rose-700">撤销后使用此 Key 的程序会立即停止工作，此操作不能恢复。</p><div className="flex gap-2"><button type="button" disabled={pending === `revoke:${item.id}`} onClick={() => setConfirmRevoke(null)} className={secondaryButton}><X size={13}/>取消</button><button type="button" disabled={pending === `revoke:${item.id}`} onClick={() => void revoke(item.id)} className={dangerButton}>{pending === `revoke:${item.id}` ? '撤销中…' : '确认撤销'}</button></div></div>}</article>})}</div>}
      </Panel>
    </div>
    <Panel title="调用方式" description="API Key 只用于 AccessHub 网关，不会发送给上游服务。"><pre className="overflow-x-auto rounded-xl bg-[#182238] p-4 text-xs leading-6 text-slate-300"><code>{`curl https://l2cl.link/api/gateway/{service}/{api} \\\n  -H "Authorization: Bearer ahk_…"`}</code></pre></Panel>
  </div>
}
