import { requireSession } from '@/lib/account'
import { getAccountProfile, getAccountSecurity } from '@/lib/account/read-models'
import { PageIntro } from '@/components/account/ui'
import { SecuritySettings } from '@/components/account/security-settings'

export default async function SecurityPage() {
  const session = await requireSession()
  const [profile, security] = await Promise.all([getAccountProfile(session.user.id), getAccountSecurity(session.user.id, session.session.id)])
  return <><PageIntro eyebrow="SECURITY" title="登录与安全" description="维护邮箱、Passkey、双重验证和活跃设备。敏感操作需要近期强验证会话。"/><SecuritySettings email={profile?.email || session.user.email} emailVerified={profile?.emailVerified ?? session.user.emailVerified} hasCredential={security.hasCredential} twoFactorEnabled={profile?.twoFactorEnabled ?? false} hasTotp={security.hasTotp} passkeys={security.passkeys} sessions={security.sessions}/></>
}
