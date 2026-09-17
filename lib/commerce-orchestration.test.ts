import assert from 'node:assert/strict'
import test from 'node:test'
import { parseAfdianWebhook } from './afdian-webhook.ts'

function webhook(order: Record<string, unknown>) {
  return JSON.stringify({ data: { type: 'order', order } })
}

test('accepts a paid Afdian order for asynchronous fulfillment', () => {
  const result = parseAfdianWebhook(webhook({
    out_trade_no: 'order-123',
    status: 2,
    plan_id: 'plan-123',
    user_id: 'afdian-user',
    month: 3,
  }))
  assert.deepEqual(result.outcome, 'paid')
  if (result.outcome !== 'paid') return
  assert.equal(result.outTradeNo, 'order-123')
  assert.equal(result.afdianUserId, 'afdian-user')
  assert.equal(result.months, 3)
})

test('recognizes the official Afdian connectivity probe before fulfillment validation', () => {
  const result = parseAfdianWebhook(webhook({
    out_trade_no: '202106232138371083454010626',
    status: 2,
    plan_id: 'a45353328af911eb973052540025c377',
  }))
  assert.equal(result.outcome, 'probe')
})

test('ignores unpaid callbacks and rejects malformed paid orders', () => {
  assert.equal(parseAfdianWebhook(webhook({ out_trade_no: 'order-1', status: 1 })).outcome, 'ignored')
  const missingUser = parseAfdianWebhook(webhook({ out_trade_no: 'order-2', status: 2, plan_id: 'plan', month: 1 }))
  assert.deepEqual(missingUser, { outcome: 'invalid', message: 'paid order has no user_id' })
  assert.deepEqual(parseAfdianWebhook('{'), { outcome: 'invalid', message: 'invalid json' })
})
