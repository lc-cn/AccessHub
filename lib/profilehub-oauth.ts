import type { GenericOAuthConfig } from 'better-auth/plugins/generic-oauth'

// Stable account-linking key: changing it would disconnect existing Better Auth accounts.
export const PROFILEHUB_PROVIDER_ID = 'rbac'

export function getProfileHubOAuthConfig(env: Record<string, string | undefined> = process.env): GenericOAuthConfig | null {
  const issuer = (env.PROFILEHUB_ISSUER_URL ?? env.RBAC_ISSUER_URL)?.trim().replace(/\/+$/, '')
  const clientId = (env.PROFILEHUB_CLIENT_ID ?? env.RBAC_CLIENT_ID)?.trim()
  const clientSecret = (env.PROFILEHUB_CLIENT_SECRET ?? env.RBAC_CLIENT_SECRET)?.trim()
  if (!issuer && !clientId && !clientSecret) return null
  if (!issuer || !clientId || !clientSecret) throw new Error('ProfileHub OAuth 需要配置 PROFILEHUB_ISSUER_URL、PROFILEHUB_CLIENT_ID、PROFILEHUB_CLIENT_SECRET')
  const url = new URL(issuer)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
      url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('PROFILEHUB_ISSUER_URL 必须为 HTTPS 根地址（本地回环地址允许 HTTP）')
  }
  return {
    providerId: PROFILEHUB_PROVIDER_ID,
    name: 'ProfileHub',
    clientId,
    clientSecret,
    discoveryUrl: `${issuer}/.well-known/openid-configuration`,
    requireIdTokenVerification: true,
    pkce: true,
    scopes: ['openid', 'profile', 'email', 'offline_access'],
    ...(env.BETTER_AUTH_URL ? { postLogoutRedirectURI: new URL('/login', env.BETTER_AUTH_URL).toString() } : {}),
  }
}
