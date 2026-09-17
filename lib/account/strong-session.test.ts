import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isRecentStrongAuthentication } from './strong-session-policy.ts'

describe('isRecentStrongAuthentication', () => {
  const now = new Date('2026-09-17T04:00:00.000Z')

  it('accepts a recent passkey or MFA timestamp', () => {
    assert.equal(isRecentStrongAuthentication(new Date('2026-09-17T03:50:01.000Z'), now), true)
  })

  it('rejects missing, stale, future and invalid timestamps', () => {
    assert.equal(isRecentStrongAuthentication(null, now), false)
    assert.equal(isRecentStrongAuthentication(new Date('2026-09-17T03:45:00.000Z'), now), false)
    assert.equal(isRecentStrongAuthentication(new Date('2026-09-17T04:00:01.000Z'), now), false)
    assert.equal(isRecentStrongAuthentication('invalid', now), false)
  })
})
