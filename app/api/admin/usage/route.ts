import { NextResponse } from 'next/server'
import { and, asc, desc, eq, gte, sql } from 'drizzle-orm'
import { requireAdminActor } from '@/lib/admin-auth'
import { withRequestDatabase } from '@/lib/db'
import { apiServices, gatewayRequests, serviceApis, user } from '@/lib/db/schema'

const allowedRanges = new Set([7, 30, 90])

export async function GET(request: Request) {
  if (!(await requireAdminActor())) return NextResponse.json({ error: '无权访问' }, { status: 403 })
  const requestedDays = Number(new URL(request.url).searchParams.get('days') || 30)
  const days = allowedRanges.has(requestedDays) ? requestedDays : 30
  const since = new Date(Date.now() - days * 86_400_000)
  return withRequestDatabase(async (db) => {
    const dateBucket = sql<string>`to_char(${gatewayRequests.createdAt}, 'YYYY-MM-DD')`
    const successCount = sql<number>`count(*) filter (where ${gatewayRequests.outcome} = 'success')::int`.mapWith(Number)
    const requestCount = sql<number>`count(*)::int`.mapWith(Number)
    const chargedUnits = sql<number>`coalesce(sum(${gatewayRequests.chargedUsageUnits}), 0)::int`.mapWith(Number)
    const averageDuration = sql<number>`coalesce(round(avg(${gatewayRequests.durationMs})), 0)::int`.mapWith(Number)
    const [summaryRows, daily, services, apis, users, recent] = await Promise.all([
      db.select({
        requests: requestCount,
        successes: successCount,
        rejected: sql<number>`count(*) filter (where ${gatewayRequests.outcome} = 'rejected')::int`.mapWith(Number),
        upstreamErrors: sql<number>`count(*) filter (where ${gatewayRequests.outcome} = 'upstream_error')::int`.mapWith(Number),
        activeUsers: sql<number>`count(distinct ${gatewayRequests.userId})::int`.mapWith(Number),
        chargedUnits,
        averageDurationMs: averageDuration,
        p95DurationMs: sql<number>`coalesce(round(percentile_cont(0.95) within group (order by ${gatewayRequests.durationMs})), 0)::int`.mapWith(Number),
      }).from(gatewayRequests).where(gte(gatewayRequests.createdAt, since)),
      db.select({ date: dateBucket, requests: requestCount, successes: successCount, chargedUnits, activeUsers: sql<number>`count(distinct ${gatewayRequests.userId})::int`.mapWith(Number) })
        .from(gatewayRequests).where(gte(gatewayRequests.createdAt, since)).groupBy(dateBucket).orderBy(asc(dateBucket)),
      db.select({ serviceId: gatewayRequests.serviceId, serviceCode: apiServices.code, serviceName: apiServices.name, requests: requestCount, successes: successCount, chargedUnits, averageDurationMs: averageDuration })
        .from(gatewayRequests).innerJoin(apiServices, eq(apiServices.id, gatewayRequests.serviceId)).where(gte(gatewayRequests.createdAt, since)).groupBy(gatewayRequests.serviceId, apiServices.code, apiServices.name).orderBy(desc(requestCount)).limit(10),
      db.select({ apiId: gatewayRequests.apiId, apiCode: serviceApis.code, apiName: serviceApis.name, serviceCode: apiServices.code, requests: requestCount, successes: successCount, chargedUnits, averageDurationMs: averageDuration })
        .from(gatewayRequests).innerJoin(serviceApis, eq(serviceApis.id, gatewayRequests.apiId)).innerJoin(apiServices, eq(apiServices.id, gatewayRequests.serviceId)).where(gte(gatewayRequests.createdAt, since)).groupBy(gatewayRequests.apiId, serviceApis.code, serviceApis.name, apiServices.code).orderBy(desc(requestCount)).limit(10),
      db.select({ userId: gatewayRequests.userId, userName: user.name, userEmail: user.email, requests: requestCount, successes: successCount, chargedUnits, lastCalledAt: sql<Date>`max(${gatewayRequests.createdAt})` })
        .from(gatewayRequests).innerJoin(user, eq(user.id, gatewayRequests.userId)).where(gte(gatewayRequests.createdAt, since)).groupBy(gatewayRequests.userId, user.name, user.email).orderBy(desc(requestCount)).limit(20),
      db.select({ id: gatewayRequests.id, userId: gatewayRequests.userId, userName: user.name, serviceCode: apiServices.code, apiCode: serviceApis.code, method: gatewayRequests.requestMethod, outcome: gatewayRequests.outcome, responseStatus: gatewayRequests.responseStatus, upstreamStatus: gatewayRequests.upstreamStatus, configuredUsageUnits: gatewayRequests.configuredUsageUnits, chargedUsageUnits: gatewayRequests.chargedUsageUnits, durationMs: gatewayRequests.durationMs, errorCode: gatewayRequests.errorCode, createdAt: gatewayRequests.createdAt })
        .from(gatewayRequests).innerJoin(user, eq(user.id, gatewayRequests.userId)).innerJoin(apiServices, eq(apiServices.id, gatewayRequests.serviceId)).innerJoin(serviceApis, and(eq(serviceApis.id, gatewayRequests.apiId), eq(serviceApis.serviceId, gatewayRequests.serviceId))).where(gte(gatewayRequests.createdAt, since)).orderBy(desc(gatewayRequests.createdAt)).limit(50),
    ])
    const summary = summaryRows[0] ?? { requests: 0, successes: 0, rejected: 0, upstreamErrors: 0, activeUsers: 0, chargedUnits: 0, averageDurationMs: 0, p95DurationMs: 0 }
    return NextResponse.json({ days, since: since.toISOString(), summary, daily, services, apis, users, recent })
  })
}
