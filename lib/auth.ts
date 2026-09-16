import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { genericOAuth } from 'better-auth/plugins'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { allTables } from '@/lib/db/schema'
import { AFDIAN_PROVIDER_ID, afdianOAuthRedirectUri, exchangeAfdianOAuthCode, isAfdianOAuthConfigured } from '@/lib/afdian-oauth'
import { sendVerificationEmail, sendEmailChangeVerification } from '@/lib/email/verification'
import { sendPasswordResetEmail } from '@/lib/email/password-reset'
import { getAccountAuthPolicy } from '@/lib/account/auth-policy'
import { recordSecurityEventBestEffort } from '@/lib/account/security-events'
import { ensureDefaultApiKey } from '@/lib/api-keys'

const origins = [
  'http://localhost:3000',
  ...['V0_RUNTIME_URL', 'V0_DEV_APP_URL', 'V0_BUILD_URL', 'V0_SANDBOX_URL'].map((key) => process.env[key]).filter(Boolean).map((value) => value!.startsWith('http') ? value! : `https://${value}`),
  ...['VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL'].map((key) => process.env[key]).filter(Boolean).map((value) => value!.startsWith('http') ? value! : `https://${value}`),
]

const accountAuthPolicy = getAccountAuthPolicy()
const emailReady = accountAuthPolicy.emailEnabled

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema: allTables }),
  baseURL: process.env.BETTER_AUTH_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.V0_RUNTIME_URL || 'http://localhost:3000'),
  trustedOrigins: origins,
  socialProviders: { github: { clientId: process.env.GITHUB_CLIENT_ID!, clientSecret: process.env.GITHUB_CLIENT_SECRET! } },
  account: { accountLinking: { enabled: true, disableImplicitLinking: true, allowDifferentEmails: true, trustedProviders: [AFDIAN_PROVIDER_ID] } },
  session: { freshAge: accountAuthPolicy.freshSessionMaxAgeSeconds },
  rateLimit: accountAuthPolicy.rateLimit,
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          await ensureDefaultApiKey(createdUser.id)
        },
      },
    },
  },
  emailAndPassword: {
    enabled: emailReady,
    requireEmailVerification: emailReady,
    autoSignIn: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: emailReady
      ? async ({ user, url }, _request) => {
          await sendPasswordResetEmail(user.email, url)
          await recordSecurityEventBestEffort({ actorId: user.id, action: 'account.password.reset_requested' })
        }
      : undefined,
    onPasswordReset: async ({ user }, _request) => {
      await recordSecurityEventBestEffort({ actorId: user.id, action: 'account.password.reset_completed' })
    },
  },
  emailVerification: {
    sendVerificationEmail: emailReady
      ? async ({ user, url }, _request) => {
          await sendVerificationEmail(user.email, url)
          await recordSecurityEventBestEffort({ actorId: user.id, action: 'account.email.verification_sent' })
        }
      : undefined,
    sendOnSignUp: emailReady,
    autoSignInAfterVerification: true,
    expiresIn: 3600,
    afterEmailVerification: async (user, _request) => {
      await recordSecurityEventBestEffort({ actorId: user.id, action: 'account.email.verified' })
    },
  },
  user: {
    changeEmail: {
      enabled: emailReady,
      sendChangeEmailConfirmation: emailReady
        ? async ({ user, newEmail, url }, _request) => {
            await sendEmailChangeVerification(user.email, url)
            await recordSecurityEventBestEffort({
              actorId: user.id,
              action: 'account.email.change_requested',
              detail: `new_email_domain:${newEmail.split('@')[1] ?? 'unknown'}`,
            })
          }
        : undefined,
    },
  },
  plugins: isAfdianOAuthConfigured() ? [genericOAuth({ config: [{
    providerId: AFDIAN_PROVIDER_ID,
    name: '爱发电',
    clientId: process.env.AFDIAN_OAUTH_CLIENT_ID!,
    clientSecret: process.env.AFDIAN_OAUTH_CLIENT_SECRET!,
    authorizationUrl: 'https://afdian.com/oauth2/authorize',
    redirectURI: afdianOAuthRedirectUri(),
    scopes: ['basic'],
    pkce: false,
    disableSignUp: true,
    getToken: async ({ code, redirectURI }) => {
      const identity = await exchangeAfdianOAuthCode(code, redirectURI)
      return { accessToken: identity.userId, tokenType: 'Bearer', scopes: ['basic'] }
    },
    getUserInfo: async (tokens) => tokens.accessToken ? ({ id: tokens.accessToken, name: '爱发电用户', emailVerified: false }) : null,
    accountSubject: ({ profile }) => String(profile.id || ''),
  }] })] : [],
  ...(process.env.NODE_ENV === 'development' ? { advanced: { defaultCookieAttributes: { sameSite: 'none' as const, secure: true } } } : {}),
})

export async function getSession() { return auth.api.getSession({ headers: await headers() }) }
