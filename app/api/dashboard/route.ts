import { NextResponse } from 'next/server'
import { and, count, desc, eq, gt, isNull, lte, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { apiUsage, groupMemberships, groups, user } from '@/lib/db/schema'

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  const today = new Date().toISOString().slice(0, 10)
  const dashboardGroups = alias(groups, 'dashboard_groups')

  const groupRows = await db
    .select({
      id: dashboardGroups.id,
      name: dashboardGroups.name,
      description: dashboardGroups.description,
      rateLimit: dashboardGroups.rateLimit,
      dailyLimit: dashboardGroups.dailyLimit,
      isDefault: dashboardGroups.isDefault,
      memberCount: sql<number>`(
        select count(*)::int
        from ${user} as dashboard_user
        where coalesce(
          (
            select dashboard_membership."groupId"
            from ${groupMemberships} as dashboard_membership
            where dashboard_membership."userId" = dashboard_user.id
              and dashboard_membership."startsAt" <= now()
              and (dashboard_membership."expiresAt" is null or dashboard_membership."expiresAt" > now())
            order by dashboard_membership."expiresAt" desc nulls first,
              dashboard_membership."startsAt" desc
            limit 1
          ),
          (
            select dashboard_default_group.id
            from ${groups} as dashboard_default_group
            where dashboard_default_group."isDefault" = true
            order by dashboard_default_group."createdAt" asc
            limit 1
          )
        ) = ${dashboardGroups.id}
      )`.mapWith(Number),
    })
    .from(dashboardGroups)
    .orderBy(desc(dashboardGroups.isDefault), dashboardGroups.createdAt)

  if (!session?.user) {
    return NextResponse.json({ authenticated: false, user: null, groups: groupRows })
  }

  const now = new Date()
  const activeMembership = and(
    eq(groupMemberships.userId, session.user.id),
    lte(groupMemberships.startsAt, now),
    or(isNull(groupMemberships.expiresAt), gt(groupMemberships.expiresAt, now)),
  )

  const [[userRow], [membership], [usage], [benefits]] = await Promise.all([
    db.select({ id: user.id, name: user.name, image: user.image, role: user.role, createdAt: user.createdAt }).from(user).where(eq(user.id, session.user.id)).limit(1),
    db
      .select({ groupId: groups.id, groupName: groups.name, rateLimit: groups.rateLimit, dailyLimit: groups.dailyLimit, expiresAt: groupMemberships.expiresAt })
      .from(groupMemberships)
      .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
      .where(activeMembership)
      .orderBy(sql`${groupMemberships.expiresAt} desc nulls first`, desc(groupMemberships.startsAt))
      .limit(1),
    db.select({ requestCount: apiUsage.requestCount }).from(apiUsage).where(and(eq(apiUsage.userId, session.user.id), eq(apiUsage.usageDate, today))).limit(1),
    db.select({ count: count() }).from(groupMemberships).where(and(activeMembership, eq(groupMemberships.source, 'redeem'))),
  ])

  const defaultGroup = groupRows.find((group) => group.isDefault) ?? null
  const currentGroup = membership ?? (defaultGroup ? {
    groupId: defaultGroup.id,
    groupName: defaultGroup.name,
    rateLimit: defaultGroup.rateLimit,
    dailyLimit: defaultGroup.dailyLimit,
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
    todayUsage: usage?.requestCount ?? 0,
    activeBenefits: benefits?.count ?? 0,
    groups: groupRows,
  })
}
