import assert from 'node:assert/strict'
import test from 'node:test'
import type { CommerceQueueMessage } from './contracts.ts'
import {
  consumeCommerceBatch,
  consumeCommerceDeadLetterBatch,
  type DeadLetterRecorder,
  type WorkflowStarter,
} from './queue.ts'
import type { QueueMessageBatch } from './platform.ts'

type FakeMessage = {
  id: string
  timestamp: Date
  body: unknown
  attempts: number
  acked: boolean
  retryDelay: number | null
  ack(): void
  retry(options?: { delaySeconds?: number }): void
}

function fakeMessage(body: unknown, attempts = 1): FakeMessage {
  return {
    id: 'message-1',
    timestamp: new Date('2026-09-17T00:00:00.000Z'),
    body,
    attempts,
    acked: false,
    retryDelay: null,
    ack() { this.acked = true },
    retry(options) { this.retryDelay = options?.delaySeconds ?? 0 },
  }
}

function fakeBatch(message: FakeMessage, queue = 'accesshub-commerce-events'): QueueMessageBatch<unknown> {
  return {
    queue,
    messages: [message],
    metadata: { metrics: { backlogCount: 1, backlogBytes: 100 } },
    ackAll() { message.ack() },
    retryAll(options) { message.retry(options) },
  }
}

test('acknowledges a message only after its workflow starts', async () => {
  const message = fakeMessage({ type: 'order.fulfillment.requested', providerEventId: 'event-123' })
  const started: CommerceQueueMessage[] = []
  const starter: WorkflowStarter = {
    async start(value) {
      started.push(value)
      return 'order-event-123'
    },
  }

  await consumeCommerceBatch(fakeBatch(message), starter)

  assert.equal(message.acked, true)
  assert.equal(message.retryDelay, null)
  assert.deepEqual(started, [{ type: 'order.fulfillment.requested', providerEventId: 'event-123' }])
})

test('retries independently when workflow creation fails', async () => {
  const message = fakeMessage({ type: 'order.fulfillment.requested', providerEventId: 'event-123' }, 3)
  const starter: WorkflowStarter = {
    async start() { throw new Error('workflow unavailable') },
  }

  await consumeCommerceBatch(fakeBatch(message), starter)

  assert.equal(message.acked, false)
  assert.equal(message.retryDelay, 120)
})

test('retries malformed messages so the queue can move them to its DLQ', async () => {
  const message = fakeMessage({ type: 'unknown' })
  const starter: WorkflowStarter = {
    async start() { return 'unused' },
  }

  await consumeCommerceBatch(fakeBatch(message), starter)

  assert.equal(message.acked, false)
  assert.equal(message.retryDelay, 30)
})

test('persists a valid dead letter before acknowledging it', async () => {
  const message = fakeMessage({ type: 'order.fulfillment.requested', providerEventId: 'event-123' }, 6)
  const recorded: Parameters<DeadLetterRecorder['record']>[0][] = []
  await consumeCommerceDeadLetterBatch(fakeBatch(message, 'accesshub-commerce-events-dlq'), {
    async record(input) { recorded.push(input) },
  })

  assert.equal(message.acked, true)
  assert.equal(message.retryDelay, null)
  assert.deepEqual(recorded, [{
    queueName: 'accesshub-commerce-events-dlq',
    messageId: 'message-1',
    payload: { type: 'order.fulfillment.requested', providerEventId: 'event-123' },
    deliveryAttempts: 6,
    failedAt: '2026-09-17T00:00:00.000Z',
    replayable: true,
  }])
})

test('persists malformed dead letters as non-replayable evidence', async () => {
  const message = fakeMessage('broken')
  const recorded: Parameters<DeadLetterRecorder['record']>[0][] = []
  await consumeCommerceDeadLetterBatch(fakeBatch(message, 'accesshub-commerce-events-dlq'), {
    async record(input) { recorded.push(input) },
  })

  assert.equal(message.acked, true)
  assert.equal(recorded[0]?.replayable, false)
  assert.deepEqual(recorded[0]?.payload, { value: 'broken' })
})

test('retries a dead letter when durable persistence fails', async () => {
  const message = fakeMessage({ type: 'order.fulfillment.requested', providerEventId: 'event-123' }, 2)
  await consumeCommerceDeadLetterBatch(fakeBatch(message, 'accesshub-commerce-events-dlq'), {
    async record() { throw new Error('database unavailable') },
  })

  assert.equal(message.acked, false)
  assert.equal(message.retryDelay, 60)
})
