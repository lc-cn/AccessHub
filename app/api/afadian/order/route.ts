import { randomBytes, randomUUID, timingSafeEqual } from 'crypto'
import { and, eq, or, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { account, activityLogs, orders, payments, providerEvents, providerOfferMappings, redeemCodes, skus, subscriptionEvents, subscriptions, subscriptionPlans } from '@/lib/db/schema'
import { resolveAfdianWebhookOffer } from '@/lib/afadian-benefits'
import { buildRedemptionMessage, messageDeliveryAction, orderDurationMonths, type AfdianMessageStatus } from '@/lib/afdian-commerce'
import { sendAfdianPrivateMessage } from '@/lib/afdian-messenger'
import { legacyDurationDays, type EntitlementUnit, type RedeemKind } from '@/lib/entitlements'

function response(ec: number, em: string, data?: Record<string, unknown>, status = 200) {
  return NextResponse.json({ ec, em, ...(data ? { data } : {}) }, { status })
}

function safeEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

function requestSecret(request: Request) {
  const authorization = request.headers.get('authorization')
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7)
  return request.headers.get('x-webhook-secret') || new URL(request.url).searchParams.get('token') || ''
}

async function deliverOrderMessage(orderId: string, recipient: string, codes: string[], months: number) {
  const [order] = await db.select({ status: orders.deliveryStatus }).from(orders).where(eq(orders.id, orderId)).limit(1)
  const status = order?.status as AfdianMessageStatus | undefined
  const action = messageDeliveryAction(status)
  if (action === 'complete') return status
  if (action === 'hold') return 'unknown'
  if (action === 'mark_unknown') {
    await db.update(orders).set({ deliveryStatus: 'unknown', deliveryLastError: '上一次私信发送结果未知，已停止自动重试' }).where(eq(orders.id, orderId))
    return 'unknown'
  }

  const attemptedAt = new Date()
  const [claimed] = await db.update(orders).set({
    deliveryStatus: 'sending',
    deliveryAttempts: sql`${orders.deliveryAttempts} + 1`,
    deliveryAttemptedAt: attemptedAt,
    deliveryLastError: null,
  }).where(and(eq(orders.id, orderId), or(eq(orders.deliveryStatus, 'pending'), eq(orders.deliveryStatus, 'failed')))).returning({ id: orders.id })
  if (!claimed) return 'unknown'

  const siteUrl = process.env.BETTER_AUTH_URL || 'https://l2cl.link'
  const result = await sendAfdianPrivateMessage(recipient, buildRedemptionMessage({ codes, months, siteUrl }))
  if (result.outcome === 'sent') {
    await db.update(orders).set({ deliveryStatus: 'sent', deliveredAt: new Date(), deliveryLastError: null }).where(eq(orders.id, orderId))
    return 'sent'
  }
  await db.update(orders).set({ deliveryStatus: result.outcome, deliveryLastError: result.error.slice(0, 500) }).where(eq(orders.id, orderId))
  return result.outcome
}

