import { NextResponse } from 'next/server'
import { and, count, desc, eq, gt, gte, isNull, lte, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { account, afdianOfferMappings, apiUsage, creditGrants, subscriptions, subscriptionPlans, user } from '@/lib/db/schema'
import { AFDIAN_PROVIDER_ID, isAfdianOAuthConfigured } from '@/lib/afdian-oauth'
import { afdianCheckoutUrl } from '@/lib/afdian-commerce'
import { countEffectivePlanSubscribers } from '@/lib/plan-subscriber-counts'
import { usagePeriodKeys } from '@/lib/usage-periods'

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { today, weekStart, monthStart } = usagePeriodKeys()
  const dashboardPlans = alias(subscriptionPlans, 'dashboard_subscription_plans')
  const now = new Date()
  const activeAnySubscription = and(
    lte(subscriptions.startsAt, now),
    or(isNull(subscriptions.expiresAt), gt(subscriptions.expiresAt, now)),
  )

  const [rawPlanRows, [userCount], effectiveSubscriptions, purchaseMappings] = await Promise.all([
    db.select({
      id: dashboardPlans.id,
      name: dashboardPlans.name,
      description: dashboardPlans.description,
      rateLimit: dashboardPlans.rateLimit,
      dailyLimit: dashboardPlans.dailyLimit,
      weeklyLimit: dashboardPlans.weeklyLimit,
      monthlyLimit: dashboardPlans.monthlyLimit,
      isDefault: dashboardPlans.isDefault,
    })
    .from(dashboardPlans)
    .orderBy(desc(dashboardPlans.isDefault), dashboardPlans.createdAt),
    db.select({ count: count() }).from(user),
    db.selectDistinctOn([subscriptions.userId], { userId: subscriptions.userId, planId: subscriptions.planId })
      .from(subscriptions)
      .where(activeAnySubscription)
      .orderBy(subscriptions.userId, desc(subscriptions.startsAt), sql`${subscriptions.expiresAt} desc nulls first`),
    db.select({ offerKey: afdianOfferMappings.offerKey, planId: afdianOfferMappings.planId })
      .from(afdianOfferMappings)
      .where(and(eq(afdianOfferMappings.enabled, true), eq(afdianOfferMappings.kind, 'plan')))
      .orderBy(desc(afdianOfferMappings.updatedAt)),
  ])
  const subscriberCounts = countEffectivePlanSubscribers({ plans: rawPlanRows, totalUsers: userCount?.count ?? 0, subscriptions: effectiveSubscriptions })
  const checkoutByPlan = new Map<string, string>()
  for (const mapping of purchaseMappings) {
    if (!mapping.planId || !mapping.offerKey.startsWith('afdian-plan:') || checkoutByPlan.has(mapping.planId)) continue
    checkoutByPlan.set(mapping.planId, afdianCheckoutUrl(mapping.offerKey.slice('afdian-plan:'.length)))
  }
  const planRows = rawPlanRows.map((plan) => ({ ...plan, subscriberCount: subscriberCounts.get(plan.id) ?? 0, purchaseUrl: checkoutByPlan.get(plan.id) ?? null }))

  const activeSubscription = and(
    eq(subscriptions.userId, session.user.id),
    lte(subscriptions.startsAt, now),
    or(isNull(subscriptions.expiresAt), gt(subscriptions.expiresAt, now)),
  )

  const [[userRow], [subscription], [usage], [benefits], [creditBalance], [creditBenefits], [afdianAccount]] = await Promise.all([
    db.select({ id: user.id, name: user.name, image: user.image, role: user.role, createdAt: user.createdAt }).from(user).where(eq(user.id, session.user.id)).limit(1),
    db
      .select({ planId: subscriptionPlans.id, planName: subscriptionPlans.name, rateLimit: subscriptionPlans.rateLimit, dailyLimit: subscriptionPlans.dailyLimit, weeklyLimit: subscriptionPlans.weeklyLimit, monthlyLimit: subscriptionPlans.monthlyLimit, expiresAt: subscriptions.expiresAt })
      .from(subscriptions)
      .innerJoin(subscriptionPlans, eq(subscriptionPlans.id, subscriptions.planId))
      .where(activeSubscription)
      .orderBy(desc(subscriptions.startsAt), sql`${subscriptions.expiresAt} desc nulls first`)
      .limit(1),
    db.select({
      daily: sql<number>`coalesce(sum(${apiUsage.requestCount}) filter (where ${apiUsage.usageDate} = ${today}), 0)::int`.mapWith(Number),
      weekly: sql<number>`coalesce(sum(${apiUsage.requestCount}) filter (where ${apiUsage.usageDate} >= ${weekStart}), 0)::int`.mapWith(Number),
      monthly: sql<number>`coalesce(sum(${apiUsage.requestCount}) filter (where ${apiUsage.usageDate} >= ${monthStart}), 0)::int`.mapWith(Number),
    }).from(apiUsage).where(and(eq(apiUsage.userId, session.user.id), gte(apiUsage.usageDate, monthStart < weekStart ? monthStart : weekStart))),
    db.select({ count: count() }).from(subscriptions).where(and(activeSubscription, eq(subscriptions.source, 'redeem'))),
    db.select({ total: sql<number>`coalesce(sum(${creditGrants.remainingCredits}), 0)::int`.mapWith(Number) }).from(creditGrants).where(and(eq(creditGrants.userId, session.user.id), gt(creditGrants.remainingCredits, 0), or(isNull(creditGrants.expiresAt), gt(creditGrants.expiresAt, now)))),
    db.select({ count: count() }).from(creditGrants).where(and(eq(creditGrants.userId, session.user.id), gt(creditGrants.remainingCredits, 0), or(isNull(creditGrants.expiresAt), gt(creditGrants.expiresAt, now)))),
    db.select({ id: account.id }).from(account).where(and(eq(account.userId, session.user.id), eq(account.providerId, AFDIAN_PROVIDER_ID))).limit(1),
  ])

  const defaultPlan = planRows.find((plan) => plan.isDefault) ?? null
  const currentPlan = subscription ?? (defaultPlan ? {
    planId: defaultPlan.id,
    planName: defaultPlan.name,
    rateLimit: defaultPlan.rateLimit,
    dailyLimit: defaultPlan.dailyLimit,
    weeklyLimit: defaultPlan.weeklyLimit,
    monthlyLimit: defaultPlan.monthlyLimit,
    expiresAt: null,
  } : null)

  return NextResponse.json({
    authenticated: true,
    user: userRow ?? {
      id: session.user.id,
      name: session.user.name,
      image: session.user.image,
      role: 'user',
      createdAt: session.user.createdAt,
    },
    currentPlan,
    usage: { daily: usage?.daily ?? 0, weekly: usage?.weekly ?? 0, monthly: usage?.monthly ?? 0 },
    activeBenefits: (benefits?.count ?? 0) + (creditBenefits?.count ?? 0),
    creditsRemaining: creditBalance?.total ?? 0,
    afdian: { linked: Boolean(afdianAccount), oauthConfigured: isAfdianOAuthConfigured() },
    plans: planRows,
  })
}
