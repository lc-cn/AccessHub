import { randomBytes, randomUUID, timingSafeEqual } from 'crypto'
import { and, desc, eq, gt, isNull, lte, or, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { account, afadianBenefitRules, afadianOrders, creditGrants, groupMemberships, groups, redeemCodes } from '@/lib/db/schema'
import { resolveAfdianWebhookBenefit } from '@/lib/afadian-benefits'
import { AFDIAN_PROVIDER_ID } from '@/lib/afdian-oauth'
import { entitlementExpiresAt, legacyDurationDays, type EntitlementUnit, type RedeemKind } from '@/lib/entitlements'

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

export async function POST(request: Request) {
  const expectedSecret = process.env.AFDIAN_WEBHOOK_SECRET
  if (!expectedSecret) return response(503, 'webhook secret is not configured', undefined, 503)
  if (!safeEqual(requestSecret(request), expectedSecret)) return response(401, 'invalid webhook secret', undefined, 401)

  const raw = await request.text()
  let payload: { data?: { type?: string; order?: Record<string, unknown> } }
  try { payload = JSON.parse(raw || '{}') as typeof payload } catch { return response(400, 'invalid json') }
  const order = payload.data?.order
  const outTradeNo = String(order?.out_trade_no || '')
  if (payload.data?.type !== 'order' || !outTradeNo) return response(400, 'missing order')
  if (Number(order?.status) !== 2) return response(200, 'ignored unpaid order')

  const planId = String(order?.plan_id || '')
  const skuDetails = Array.isArray(order?.sku_detail) ? order.sku_detail as Array<Record<string, unknown>> : []
  const skuIds = skuDetails.map((item) => String(item.sku_id || '')).filter(Boolean)
  const storedRules = await db.select().from(afadianBenefitRules).where(eq(afadianBenefitRules.enabled, true))
  const resolution = resolveAfdianWebhookBenefit(storedRules.map((rule) => ({
    benefitKey: rule.benefitKey,
    enabled: rule.enabled,
    kind: rule.kind as RedeemKind,
    groupId: rule.groupId ?? undefined,
    credits: rule.credits ?? undefined,
    durationValue: rule.durationValue,
    durationUnit: rule.durationUnit as EntitlementUnit,
    codesPerItem: rule.codesPerItem,
  })), { outTradeNo, planId, skuIds })
  if (resolution.outcome === 'probe') return response(200, 'ok', { probe: true })
  if (resolution.outcome === 'unmapped') return response(422, 'no valid entitlement mapping for this plan or sku')
  const { resolved } = resolution

  const itemCount = skuDetails.length ? skuDetails.reduce((total, item) => total + Math.max(0, Number(item.count) || 0), 0) : 1
  const codeCount = Math.max(1, itemCount) * resolved.benefit.codesPerItem
  if (codeCount > 1000) return response(422, 'order would generate more than 1000 codes')

  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${outTradeNo}))`)
      const [existing] = await tx.select({ generatedCodes: afadianOrders.generatedCodes }).from(afadianOrders).where(eq(afadianOrders.outTradeNo, outTradeNo)).limit(1)
      if (existing) {
        const codes = JSON.parse(existing.generatedCodes) as string[]
        return { duplicate: true, delivery: codes.length ? 'codes' : 'direct', codes }
      }

      if (resolved.benefit.kind === 'group') {
        const [group] = await tx.select({ id: groups.id }).from(groups).where(eq(groups.id, resolved.benefit.groupId!)).limit(1)
        if (!group) throw new Error('mapped user group does not exist')
      }

      const afdianUserId = String(order?.user_id || '').trim()
      const [linkedAccount] = afdianUserId ? await tx.select({ userId: account.userId }).from(account).where(and(
        eq(account.providerId, AFDIAN_PROVIDER_ID),
        eq(account.accountId, afdianUserId),
      )).limit(1) : []

      if (linkedAccount) {
        const now = new Date()
        if (resolved.benefit.kind === 'credits') {
          const credits = resolved.benefit.credits! * codeCount
          await tx.insert(creditGrants).values({
            id: randomUUID(),
            userId: linkedAccount.userId,
            credits,
            remainingCredits: credits,
            expiresAt: entitlementExpiresAt(now, resolved.benefit.durationValue, resolved.benefit.durationUnit),
            source: 'afdian',
            redeemCodeId: null,
          })
        } else {
          const [current] = await tx.select({ expiresAt: groupMemberships.expiresAt }).from(groupMemberships).where(and(
            eq(groupMemberships.userId, linkedAccount.userId),
            eq(groupMemberships.groupId, resolved.benefit.groupId!),
            lte(groupMemberships.startsAt, now),
            or(isNull(groupMemberships.expiresAt), gt(groupMemberships.expiresAt, now)),
          )).orderBy(desc(groupMemberships.startsAt)).limit(1)

          if (!current || current.expiresAt) {
            const startsAt = current?.expiresAt ?? now
            const durationValue = resolved.benefit.durationValue === -1 ? -1 : resolved.benefit.durationValue * codeCount
            await tx.insert(groupMemberships).values({
              id: randomUUID(),
              userId: linkedAccount.userId,
              groupId: resolved.benefit.groupId!,
              startsAt,
              expiresAt: entitlementExpiresAt(startsAt, durationValue, resolved.benefit.durationUnit),
              source: 'afdian',
            })
          }
        }

        await tx.insert(afadianOrders).values({ id: randomUUID(), outTradeNo, userId: afdianUserId, benefitKey: resolved.key, generatedCodes: '[]', payload: raw })
        return { duplicate: false, delivery: 'direct', codes: [] as string[] }
      }

      const values = Array.from({ length: codeCount }, () => ({
        id: randomUUID(),
        code: `AFD-${randomBytes(4).toString('hex').toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`,
        kind: resolved.benefit.kind,
        groupId: resolved.benefit.kind === 'group' ? resolved.benefit.groupId! : null,
        credits: resolved.benefit.kind === 'credits' ? resolved.benefit.credits! : null,
        durationDays: legacyDurationDays(resolved.benefit.durationValue, resolved.benefit.durationUnit),
        durationValue: resolved.benefit.durationValue,
        durationUnit: resolved.benefit.durationUnit,
      }))
      await tx.insert(redeemCodes).values(values)
      const codes = values.map((item) => item.code)
      await tx.insert(afadianOrders).values({ id: randomUUID(), outTradeNo, userId: afdianUserId || null, benefitKey: resolved.key, generatedCodes: JSON.stringify(codes), payload: raw })
      return { duplicate: false, delivery: 'codes', codes }
    })
    return response(200, 'ok', { duplicate: result.duplicate, delivery: result.delivery, codes: result.codes })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'fulfillment failed'
    return response(500, message)
  }
}