export async function POST(request: Request) {
  const expectedSecret = process.env.AFDIAN_WEBHOOK_SECRET
  if (!expectedSecret) return response(503, 'webhook secret is not configured', undefined, 503)
  if (!safeEqual(requestSecret(request), expectedSecret)) return response(401, 'invalid webhook secret', undefined, 401)

  const raw = await request.text()
  let payload: { data?: { type?: string; order?: Record<string, unknown> } }
  try { payload = JSON.parse(raw || '{}') as typeof payload } catch { return response(400, 'invalid json') }
  const order = payload.data?.order
  const outTradeNo = String(order?.out_trade_no || '').trim()
  if (payload.data?.type !== 'order' || !outTradeNo) return response(400, 'missing order')
  if (Number(order?.status) !== 2) return response(200, 'ignored unpaid order')

  const afdianPlanId = String(order?.plan_id || '').trim()
  const afdianUserId = String(order?.user_id || '').trim()
  const months = orderDurationMonths(order?.month)
  if (!afdianUserId) return response(422, 'paid order has no user_id')
  if (!months) return response(422, 'paid order has invalid month')

  const skuDetails = Array.isArray(order?.sku_detail) ? order.sku_detail as Array<Record<string, unknown>> : []
  const skuIds = skuDetails.map((item) => String(item.sku_id || '')).filter(Boolean)
  const [providerEvent] = await db.insert(providerEvents).values({ id: randomUUID(), providerId: 'psp-afdian', externalEventId: outTradeNo, type: 'order.paid', rawPayload: raw }).onConflictDoUpdate({ target: [providerEvents.providerId, providerEvents.externalEventId, providerEvents.type], set: { rawPayload: raw } }).returning({ id: providerEvents.id })
  const storedMappings = await db.select({
    id: providerOfferMappings.id,
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
  }).from(providerOfferMappings).innerJoin(skus, eq(skus.id, providerOfferMappings.skuId)).where(and(eq(providerOfferMappings.providerId, 'psp-afdian'), eq(providerOfferMappings.enabled, true), eq(skus.active, true)))
  const resolution = resolveAfdianWebhookOffer(storedMappings.map((mapping) => ({
    offerKey: `afdian-${mapping.externalOfferType}:${mapping.externalOfferId}`,
    enabled: mapping.enabled,
    kind: mapping.kind as RedeemKind,
    planId: mapping.planId ?? undefined,
    credits: mapping.credits ?? undefined,
    durationValue: mapping.durationValue,
    durationUnit: mapping.durationUnit as EntitlementUnit,
    codesPerItem: mapping.codesPerItem,
  })), { outTradeNo, afdianPlanId, skuIds })
  if (resolution.outcome === 'probe') {
    await db.update(providerEvents).set({ status: 'ignored', processedAt: new Date(), error: null }).where(eq(providerEvents.id, providerEvent.id))
    return response(200, 'ok', { probe: true })
  }
  if (resolution.outcome === 'unmapped') {
    await db.update(providerEvents).set({ status: 'failed', error: 'no valid offer mapping', processedAt: new Date() }).where(eq(providerEvents.id, providerEvent.id))
    return response(422, 'no valid Afdian offer mapping for this plan or sku')
  }
  const { resolved } = resolution

  const itemCount = skuDetails.length ? skuDetails.reduce((total, item) => total + Math.max(0, Number(item.count) || 0), 0) : 1
  const codeCount = Math.max(1, itemCount) * resolved.benefit.codesPerItem
  if (codeCount > 1000) {
    await db.update(providerEvents).set({ status: 'failed', error: 'order would generate more than 1000 codes', processedAt: new Date() }).where(eq(providerEvents.id, providerEvent.id))
    return response(422, 'order would generate more than 1000 codes')
  }

  try {
    const fulfillment = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${outTradeNo}))`)
      const [existing] = await tx.select({ id: orders.id, termMonths: orders.termMonths }).from(orders).where(and(eq(orders.providerId, 'psp-afdian'), eq(orders.externalOrderId, outTradeNo))).limit(1)
      if (existing) {
        const existingCodes = await tx.select({ code: redeemCodes.code }).from(redeemCodes).where(eq(redeemCodes.orderId, existing.id))
        await tx.update(providerEvents).set({ status: 'processed', processedAt: new Date(), error: null }).where(eq(providerEvents.id, providerEvent.id))
        return { orderId: existing.id, duplicate: true, codes: existingCodes.map((item) => item.code), months: existing.termMonths }
      }

      if (resolved.benefit.kind === 'plan') {
        const [plan] = await tx.select({ id: subscriptionPlans.id }).from(subscriptionPlans).where(eq(subscriptionPlans.id, resolved.benefit.planId!)).limit(1)
        if (!plan) throw new Error('mapped subscription plan does not exist')
      }

      const orderId = randomUUID()
      const durationValue = resolved.benefit.kind === 'plan' ? months : resolved.benefit.durationValue
      const durationUnit = resolved.benefit.kind === 'plan' ? 'month' : resolved.benefit.durationUnit
      const values = Array.from({ length: codeCount }, () => ({
        id: randomUUID(),
        code: `AFD-${randomBytes(4).toString('hex').toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`,
        kind: resolved.benefit.kind,
        planId: resolved.benefit.kind === 'plan' ? resolved.benefit.planId! : null,
        credits: resolved.benefit.kind === 'credits' ? resolved.benefit.credits! : null,
        durationDays: legacyDurationDays(durationValue, durationUnit),
        durationValue,
        durationUnit,
        orderId,
        subscriptionId: resolved.benefit.kind === 'plan' ? randomUUID() : null,
      }))
      await tx.insert(redeemCodes).values(values)
      const codes = values.map((item) => item.code)
      const matchedMapping = storedMappings.find((mapping) => `afdian-${mapping.externalOfferType}:${mapping.externalOfferId}` === resolved.key)!
      const [linkedAccount] = await tx.select({ userId: account.userId }).from(account).where(and(eq(account.providerId, 'afdian'), eq(account.accountId, afdianUserId))).limit(1)
      await tx.insert(orders).values({
        id: orderId,
        providerId: 'psp-afdian',
        externalOrderId: outTradeNo,
        externalCustomerId: afdianUserId,
        externalOfferId: afdianPlanId,
        externalOfferTitle: String(order?.plan_title || order?.title || '').trim(),
        userId: linkedAccount?.userId || null,
        skuId: matchedMapping.skuId,
        status: 'paid',
        termMonths: months,
        amount: String(order?.total_amount || '').trim(),
        currency: 'CNY',
        deliveryStatus: 'pending',
      })
      await tx.insert(payments).values({ id: randomUUID(), orderId, providerId: 'psp-afdian', externalPaymentId: outTradeNo, status: 'succeeded', amount: String(order?.total_amount || '').trim(), currency: 'CNY', paidAt: new Date() })
      const subscriptionIds = values.flatMap((item) => item.subscriptionId ? [item.subscriptionId] : [])
      if (subscriptionIds.length) {
        await tx.insert(subscriptions).values(subscriptionIds.map((subscriptionId) => ({ id: subscriptionId, userId: linkedAccount?.userId || null, planId: resolved.benefit.planId!, skuId: matchedMapping.skuId, providerId: 'psp-afdian', status: 'pending_activation' })))
        await tx.insert(subscriptionEvents).values(subscriptionIds.map((subscriptionId) => ({ id: randomUUID(), subscriptionId, type: 'payment_confirmed', toStatus: 'pending_activation', providerEventId: providerEvent.id, detail: `order:${orderId}` })))
      }
      await tx.update(providerEvents).set({ status: 'processed', processedAt: new Date(), error: null }).where(eq(providerEvents.id, providerEvent.id))
      await tx.insert(activityLogs).values({ id: randomUUID(), action: 'order.received', resourceType: 'order', resourceId: orderId, detail: `afdian:${outTradeNo}` })
      return { orderId, duplicate: false, codes, months }
    })

    if (!fulfillment.codes.length) return response(200, 'ok', { duplicate: fulfillment.duplicate, delivery: 'legacy' })
    const messageStatus = await deliverOrderMessage(fulfillment.orderId, afdianUserId, fulfillment.codes, fulfillment.months)
    if (messageStatus === 'failed') return response(500, 'codes generated but private message failed', { duplicate: fulfillment.duplicate, delivery: 'codes', messageStatus })
    return response(200, 'ok', { duplicate: fulfillment.duplicate, delivery: 'codes', messageStatus })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'fulfillment failed'
    await db.update(providerEvents).set({ status: 'failed', error: message.slice(0, 500), processedAt: new Date() }).where(eq(providerEvents.id, providerEvent.id)).catch(() => undefined)
    return response(500, message)
  }
}
