import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AUTH_IP_ADDRESS_HEADERS, getAccountAuthPolicy, SENSITIVE_AUTH_RATE_LIMITS } from './account/auth-policy.ts'
import { resetEmailConfigCache } from './email/config.ts'

describe('account auth policy', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
    resetEmailConfigCache()
  })

  it('disables credential auth when SMTP is absent without affecting OAuth configuration', () => {
    for (const key of ['SMTP_HOST', 'SMTP_FROM', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_SECURE']) {
      delete process.env[key]
    }
    resetEmailConfigCache()

    assert.equal(getAccountAuthPolicy().emailEnabled, false)
  })

  it('enables credential auth only for a complete SMTP configuration', () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_FROM = 'noreply@example.com'
    resetEmailConfigCache()

    assert.equal(getAccountAuthPolicy().emailEnabled, true)
  })

  it('uses one freshness threshold for Better Auth and account helpers', () => {
    process.env.FRESH_SESSION_MAX_AGE_MINUTES = '15'
    assert.equal(getAccountAuthPolicy().freshSessionMaxAgeSeconds, 900)
  })

  it('rate limits each sensitive email endpoint', () => {
    assert.deepEqual(Object.keys(SENSITIVE_AUTH_RATE_LIMITS).sort(), [
      '/change-email',
      '/request-password-reset',
      '/send-verification-email',
      '/sign-up/email',
    ])
  })

  it('trusts Cloudflare client IP headers for per-client rate limiting', () => {
    assert.deepEqual(AUTH_IP_ADDRESS_HEADERS, ['cf-connecting-ip'])
  })
})
