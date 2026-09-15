import assert from 'node:assert/strict'
import test from 'node:test'
import { planAction } from './plan-tier.ts'

const current = { planId: 'pro', rank: 200 }

test('the default plan is always included', () => {
  assert.equal(planAction({ id: 'basic', rank: 0, isDefault: true }, current), 'included')
})

test('classifies the current, lower and higher tiers', () => {
  assert.equal(planAction({ id: 'pro', rank: 200, isDefault: false }, current), 'current')
  assert.equal(planAction({ id: 'go', rank: 100, isDefault: false }, current), 'downgrade')
  assert.equal(planAction({ id: 'plus', rank: 300, isDefault: false }, current), 'upgrade')
})

test('all paid plans are upgrades from the default plan', () => {
  assert.equal(planAction({ id: 'go', rank: 100, isDefault: false }, { planId: 'basic', rank: 0 }), 'upgrade')
})
