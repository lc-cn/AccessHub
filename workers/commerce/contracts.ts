export type OrderFulfillmentRequested = {
  type: 'order.fulfillment.requested'
  providerEventId: string
}

export type SubscriptionPeriodScheduled = {
  type: 'subscription.period.scheduled'
  subscriptionId: string
  periodEnd: string
}

export type CommerceQueueMessage = OrderFulfillmentRequested | SubscriptionPeriodScheduled

export type OrderFulfillmentParams = {
  providerEventId: string
}

export type SubscriptionPeriodParams = {
  subscriptionId: string
  periodEnd: string
}

export type CommerceCommand =
  | { type: 'order.fulfill'; providerEventId: string }
  | { type: 'order.deliver'; providerEventId: string }
  | { type: 'subscription.period.reconcile'; subscriptionId: string; expectedPeriodEnd: string }
  | { type: 'outbox.dispatch'; scheduledAt: string }
  | { type: 'subscriptions.reconcile_due'; scheduledAt: string }
  | { type: 'dead-letter.record'; queueName: string; messageId: string; payload: Record<string, unknown>; deliveryAttempts: number; failedAt: string; replayable: boolean }

export type CommerceCommandResult = {
  ok: true
  outcome: string
}

export type CommerceCommandError = {
  error: string
  retryable: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 64 && /^[A-Za-z0-9_-]+$/.test(value)
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

export function parseCommerceQueueMessage(value: unknown): CommerceQueueMessage | null {
  if (!isRecord(value)) return null
  if (value.type === 'order.fulfillment.requested' && isIdentifier(value.providerEventId)) {
    return { type: value.type, providerEventId: value.providerEventId }
  }
  if (
    value.type === 'subscription.period.scheduled'
    && isIdentifier(value.subscriptionId)
    && isIsoTimestamp(value.periodEnd)
  ) {
    return { type: value.type, subscriptionId: value.subscriptionId, periodEnd: value.periodEnd }
  }
  return null
}

export function orderWorkflowId(providerEventId: string) {
  return `order-${providerEventId}`
}

export function subscriptionWorkflowId(subscriptionId: string, periodEnd: string) {
  return `subscription-${subscriptionId}-${Date.parse(periodEnd)}`
}

export function queueRetryDelaySeconds(attempts: number) {
  const normalizedAttempts = Number.isFinite(attempts) ? Math.max(1, Math.floor(attempts)) : 1
  return Math.min(900, 30 * (2 ** (normalizedAttempts - 1)))
}
