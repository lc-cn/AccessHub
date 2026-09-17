import { randomBytes, randomUUID } from 'node:crypto'
import { and, eq, inArray, lt, lte, or, sql } from 'drizzle-orm'
import { resolveAfdianWebhookOffer } from '@/lib/afadian-benefits'
import { buildRedemptionMessage, messageDeliveryAction, orderDurationMonths, type AfdianMessageStatus } from '@/lib/afdian-commerce'
import { sendAfdianPrivateMessage } from '@/lib/afdian-messenger'
import { parseAfdianWebhook, type AfdianOrderPayload, type ParsedAfdianWebhook } from '@/lib/afdian-webhook'
import { nextRetryAt, outboxDeduplicationKey } from '@/lib/commerce-events'
import { db } from '@/lib/db'
import {
  account,
  activityLogs,
  externalEffectAttempts,
  orders,
  outboxEvents,
  payments,
  providerEvents,
  providerOfferMappings,
  redeemCodes,
  skus,
  subscriptionEvents,
  subscriptions,
  subscriptionPlans,
} from '@/lib/db/schema'
import { legacyDurationDays, type EntitlementUnit, type RedeemKind } from '@/lib/entitlements'
import { getCommerceQueue } from '#accesshub-platform-bindings'
import { transitionSubscription } from '@/lib/subscription-service'

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export class CommerceCommandError extends Error {
  readonly retryable: boolean

  constructor(message: string, retryable: boolean) {
    super(message)
    this.name = 'CommerceCommandError'
    this.retryable = retryable
  }
}

export async function recordAfdianProviderEvent(rawPayload: string, parsed: Extract<ParsedAfdianWebhook, { outcome: 'paid' | 'probe' }>) {
  return db.transaction(async (tx) => {
    const now = new Date()
    const [providerEvent] = await tx.insert(providerEvents).values({
      id: randomUUID(),
      providerId: 'psp-afdian',
      externalEventId: parsed.outTradeNo,
      type: 'order.paid',
      rawPayload,
      status: parsed.outcome === 'probe' ? 'ignored' : 'received',
      processedAt: parsed.outcome === 'probe' ? now : null,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [providerEvents.providerId, providerEvents.externalEventId, providerEvents.type],
      set: { rawPayload, updatedAt: now },
    }).returning({ id: providerEvents.id, status: providerEvents.status })

    if (parsed.outcome === 'probe') return { providerEventId: providerEvent.id, outboxEventId: null, probe: true }

    const deduplicationKey = outboxDeduplicationKey('psp-afdian', parsed.outTradeNo, 'order.paid')
    const [created] = await tx.insert(outboxEvents).values({
      id: randomUUID(),
      aggregateType: 'provider_event',
      aggregateId: providerEvent.id,
      eventType: 'order.fulfillment.requested',
      destination: 'commerce',
      deduplicationKey,
      payload: { type: 'order.fulfillment.requested', providerEventId: providerEvent.id },
    }).onConflictDoNothing({ target: [outboxEvents.destination, outboxEvents.deduplicationKey] }).returning({ id: outboxEvents.id })

    const outboxEvent = created ?? (await tx.select({ id: outboxEvents.id }).from(outboxEvents).where(and(
      eq(outboxEvents.destination, 'commerce'),
      eq(outboxEvents.deduplicationKey, deduplicationKey),
    )).limit(1))[0]
    return { providerEventId: providerEvent.id, outboxEventId: outboxEvent?.id ?? null, probe: false }
  })
}

