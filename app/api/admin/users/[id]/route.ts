import { NextResponse } from 'next/server'
import { and, desc, eq, gt, gte, isNull, or, sql } from 'drizzle-orm'
import { requireAdminActor } from '@/lib/admin-auth'
import { withRequestDatabase } from '@/lib/db'
import { account, apiKeys, apiServices, creditGrants, gatewayRequests, orders, passkey, planEntitlements, serviceApis, session, subscriptionPlans, subscriptions, twoFactor, user } from '@/lib/db/schema'

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  if (!(await requireAdminActor())) return NextResponse.json({ error: '无权访问' }, { status: 403 })
  const { id: userId } = await context.params
  const now = new Date()
  const since30d = new Date(now.getTime() - 30 * 86_400_000)
  try {
    return await withRequestDatabase(async (db) => {
      const [[profile], identities, passkeys, activeSessions, [totp], [summary], entitlements, credits, keys, subscriptionRows, orderRows, recentCalls, plans] = await Promise.all([
        db.select({ id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified, image: user.image, role: user.role, twoFactorEnabled: user.twoFactorEnabled, createdAt: user.createdAt, updatedAt: user.updatedAt }).from(user).where(eq(user.id, userId)).limit(1),
        db.select({ id: account.id, provider: account.providerId, hasPassword: sql<boolean>`${account.password} is not null`.mapWith(Boolean), createdAt: account.createdAt }).from(account).where(eq(account.userId, userId)).orderBy(account.createdAt),
        db.select({ id: passkey.id }).from(passkey).where(eq(passkey.userId, userId)),
        db.select({ id: session.id }).from(session).where(and(eq(session.userId, userId), gt(session.expiresAt, now))),
        db.select({ verified: twoFactor.verified }).from(twoFactor).where(eq(twoFactor.userId, userId)).limit(1),
        db.select({
          requests30d: sql<number>`count(*)::int`.mapWith(Number),
          successfulRequests30d: sql<number>`count(*) filter (where ${gatewayRequests.outcome} = 'success')::int`.mapWith(Number),
          chargedUnits30d: sql<number>`coalesce(sum(${gatewayRequests.chargedUsageUnits}), 0)::int`.mapWith(Number),
        }).from(gatewayRequests).where(and(eq(gatewayRequests.userId, userId), gte(gatewayRequests.createdAt, since30d))),
        db.select({ id: planEntitlements.id, planId: planEntitlements.planId, planName: subscriptionPlans.name, rank: subscriptionPlans.rank, source: planEntitlements.source, startsAt: planEntitlements.startsAt, expiresAt: planEntitlements.expiresAt }).from(planEntitlements).innerJoin(subscriptionPlans, eq(subscriptionPlans.id, planEntitlements.planId)).where(eq(planEntitlements.userId, userId)).orderBy(desc(planEntitlements.startsAt)),
        db.select({ id: creditGrants.id, credits: creditGrants.credits, remainingCredits: creditGrants.remainingCredits, source: creditGrants.source, expiresAt: creditGrants.expiresAt, createdAt: creditGrants.createdAt }).from(creditGrants).where(eq(creditGrants.userId, userId)).orderBy(desc(creditGrants.createdAt)),
        db.select({ id: apiKeys.id, name: apiKeys.name, kind: apiKeys.kind, prefix: apiKeys.prefix, expiresAt: apiKeys.expiresAt, lastUsedAt: apiKeys.lastUsedAt, revokedAt: apiKeys.revokedAt, createdAt: apiKeys.createdAt }).from(apiKeys).where(eq(apiKeys.userId, userId)).orderBy(desc(apiKeys.createdAt)).limit(100),
        db.select({ id: subscriptions.id, planName: subscriptionPlans.name, status: subscriptions.status, providerId: subscriptions.providerId, currentPeriodStart: subscriptions.currentPeriodStart, currentPeriodEnd: subscriptions.currentPeriodEnd, createdAt: subscriptions.createdAt }).from(subscriptions).innerJoin(subscriptionPlans, eq(subscriptionPlans.id, subscriptions.planId)).where(eq(subscriptions.userId, userId)).orderBy(desc(subscriptions.createdAt)).limit(100),
        db.select({ id: orders.id, providerId: orders.providerId, externalOrderId: orders.externalOrderId, title: orders.externalOfferTitle, amount: orders.amount, currency: orders.currency, status: orders.status, deliveryStatus: orders.deliveryStatus, createdAt: orders.createdAt }).from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)).limit(50),
        db.select({ id: gatewayRequests.id, serviceCode: apiServices.code, apiCode: serviceApis.code, outcome: gatewayRequests.outcome, responseStatus: gatewayRequests.responseStatus, chargedUsageUnits: gatewayRequests.chargedUsageUnits, durationMs: gatewayRequests.durationMs, createdAt: gatewayRequests.createdAt }).from(gatewayRequests).innerJoin(apiServices, eq(apiServices.id, gatewayRequests.serviceId)).innerJoin(serviceApis, eq(serviceApis.id, gatewayRequests.apiId)).where(eq(gatewayRequests.userId, userId)).orderBy(desc(gatewayRequests.createdAt)).limit(30),
        db.select({ id: subscriptionPlans.id, name: subscriptionPlans.name, rank: subscriptionPlans.rank, isDefault: subscriptionPlans.isDefault }).from(subscriptionPlans).orderBy(subscriptionPlans.rank),
      ])
      if (!profile) return NextResponse.json({ error: '用户不存在' }, { status: 404 })
      const [creditSummary, orderSummary] = await Promise.all([
        db.select({ value: sql<number>`coalesce(sum(${creditGrants.remainingCredits}), 0)::int`.mapWith(Number) }).from(creditGrants).where(and(eq(creditGrants.userId, userId), gt(creditGrants.remainingCredits, 0), or(isNull(creditGrants.expiresAt), gt(creditGrants.expiresAt, now)))),
        db.select({ value: sql<number>`count(*)::int`.mapWith(Number) }).from(orders).where(eq(orders.userId, userId)),
      ])
      const active = (startsAt: Date, expiresAt: Date | null) => startsAt <= now && (!expiresAt || expiresAt > now)
      return NextResponse.json({
        user: profile,
        security: { identities, passkeyCount: passkeys.length, activeSessionCount: activeSessions.length, hasTotp: totp?.verified === true },
        summary: { creditsRemaining: creditSummary[0]?.value ?? 0, requests30d: summary?.requests30d ?? 0, chargedUnits30d: summary?.chargedUnits30d ?? 0, successfulRequests30d: summary?.successfulRequests30d ?? 0, orderCount: orderSummary[0]?.value ?? 0 },
        entitlements: entitlements.map((item) => ({ ...item, active: active(item.startsAt, item.expiresAt) })),
        credits: credits.map((item) => ({ ...item, active: item.remainingCredits > 0 && (!item.expiresAt || item.expiresAt > now) })),
        apiKeys: keys,
        subscriptions: subscriptionRows,
        orders: orderRows,
        recentCalls,
        plans,
      }, { headers: { 'cache-control': 'private, no-store' } })
    })
  } catch (error) {
    console.error('[admin-user] failed to read user detail', error)
    return NextResponse.json({ error: '暂时无法读取用户详情' }, { status: 503 })
  }
}
