import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { github } from 'better-auth/social-providers'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { allTables } from '@/lib/db/schema'

const origins = [
  'http://localhost:3000',
  ...['V0_RUNTIME_URL', 'V0_DEV_APP_URL', 'V0_BUILD_URL', 'V0_SANDBOX_URL'].map((key) => process.env[key]).filter(Boolean).map((value) => value!.startsWith('http') ? value! : `https://${value}`),
  ...['VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL'].map((key) => process.env[key]).filter(Boolean).map((value) => value!.startsWith('http') ? value! : `https://${value}`),
]

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema: allTables }),
  baseURL: process.env.BETTER_AUTH_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.V0_RUNTIME_URL || 'http://localhost:3000'),
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: origins,
  socialProviders: { github: { clientId: process.env.GITHUB_CLIENT_ID!, clientSecret: process.env.GITHUB_CLIENT_SECRET! } },
  plugins: [],
  ...(process.env.NODE_ENV === 'development' ? { advanced: { defaultCookieAttributes: { sameSite: 'none' as const, secure: true } } } : {}),
})

export async function getSession() { return auth.api.getSession({ headers: await headers() }) }
