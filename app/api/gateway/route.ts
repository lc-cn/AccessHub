import { NextResponse } from 'next/server'
import { and, eq, gt, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { groupMemberships, groups, apiUsage } from '@/lib/db/schema'
import { headers } from 'next/headers'

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [membership] = await db.select({ rateLimit: groups.rateLimit, dailyLimit: groups.dailyLimit }).from(groupMemberships).innerJoin(groups, eq(groups.id, groupMemberships.groupId)).where(and(eq(groupMemberships.userId, session.user.id), sql`(${groupMemberships.expiresAt} is null or ${groupMemberships.expiresAt} > now())`)).orderBy(sql`${groupMemberships.expiresAt} desc nulls first`).limit(1)
  const limit = membership?.rateLimit || 60
  const today = new Date().toISOString().slice(0, 10)
  const [usage] = await db.select().from(apiUsage).where(and(eq(apiUsage.userId, session.user.id), eq(apiUsage.usageDate, today))).limit(1)
  if (usage && usage.windowStartedAt > new Date(Date.now() - 60000) && usage.windowCount >= limit) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  if (usage) await db.update(apiUsage).set({ requestCount: usage.requestCount + 1, windowCount: usage.windowStartedAt > new Date(Date.now() - 60000) ? usage.windowCount + 1 : 1, windowStartedAt: usage.windowStartedAt > new Date(Date.now() - 60000) ? usage.windowStartedAt : new Date() }).where(eq(apiUsage.id, usage.id))
  else await db.insert(apiUsage).values({ id: randomUUID(), userId: session.user.id, usageDate: today, requestCount: 1, windowCount: 1 })
  return NextResponse.json({ ok: true })
}
