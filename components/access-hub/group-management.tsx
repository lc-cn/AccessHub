'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Gauge, Plus, Save, Star, Users } from 'lucide-react'
import type { AdminData, AdminGroup, DashboardGroup } from './types'

type GroupForm = { name: string; description: string; rateLimit: string; dailyLimit: string; isDefault: boolean }
const emptyForm: GroupForm = { name: '', description: '', rateLimit: '60', dailyLimit: '10000', isDefault: false }

export function GroupManagement({ groups, onChanged }: { groups: DashboardGroup[]; onChanged: () => Promise<void> }) {
  const [adminGroups, setAdminGroups] = useState<AdminGroup[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<GroupForm>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const response = await fetch('/api/admin', { cache: 'no-store' })
    if (!response.ok) {
      setNotice({ tone: 'error', text: response.status === 403 ? '当前账户没有管理员权限' : '用户组读取失败，请稍后重试' })
      setLoading(false)
      return
    }
    const data: AdminData = await response.json()
    setAdminGroups(data.groups)
    setSelectedId((current) => current && data.groups.some((group) => group.id === current) ? current : data.groups[0]?.id ?? null)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const selected = useMemo(() => adminGroups.find((group) => group.id === selectedId) ?? null, [adminGroups, selectedId])
  useEffect(() => {
    if (creating) setForm(emptyForm)
    else if (selected) setForm({ name: selected.name, description: selected.description, rateLimit: String(selected.rateLimit), dailyLimit: selected.dailyLimit == null ? '' : String(selected.dailyLimit), isDefault: selected.isDefault })
  }, [creating, selected])

  const submit = async () => {
    if (!form.name.trim()) return setNotice({ tone: 'error', text: '请填写用户组名称' })
    setSaving(true)
    setNotice(null)
    const response = await fetch('/api/admin', {
      method: creating ? 'POST' : 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'group', groupId: selectedId, ...form }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      setNotice({ tone: 'error', text: result.error || '保存失败，请检查填写内容' })
      setSaving(false)
      return
    }
    setNotice({ tone: 'success', text: creating ? '用户组已创建' : '策略已保存' })
    setCreating(false)
    setSelectedId(result.group.id)
    await Promise.all([load(), onChanged()])
    setSaving(false)
  }

  const selectedMembers = groups.find((group) => group.id === selectedId)?.memberCount ?? 0

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,.9fr)]">
    <section>
      <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-xs font-medium tracking-wide text-[#3157d5]">访问策略</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">用户组</h2><p className="mt-2 text-sm text-slate-500">选择一个用户组查看配额，或创建新的权限层级。</p></div><button onClick={() => { setCreating(true); setSelectedId(null); setNotice(null) }} className="flex items-center gap-2 rounded-xl bg-[#3157d5] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#284bc2] active:translate-y-px"><Plus size={16}/>新建用户组</button></div>
      {loading ? <GroupSkeleton/> : adminGroups.length === 0 ? <button onClick={() => setCreating(true)} className="w-full rounded-[22px] border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">还没有用户组，创建第一个用户组</button> : <div className="space-y-3">{adminGroups.map((group) => {
        const memberCount = groups.find((item) => item.id === group.id)?.memberCount ?? 0
        const active = !creating && selectedId === group.id
        return <button key={group.id} onClick={() => { setCreating(false); setSelectedId(group.id); setNotice(null) }} className={`grid w-full grid-cols-[1fr_auto] gap-5 rounded-[18px] p-5 text-left transition active:translate-y-px ${active ? 'bg-[#182238] text-white shadow-[0_18px_42px_rgba(24,34,56,.16)]' : 'bg-white hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(39,55,92,.07)]'}`}><div className="min-w-0"><div className="flex items-center gap-2"><h3 className="truncate font-semibold">{group.name}</h3>{group.isDefault && <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${active ? 'bg-white/10 text-slate-200' : 'bg-[#edf2ff] text-[#3157d5]'}`}>默认</span>}</div><p className={`mt-1 truncate text-xs ${active ? 'text-slate-400' : 'text-slate-400'}`}>{group.description || '暂无描述'}</p><div className={`mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs ${active ? 'text-slate-300' : 'text-slate-500'}`}><span className="flex items-center gap-1.5"><Gauge size={13}/>{group.rateLimit.toLocaleString()} 次/分钟</span><span>{group.dailyLimit?.toLocaleString() ?? '不限额'} 次/日</span></div></div><div className="text-right"><p className="text-2xl font-semibold tabular-nums">{memberCount.toLocaleString()}</p><p className={`mt-1 text-[11px] ${active ? 'text-slate-400' : 'text-slate-400'}`}>有效成员</p></div></button>
      })}</div>}
    </section>

    <aside className="h-fit rounded-[22px] bg-white p-6 shadow-[0_18px_55px_rgba(39,55,92,.06)] xl:sticky xl:top-24">
      <div className="flex items-start justify-between"><div><p className="text-xs text-slate-400">{creating ? '新策略' : '策略详情'}</p><h3 className="mt-1 text-lg font-semibold">{creating ? '创建用户组' : selected?.name || '选择用户组'}</h3></div>{!creating && selected && <div className="text-right"><p className="text-lg font-semibold tabular-nums">{selectedMembers}</p><p className="text-[10px] text-slate-400">有效成员</p></div>}</div>
      {(creating || selected) ? <form onSubmit={(event) => { event.preventDefault(); void submit() }} className="mt-6 space-y-5">
        <Field label="用户组名称"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={80} className="access-input" placeholder="例如：专业用户"/></Field>
        <Field label="说明"><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={240} rows={3} className="access-input resize-none" placeholder="说明适用对象和使用场景"/></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="每分钟请求"><input type="number" min="1" value={form.rateLimit} onChange={(event) => setForm({ ...form, rateLimit: event.target.value })} className="access-input tabular-nums"/></Field><Field label="每日请求"><input type="number" min="1" value={form.dailyLimit} onChange={(event) => setForm({ ...form, dailyLimit: event.target.value })} className="access-input tabular-nums" placeholder="留空则不限"/></Field></div>
        <label className={`flex items-center justify-between rounded-xl border px-4 py-3 ${form.isDefault ? 'border-[#b9c9ff] bg-[#f3f6ff]' : 'border-slate-200'}`}><span><span className="flex items-center gap-2 text-sm font-medium"><Star size={15} className={form.isDefault ? 'fill-[#3157d5] text-[#3157d5]' : 'text-slate-400'}/>默认用户组</span><span className="mt-1 block text-xs text-slate-400">未配置其他权益的用户自动归入此组</span></span><input type="checkbox" checked={form.isDefault} disabled={selected?.isDefault} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} className="size-4 accent-[#3157d5]"/></label>
        {notice && <p className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs ${notice.tone === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>{notice.tone === 'success' && <CheckCircle2 size={14}/>} {notice.text}</p>}
        <div className="flex gap-2 border-t border-slate-100 pt-5">{creating && <button type="button" onClick={() => { setCreating(false); setSelectedId(adminGroups[0]?.id ?? null) }} className="rounded-xl px-4 py-2.5 text-sm text-slate-500 transition hover:bg-slate-50">取消</button>}<button disabled={saving} className="ml-auto flex items-center gap-2 rounded-xl bg-[#182238] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 active:translate-y-px disabled:opacity-50"><Save size={15}/>{saving ? '保存中…' : creating ? '创建用户组' : '保存策略'}</button></div>
      </form> : <p className="mt-8 rounded-xl bg-slate-50 p-5 text-sm text-slate-400">从左侧选择一个用户组开始配置。</p>}
    </aside>
  </div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-medium text-slate-500">{label}</span>{children}</label> }
function GroupSkeleton() { return <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-[18px] bg-white"/>)}</div> }
