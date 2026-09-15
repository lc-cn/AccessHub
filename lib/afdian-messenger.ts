import { buildAfdianMessageRequest } from '@/lib/afdian-commerce'

type DeliveryResult = { outcome: 'sent' } | { outcome: 'failed' | 'unknown'; error: string }

export function isAfdianMessengerConfigured() {
  return Boolean(process.env.AFDIAN_USER_ID && process.env.AFDIAN_ADMIN_TOKEN)
}

export async function sendAfdianPrivateMessage(recipient: string, content: string): Promise<DeliveryResult> {
  const userId = process.env.AFDIAN_USER_ID
  const token = process.env.AFDIAN_ADMIN_TOKEN
  if (!userId || !token) return { outcome: 'failed', error: '爱发电 OpenAPI 凭据尚未配置' }

  try {
    const response = await fetch('https://afdian.com/api/open/send-msg', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildAfdianMessageRequest({ token, userId, recipient, content })),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    })
    const payload = await response.json().catch(() => null) as { ec?: number; em?: string } | null
    if (response.ok && payload?.ec === 200) return { outcome: 'sent' }
    return { outcome: 'failed', error: payload?.em || `爱发电私信发送失败（HTTP ${response.status}）` }
  } catch (error) {
    return { outcome: 'unknown', error: error instanceof Error ? error.message : '爱发电私信发送结果未知' }
  }
}
