import type { GenericOAuthConfig } from 'better-auth/plugins/generic-oauth'

export const RBAC_PROVIDER_ID = 'rbac'

export function getRbacOAuthConfig(env: Record<string, string | undefined> = process.env): GenericOAuthConfig | null {
  const issuer = env.RBAC_ISSUER_URL?.trim().replace(/\/+$/, '')
  const clientId = env.RBAC_CLIENT_ID?.trim()
  const clientSecret = env.RBAC_CLIENT_SECRET?.trim()
  if (!issuer && !clientId && !clientSecret) return null
  if (!issuer || !clientId || !clientSecret) throw new Error('RBAC OAuth 需要配置 RBAC_ISSUER_URL、RBAC_CLIENT_ID、RBAC_CLIENT_SECRET')
  const url = new URL(issuer)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
      url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('RBAC_ISSUER_URL 必须为 HTTPS 根地址（本地回环地址允许 HTTP）')
  }
  return {
    providerId: RBAC_PROVIDER_ID,
    name: '统一账号',
    clientId,
    clientSecret,
    discoveryUrl: `${issuer}/.well-known/openid-configuration`,
    requireIdTokenVerification: true,
    pkce: true,
    scopes: ['openid', 'profile', 'email', 'offline_access'],
    ...(env.BETTER_AUTH_URL ? { postLogoutRedirectURI: new URL('/login', env.BETTER_AUTH_URL).toString() } : {}),
  }
}
