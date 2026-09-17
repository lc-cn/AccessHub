import { requireSession } from '@/lib/account'
import { getAccountSecurity } from '@/lib/account/read-models'
import { isAfdianOAuthConfigured } from '@/lib/afdian-oauth'
import { getProfileHubOAuthConfig } from '@/lib/profilehub-oauth'
import { ConnectionsList } from '@/components/account/connections-list'
import { PageIntro, Panel } from '@/components/account/ui'

export default async function ConnectionsPage() {
  const session = await requireSession()
  const security = await getAccountSecurity(session.user.id, session.session.id)
  return <><PageIntro eyebrow="CONNECTIONS" title="账号绑定" description="登录方式都属于同一个 AccessHub 用户。解除绑定前，请确认仍有其他可用的登录方式。"/><Panel title="登录身份" description="OAuth 密钥、访问令牌和外部平台用户 ID 不会显示在这里。"><ConnectionsList identities={security.identities} profileHubAvailable={getProfileHubOAuthConfig() !== null} afdianAvailable={isAfdianOAuthConfigured()}/></Panel></>
}
