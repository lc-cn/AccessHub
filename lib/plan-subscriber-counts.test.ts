import assert from 'node:assert/strict'
import test from 'node:test'
import { countEffectivePlanSubscribers } from './plan-subscriber-counts.ts'

test('counts users without an explicit subscription in the default plan', () => {
  const counts = countEffectivePlanSubscribers({
    plans: [{ id: 'basic', isDefault: true }, { id: 'pro', isDefault: false }],
    totalUsers: 3,
    entitlements: [{ userId: 'u2', planId: 'pro' }],
  })

  assert.deepEqual(counts, new Map([['basic', 2], ['pro', 1]]))
})

test('counts only the selected effective subscription for each user', () => {
  const counts = countEffectivePlanSubscribers({
    plans: [{ id: 'basic', isDefault: true }, { id: 'plus', isDefault: false }],
    totalUsers: 2,
    entitlements: [{ userId: 'u1', planId: 'plus' }, { userId: 'u2', planId: 'basic' }],
  })

  assert.deepEqual(counts, new Map([['basic', 1], ['plus', 1]]))
})
