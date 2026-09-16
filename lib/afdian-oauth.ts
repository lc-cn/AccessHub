const AFDIAN_HOSTS = new Set(['afdian.com', 'www.afdian.com', 'afdian.net', 'www.afdian.net'])

type AfdianOAuthTokenPayload = {
  ec?: number
  em?: string
  data?: { user_id?: string; user_private_id?: string }
}

export const AFDIAN_PROVIDER_ID = 'afdian'

export function isAfdianOAuthConfigured() {
  return Boolean(process.env.AFDIAN_OAUTH_CLIENT_ID && process.env.AFDIAN_OAUTH_CLIENT_SECRET)
}

export function afdianOAuthRedirectUri() {
  const base = process.env.BETTER_AUTH_URL || 'https://l2cl.link'
  return new URL('/api/auth/callback/afdian', base).toString()
}

export function afdianPurchaseUrl() {
  const configured = process.env.NEXT_PUBLIC_AFDIAN_URL
  if (!configured) return null
  try {
    const url = new URL(configured)
    return url.protocol === 'https:' && AFDIAN_HOSTS.has(url.hostname) ? url : null
  } catch {
    return null
  }
}

export function parseAfdianOAuthToken(payload: AfdianOAuthTokenPayload) {
  const userId = String(payload.data?.user_id || '').trim()
  if (payload.ec !== 200 || !userId) throw new Error(payload.em || '爱发电 OAuth 返回了无效用户信息')
  return { userId, userPrivateId: String(payload.data?.user_private_id || '').trim() || null }
}

export async function exchangeAfdianOAuthCode(code: string, redirectUri: string) {
  const clientId = process.env.AFDIAN_OAUTH_CLIENT_ID
  const clientSecret = process.env.AFDIAN_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('爱发电 OAuth 尚未配置')

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  })
  const response = await fetch('https://afdian.com/api/oauth2/access_token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`爱发电 OAuth 请求失败（HTTP ${response.status}）`)
  return parseAfdianOAuthToken(await response.json() as AfdianOAuthTokenPayload)
}
