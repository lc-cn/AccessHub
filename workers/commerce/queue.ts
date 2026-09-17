import type { CommerceQueueMessage } from './contracts.ts'
import {
  orderWorkflowId,
  parseCommerceQueueMessage,
  queueRetryDelaySeconds,
  subscriptionWorkflowId,
} from './contracts.ts'
import type { CommerceEnv } from './env.ts'
import { errorMessage, log } from './logging.ts'
import type { QueueMessageBatch } from './platform.ts'

export interface WorkflowStarter {
  start(message: CommerceQueueMessage): Promise<string>
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
