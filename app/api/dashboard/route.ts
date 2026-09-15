import { NextResponse } from 'next/server'
import { and, count, desc, eq, gt, gte, isNull, lte, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { account, apiUsage, creditGrants, groupMemberships, groups, user } from '@/lib/db/schema'
import { AFDIAN_PROVIDER_ID, isAfdianOAuthConfigured } from '@/lib/afdian-oauth'
import { countEffectiveGroupMembers } from '@/lib/group-member-counts'
import { usagePeriodKeys } from '@/lib/usage-periods'

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { today, weekStart, monthStart } = usagePeriodKeys()
  const dashboardGroups = alias(groups, 'dashboard_groups')
  const now = new Date()
  const activeAnyMembership = and(
    lte(groupMemberships.startsAt, now),
    or(isNull(groupMemberships.expiresAt), gt(groupMemberships.expiresAt, now)),
  )

  const [rawGroupRows, [userCount], effectiveMemberships] = await Promise.all([
    db.select({
      id: dashboardGroups.id,
      name: dashboardGroups.name,
      description: dashboardGroups.description,
      rateLimit: dashboardGroups.rateLimit,
      dailyLimit: dashboardGroups.dailyLimit,
      weeklyLimit: dashboardGroups.weeklyLimit,
      monthlyLimit: dashboardGroups.monthlyLimit,
      isDefault: dashboardGroups.isDefault,
    })
    .from(dashboardGroups)
    .orderBy(desc(dashboardGroups.isDefault), dashboardGroups.createdAt),
    db.select({ count: count() }).from(user),
    db.selectDistinctOn([groupMemberships.userId], { userId: groupMemberships.userId, groupId: groupMemberships.groupId })
      .from(groupMemberships)
      .where(activeAnyMembership)
      .orderBy(groupMemberships.userId, desc(groupMemberships.startsAt), sql`${groupMemberships.expiresAt} desc nulls first`),
  ])
  const memberCounts = countEffectiveGroupMembers({ groups: rawGroupRows, totalUsers: userCount?.count ?? 0, memberships: effectiveMemberships })
  const groupRows = rawGroupRows.map((group) => ({ ...group, memberCount: memberCounts.get(group.id) ?? 0 }))

  const activeMembership = and(
    eq(groupMemberships.userId, session.user.id),
    lte(groupMemberships.startsAt, now),
    or(isNull(groupMemberships.expiresAt), gt(groupMemberships.expiresAt, now)),
  )

  const [[userRow], [membership], [usage], [benefits], [creditBalance], [creditBenefits], [afdianAccount]] = await Promise.all([
    db.select({ id: user.id, name: user.name, image: user.image, role: user.role, createdAt: user.createdAt }).from(user).where(eq(user.id, session.user.id)).limit(1),
    db
      .select({ groupId: groups.id, groupName: groups.name, rateLimit: groups.rateLimit, dailyLimit: groups.dailyLimit, weeklyLimit: groups.weeklyLimit, monthlyLimit: groups.monthlyLimit, expiresAt: groupMemberships.expiresAt })
      .from(groupMemberships)
      .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
      .where(activeMembership)
      .orderBy(desc(groupMemberships.startsAt), sql`${groupMemberships.expiresAt} desc nulls first`)
      .limit(1),
    db.select({
      daily: sql<number>`coalesce(sum(${apiUsage.requestCount}) filter (where ${apiUsage.usageDate} = ${today}), 0)::int`.mapWith(Number),
      weekly: sql<number>`coalesce(sum(${apiUsage.requestCount}) filter (where ${apiUsage.usageDate} >= ${weekStart}), 0)::int`.mapWith(Number),
      monthly: sql<number>`coalesce(sum(${apiUsage.requestCount}) filter (where ${apiUsage.usageDate} >= ${monthStart}), 0)::int`.mapWith(Number),
    }).from(apiUsage).where(and(eq(apiUsage.userId, session.user.id), gte(apiUsage.usageDate, monthStart < weekStart ? monthStart : weekStart))),
    db.select({ count: count() }).from(groupMemberships).where(and(activeMembership, eq(groupMemberships.source, 'redeem'))),
    db.select({ total: sql<number>`coalesce(sum(${creditGrants.remainingCredits}), 0)::int`.mapWith(Number) }).from(creditGrants).where(and(eq(creditGrants.userId, session.user.id), gt(creditGrants.remainingCredits, 0), or(isNull(creditGrants.expiresAt), gt(creditGrants.expiresAt, now)))),
    db.select({ count: count() }).from(creditGrants).where(and(eq(creditGrants.userId, session.user.id), gt(creditGrants.remainingCredits, 0), or(isNull(creditGrants.expiresAt), gt(creditGrants.expiresAt, now)))),
    db.select({ id: account.id }).from(account).where(and(eq(account.userId, session.user.id), eq(account.providerId, AFDIAN_PROVIDER_ID))).limit(1),
  ])

  const defaultGroup = groupRows.find((group) => group.isDefault) ?? null
  const currentGroup = membership ?? (defaultGroup ? {
    groupId: defaultGroup.id,
    groupName: defaultGroup.name,
    rateLimit: defaultGroup.rateLimit,
    dailyLimit: defaultGroup.dailyLimit,
    weeklyLimit: defaultGroup.weeklyLimit,
    monthlyLimit: defaultGroup.monthlyLimit,
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
    currentGroup,
    usage: { daily: usage?.daily ?? 0, weekly: usage?.weekly ?? 0, monthly: usage?.monthly ?? 0 },
    activeBenefits: (benefits?.count ?? 0) + (creditBenefits?.count ?? 0),
    creditsRemaining: creditBalance?.total ?? 0,
    afdian: { linked: Boolean(afdianAccount), oauthConfigured: isAfdianOAuthConfigured() },
    groups: groupRows,
  })
}
