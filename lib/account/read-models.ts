import { and, desc, eq, gte, gt, isNull, lt, lte, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { AFDIAN_PROVIDER_ID } from '@/lib/afdian-oauth'
import {
  account,
  apiKeys,
  apiServices,
  apiUsage,
  creditGrants,
  creditTransactions,
  orders,
  payments,
  planEntitlements,
  redeemCodes,
  session,
  skus,
  subscriptionPlans,
  subscriptions,
  user,
} from '@/lib/db/schema'

export async function getAccountProfile(userId: string) {
  const [profile] = await db.select({
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image,
    role: user.role,
    createdAt: user.createdAt,
  }).from(user).where(eq(user.id, userId)).limit(1)
  return profile ?? null
}

export async function getAccountOverview(userId: string) {
  const now = new Date()
  const [profile, [activeEntitlement], [defaultPlan], [credits], [orderCount]] = await Promise.all([
    getAccountProfile(userId),
    db.select({
      name: subscriptionPlans.name,
      description: subscriptionPlans.description,
      expiresAt: planEntitlements.expiresAt,
      dailyLimit: subscriptionPlans.dailyLimit,
      monthlyLimit: subscriptionPlans.monthlyLimit,
    }).from(planEntitlements)
      .innerJoin(subscriptionPlans, eq(subscriptionPlans.id, planEntitlements.planId))
      .where(and(eq(planEntitlements.userId, userId), lte(planEntitlements.startsAt, now), or(isNull(planEntitlements.expiresAt), gt(planEntitlements.expiresAt, now))))
      .orderBy(desc(subscriptionPlans.rank), desc(planEntitlements.startsAt))
      .limit(1),
    db.select({
      name: subscriptionPlans.name,
      description: subscriptionPlans.description,
      expiresAt: sql<Date | null>`null`,
      dailyLimit: subscriptionPlans.dailyLimit,
      monthlyLimit: subscriptionPlans.monthlyLimit,
    }).from(subscriptionPlans).where(eq(subscriptionPlans.isDefault, true)).limit(1),
    db.select({ total: sql<number>`coalesce(sum(${creditGrants.remainingCredits}), 0)::int`.mapWith(Number) })
      .from(creditGrants)
      .where(and(eq(creditGrants.userId, userId), gt(creditGrants.remainingCredits, 0), or(isNull(creditGrants.expiresAt), gt(creditGrants.expiresAt, now)))),
    db.select({ total: sql<number>`count(*)::int`.mapWith(Number) }).from(orders).where(eq(orders.userId, userId)),
  ])
  return { profile, activePlan: activeEntitlement ?? defaultPlan ?? null, creditsRemaining: credits?.total ?? 0, orderCount: orderCount?.total ?? 0 }
}

export async function getAccountSecurity(userId: string, currentSessionId: string) {
  const now = new Date()
  const [identities, sessions] = await Promise.all([
    db.select({ id: account.id, provider: account.providerId, hasPassword: sql<boolean>`${account.password} is not null`.mapWith(Boolean), createdAt: account.createdAt })
      .from(account).where(eq(account.userId, userId)).orderBy(account.createdAt),
    db.select({ id: session.id, createdAt: session.createdAt, updatedAt: session.updatedAt, expiresAt: session.expiresAt, ipAddress: session.ipAddress, userAgent: session.userAgent })
      .from(session).where(and(eq(session.userId, userId), gt(session.expiresAt, now))).orderBy(desc(session.updatedAt)),
  ])
  return {
    identities,
    sessions: sessions.map((item) => ({ ...item, current: item.id === currentSessionId })),
    hasCredential: identities.some((item) => item.provider === 'credential' && item.hasPassword),
  }
}

export async function getAccountApiKeys(userId: string) {
  return db.select({ id: apiKeys.id, name: apiKeys.name, kind: apiKeys.kind, prefix: apiKeys.prefix, serviceScopes: apiKeys.serviceScopes, expiresAt: apiKeys.expiresAt, lastUsedAt: apiKeys.lastUsedAt, revokedAt: apiKeys.revokedAt, createdAt: apiKeys.createdAt })
    .from(apiKeys).where(eq(apiKeys.userId, userId)).orderBy(desc(apiKeys.createdAt)).limit(100)
}

export async function getApiKeyServiceOptions() {
  return db.select({ code: apiServices.code, name: apiServices.name }).from(apiServices).where(eq(apiServices.enabled, true)).orderBy(apiServices.name)
}

export async function getAccountEntitlements(userId: string) {
  const now = new Date()
  const [plans, [defaultPlan], credits] = await Promise.all([
    db.select({
      id: planEntitlements.id,
      planName: subscriptionPlans.name,
      description: subscriptionPlans.description,
      source: planEntitlements.source,
      startsAt: planEntitlements.startsAt,
      expiresAt: planEntitlements.expiresAt,
      rateLimit: subscriptionPlans.rateLimit,
      dailyLimit: subscriptionPlans.dailyLimit,
      weeklyLimit: subscriptionPlans.weeklyLimit,
      monthlyLimit: subscriptionPlans.monthlyLimit,
    }).from(planEntitlements)
      .innerJoin(subscriptionPlans, eq(subscriptionPlans.id, planEntitlements.planId))
      .where(eq(planEntitlements.userId, userId))
      .orderBy(desc(planEntitlements.startsAt)),
    db.select({
      id: subscriptionPlans.id,
      planName: subscriptionPlans.name,
      description: subscriptionPlans.description,
      source: sql<string>`'default'`,
      startsAt: subscriptionPlans.createdAt,
      expiresAt: sql<Date | null>`null`,
      rateLimit: subscriptionPlans.rateLimit,
      dailyLimit: subscriptionPlans.dailyLimit,
      weeklyLimit: subscriptionPlans.weeklyLimit,
      monthlyLimit: subscriptionPlans.monthlyLimit,
    }).from(subscriptionPlans).where(eq(subscriptionPlans.isDefault, true)).limit(1),
    db.select({ id: creditGrants.id, credits: creditGrants.credits, remainingCredits: creditGrants.remainingCredits, expiresAt: creditGrants.expiresAt, source: creditGrants.source, createdAt: creditGrants.createdAt })
      .from(creditGrants).where(eq(creditGrants.userId, userId)).orderBy(desc(creditGrants.createdAt)),
  ])
  return {
    plans: [
      ...(defaultPlan ? [{ ...defaultPlan, id: `default:${defaultPlan.id}`, active: true, included: true }] : []),
      ...plans.map((item) => ({ ...item, active: item.startsAt <= now && (!item.expiresAt || item.expiresAt > now), included: false })),
    ],
    credits: credits.map((item) => ({ ...item, active: item.remainingCredits > 0 && (!item.expiresAt || item.expiresAt > now) })),
  }
}

export async function getCreditTransactions(userId: string) {
  return db.select({ id: creditTransactions.id, delta: creditTransactions.delta, balanceAfter: creditTransactions.balanceAfter, reason: creditTransactions.reason, createdAt: creditTransactions.createdAt })
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, userId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(100)
}

export async function getAccountUsage(userId: string, days: 7 | 30 | 90 = 30) {
  const start = new Date()
  start.setUTCDate(start.getUTCDate() - days + 1)
  const startKey = start.toISOString().slice(0, 10)
  const [planRows, creditRows] = await Promise.all([
    db.select({ date: apiUsage.usageDate, planId: apiUsage.planId, planName: subscriptionPlans.name, count: sql<number>`sum(${apiUsage.requestCount})::int`.mapWith(Number) })
      .from(apiUsage)
      .innerJoin(subscriptionPlans, eq(subscriptionPlans.id, apiUsage.planId))
      .where(and(eq(apiUsage.userId, userId), gte(apiUsage.usageDate, startKey)))
      .groupBy(apiUsage.usageDate, apiUsage.planId, subscriptionPlans.name)
      .orderBy(apiUsage.usageDate),
    db.select({ date: sql<string>`to_char(${creditTransactions.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`, count: sql<number>`sum(-${creditTransactions.delta})::int`.mapWith(Number) })
      .from(creditTransactions)
      .where(and(eq(creditTransactions.userId, userId), eq(creditTransactions.reason, 'api_usage'), lt(creditTransactions.delta, 0), gte(creditTransactions.createdAt, start)))
      .groupBy(sql`to_char(${creditTransactions.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`),
  ])
  const byDate = new Map<string, number>()
  const bySource = new Map<string, { id: string; name: string; count: number }>()
  for (const row of planRows) {
    byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.count)
    const source = bySource.get(row.planId) ?? { id: row.planId, name: row.planName, count: 0 }
    source.count += row.count
    bySource.set(row.planId, source)
  }
  for (const row of creditRows) {
    byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.count)
    const source = bySource.get('credits') ?? { id: 'credits', name: 'Credits', count: 0 }
    source.count += row.count
    bySource.set('credits', source)
  }
  const daily = Array.from({ length: days }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    const key = date.toISOString().slice(0, 10)
    return { date: key, count: byDate.get(key) ?? 0 }
  })
  return { daily, bySource: [...bySource.values()].sort((a, b) => b.count - a.count) }
}

