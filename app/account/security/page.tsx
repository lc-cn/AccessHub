import { requireSession } from '@/lib/account'
import { getAccountProfile, getAccountSecurity } from '@/lib/account/read-models'
import { PageIntro } from '@/components/account/ui'
import { SecuritySettings } from '@/components/account/security-settings'

export default async function SecurityPage() {
  const session = await requireSession()
  const [profile, security] = await Promise.all([getAccountProfile(session.user.id), getAccountSecurity(session.user.id, session.session.id)])
  return <><PageIntro eyebrow="SECURITY" title="登录与安全" description="维护邮箱验证、密码和活跃设备。敏感操作需要近期登录会话。"/><SecuritySettings email={profile?.email || session.user.email} emailVerified={profile?.emailVerified ?? session.user.emailVerified} hasCredential={security.hasCredential} sessions={security.sessions}/></>
}
