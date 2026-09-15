import { requireSession } from '@/lib/account'
import { getAccountProfile } from '@/lib/account/read-models'
import { PageIntro, Panel, Status, formatDate } from '@/components/account/ui'
import { ProfileForm } from '@/components/account/profile-form'

export default async function ProfilePage() {
  const session = await requireSession()
  const profile = await getAccountProfile(session.user.id)
  return <><PageIntro eyebrow="PROFILE" title="个人资料" description="维护其他用户能识别你的公开资料；主邮箱和登录凭据在安全页面管理。"/><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"><Panel title="基础资料"><ProfileForm initialName={profile?.name || session.user.name} initialImage={profile?.image || ''}/></Panel><Panel title="账户信息"><dl className="space-y-5"><Info label="账户 ID" value={session.user.id}/><Info label="加入时间" value={formatDate(profile?.createdAt)}/><div><dt className="text-xs text-slate-400">邮箱状态</dt><dd className="mt-2"><Status tone={profile?.emailVerified ? 'green' : 'amber'}>{profile?.emailVerified ? '已验证' : '尚未验证'}</Status></dd></div></dl></Panel></div></>
}
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 break-all text-sm font-medium text-slate-700">{value}</dd></div> }
