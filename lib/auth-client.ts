import { createAuthClient } from 'better-auth/react'
import { emailOTPClient, twoFactorClient } from 'better-auth/client/plugins'
import { passkeyClient } from '@better-auth/passkey/client'

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : undefined,
  plugins: [emailOTPClient(), passkeyClient(), twoFactorClient({ twoFactorPage: '/two-factor' })],
})

/** Keep provider logout navigation separate from SPA navigation to avoid a redirect race. */
export async function signOutDestination(): Promise<string> {
  const result = await authClient.signOut({ callbackURL: '/login', disableRedirect: true })
  if (result.error) throw new Error(result.error.message || '退出登录失败')
  return result.data?.url || '/login'
}
