import { randomUUID } from 'node:crypto'
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { activityLogs, planEntitlements, subscriptionEvents, subscriptions } from '@/lib/db/schema'
import { assertSubscriptionTransition, type SubscriptionStatus } from '@/lib/subscription-state'

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export type SubscriptionTransitionInput = {
  subscriptionId: string
  toStatus: SubscriptionStatus
  eventType: string
  userId?: string
  periodStart?: Date | null
  periodEnd?: Date | null
  providerEventId?: string | null
  actorId?: string | null
  detail?: string
}

export async function transitionSubscription(tx: Transaction, input: SubscriptionTransitionInput) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.subscriptionId}))`)
  const [current] = await tx.select().from(subscriptions).where(eq(subscriptions.id, input.subscriptionId)).limit(1)
  if (!current) throw new Error('订阅不存在')

  const fromStatus = current.status as SubscriptionStatus
  assertSubscriptionTransition(fromStatus, input.toStatus)
  const now = new Date()
  const userId = input.userId ?? current.userId
  const periodStart = input.periodStart === undefined ? current.currentPeriodStart : input.periodStart
  const periodEnd = input.periodEnd === undefined ? current.currentPeriodEnd : input.periodEnd
  if (input.toStatus === 'active') {
    if (!userId) throw new Error('订阅尚未绑定用户，不能激活')
    if (periodEnd && periodEnd <= now) throw new Error('订阅周期已经结束，不能激活')
  }

  const terminal = input.toStatus === 'canceled' || input.toStatus === 'expired'
  const [updated] = await tx.update(subscriptions).set({
    userId,
    status: input.toStatus,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    canceledAt: input.toStatus === 'canceled' ? now : current.canceledAt,
    endedAt: terminal ? now : null,
    updatedAt: now,
  }).where(eq(subscriptions.id, input.subscriptionId)).returning()

  if (input.toStatus === 'active' && userId) {
    const [existingEntitlement] = await tx.select({ id: planEntitlements.id }).from(planEntitlements).where(and(
      eq(planEntitlements.subscriptionId, input.subscriptionId),
      or(isNull(planEntitlements.expiresAt), gt(planEntitlements.expiresAt, now)),
    )).limit(1)
    if (!existingEntitlement) await tx.insert(planEntitlements).values({ id: randomUUID(), userId, planId: current.planId, subscriptionId: input.subscriptionId, startsAt: periodStart ?? now, expiresAt: periodEnd, source: 'subscription' })
  } else {
    await tx.update(planEntitlements).set({ expiresAt: now }).where(and(eq(planEntitlements.subscriptionId, input.subscriptionId), or(isNull(planEntitlements.expiresAt), gt(planEntitlements.expiresAt, now))))
  }

  await tx.insert(subscriptionEvents).values({ id: randomUUID(), subscriptionId: input.subscriptionId, type: input.eventType, fromStatus, toStatus: input.toStatus, providerEventId: input.providerEventId || null, detail: input.detail || '' })
  if (input.actorId) await tx.insert(activityLogs).values({ id: randomUUID(), actorId: input.actorId, action: 'subscription.transitioned', resourceType: 'subscription', resourceId: input.subscriptionId, detail: `${fromStatus} -> ${input.toStatus}` })
  return updated
}
