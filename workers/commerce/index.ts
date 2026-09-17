import type { CommerceEnv } from './env.ts'
import { executeCommerceCommand } from './internal-command.ts'
import { errorMessage, log } from './logging.ts'
import { cloudflareWorkflowStarter, consumeCommerceBatch } from './queue.ts'

export { OrderFulfillmentWorkflow, SubscriptionPeriodWorkflow } from './workflows.ts'

export default {
  async fetch(): Promise<Response> {
    return new Response('Not found', { status: 404 })
  },

  async queue(batch, env): Promise<void> {
    await consumeCommerceBatch(batch, cloudflareWorkflowStarter(env))
  },

  async scheduled(controller, env): Promise<void> {
    const scheduledAt = new Date(controller.scheduledTime).toISOString()
    try {
      const outboxResult = await executeCommerceCommand(env, {
        type: 'outbox.dispatch',
        scheduledAt,
      })
      const reconciliationResult = await executeCommerceCommand(env, {
        type: 'subscriptions.reconcile_due',
        scheduledAt,
      })
      log('info', 'commerce.subscription_reconciliation.completed', {
        cron: controller.cron,
        scheduledAt,
        outboxOutcome: outboxResult.outcome,
        reconciliationOutcome: reconciliationResult.outcome,
      })
    } catch (error) {
      log('error', 'commerce.subscription_reconciliation.failed', {
        cron: controller.cron,
        scheduledAt,
        error: errorMessage(error),
      })
      throw error
    }
  },
} satisfies ExportedHandler<CommerceEnv>
