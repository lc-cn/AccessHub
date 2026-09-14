import { randomUUID } from 'crypto'
import { and, desc, eq, gt, gte, isNull, lte, or, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { apiUsage, creditGrants, groupMemberships, groups } from '@/lib/db/schema'
import { retryAfterSeconds, usagePeriodKeys } from '@/lib/usage-periods'
import { isUnlimited } from '@/lib/entitlements'

type Period = 'minute' | 'day' | 'week' | 'month'

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  return db.transaction(async (tx) => {
    const now = new Date()
    const minuteStart = new Date(now.getTime() - 60_000)
    const { today, weekStart, monthStart } = usagePeriodKeys(now)

    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${session.user.id}))`)

    const [membership] = await tx
      .select({
        groupId: groups.id,
        groupName: groups.name,
        rateLimit: groups.rateLimit,
        dailyLimit: groups.dailyLimit,
        weeklyLimit: groups.weeklyLimit,
        monthlyLimit: groups.monthlyLimit,
      })
      .from(groupMemberships)
      .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
      .where(and(eq(groupMemberships.userId, session.user.id), lte(groupMemberships.startsAt, now), or(isNull(groupMemberships.expiresAt), gt(groupMemberships.expiresAt, now))))
      .orderBy(desc(groupMemberships.startsAt), sql`${groupMemberships.expiresAt} desc nulls first`)
      .limit(1)
    const [defaultGroup] = membership ? [] : await tx
      .select({ groupId: groups.id, groupName: groups.name, rateLimit: groups.rateLimit, dailyLimit: groups.dailyLimit, weeklyLimit: groups.weeklyLimit, monthlyLimit: groups.monthlyLimit })
      .from(groups)
      .where(eq(groups.isDefault, true))
      .limit(1)
    const policy = membership ?? defaultGroup
    if (!policy) return NextResponse.json({ error: 'access_policy_missing' }, { status: 403 })

    const [totals] = await tx
      .select({
        daily: sql<number>`coalesce(sum(${apiUsage.requestCount}) filter (where ${apiUsage.usageDate} = ${today}), 0)::int`.mapWith(Number),
        weekly: sql<number>`coalesce(sum(${apiUsage.requestCount}) filter (where ${apiUsage.usageDate} >= ${weekStart}), 0)::int`.mapWith(Number),
        monthly: sql<number>`coalesce(sum(${apiUsage.requestCount}) filter (where ${apiUsage.usageDate} >= ${monthStart}), 0)::int`.mapWith(Number),
      })
      .from(apiUsage)
      .where(and(eq(apiUsage.userId, session.user.id), gte(apiUsage.usageDate, monthStart < weekStart ? monthStart : weekStart)))

    const [todayUsage] = await tx.select().from(apiUsage).where(and(eq(apiUsage.userId, session.user.id), eq(apiUsage.usageDate, today))).orderBy(desc(apiUsage.windowStartedAt)).limit(1)
    const minuteCount = todayUsage?.windowStartedAt && todayUsage.windowStartedAt > minuteStart ? todayUsage.windowCount : 0
    const checks: { period: Period; used: number; limit: number | null }[] = [
      { period: 'minute', used: minuteCount, limit: policy.rateLimit },
      { period: 'day', used: totals?.daily ?? 0, limit: policy.dailyLimit },
      { period: 'week', used: totals?.weekly ?? 0, limit: policy.weeklyLimit },
      { period: 'month', used: totals?.monthly ?? 0, limit: policy.monthlyLimit },
    ]
    const exceeded = checks.find((item) => !isUnlimited(item.limit) && item.used >= item.limit!)
    let creditUsed = false
    let creditsRemaining = 0
    if (exceeded) {
      const [grant] = await tx
        .select({ id: creditGrants.id, remainingCredits: creditGrants.remainingCredits })
        .from(creditGrants)
        .where(and(eq(creditGrants.userId, session.user.id), gt(creditGrants.remainingCredits, 0), or(isNull(creditGrants.expiresAt), gt(creditGrants.expiresAt, now))))
        .orderBy(sql`${creditGrants.expiresAt} asc nulls last`, creditGrants.createdAt)
        .limit(1)
      if (!grant) return NextResponse.json({
        error: 'usage_limit_exceeded',
        period: exceeded.period,
        limit: exceeded.limit,
        used: exceeded.used,
        creditsRemaining: 0,
        retryAfterSeconds: retryAfterSeconds(exceeded.period, now, todayUsage?.windowStartedAt),
      }, { status: 429 })
      await tx.update(creditGrants).set({ remainingCredits: grant.remainingCredits - 1 }).where(eq(creditGrants.id, grant.id))
      creditUsed = true
    }

    if (todayUsage) {
      const inCurrentWindow = todayUsage.windowStartedAt > minuteStart
      await tx.update(apiUsage).set({
        requestCount: todayUsage.requestCount + 1,
        windowCount: inCurrentWindow ? todayUsage.windowCount + 1 : 1,
        windowStartedAt: inCurrentWindow ? todayUsage.windowStartedAt : now,
      }).where(eq(apiUsage.id, todayUsage.id))
    } else {
      await tx.insert(apiUsage).values({ id: randomUUID(), userId: session.user.id, usageDate: today, requestCount: 1, windowCount: 1, windowStartedAt: now })
    }

    const [creditTotal] = await tx.select({ total: sql<number>`coalesce(sum(${creditGrants.remainingCredits}), 0)::int`.mapWith(Number) }).from(creditGrants).where(and(eq(creditGrants.userId, session.user.id), gt(creditGrants.remainingCredits, 0), or(isNull(creditGrants.expiresAt), gt(creditGrants.expiresAt, now))))
    creditsRemaining = creditTotal?.total ?? 0
    return NextResponse.json({ ok: true, group: policy.groupName, creditUsed, creditsRemaining, usage: { minute: minuteCount + 1, daily: (totals?.daily ?? 0) + 1, weekly: (totals?.weekly ?? 0) + 1, monthly: (totals?.monthly ?? 0) + 1 } })
  })
}
