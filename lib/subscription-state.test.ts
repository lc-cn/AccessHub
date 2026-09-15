import assert from 'node:assert/strict'
import test from 'node:test'
import { assertSubscriptionTransition, canTransitionSubscription } from './subscription-state.ts'

test('activates a subscription after redemption or confirmed payment', () => {
  assert.equal(canTransitionSubscription('pending_activation', 'active'), true)
})

test('allows payment recovery from past due', () => {
  assert.equal(canTransitionSubscription('past_due', 'active'), true)
})

test('keeps terminal subscription states terminal', () => {
  assert.equal(canTransitionSubscription('canceled', 'active'), false)
  assert.throws(() => assertSubscriptionTransition('expired', 'active'), /invalid subscription transition/)
})
