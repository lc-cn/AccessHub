import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from 'cloudflare:workers'
import { NonRetryableError } from 'cloudflare:workflows'
import type {
  CommerceCommand,
  OrderFulfillmentParams,
  SubscriptionPeriodParams,
} from './contracts.ts'
import type { CommerceEnv } from './env.ts'
import { CommerceCommandFailure, executeCommerceCommand } from './internal-command.ts'
import { log } from './logging.ts'

const COMMAND_STEP_CONFIG = {
  retries: {
    limit: 5,
    delay: '15 seconds' as const,
    backoff: 'exponential' as const,
  },
  timeout: '2 minutes' as const,
}

function validateWorkflowIdentifier(value: string, label: string) {
  if (!value || value.length > 64 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new NonRetryableError(`invalid ${label}`)
  }
}

async function runCommand(env: CommerceEnv, command: CommerceCommand) {
  try {
    return await executeCommerceCommand(env, command)
  } catch (error) {
    if (error instanceof CommerceCommandFailure && !error.retryable) {
      throw new NonRetryableError(error.message)
    }
    throw error
  }
}

export class OrderFulfillmentWorkflow extends WorkflowEntrypoint<CommerceEnv, OrderFulfillmentParams> {
  override async run(event: WorkflowEvent<OrderFulfillmentParams>, step: WorkflowStep) {
    validateWorkflowIdentifier(event.payload.providerEventId, 'provider event id')
    const fields = { instanceId: event.instanceId, providerEventId: event.payload.providerEventId }
    log('info', 'commerce.order_workflow.started', fields)

    const fulfillment = await step.do('fulfill order', COMMAND_STEP_CONFIG, async () => runCommand(this.env, {
      type: 'order.fulfill',
      providerEventId: event.payload.providerEventId,
    }))
    const delivery = await step.do('deliver order', COMMAND_STEP_CONFIG, async () => runCommand(this.env, {
      type: 'order.deliver',
      providerEventId: event.payload.providerEventId,
    }))

    log('info', 'commerce.order_workflow.completed', {
      ...fields,
      fulfillmentOutcome: fulfillment.outcome,
      deliveryOutcome: delivery.outcome,
    })
    return { fulfillmentOutcome: fulfillment.outcome, deliveryOutcome: delivery.outcome }
  }
}

export class SubscriptionPeriodWorkflow extends WorkflowEntrypoint<CommerceEnv, SubscriptionPeriodParams> {
  override async run(event: WorkflowEvent<SubscriptionPeriodParams>, step: WorkflowStep) {
    validateWorkflowIdentifier(event.payload.subscriptionId, 'subscription id')
    const periodEndMs = Date.parse(event.payload.periodEnd)
    if (!Number.isFinite(periodEndMs)) throw new NonRetryableError('invalid subscription period end')

    const fields = {
      instanceId: event.instanceId,
      subscriptionId: event.payload.subscriptionId,
      periodEnd: event.payload.periodEnd,
    }
    log('info', 'commerce.subscription_workflow.started', fields)
    await step.sleepUntil('wait for subscription period end', periodEndMs)
    const result = await step.do('reconcile subscription period', COMMAND_STEP_CONFIG, async () => runCommand(this.env, {
      type: 'subscription.period.reconcile',
      subscriptionId: event.payload.subscriptionId,
      expectedPeriodEnd: event.payload.periodEnd,
    }))
    log('info', 'commerce.subscription_workflow.completed', { ...fields, outcome: result.outcome })
    return { outcome: result.outcome }
  }
}
