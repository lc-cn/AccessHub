import { isEmailAvailable } from '../email/config.ts'
import { getFreshSessionMaxAgeSeconds } from './fresh-session.ts'

export const SENSITIVE_AUTH_RATE_LIMITS = {
  '/sign-up/email': { window: 60, max: 5 },
  '/request-password-reset': { window: 60, max: 5 },
  '/send-verification-email': { window: 60, max: 5 },
  '/change-email': { window: 60, max: 5 },
} as const

export function getAccountAuthPolicy() {
  return {
    emailEnabled: isEmailAvailable(),
    freshSessionMaxAgeSeconds: getFreshSessionMaxAgeSeconds(),
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: SENSITIVE_AUTH_RATE_LIMITS,
    },
  }
}
