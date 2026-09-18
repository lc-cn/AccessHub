import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { requireAdminActor } from '@/lib/admin-auth'
import { parseAdminUserGrantInput } from '@/lib/admin-user-grants'
import { AccountError } from '@/lib/account/errors'
import { getSession } from '@/lib/account/session'
import { requireStrongSession } from '@/lib/account/strong-session'
import { db } from '@/lib/db'
import { activityLogs, creditGrants, creditTransactions, planEntitlements, subscriptionPlans, user } from '@/lib/db/schema'

type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context) {
  const actorId = await requireAdminActor()
  if (!actorId) return NextResponse.json({ error: '无权操作' }, { status: 403 })
  try {
    const current = await getSession()
    if (!current?.session) return NextResponse.json({ error: '请重新登录' }, { status: 401 })
    await requireStrongSession(current.session)
    const { id: userId } = await context.params
    const parsed = parseAdminUserGrantInput(await request.json().catch(() => ({})) as Record<string, unknown>)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const [target] = await db.select({ id: user.id }).from(user).where(eq(user.id, userId)).limit(1)
    if (!target) return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    const now = new Date()
    const expiresAt = parsed.value.durationDays === -1 ? null : new Date(now.getTime() + parsed.value.durationDays * 86_400_000)
    if (parsed.value.kind === 'plan') {
      const { planId, durationDays, reason } = parsed.value
      const [plan] = await db.select({ id: subscriptionPlans.id, name: subscriptionPlans.name }).from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1)
      if (!plan) return NextResponse.json({ error: '订阅计划不存在' }, { status: 400 })
      const created = await db.transaction(async (tx) => {
        const [entitlement] = await tx.insert(planEntitlements).values({ id: randomUUID(), userId, planId, startsAt: now, expiresAt, source: 'admin' }).returning()
        await tx.insert(activityLogs).values({ id: randomUUID(), actorId, action: 'user.entitlement.granted', resourceType: 'user', resourceId: userId, detail: `${plan.name} · ${durationDays === -1 ? '永久' : `${durationDays} 天`} · ${reason}` })
        return entitlement
      })
      return NextResponse.json({ entitlement: created }, { status: 201 })
    }
    if (parsed.value.kind === 'credits') {
      const { credits, durationDays, reason } = parsed.value
      const created = await db.transaction(async (tx) => {
        const grantId = randomUUID()
        const [grant] = await tx.insert(creditGrants).values({ id: grantId, userId, credits, remainingCredits: credits, expiresAt, source: 'admin' }).returning()
        await tx.insert(creditTransactions).values({ id: randomUUID(), userId, creditGrantId: grantId, delta: credits, balanceAfter: credits, reason: 'admin_grant', referenceId: actorId })
        await tx.insert(activityLogs).values({ id: randomUUID(), actorId, action: 'user.credits.granted', resourceType: 'user', resourceId: userId, detail: `${credits} Credits · ${durationDays === -1 ? '永久' : `${durationDays} 天`} · ${reason}` })
        return grant
      })
      return NextResponse.json({ creditGrant: created }, { status: 201 })
    }
    return NextResponse.json({ error: '权益类型无效' }, { status: 400 })
  } catch (error) {
    if (error instanceof AccountError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    console.error('[admin-user] failed to grant entitlement', error)
    return NextResponse.json({ error: '补发权益失败，请稍后重试' }, { status: 500 })
  }
}
