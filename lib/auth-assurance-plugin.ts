import { createAuthMiddleware } from 'better-auth/api'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { session } from '@/lib/db/schema'

const strongAuthenticationPaths = new Map([
  ['/sign-in/email-otp', 'email_otp'],
  ['/email-otp/verify-email', 'email_verification'],
  ['/passkey/verify-authentication', 'passkey'],
  ['/two-factor/verify-totp', 'totp'],
  ['/two-factor/verify-otp', 'mfa_otp'],
  ['/two-factor/verify-backup-code', 'backup_code'],
])

export function strongAuthenticationPlugin() {
  return {
    id: 'accesshub-strong-authentication',
    hooks: {
      after: [{
        matcher(context: { path?: string }) { return strongAuthenticationPaths.has(context.path || '') },
        handler: createAuthMiddleware(async (ctx) => {
          const authenticated = ctx.context.newSession ?? ctx.context.session
          const method = strongAuthenticationPaths.get(ctx.path)
          if (!authenticated?.session.id || !method) return
          await db.update(session).set({ strongAuthAt: new Date(), strongAuthMethod: method }).where(eq(session.id, authenticated.session.id))
        }),
      }],
    },
  }
}
