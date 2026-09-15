import assert from 'node:assert/strict'
import test from 'node:test'
import { parseBenefitInput, parseSubscriptionPlanPolicyInput } from './admin-entitlements.ts'

test('normalizes a valid subscription plan and preserves unlimited quotas', () => {
  const result = parseSubscriptionPlanPolicyInput({ name: ' pro ', description: ' paid ', rank: '200', rateLimit: '120', dailyLimit: '5000', weeklyLimit: '-1', monthlyLimit: '-1' })
  assert.deepEqual(result, { ok: true, value: { name: 'pro', description: 'paid', rank: 200, rateLimit: 120, dailyLimit: 5000, weeklyLimit: -1, monthlyLimit: -1, isDefault: false } })
})

test('rejects quota periods that decrease over time', () => {
  const result = parseSubscriptionPlanPolicyInput({ name: 'bad', rateLimit: '60', dailyLimit: '5000', weeklyLimit: '1000', monthlyLimit: '20000' })
  assert.deepEqual(result, { ok: false, error: '每周配额不能低于每日配额' })
})

test('parses subscription-plan and credits benefits through one interface', () => {
  assert.deepEqual(parseBenefitInput({ kind: 'plan', planId: 'plus', durationValue: '-1', durationUnit: 'year' }), { ok: true, value: { kind: 'plan', planId: 'plus', credits: null, durationValue: -1, durationUnit: 'year' } })
  assert.deepEqual(parseBenefitInput({ kind: 'credits', credits: '3000', durationValue: '1', durationUnit: 'quarter' }), { ok: true, value: { kind: 'credits', planId: null, credits: 3000, durationValue: 1, durationUnit: 'quarter' } })
})
