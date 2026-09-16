import { randomUUID } from 'node:crypto'
import { and, desc, eq, gt, gte, isNull, lte, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { apiUsage, creditGrants, creditTransactions, planEntitlements, subscriptionPlans } from '@/lib/db/schema'
import { retryAfterSeconds, usagePeriodKeys } from '@/lib/usage-periods'
import { selectAllowance, type UsageSnapshot } from '@/lib/usage-allowance'

export type AllowanceReservation = {
  ok: true
  plan: string
  allowancePlan: string | null
  allowanceSource: 'current_plan' | 'default_fallback' | 'default_plan' | 'credits' | 'free'
  creditUsed: boolean
  creditsRemaining: number
  usage: UsageSnapshot | null
  units: number
} | {
  ok: false
  status: 403 | 429
  body: Record<string, unknown>
}

export function reserveApiUsage(userId: string, units = 1, referenceId?: string, options: { commit?: boolean } = {}): Promise<AllowanceReservation> {
  if (!Number.isSafeInteger(units) || units < 0) throw new RangeError('Usage units must be a non-negative integer')
  const commit = options.commit !== false
  return db.transaction(async (tx) => {
    const now = new Date()
    const minuteStart = new Date(now.getTime() - 60_000)
    const { today, weekStart, monthStart } = usagePeriodKeys(now)
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`)

    const planSelection = {
      planId: subscriptionPlans.id, planName: subscriptionPlans.name, rank: subscriptionPlans.rank,
      rateLimit: subscriptionPlans.rateLimit, dailyLimit: subscriptionPlans.dailyLimit,
      weeklyLimit: subscriptionPlans.weeklyLimit, monthlyLimit: subscriptionPlans.monthlyLimit,
    }
    const [[entitlement], [defaultPlan]] = await Promise.all([
      tx.select(planSelection).from(planEntitlements).innerJoin(subscriptionPlans, eq(subscriptionPlans.id, planEntitlements.planId))
        .where(and(eq(planEntitlements.userId, userId), lte(planEntitlements.startsAt, now), or(isNull(planEntitlements.expiresAt), gt(planEntitlements.expiresAt, now))))
        .orderBy(desc(subscriptionPlans.rank), desc(planEntitlements.startsAt), sql`${planEntitlements.expiresAt} desc nulls first`).limit(1),
      tx.select(planSelection).from(subscriptionPlans).where(eq(subscriptionPlans.isDefault, true)).limit(1),
    ])
    const currentPlan = entitlement ?? defaultPlan
    if (!currentPlan || !defaultPlan) return { ok: false, status: 403, body: { error: 'access_policy_missing' } }
    if (units === 0) {
      return {
        ok: true,
        plan: currentPlan.planName,
        allowancePlan: currentPlan.planName,
        allowanceSource: 'free',
        creditUsed: false,
        creditsRemaining: 0,
        usage: null,
        units,
      }
    }

    const loadUsage = async (planId: string) => {
      const [[totals], [todayUsage]] = await Promise.all([
        tx.select({
          daily: sql<number>`coalesce(sum(${apiUsage.requestCount}) filter (where ${apiUsage.usageDate} = ${today}), 0)::int`.mapWith(Number),
          weekly: sql<number>`coalesce(sum(${apiUsage.requestCount}) filter (where ${apiUsage.usageDate} >= ${weekStart}), 0)::int`.mapWith(Number),
          monthly: sql<number>`coalesce(sum(${apiUsage.requestCount}) filter (where ${apiUsage.usageDate} >= ${monthStart}), 0)::int`.mapWith(Number),
        }).from(apiUsage).where(and(eq(apiUsage.userId, userId), eq(apiUsage.planId, planId), gte(apiUsage.usageDate, monthStart < weekStart ? monthStart : weekStart))),
        tx.select().from(apiUsage).where(and(eq(apiUsage.userId, userId), eq(apiUsage.planId, planId), eq(apiUsage.usageDate, today))).orderBy(desc(apiUsage.windowStartedAt)).limit(1),
      ])
      const usage: UsageSnapshot = { minute: todayUsage?.windowStartedAt && todayUsage.windowStartedAt > minuteStart ? todayUsage.windowCount : 0, daily: totals?.daily ?? 0, weekly: totals?.weekly ?? 0, monthly: totals?.monthly ?? 0 }
      return { usage, todayUsage }
    }

    const candidates = entitlement && entitlement.planId !== defaultPlan.planId
      ? [{ plan: entitlement, source: 'current_plan' as const }, { plan: defaultPlan, source: 'default_fallback' as const }]
      : [{ plan: defaultPlan, source: 'default_plan' as const }]
    const evaluated = await Promise.all(candidates.map(async (candidate) => {
      const snapshot = await loadUsage(candidate.plan.planId)
      return { ...candidate, snapshot, policy: candidate.plan, usage: snapshot.usage }
    }))
    const allowance = selectAllowance(evaluated, units)
    const selected = allowance.selected
    const lastWindowStartedAt = evaluated.at(-1)?.snapshot.todayUsage?.windowStartedAt
    let creditUsed = false

    if (!selected) {
      const grants = await tx.select({ id: creditGrants.id, remainingCredits: creditGrants.remainingCredits }).from(creditGrants)
        .where(and(eq(creditGrants.userId, userId), gt(creditGrants.remainingCredits, 0), or(isNull(creditGrants.expiresAt), gt(creditGrants.expiresAt, now))))
        .orderBy(sql`${creditGrants.expiresAt} asc nulls last`, creditGrants.createdAt)
      const available = grants.reduce((sum, grant) => sum + grant.remainingCredits, 0)
      if (available < units) return { ok: false, status: 429, body: { error: 'usage_limit_exceeded', period: allowance.exceeded?.period, limit: allowance.exceeded?.limit, used: allowance.exceeded?.used, requiredUnits: units, creditsRemaining: available, retryAfterSeconds: allowance.exceeded ? retryAfterSeconds(allowance.exceeded.period, now, lastWindowStartedAt) : undefined } }
      let remaining = units
      if (commit) {
        for (const grant of grants) {
          if (!remaining) break
          const deduction = Math.min(remaining, grant.remainingCredits)
          const balanceAfter = grant.remainingCredits - deduction
          await tx.update(creditGrants).set({ remainingCredits: balanceAfter }).where(eq(creditGrants.id, grant.id))
          await tx.insert(creditTransactions).values({ id: randomUUID(), userId, creditGrantId: grant.id, delta: -deduction, balanceAfter, reason: 'api_usage', referenceId })
          remaining -= deduction
        }
      }
      creditUsed = true
    } else if (commit) {
      const { todayUsage } = selected.snapshot
      if (todayUsage) {
        const inCurrentWindow = todayUsage.windowStartedAt > minuteStart
        await tx.update(apiUsage).set({ requestCount: todayUsage.requestCount + units, windowCount: inCurrentWindow ? todayUsage.windowCount + units : units, windowStartedAt: inCurrentWindow ? todayUsage.windowStartedAt : now }).where(eq(apiUsage.id, todayUsage.id))
      } else {
        await tx.insert(apiUsage).values({ id: randomUUID(), userId, planId: selected.plan.planId, usageDate: today, requestCount: units, windowCount: units, windowStartedAt: now })
      }
    }

    const [creditTotal] = await tx.select({ total: sql<number>`coalesce(sum(${creditGrants.remainingCredits}), 0)::int`.mapWith(Number) }).from(creditGrants).where(and(eq(creditGrants.userId, userId), gt(creditGrants.remainingCredits, 0), or(isNull(creditGrants.expiresAt), gt(creditGrants.expiresAt, now))))
    const chargedUnits = commit ? units : 0
    const usage = selected ? { minute: selected.snapshot.usage.minute + chargedUnits, daily: selected.snapshot.usage.daily + chargedUnits, weekly: selected.snapshot.usage.weekly + chargedUnits, monthly: selected.snapshot.usage.monthly + chargedUnits } : null
    return { ok: true, plan: currentPlan.planName, allowancePlan: selected?.plan.planName ?? null, allowanceSource: selected?.source ?? 'credits', creditUsed, creditsRemaining: creditTotal?.total ?? 0, usage, units }
  })
}
