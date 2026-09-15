import { randomBytes, randomUUID, timingSafeEqual } from 'crypto'
import { and, eq, or, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { afdianOfferMappings, afadianOrders, subscriptionPlans, redeemCodes } from '@/lib/db/schema'
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
  const [order] = await db.select({ status: afadianOrders.messageStatus }).from(afadianOrders).where(eq(afadianOrders.id, orderId)).limit(1)
  const status = order?.status as AfdianMessageStatus | undefined
  const action = messageDeliveryAction(status)
  if (action === 'complete') return status
  if (action === 'hold') return 'unknown'
  if (action === 'mark_unknown') {
    await db.update(afadianOrders).set({ messageStatus: 'unknown', messageLastError: '上一次私信发送结果未知，已停止自动重试' }).where(eq(afadianOrders.id, orderId))
    return 'unknown'
  }

  const attemptedAt = new Date()
  const [claimed] = await db.update(afadianOrders).set({
    messageStatus: 'sending',
    messageAttempts: sql`${afadianOrders.messageAttempts} + 1`,
    messageAttemptedAt: attemptedAt,
    messageLastError: null,
  }).where(and(eq(afadianOrders.id, orderId), or(eq(afadianOrders.messageStatus, 'pending'), eq(afadianOrders.messageStatus, 'failed')))).returning({ id: afadianOrders.id })
  if (!claimed) return 'unknown'

  const siteUrl = process.env.BETTER_AUTH_URL || 'https://www.l2cl.link'
  const result = await sendAfdianPrivateMessage(recipient, buildRedemptionMessage({ codes, months, siteUrl }))
  if (result.outcome === 'sent') {
    await db.update(afadianOrders).set({ messageStatus: 'sent', messageSentAt: new Date(), messageLastError: null }).where(eq(afadianOrders.id, orderId))
    return 'sent'
  }
  await db.update(afadianOrders).set({ messageStatus: result.outcome, messageLastError: result.error.slice(0, 500) }).where(eq(afadianOrders.id, orderId))
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
  const storedMappings = await db.select().from(afdianOfferMappings).where(eq(afdianOfferMappings.enabled, true))
  const resolution = resolveAfdianWebhookOffer(storedMappings.map((mapping) => ({
    offerKey: mapping.offerKey,
    enabled: mapping.enabled,
    kind: mapping.kind as RedeemKind,
    planId: mapping.planId ?? undefined,
    credits: mapping.credits ?? undefined,
    durationValue: mapping.durationValue,
    durationUnit: mapping.durationUnit as EntitlementUnit,
    codesPerItem: mapping.codesPerItem,
  })), { outTradeNo, afdianPlanId, skuIds })
  if (resolution.outcome === 'probe') return response(200, 'ok', { probe: true })
  if (resolution.outcome === 'unmapped') return response(422, 'no valid Afdian offer mapping for this plan or sku')
  const { resolved } = resolution

  const itemCount = skuDetails.length ? skuDetails.reduce((total, item) => total + Math.max(0, Number(item.count) || 0), 0) : 1
  const codeCount = Math.max(1, itemCount) * resolved.benefit.codesPerItem
  if (codeCount > 1000) return response(422, 'order would generate more than 1000 codes')

  try {
    const fulfillment = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${outTradeNo}))`)
      const [existing] = await tx.select({ id: afadianOrders.id, generatedCodes: afadianOrders.generatedCodes, orderMonths: afadianOrders.orderMonths }).from(afadianOrders).where(eq(afadianOrders.outTradeNo, outTradeNo)).limit(1)
      if (existing) return { orderId: existing.id, duplicate: true, codes: JSON.parse(existing.generatedCodes) as string[], months: existing.orderMonths }

      if (resolved.benefit.kind === 'plan') {
        const [plan] = await tx.select({ id: subscriptionPlans.id }).from(subscriptionPlans).where(eq(subscriptionPlans.id, resolved.benefit.planId!)).limit(1)
        if (!plan) throw new Error('mapped subscription plan does not exist')
      }

      const orderId = randomUUID()
      const values = Array.from({ length: codeCount }, () => ({
        id: randomUUID(),
        code: `AFD-${randomBytes(4).toString('hex').toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`,
        kind: resolved.benefit.kind,
        planId: resolved.benefit.kind === 'plan' ? resolved.benefit.planId! : null,
        credits: resolved.benefit.kind === 'credits' ? resolved.benefit.credits! : null,
        durationDays: legacyDurationDays(months, 'month'),
        durationValue: months,
        durationUnit: 'month',
        afadianOrderId: orderId,
      }))
      await tx.insert(redeemCodes).values(values)
      const codes = values.map((item) => item.code)
      await tx.insert(afadianOrders).values({
        id: orderId,
        outTradeNo,
        userId: afdianUserId,
        afdianPlanId,
        afdianPlanTitle: String(order?.plan_title || order?.title || '').trim(),
        orderMonths: months,
        amount: String(order?.total_amount || '').trim(),
        offerKey: resolved.key,
        generatedCodes: JSON.stringify(codes),
        messageStatus: 'pending',
        payload: raw,
      })
      return { orderId, duplicate: false, codes, months }
    })

    if (!fulfillment.codes.length) return response(200, 'ok', { duplicate: fulfillment.duplicate, delivery: 'legacy' })
    const messageStatus = await deliverOrderMessage(fulfillment.orderId, afdianUserId, fulfillment.codes, fulfillment.months)
    if (messageStatus === 'failed') return response(500, 'codes generated but private message failed', { duplicate: fulfillment.duplicate, delivery: 'codes', messageStatus })
    return response(200, 'ok', { duplicate: fulfillment.duplicate, delivery: 'codes', messageStatus })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'fulfillment failed'
    return response(500, message)
  }
}
