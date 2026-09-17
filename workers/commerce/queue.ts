import type { CommerceQueueMessage } from './contracts.ts'
import {
  orderWorkflowId,
  parseCommerceQueueMessage,
  queueRetryDelaySeconds,
  subscriptionWorkflowId,
} from './contracts.ts'
import type { CommerceEnv } from './env.ts'
import { executeCommerceCommand } from './internal-command.ts'
import { errorMessage, log } from './logging.ts'
import type { QueueMessageBatch } from './platform.ts'

export interface WorkflowStarter {
  start(message: CommerceQueueMessage): Promise<string>
}

export interface DeadLetterRecorder {
  record(input: {
    queueName: string
    messageId: string
    payload: Record<string, unknown>
    deliveryAttempts: number
    failedAt: string
    replayable: boolean
  }): Promise<void>
}

function deadLetterPayload(value: unknown) {
  const parsed = parseCommerceQueueMessage(value)
  if (parsed) return { payload: parsed as unknown as Record<string, unknown>, replayable: true }
  try {
    const serializable = JSON.parse(JSON.stringify(value)) as unknown
    if (typeof serializable === 'object' && serializable !== null && !Array.isArray(serializable)) {
      return { payload: serializable as Record<string, unknown>, replayable: false }
    }
    return { payload: { value: serializable ?? null }, replayable: false }
  } catch {
    return { payload: { value: String(value), serializationError: true }, replayable: false }
  }
}

export function cloudflareDeadLetterRecorder(env: CommerceEnv): DeadLetterRecorder {
  return {
    async record(input) {
      await executeCommerceCommand(env, { type: 'dead-letter.record', ...input })
    },
  }
}

export function cloudflareWorkflowStarter(env: CommerceEnv): WorkflowStarter {
  return {
    async start(message) {
      if (message.type === 'order.fulfillment.requested') {
        const id = orderWorkflowId(message.providerEventId)
        await env.ORDER_FULFILLMENT.createBatch([{
          id,
          params: { providerEventId: message.providerEventId },
        }])
        return id
      }

      const id = subscriptionWorkflowId(message.subscriptionId, message.periodEnd)
      await env.SUBSCRIPTION_PERIOD.createBatch([{
        id,
        params: { subscriptionId: message.subscriptionId, periodEnd: message.periodEnd },
      }])
      return id
    },
  }
}

export async function consumeCommerceBatch(
  batch: QueueMessageBatch<unknown>,
  starter: WorkflowStarter,
) {
  for (const message of batch.messages) {
    try {
      const parsed = parseCommerceQueueMessage(message.body)
      if (!parsed) throw new Error('invalid commerce queue message')
      const workflowId = await starter.start(parsed)
      message.ack()
      log('info', 'commerce.queue.acknowledged', {
        messageId: message.id,
        messageType: parsed.type,
        workflowId,
        attempts: message.attempts,
      })
    } catch (error) {
      const delaySeconds = queueRetryDelaySeconds(message.attempts)
      message.retry({ delaySeconds })
      log('error', 'commerce.queue.retry_scheduled', {
        messageId: message.id,
        attempts: message.attempts,
        delaySeconds,
        error: errorMessage(error),
      })
    }
  }
}

export async function consumeCommerceDeadLetterBatch(
  batch: QueueMessageBatch<unknown>,
  recorder: DeadLetterRecorder,
) {
  for (const message of batch.messages) {
    try {
      const normalized = deadLetterPayload(message.body)
      await recorder.record({
        queueName: batch.queue,
        messageId: message.id,
        payload: normalized.payload,
        deliveryAttempts: message.attempts,
        failedAt: message.timestamp.toISOString(),
        replayable: normalized.replayable,
      })
      message.ack()
      log('info', 'commerce.dead_letter.persisted', {
        messageId: message.id,
        replayable: normalized.replayable,
        attempts: message.attempts,
      })
    } catch (error) {
      message.retry({ delaySeconds: queueRetryDelaySeconds(message.attempts) })
      log('error', 'commerce.dead_letter.persistence_failed', {
        messageId: message.id,
        attempts: message.attempts,
        error: errorMessage(error),
      })
    }
  }
}
