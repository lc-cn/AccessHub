import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import {
  CommerceCommandError,
  deliverAfdianProviderEvent,
  dispatchPendingCommerceEvents,
  fulfillAfdianProviderEvent,
  reconcileSubscriptionPeriod,
} from '@/lib/commerce-orchestration'
import { expireDueSubscriptions } from '@/lib/subscription-service'

type CommerceCommand =
  | { type: 'order.fulfill'; providerEventId: string }
  | { type: 'order.deliver'; providerEventId: string }
  | { type: 'subscription.period.reconcile'; subscriptionId: string; expectedPeriodEnd: string }
  | { type: 'subscriptions.reconcile_due'; scheduledAt: string }
  | { type: 'outbox.dispatch'; scheduledAt: string }

function safeEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

function authorized(request: Request) {
  const expected = process.env.COMMERCE_INTERNAL_SECRET
  if (!expected) return false
  const authorization = request.headers.get('authorization') || ''
  const actual = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  return safeEqual(actual, expected)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function parseCommand(value: unknown): CommerceCommand | null {
  if (!value || typeof value !== 'object') return null
  const body = value as Record<string, unknown>
  if (body.type === 'order.fulfill' && isNonEmptyString(body.providerEventId)) return { type: body.type, providerEventId: body.providerEventId }
  if (body.type === 'order.deliver' && isNonEmptyString(body.providerEventId)) return { type: body.type, providerEventId: body.providerEventId }
  if (body.type === 'subscription.period.reconcile' && isNonEmptyString(body.subscriptionId) && isNonEmptyString(body.expectedPeriodEnd)) {
    return { type: body.type, subscriptionId: body.subscriptionId, expectedPeriodEnd: body.expectedPeriodEnd }
  }
  if ((body.type === 'subscriptions.reconcile_due' || body.type === 'outbox.dispatch') && isNonEmptyString(body.scheduledAt)) {
    return { type: body.type, scheduledAt: body.scheduledAt }
  }
  return null
}

function success(outcome: string, data: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, outcome, ...data })
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'unauthorized', retryable: false }, { status: 401 })
  const command = parseCommand(await request.json().catch(() => null))
  if (!command) return NextResponse.json({ error: 'invalid commerce command', retryable: false }, { status: 400 })

  try {
    if (command.type === 'order.fulfill') {
      const result = await fulfillAfdianProviderEvent(command.providerEventId)
      return success(result.duplicate ? 'already_fulfilled' : 'fulfilled', result)
    }
    if (command.type === 'order.deliver') {
      const result = await deliverAfdianProviderEvent(command.providerEventId)
      if (result.outcome === 'failed') return NextResponse.json({ ...result, retryable: true }, { status: 503 })
      return success(result.outcome, result)
    }
    if (command.type === 'subscription.period.reconcile') {
      const result = await reconcileSubscriptionPeriod(command.subscriptionId, command.expectedPeriodEnd)
      return success(result.outcome, result)
    }
    if (command.type === 'outbox.dispatch') {
      const result = await dispatchPendingCommerceEvents()
      return success('dispatched', result)
    }
    return success('reconciled', { expired: await expireDueSubscriptions(new Date(command.scheduledAt)) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'commerce command failed'
    const retryable = error instanceof CommerceCommandError ? error.retryable : true
    return NextResponse.json({ error: message, retryable }, { status: retryable ? 503 : 422 })
  }
}