export async function getAccountOrders(userId: string) {
  const [afdianIdentity] = await db.select({ accountId: account.accountId }).from(account).where(and(eq(account.userId, userId), eq(account.providerId, AFDIAN_PROVIDER_ID))).limit(1)
  const ownership = afdianIdentity ? or(eq(orders.userId, userId), and(eq(orders.providerId, 'psp-afdian'), eq(orders.externalCustomerId, afdianIdentity.accountId))) : eq(orders.userId, userId)
  return db.select({
    id: orders.id,
    providerId: orders.providerId,
    status: orders.status,
    deliveryStatus: orders.deliveryStatus,
    amount: orders.amount,
    currency: orders.currency,
    termMonths: orders.termMonths,
    offerTitle: orders.externalOfferTitle,
    skuName: skus.name,
    skuKind: skus.kind,
    paymentStatus: payments.status,
    paidAt: payments.paidAt,
    redeemCode: redeemCodes.code,
    redeemedAt: redeemCodes.redeemedAt,
    subscriptionStatus: subscriptions.status,
    createdAt: orders.createdAt,
  }).from(orders)
    .leftJoin(skus, eq(skus.id, orders.skuId))
    .leftJoin(payments, eq(payments.orderId, orders.id))
    .leftJoin(redeemCodes, eq(redeemCodes.orderId, orders.id))
    .leftJoin(subscriptions, eq(subscriptions.id, redeemCodes.subscriptionId))
    .where(ownership)
    .orderBy(desc(orders.createdAt))
}
