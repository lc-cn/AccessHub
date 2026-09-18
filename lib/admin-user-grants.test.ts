import assert from 'node:assert/strict'
import test from 'node:test'
import { parseAdminUserGrantInput } from './admin-user-grants.ts'

test('parses protected plan and credits grants', () => {
  assert.deepEqual(parseAdminUserGrantInput({ kind: 'plan', planId: 'pro', durationDays: -1, reason: '订单异常补偿' }), { ok: true, value: { kind: 'plan', planId: 'pro', durationDays: -1, reason: '订单异常补偿' } })
  assert.deepEqual(parseAdminUserGrantInput({ kind: 'credits', credits: 1000, durationDays: 30, reason: '客服工单补偿' }), { ok: true, value: { kind: 'credits', credits: 1000, durationDays: 30, reason: '客服工单补偿' } })
})

test('rejects grants without a durable reason or bounded value', () => {
  assert.equal(parseAdminUserGrantInput({ kind: 'plan', planId: 'pro', durationDays: 30, reason: '补偿' }).ok, false)
  assert.equal(parseAdminUserGrantInput({ kind: 'credits', credits: 0, durationDays: 30, reason: '客服工单补偿' }).ok, false)
  assert.equal(parseAdminUserGrantInput({ kind: 'credits', credits: 100, durationDays: 0, reason: '客服工单补偿' }).ok, false)
  assert.equal(parseAdminUserGrantInput({ kind: 'other', durationDays: 30, reason: '客服工单补偿' }).ok, false)
})
