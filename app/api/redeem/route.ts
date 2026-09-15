import { NextResponse } from 'next/server'
import { eq, and, gt, isNull, or } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { creditGrants, redeemCodes, subscriptions, subscriptionPlans } from '@/lib/db/schema'
import { headers } from 'next/headers'
import { entitlementExpiresAt, type EntitlementUnit } from '@/lib/entitlements'

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const code = String(body.code || '').trim().toUpperCase()
  if (!code) return NextResponse.json({ error: '请输入兑换码' }, { status: 400 })
  const now = new Date()
  return db.transaction(async (tx) => {
    const [item] = await tx
      .update(redeemCodes)
      .set({ redeemedAt: now, redeemedBy: session.user.id })
      .where(and(eq(redeemCodes.code, code), isNull(redeemCodes.redeemedAt), or(isNull(redeemCodes.expiresAt), gt(redeemCodes.expiresAt, now))))
      .returning({ id: redeemCodes.id, kind: redeemCodes.kind, planId: redeemCodes.planId, credits: redeemCodes.credits, durationValue: redeemCodes.durationValue, durationUnit: redeemCodes.durationUnit })
    if (!item) return NextResponse.json({ error: '兑换码无效、已核销或已过期' }, { status: 400 })

    const expiresAt = entitlementExpiresAt(now, item.durationValue, item.durationUnit as EntitlementUnit)
    if (item.kind === 'credits') {
      if (!item.credits) throw new Error('credits redeem code has no credits')
      await tx.insert(creditGrants).values({ id: randomUUID(), userId: session.user.id, credits: item.credits, remainingCredits: item.credits, expiresAt, source: 'redeem', redeemCodeId: item.id })
      return NextResponse.json({ ok: true, kind: 'credits', credits: item.credits, expiresAt: expiresAt?.toISOString() ?? null })
    }

    if (!item.planId) throw new Error('plan redeem code has no subscription plan')
    await tx.insert(subscriptions).values({ id: randomUUID(), userId: session.user.id, planId: item.planId, startsAt: now, expiresAt, source: 'redeem' })
    const [plan] = await tx.select({ name: subscriptionPlans.name }).from(subscriptionPlans).where(eq(subscriptionPlans.id, item.planId)).limit(1)
    return NextResponse.json({ ok: true, kind: 'plan', plan: plan?.name, expiresAt: expiresAt?.toISOString() ?? null })
  })
}
