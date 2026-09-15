import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { isFreshSession, requireFreshSession } from './fresh-session.ts'
import { AccountError } from './errors.ts'

describe('isFreshSession', () => {
  const originalEnv = process.env.FRESH_SESSION_MAX_AGE_MINUTES

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.FRESH_SESSION_MAX_AGE_MINUTES
    } else {
      process.env.FRESH_SESSION_MAX_AGE_MINUTES = originalEnv
    }
  })

  it('returns true for session created within max age', () => {
    const now = new Date('2026-01-15T12:00:00Z')
    const createdAt = new Date('2026-01-15T11:55:00Z') // 5 minutes ago
    assert.equal(isFreshSession({ createdAt }, now), true)
  })

  it('returns false for session created beyond max age', () => {
    const now = new Date('2026-01-15T12:00:00Z')
    const createdAt = new Date('2026-01-15T11:40:00Z') // 20 minutes ago (default max is 15)
    assert.equal(isFreshSession({ createdAt }, now), false)
  })

  it('respects custom max age from env var', () => {
    process.env.FRESH_SESSION_MAX_AGE_MINUTES = '30'
    const now = new Date('2026-01-15T12:00:00Z')
    const createdAt = new Date('2026-01-15T11:25:00Z') // 35 minutes ago
    assert.equal(isFreshSession({ createdAt }, now), false)

    const createdAt2 = new Date('2026-01-15T11:45:00Z') // 15 minutes ago
    assert.equal(isFreshSession({ createdAt: createdAt2 }, now), true)
  })

  it('handles ISO string dates', () => {
    const now = new Date('2026-01-15T12:00:00Z')
    const session = { createdAt: '2026-01-15T11:55:00Z' }
    assert.equal(isFreshSession(session, now), true)
  })

  it('matches Better Auth by rejecting the exact expiry boundary', () => {
    const now = new Date('2026-01-15T12:00:00Z')
    const createdAt = new Date('2026-01-15T11:45:00Z') // exactly 15 minutes
    assert.equal(isFreshSession({ createdAt }, now), false)
  })

  it('rejects future and invalid session timestamps', () => {
    const now = new Date('2026-01-15T12:00:00Z')
    assert.equal(isFreshSession({ createdAt: '2026-01-15T12:00:01Z' }, now), false)
    assert.equal(isFreshSession({ createdAt: 'invalid' }, now), false)
  })

  it('rejects an invalid freshness setting', () => {
    process.env.FRESH_SESSION_MAX_AGE_MINUTES = '-1'
    assert.throws(
      () => isFreshSession({ createdAt: new Date('2026-01-15T11:55:00Z') }, new Date('2026-01-15T12:00:00Z')),
      /必须是大于 0 的整数/,
    )
  })
})

describe('requireFreshSession', () => {
  it('does not throw for fresh session', () => {
    const now = new Date('2026-01-15T12:00:00Z')
    const createdAt = new Date('2026-01-15T11:55:00Z')
    assert.doesNotThrow(() => requireFreshSession({ createdAt }, now))
  })

  it('throws AccountError for stale session', () => {
    const now = new Date('2026-01-15T12:00:00Z')
    const createdAt = new Date('2026-01-15T11:40:00Z') // 20 minutes ago
    try {
      requireFreshSession({ createdAt }, now)
      assert.fail('should have thrown')
    } catch (error) {
      assert.ok(error instanceof AccountError)
      assert.equal((error as AccountError).code, 'fresh_session_required')
      assert.equal((error as AccountError).status, 403)
    }
  })
})
