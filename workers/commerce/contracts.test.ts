import assert from 'node:assert/strict'
import test from 'node:test'
import {
  orderWorkflowId,
  parseCommerceQueueMessage,
  queueRetryDelaySeconds,
  subscriptionWorkflowId,
} from './contracts.ts'

test('parses supported commerce queue messages', () => {
  assert.deepEqual(parseCommerceQueueMessage({
    type: 'order.fulfillment.requested',
    providerEventId: 'event-123',
  }), {
    type: 'order.fulfillment.requested',
    providerEventId: 'event-123',
  })

  assert.deepEqual(parseCommerceQueueMessage({
    type: 'subscription.period.scheduled',
    subscriptionId: 'subscription-123',
    periodEnd: '2027-01-02T03:04:05.000Z',
  }), {
    type: 'subscription.period.scheduled',
    subscriptionId: 'subscription-123',
    periodEnd: '2027-01-02T03:04:05.000Z',
  })
})

test('rejects malformed messages', () => {
  assert.equal(parseCommerceQueueMessage(null), null)
  assert.equal(parseCommerceQueueMessage({ type: 'order.fulfillment.requested', providerEventId: '../bad' }), null)
  assert.equal(parseCommerceQueueMessage({ type: 'subscription.period.scheduled', subscriptionId: 'sub', periodEnd: 'not-a-date' }), null)
})

test('builds deterministic workflow ids', () => {
  assert.equal(orderWorkflowId('event-123'), 'order-event-123')
  assert.equal(
    subscriptionWorkflowId('subscription-123', '2027-01-02T03:04:05.000Z'),
    'subscription-subscription-123-1798859045000',
  )
})

test('caps exponential queue retry delay', () => {
  assert.equal(queueRetryDelaySeconds(1), 30)
  assert.equal(queueRetryDelaySeconds(2), 60)
  assert.equal(queueRetryDelaySeconds(10), 900)
})
