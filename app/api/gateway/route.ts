import { randomUUID } from 'crypto'
import { and, desc, eq, gt, gte, isNull, lte, or, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { apiUsage, creditGrants, planEntitlements, subscriptionPlans } from '@/lib/db/schema'
import { retryAfterSeconds, usagePeriodKeys } from '@/lib/usage-periods'
import { selectAllowance, type UsageSnapshot } from '@/lib/usage-allowance'

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  return db.transaction(async (tx) => {
    const now = new Date()
    const minuteStart = new Date(now.getTime() - 60_000)
    const { today, weekStart, monthStart } = usagePeriodKeys(now)
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${session.user.id}))`)

    const planSelection = {
      planId: subscriptionPlans.id, planName: subscriptionPlans.name, rank: subscriptionPlans.rank,
      rateLimit: subscriptionPlans.rateLimit, dailyLimit: subscriptionPlans.dailyLimit,
      weeklyLimit: subscriptionPlans.weeklyLimit, monthlyLimit: subscriptionPlans.monthlyLimit,
    }
    const [[entitlement], [defaultPlan]] = await Promise.all([
      tx.select(planSelection).from(planEntitlements).innerJoin(subscriptionPlans, eq(subscriptionPlans.id, planEntitlements.planId))
        .where(and(eq(planEntitlements.userId, session.user.id), lte(planEntitlements.startsAt, now), or(isNull(planEntitlements.expiresAt), gt(planEntitlements.expiresAt, now))))
        .orderBy(desc(subscriptionPlans.rank), desc(planEntitlements.startsAt), sql`${planEntitlements.expiresAt} desc nulls first`).limit(1),
      tx.select(planSelection).from(subscriptionPlans).where(eq(subscriptionPlans.isDefault, true)).limit(1),
    ])
    const currentPlan = entitlement ?? defaultPlan
    if (!currentPlan || !defaultPlan) return NextResponse.json({ error: 'access_policy_missing' }, { status: 403 })

    const loadUsage = async (planId: string) => {
      const [[totals], [todayUsage]] = await Promise.all([
        tx.select({
          daily: sql<number>`coalesce(sum(${apiUsage.requestCount}) filter (where ${apiUsage.usageDate} = ${today}), 0)::int`.mapWith(Number),
          weekly: sql<number>`coalesce(sum(${apiUsage.requestCount}) filter (where ${apiUsage.usageDate} >= ${weekStart}), 0)::int`.mapWith(Number),
          monthly: sql<number>`coalesce(sum(${apiUsage.requestCount}) filter (where ${apiUsage.usageDate} >= ${monthStart}), 0)::int`.mapWith(Number),
        }).from(apiUsage).where(and(eq(apiUsage.userId, session.user.id), eq(apiUsage.planId, planId), gte(apiUsage.usageDate, monthStart < weekStart ? monthStart : weekStart))),
        tx.select().from(apiUsage).where(and(eq(apiUsage.userId, session.user.id), eq(apiUsage.planId, planId), eq(apiUsage.usageDate, today))).orderBy(desc(apiUsage.windowStartedAt)).limit(1),
      ])
      const usage: UsageSnapshot = {
        minute: todayUsage?.windowStartedAt && todayUsage.windowStartedAt > minuteStart ? todayUsage.windowCount : 0,
        daily: totals?.daily ?? 0, weekly: totals?.weekly ?? 0, monthly: totals?.monthly ?? 0,
      }
      return { usage, todayUsage }
    }

    const candidates = entitlement && entitlement.planId !== defaultPlan.planId
      ? [{ plan: entitlement, source: 'current_plan' as const }, { plan: defaultPlan, source: 'default_fallback' as const }]
      : [{ plan: defaultPlan, source: 'default_plan' as const }]
    const evaluated = await Promise.all(candidates.map(async (candidate) => {
      const snapshot = await loadUsage(candidate.plan.planId)
      return { ...candidate, snapshot, policy: candidate.plan, usage: snapshot.usage }
    }))
    const allowance = selectAllowance(evaluated)
    const selected = allowance.selected
    const lastExceeded = allowance.exceeded
    const lastWindowStartedAt = evaluated.at(-1)?.snapshot.todayUsage?.windowStartedAt

    let creditUsed = false
    if (!selected) {
      const [grant] = await tx.select({ id: creditGrants.id, remainingCredits: creditGrants.remainingCredits }).from(creditGrants)
        .where(and(eq(creditGrants.userId, session.user.id), gt(creditGrants.remainingCredits, 0), or(isNull(creditGrants.expiresAt), gt(creditGrants.expiresAt, now))))
        .orderBy(sql`${creditGrants.expiresAt} asc nulls last`, creditGrants.createdAt).limit(1)
      if (!grant) return NextResponse.json({ error: 'usage_limit_exceeded', period: lastExceeded?.period, limit: lastExceeded?.limit, used: lastExceeded?.used, creditsRemaining: 0, retryAfterSeconds: lastExceeded ? retryAfterSeconds(lastExceeded.period, now, lastWindowStartedAt) : undefined }, { status: 429 })
      await tx.update(creditGrants).set({ remainingCredits: grant.remainingCredits - 1 }).where(eq(creditGrants.id, grant.id))
      creditUsed = true
    } else {
      const { todayUsage } = selected.snapshot
      if (todayUsage) {
        const inCurrentWindow = todayUsage.windowStartedAt > minuteStart
        await tx.update(apiUsage).set({ requestCount: todayUsage.requestCount + 1, windowCount: inCurrentWindow ? todayUsage.windowCount + 1 : 1, windowStartedAt: inCurrentWindow ? todayUsage.windowStartedAt : now }).where(eq(apiUsage.id, todayUsage.id))
      } else {
        await tx.insert(apiUsage).values({ id: randomUUID(), userId: session.user.id, planId: selected.plan.planId, usageDate: today, requestCount: 1, windowCount: 1, windowStartedAt: now })
      }
    }

    const [creditTotal] = await tx.select({ total: sql<number>`coalesce(sum(${creditGrants.remainingCredits}), 0)::int`.mapWith(Number) }).from(creditGrants).where(and(eq(creditGrants.userId, session.user.id), gt(creditGrants.remainingCredits, 0), or(isNull(creditGrants.expiresAt), gt(creditGrants.expiresAt, now))))
    const usage = selected ? { minute: selected.snapshot.usage.minute + 1, daily: selected.snapshot.usage.daily + 1, weekly: selected.snapshot.usage.weekly + 1, monthly: selected.snapshot.usage.monthly + 1 } : null
    return NextResponse.json({ ok: true, plan: currentPlan.planName, allowancePlan: selected?.plan.planName ?? null, allowanceSource: selected?.source ?? 'credits', creditUsed, creditsRemaining: creditTotal?.total ?? 0, usage })
  })
}