export async function enqueueSubscriptionPeriod(tx: Transaction, input: { subscriptionId: string; periodEnd: Date }) {
  const periodEnd = input.periodEnd.toISOString()
  const deduplicationKey = outboxDeduplicationKey('subscription', input.subscriptionId, 'period', periodEnd)
  const [created] = await tx.insert(outboxEvents).values({
    id: randomUUID(),
    aggregateType: 'subscription',
    aggregateId: input.subscriptionId,
    eventType: 'subscription.period.scheduled',
    destination: 'commerce',
    deduplicationKey,
    payload: { type: 'subscription.period.scheduled', subscriptionId: input.subscriptionId, periodEnd },
  }).onConflictDoNothing({ target: [outboxEvents.destination, outboxEvents.deduplicationKey] }).returning({ id: outboxEvents.id })
  if (created) return created.id
  const [existing] = await tx.select({ id: outboxEvents.id }).from(outboxEvents).where(and(
    eq(outboxEvents.destination, 'commerce'),
    eq(outboxEvents.deduplicationKey, deduplicationKey),
  )).limit(1)
  return existing?.id ?? null
}

export async function dispatchPendingCommerceEvents(options: { ids?: string[]; limit?: number } = {}) {
  const queue = getCommerceQueue()
  if (!queue) return { available: false, published: 0, failed: 0 }

  const now = new Date()
  const staleClaim = new Date(now.getTime() - 5 * 60_000)
  const candidates = await db.select({ id: outboxEvents.id }).from(outboxEvents).where(and(
    eq(outboxEvents.destination, 'commerce'),
    options.ids?.length ? inArray(outboxEvents.id, options.ids) : undefined,
    lte(outboxEvents.availableAt, now),
    or(
      inArray(outboxEvents.status, ['pending', 'failed']),
      and(eq(outboxEvents.status, 'publishing'), lt(outboxEvents.claimedAt, staleClaim)),
    ),
  )).orderBy(outboxEvents.createdAt).limit(Math.min(Math.max(options.limit ?? 100, 1), 100))

  let published = 0
  let failed = 0
  for (const candidate of candidates) {
    const claimedAt = new Date()
    const [claimed] = await db.update(outboxEvents).set({
      status: 'publishing',
      claimedAt,
      claimedBy: crypto.randomUUID(),
      attemptCount: sql`${outboxEvents.attemptCount} + 1`,
      lastError: null,
      updatedAt: claimedAt,
    }).where(and(
      eq(outboxEvents.id, candidate.id),
      or(
        inArray(outboxEvents.status, ['pending', 'failed']),
        and(eq(outboxEvents.status, 'publishing'), lt(outboxEvents.claimedAt, staleClaim)),
      ),
    )).returning({ id: outboxEvents.id, aggregateId: outboxEvents.aggregateId, payload: outboxEvents.payload, attemptCount: outboxEvents.attemptCount })
    if (!claimed) continue

    await db.update(providerEvents).set({ status: 'queued', queuedAt: claimedAt, nextAttemptAt: null, error: null, updatedAt: claimedAt }).where(and(
      eq(providerEvents.id, claimed.aggregateId),
      inArray(providerEvents.status, ['received', 'failed']),
    ))

    try {
      await queue.send(claimed.payload, { contentType: 'json' })
      const completedAt = new Date()
      await db.transaction(async (tx) => {
        await tx.update(outboxEvents).set({ status: 'published', publishedAt: completedAt, updatedAt: completedAt }).where(eq(outboxEvents.id, claimed.id))
        await tx.update(providerEvents).set({ queuedAt: completedAt, nextAttemptAt: null, error: null, updatedAt: completedAt }).where(and(
          eq(providerEvents.id, claimed.aggregateId),
          eq(providerEvents.status, 'queued'),
        ))
      })
      published += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : 'queue publish failed'
      const retryAt = nextRetryAt(new Date(), claimed.attemptCount)
      await db.update(outboxEvents).set({ status: 'failed', availableAt: retryAt, lastError: message.slice(0, 500), updatedAt: new Date() }).where(eq(outboxEvents.id, claimed.id))
      await db.update(providerEvents).set({ status: 'failed', nextAttemptAt: retryAt, error: message.slice(0, 500), updatedAt: new Date() }).where(and(
        eq(providerEvents.id, claimed.aggregateId),
        inArray(providerEvents.status, ['received', 'queued', 'failed']),
      ))
      failed += 1
    }
  }
  return { available: true, published, failed }
}

