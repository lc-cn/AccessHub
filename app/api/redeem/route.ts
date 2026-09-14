import { NextResponse } from 'next/server'
import { eq, and, isNull } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redeemCodes, groupMemberships, groups } from '@/lib/db/schema'
import { headers } from 'next/headers'

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const code = String(body.code || '').trim().toUpperCase()
  if (!code) return NextResponse.json({ error: '请输入兑换码' }, { status: 400 })
  const [item] = await db.select().from(redeemCodes).where(and(eq(redeemCodes.code, code), isNull(redeemCodes.redeemedAt))).limit(1)
  if (!item || (item.expiresAt && item.expiresAt < new Date())) return NextResponse.json({ error: '兑换码无效或已过期' }, { status: 400 })
  const now = new Date()
  await db.update(redeemCodes).set({ redeemedAt: now, redeemedBy: session.user.id }).where(eq(redeemCodes.id, item.id))
  await db.insert(groupMemberships).values({ id: randomUUID(), userId: session.user.id, groupId: item.groupId, startsAt: now, expiresAt: new Date(now.getTime() + item.durationDays * 86400000), source: 'redeem' })
  const [group] = await db.select({ name: groups.name }).from(groups).where(eq(groups.id, item.groupId)).limit(1)
  return NextResponse.json({ ok: true, group: group?.name, expiresAt: new Date(now.getTime() + item.durationDays * 86400000).toISOString() })
}
