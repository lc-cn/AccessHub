import { requireSession } from '@/lib/account'
import { getAccountApiKeys, getApiKeyServiceOptions } from '@/lib/account/read-models'
import { PageIntro } from '@/components/account/ui'
import { ApiKeyManager } from '@/components/account/api-key-manager'

export default async function ApiKeysPage() {
  const session = await requireSession()
  const [apiKeys, services] = await Promise.all([getAccountApiKeys(session.user.id), getApiKeyServiceOptions()])
  return <>
    <PageIntro eyebrow="API KEYS" title="程序调用凭据" description="为服务端、脚本或 CI 创建独立凭据。Key 只在创建时显示一次，可随时撤销。"/>
    <ApiKeyManager initialKeys={apiKeys} services={services}/>
  </>
}