function orderIdentity(order: AfdianOrderPayload) {
  const outTradeNo = String(order.out_trade_no || '').trim()
  const afdianPlanId = String(order.plan_id || '').trim()
  const afdianUserId = String(order.user_id || '').trim()
  const months = orderDurationMonths(order.month)
  const skuDetails = Array.isArray(order.sku_detail) ? order.sku_detail as AfdianOrderPayload[] : []
  const skuIds = skuDetails.map((item) => String(item.sku_id || '')).filter(Boolean)
  if (!outTradeNo || !afdianUserId || !months) throw new CommerceCommandError('stored provider event has an invalid paid order', false)
  return { outTradeNo, afdianPlanId, afdianUserId, months, skuDetails, skuIds }
}

export async function fulfillAfdianProviderEvent(providerEventId: string) {
  const [providerEvent] = await db.select().from(providerEvents).where(and(
    eq(providerEvents.id, providerEventId),
    eq(providerEvents.providerId, 'psp-afdian'),
  )).limit(1)
  if (!providerEvent) throw new CommerceCommandError('provider event not found', false)

  const parsed = parseAfdianWebhook(providerEvent.rawPayload)
  if (parsed.outcome !== 'paid') throw new CommerceCommandError(`provider event is not a fulfillable order: ${parsed.outcome}`, false)
  const identity = orderIdentity(parsed.order)
  const workflowInstanceId = `order-${providerEvent.id}`
  const startedAt = new Date()
  await db.update(providerEvents).set({
    status: 'processing',
    workflowInstanceId,
    processingStartedAt: providerEvent.processingStartedAt ?? startedAt,
    attemptCount: sql`${providerEvents.attemptCount} + 1`,
    error: null,
    updatedAt: startedAt,
  }).where(and(eq(providerEvents.id, providerEvent.id), inArray(providerEvents.status, ['received', 'queued', 'processing', 'workflow_started', 'failed'])))

  const storedMappings = await db.select({
    externalOfferType: providerOfferMappings.externalOfferType,
    externalOfferId: providerOfferMappings.externalOfferId,
    skuId: providerOfferMappings.skuId,
    enabled: providerOfferMappings.enabled,
    codesPerItem: providerOfferMappings.unitsPerItem,
    kind: skus.kind,
    planId: skus.planId,
    credits: skus.credits,
    durationValue: skus.durationValue,
    durationUnit: skus.durationUnit,
  }).from(providerOfferMappings).innerJoin(skus, eq(skus.id, providerOfferMappings.skuId)).where(and(
    eq(providerOfferMappings.providerId, 'psp-afdian'),
    eq(providerOfferMappings.enabled, true),
    eq(skus.active, true),
  ))
  const resolution = resolveAfdianWebhookOffer(storedMappings.map((mapping) => ({
    offerKey: `afdian-${mapping.externalOfferType}:${mapping.externalOfferId}`,
    enabled: mapping.enabled,
    kind: mapping.kind as RedeemKind,
    planId: mapping.planId ?? undefined,
    credits: mapping.credits ?? undefined,
    durationValue: mapping.durationValue,
    durationUnit: mapping.durationUnit as EntitlementUnit,
    codesPerItem: mapping.codesPerItem,
  })), identity)
  if (resolution.outcome !== 'mapped') {
    const error = resolution.outcome === 'probe' ? 'probe event cannot be fulfilled' : 'no valid Afdian offer mapping for this plan or sku'
    await db.update(providerEvents).set({ status: resolution.outcome === 'probe' ? 'ignored' : 'failed', error, processedAt: new Date(), updatedAt: new Date() }).where(eq(providerEvents.id, providerEvent.id))
    throw new CommerceCommandError(error, false)
  }

  const itemCount = identity.skuDetails.length
    ? identity.skuDetails.reduce((total, item) => total + Math.max(0, Number(item.count) || 0), 0)
    : 1
  const codeCount = Math.max(1, itemCount) * resolution.resolved.benefit.codesPerItem
  if (codeCount > 1000) throw new CommerceCommandError('order would generate more than 1000 codes', false)

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${identity.outTradeNo}))`)
    const [existing] = await tx.select({ id: orders.id, termMonths: orders.termMonths }).from(orders).where(and(
      eq(orders.providerId, 'psp-afdian'),
      eq(orders.externalOrderId, identity.outTradeNo),
    )).limit(1)
    if (existing) {
      const existingCodes = await tx.select({ code: redeemCodes.code }).from(redeemCodes).where(eq(redeemCodes.orderId, existing.id))
      await tx.update(providerEvents).set({ status: 'processed', processedAt: new Date(), error: null, updatedAt: new Date() }).where(eq(providerEvents.id, providerEvent.id))
      return { providerEventId, orderId: existing.id, duplicate: true, codeCount: existingCodes.length, months: existing.termMonths }
    }

    if (resolution.resolved.benefit.kind === 'plan') {
      const [plan] = await tx.select({ id: subscriptionPlans.id }).from(subscriptionPlans).where(eq(subscriptionPlans.id, resolution.resolved.benefit.planId!)).limit(1)
      if (!plan) throw new CommerceCommandError('mapped subscription plan does not exist', false)
    }

    const orderId = randomUUID()
    const durationValue = resolution.resolved.benefit.kind === 'plan' ? identity.months : resolution.resolved.benefit.durationValue
    const durationUnit = resolution.resolved.benefit.kind === 'plan' ? 'month' : resolution.resolved.benefit.durationUnit
    const values = Array.from({ length: codeCount }, () => ({
      id: randomUUID(),
      code: `AFD-${randomBytes(4).toString('hex').toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`,
      kind: resolution.resolved.benefit.kind,
      planId: resolution.resolved.benefit.kind === 'plan' ? resolution.resolved.benefit.planId! : null,
      credits: resolution.resolved.benefit.kind === 'credits' ? resolution.resolved.benefit.credits! : null,
      durationDays: legacyDurationDays(durationValue, durationUnit),
      durationValue,
      durationUnit,
      orderId,
      subscriptionId: resolution.resolved.benefit.kind === 'plan' ? randomUUID() : null,
    }))
    await tx.insert(redeemCodes).values(values)
    const matchedMapping = storedMappings.find((mapping) => `afdian-${mapping.externalOfferType}:${mapping.externalOfferId}` === resolution.resolved.key)
    if (!matchedMapping) throw new CommerceCommandError('resolved offer mapping disappeared', true)
    const [linkedAccount] = await tx.select({ userId: account.userId }).from(account).where(and(
      eq(account.providerId, 'afdian'),
      eq(account.accountId, identity.afdianUserId),
    )).limit(1)
    await tx.insert(orders).values({
      id: orderId,
      providerId: 'psp-afdian',
      externalOrderId: identity.outTradeNo,
      externalCustomerId: identity.afdianUserId,
      externalOfferId: identity.afdianPlanId,
      externalOfferTitle: String(parsed.order.plan_title || parsed.order.title || '').trim(),
      userId: linkedAccount?.userId || null,
      skuId: matchedMapping.skuId,
      status: 'paid',
      termMonths: identity.months,
      amount: String(parsed.order.total_amount || '').trim(),
      currency: 'CNY',
      deliveryStatus: 'pending',
    })
    await tx.insert(payments).values({ id: randomUUID(), orderId, providerId: 'psp-afdian', externalPaymentId: identity.outTradeNo, status: 'succeeded', amount: String(parsed.order.total_amount || '').trim(), currency: 'CNY', paidAt: new Date() })
    const subscriptionIds = values.flatMap((item) => item.subscriptionId ? [item.subscriptionId] : [])
    if (subscriptionIds.length) {
      await tx.insert(subscriptions).values(subscriptionIds.map((subscriptionId) => ({ id: subscriptionId, userId: linkedAccount?.userId || null, planId: resolution.resolved.benefit.planId!, skuId: matchedMapping.skuId, providerId: 'psp-afdian', status: 'pending_activation' })))
      await tx.insert(subscriptionEvents).values(subscriptionIds.map((subscriptionId) => ({ id: randomUUID(), subscriptionId, type: 'payment_confirmed', toStatus: 'pending_activation', providerEventId: providerEvent.id, detail: `order:${orderId}` })))
    }
    const completedAt = new Date()
    await tx.update(providerEvents).set({ status: 'processed', processedAt: completedAt, error: null, updatedAt: completedAt }).where(eq(providerEvents.id, providerEvent.id))
    await tx.insert(activityLogs).values({ id: randomUUID(), action: 'order.received', resourceType: 'order', resourceId: orderId, detail: `afdian:${identity.outTradeNo}` })
    return { providerEventId, orderId, duplicate: false, codeCount: values.length, months: identity.months }
  })
}

export async function deliverAfdianProviderEvent(providerEventId: string) {
  const [providerEvent] = await db.select({ externalOrderId: providerEvents.externalEventId }).from(providerEvents).where(and(
    eq(providerEvents.id, providerEventId),
    eq(providerEvents.providerId, 'psp-afdian'),
  )).limit(1)
  if (!providerEvent) throw new CommerceCommandError('provider event not found', false)
  const [order] = await db.select().from(orders).where(and(
    eq(orders.providerId, 'psp-afdian'),
    eq(orders.externalOrderId, providerEvent.externalOrderId),
  )).limit(1)
  if (!order) throw new CommerceCommandError('fulfilled order not found', true)
  const codes = await db.select({ code: redeemCodes.code }).from(redeemCodes).where(eq(redeemCodes.orderId, order.id))
  if (!codes.length) return { outcome: 'not_requested' as const, orderId: order.id }
  if (!order.externalCustomerId) throw new CommerceCommandError('order has no Afdian recipient', false)

  const idempotencyKey = `afdian-order-message:${order.id}`
  const claim = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${order.id}))`)
    const [currentOrder] = await tx.select().from(orders).where(eq(orders.id, order.id)).limit(1)
    const status = currentOrder?.deliveryStatus as AfdianMessageStatus | undefined
    const action = messageDeliveryAction(status)
    if (action === 'complete') return { send: false as const, outcome: status ?? 'sent' }
    const [effect] = await tx.select().from(externalEffectAttempts).where(and(
      eq(externalEffectAttempts.effectType, 'afdian.private_message'),
      eq(externalEffectAttempts.idempotencyKey, idempotencyKey),
    )).limit(1)
    if (action === 'hold' || effect?.status === 'unknown') return { send: false as const, outcome: 'unknown' as const }
    if (action === 'mark_unknown' || effect?.status === 'claimed') {
      const message = '上一次私信发送结果未知，已停止自动重试'
      await tx.update(orders).set({ deliveryStatus: 'unknown', deliveryLastError: message, updatedAt: new Date() }).where(eq(orders.id, order.id))
      if (effect) await tx.update(externalEffectAttempts).set({ status: 'unknown', completedAt: new Date(), lastError: message, updatedAt: new Date() }).where(eq(externalEffectAttempts.id, effect.id))
      return { send: false as const, outcome: 'unknown' as const }
    }
    if (effect?.status === 'succeeded') {
      await tx.update(orders).set({ deliveryStatus: 'sent', deliveredAt: effect.completedAt, deliveryLastError: null, updatedAt: new Date() }).where(eq(orders.id, order.id))
      return { send: false as const, outcome: 'sent' as const }
    }

    const attemptedAt = new Date()
    let effectId: string
    if (effect) {
      effectId = effect.id
      await tx.update(externalEffectAttempts).set({ status: 'claimed', attemptCount: sql`${externalEffectAttempts.attemptCount} + 1`, claimedAt: attemptedAt, completedAt: null, nextAttemptAt: null, lastError: null, updatedAt: attemptedAt }).where(eq(externalEffectAttempts.id, effect.id))
    } else {
      effectId = randomUUID()
      await tx.insert(externalEffectAttempts).values({ id: effectId, providerEventId, orderId: order.id, effectType: 'afdian.private_message', idempotencyKey, target: order.externalCustomerId!, requestPayload: { codeCount: codes.length, months: order.termMonths } })
    }
    await tx.update(orders).set({ deliveryStatus: 'sending', deliveryAttempts: sql`${orders.deliveryAttempts} + 1`, deliveryAttemptedAt: attemptedAt, deliveryLastError: null, updatedAt: attemptedAt }).where(eq(orders.id, order.id))
    return { send: true as const, effectId }
  })
  if (!claim.send) return { outcome: claim.outcome, orderId: order.id }

  const siteUrl = process.env.BETTER_AUTH_URL || 'https://l2cl.link'
  const result = await sendAfdianPrivateMessage(order.externalCustomerId, buildRedemptionMessage({ codes: codes.map((item) => item.code), months: order.termMonths, siteUrl }))
  const completedAt = new Date()
  if (result.outcome === 'sent') {
    await db.transaction(async (tx) => {
      await tx.update(externalEffectAttempts).set({ status: 'succeeded', completedAt, responsePayload: { outcome: 'sent' }, lastError: null, updatedAt: completedAt }).where(eq(externalEffectAttempts.id, claim.effectId))
      await tx.update(orders).set({ deliveryStatus: 'sent', deliveredAt: completedAt, deliveryLastError: null, updatedAt: completedAt }).where(eq(orders.id, order.id))
    })
    return { outcome: 'sent' as const, orderId: order.id }
  }

  const retryAt = result.outcome === 'failed' ? nextRetryAt(completedAt, Math.max(1, order.deliveryAttempts + 1), { baseDelayMs: 30_000 }) : null
  await db.transaction(async (tx) => {
    await tx.update(externalEffectAttempts).set({ status: result.outcome, completedAt, nextAttemptAt: retryAt, responsePayload: { outcome: result.outcome }, lastError: result.error.slice(0, 500), updatedAt: completedAt }).where(eq(externalEffectAttempts.id, claim.effectId))
    await tx.update(orders).set({ deliveryStatus: result.outcome, deliveryLastError: result.error.slice(0, 500), updatedAt: completedAt }).where(eq(orders.id, order.id))
  })
  return { outcome: result.outcome, orderId: order.id, error: result.error }
}

