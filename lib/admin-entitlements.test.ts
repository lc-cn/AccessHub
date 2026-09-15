import assert from 'node:assert/strict'
import test from 'node:test'
import { parseBenefitInput, parseGroupPolicyInput } from './admin-entitlements.ts'

test('normalizes a valid group policy and preserves unlimited quotas', () => {
  const result = parseGroupPolicyInput({ name: ' pro ', description: ' paid ', rateLimit: '120', dailyLimit: '5000', weeklyLimit: '-1', monthlyLimit: '-1' })
  assert.deepEqual(result, { ok: true, value: { name: 'pro', description: 'paid', rateLimit: 120, dailyLimit: 5000, weeklyLimit: -1, monthlyLimit: -1, isDefault: false } })
})

test('rejects quota periods that decrease over time', () => {
  const result = parseGroupPolicyInput({ name: 'bad', rateLimit: '60', dailyLimit: '5000', weeklyLimit: '1000', monthlyLimit: '20000' })
  assert.deepEqual(result, { ok: false, error: '每周配额不能低于每日配额' })
})

test('parses group and credits benefits through one interface', () => {
  assert.deepEqual(parseBenefitInput({ kind: 'group', groupId: 'plus', durationValue: '-1', durationUnit: 'year' }), { ok: true, value: { kind: 'group', groupId: 'plus', credits: null, durationValue: -1, durationUnit: 'year' } })
  assert.deepEqual(parseBenefitInput({ kind: 'credits', credits: '3000', durationValue: '1', durationUnit: 'quarter' }), { ok: true, value: { kind: 'credits', groupId: null, credits: 3000, durationValue: 1, durationUnit: 'quarter' } })
})
