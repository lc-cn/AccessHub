import assert from 'node:assert/strict'
import test from 'node:test'
import { exceededAllowance, selectAllowance } from './usage-allowance.ts'

test('reports the first exhausted allowance period', () => {
  assert.deepEqual(exceededAllowance({ rateLimit: 60, dailyLimit: 100, weeklyLimit: 500, monthlyLimit: 1000 }, { minute: 3, daily: 100, weekly: 100, monthly: 100 }), { period: 'day', used: 100, limit: 100 })
})

test('supports unlimited allowance values', () => {
  assert.equal(exceededAllowance({ rateLimit: -1, dailyLimit: -1, weeklyLimit: -1, monthlyLimit: -1 }, { minute: 999, daily: 999, weekly: 999, monthly: 999 }), null)
})

test('reserves all configured usage units before allowing a request', () => {
  assert.deepEqual(exceededAllowance({ rateLimit: 10, dailyLimit: 100, weeklyLimit: 500, monthlyLimit: 1000 }, { minute: 8, daily: 8, weekly: 8, monthly: 8 }, 3), { period: 'minute', used: 8, limit: 10 })
  assert.equal(exceededAllowance({ rateLimit: 10, dailyLimit: 100, weeklyLimit: 500, monthlyLimit: 1000 }, { minute: 8, daily: 8, weekly: 8, monthly: 8 }, 2), null)
})

test('falls back from an exhausted paid plan to the default plan', () => {
  const exhausted = { minute: 60, daily: 100, weekly: 100, monthly: 100 }
  const available = { minute: 0, daily: 10, weekly: 10, monthly: 10 }
  const result = selectAllowance([
    { source: 'current', policy: { rateLimit: 60, dailyLimit: 100, weeklyLimit: 500, monthlyLimit: 1000 }, usage: exhausted },
    { source: 'default', policy: { rateLimit: 30, dailyLimit: 100, weeklyLimit: -1, monthlyLimit: -1 }, usage: available },
  ])
  assert.equal(result.selected?.source, 'default')
})

test('returns no plan allowance when paid and default plans are exhausted', () => {
  const exhausted = { minute: 60, daily: 100, weekly: 100, monthly: 100 }
  const result = selectAllowance([
    { source: 'current', policy: { rateLimit: 60, dailyLimit: 100, weeklyLimit: 500, monthlyLimit: 1000 }, usage: exhausted },
    { source: 'default', policy: { rateLimit: 30, dailyLimit: 100, weeklyLimit: -1, monthlyLimit: -1 }, usage: exhausted },
  ])
  assert.equal(result.selected, null)
})