export async function reconcileUnknownAfdianDelivery(input: {
  orderId: string
  actorId: string
  decision: 'confirmed_sent' | 'confirmed_not_sent'
}) {
  const [target] = await db.select({
    id: orders.id,
    providerId: orders.providerId,
    externalOrderId: orders.externalOrderId,
    deliveryStatus: orders.deliveryStatus,
    deliveredAt: orders.deliveredAt,
    providerEventId: providerEvents.id,
  }).from(orders).leftJoin(providerEvents, and(
    eq(providerEvents.providerId, orders.providerId),
    eq(providerEvents.externalEventId, orders.externalOrderId),
  )).where(eq(orders.id, input.orderId)).limit(1)
  if (!target) throw new CommerceCommandError('订单不存在', false)
  if (target.providerId !== 'psp-afdian') throw new CommerceCommandError('该订单不支持爱发电私信核对', false)
  if (target.deliveryStatus !== 'unknown') throw new CommerceCommandError('订单当前不需要人工核对', false)
  if (!target.providerEventId) throw new CommerceCommandError('订单缺少关联的支付事件', false)

  const decidedAt = new Date()
  if (input.decision === 'confirmed_sent') {
    await db.transaction(async (tx) => {
      const [claimedOrder] = await tx.update(orders).set({
        deliveryStatus: 'sent',
        deliveredAt: target.deliveredAt ?? decidedAt,
        deliveryLastError: null,
        updatedAt: decidedAt,
      }).where(and(eq(orders.id, target.id), eq(orders.deliveryStatus, 'unknown'))).returning({ id: orders.id })
      if (!claimedOrder) throw new CommerceCommandError('订单已被其他操作处理，请刷新后重试', false)
      await tx.update(externalEffectAttempts).set({
        status: 'succeeded',
        completedAt: decidedAt,
        nextAttemptAt: null,
        responsePayload: { outcome: 'sent', reconciledBy: input.actorId },
        lastError: null,
        updatedAt: decidedAt,
      }).where(and(
        eq(externalEffectAttempts.orderId, target.id),
        eq(externalEffectAttempts.effectType, 'afdian.private_message'),
      ))
      await tx.insert(activityLogs).values({
        id: randomUUID(),
        actorId: input.actorId,
        action: 'order.delivery_reconciled_sent',
        resourceType: 'order',
        resourceId: target.id,
        detail: '管理员已在爱发电侧确认私信送达',
      })
    })
    return { outcome: 'sent' as const, orderId: target.id }
  }

  await db.transaction(async (tx) => {
    const [claimedOrder] = await tx.update(orders).set({
      deliveryStatus: 'failed',
      deliveryLastError: '管理员已确认上一次私信未送达，正在人工重试',
      updatedAt: decidedAt,
    }).where(and(eq(orders.id, target.id), eq(orders.deliveryStatus, 'unknown'))).returning({ id: orders.id })
    if (!claimedOrder) throw new CommerceCommandError('订单已被其他操作处理，请刷新后重试', false)
    await tx.update(externalEffectAttempts).set({
      status: 'failed',
      completedAt: decidedAt,
      nextAttemptAt: decidedAt,
      responsePayload: { outcome: 'failed', reconciledBy: input.actorId },
      lastError: '管理员已确认上一次私信未送达',
      updatedAt: decidedAt,
    }).where(and(
      eq(externalEffectAttempts.orderId, target.id),
      eq(externalEffectAttempts.effectType, 'afdian.private_message'),
    ))
    await tx.insert(activityLogs).values({
      id: randomUUID(),
      actorId: input.actorId,
      action: 'order.delivery_reconciled_retry',
      resourceType: 'order',
      resourceId: target.id,
      detail: '管理员已确认上一次私信未送达并发起重试',
    })
  })
  return deliverAfdianProviderEvent(target.providerEventId)
}

export async function reconcileSubscriptionPeriod(subscriptionId: string, expectedPeriodEnd: string) {
  const expected = new Date(expectedPeriodEnd)
  if (!Number.isFinite(expected.getTime())) throw new CommerceCommandError('invalid expectedPeriodEnd', false)
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${subscriptionId}))`)
    const [subscription] = await tx.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId)).limit(1)
    if (!subscription) throw new CommerceCommandError('subscription not found', false)
    if (subscription.status === 'canceled' || subscription.status === 'expired') return { outcome: 'already_terminal' as const }
    if (!subscription.currentPeriodEnd || subscription.currentPeriodEnd.getTime() !== expected.getTime()) return { outcome: 'period_changed' as const }
    if (subscription.currentPeriodEnd > new Date()) return { outcome: 'not_due' as const }
    await transitionSubscription(tx, { subscriptionId, toStatus: 'expired', eventType: 'period_ended', detail: `workflow expected:${expected.toISOString()}` })
    return { outcome: 'expired' as const }
  })
}
