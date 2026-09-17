import assert from 'node:assert/strict'
import test from 'node:test'

import { canTransitionProviderEvent, isTerminalProviderEventStatus, nextRetryAt, outboxDeduplicationKey, retryDelayMs } from './commerce-events.ts'

test('provider event transitions permit queue retries but keep completed outcomes terminal', () => {
  assert.equal(canTransitionProviderEvent('received', 'queued'), true)
  assert.equal(canTransitionProviderEvent('processing', 'workflow_started'), true)
  assert.equal(canTransitionProviderEvent('processing', 'queued'), true)
  assert.equal(canTransitionProviderEvent('failed', 'queued'), true)
  assert.equal(canTransitionProviderEvent('processed', 'queued'), false)
  assert.equal(canTransitionProviderEvent('ignored', 'processing'), false)
  assert.equal(isTerminalProviderEventStatus('processed'), true)
  assert.equal(isTerminalProviderEventStatus('failed'), false)
})

test('retry delay uses capped exponential backoff', () => {
  assert.equal(retryDelayMs(1), 1_000)
  assert.equal(retryDelayMs(4), 8_000)
  assert.equal(retryDelayMs(99), 15 * 60_000)
  assert.equal(retryDelayMs(3, { baseDelayMs: 250, maxDelayMs: 600 }), 600)
  assert.throws(() => retryDelayMs(0), /positive safe integer/)
  assert.throws(() => retryDelayMs(1, { baseDelayMs: 2, maxDelayMs: 1 }), /greater than or equal/)
})

test('next retry timestamp is deterministic', () => {
  const now = new Date('2026-09-17T00:00:00.000Z')
  assert.equal(nextRetryAt(now, 2).toISOString(), '2026-09-17T00:00:02.000Z')
  assert.throws(() => nextRetryAt(new Date(Number.NaN), 1), /valid Date/)
})

test('outbox deduplication keys remain unambiguous when values contain separators', () => {
  assert.equal(outboxDeduplicationKey('afdian', 'order:1', 'paid'), '6:afdian|7:order:1|4:paid')
  assert.notEqual(outboxDeduplicationKey('a|b', 'c'), outboxDeduplicationKey('a', 'b|c'))
  assert.notEqual(outboxDeduplicationKey('订单', '1'), outboxDeduplicationKey('订', '单1'))
  assert.throws(() => outboxDeduplicationKey('order', ''), /non-empty/)
})
