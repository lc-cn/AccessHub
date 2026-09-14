import { NextResponse } from 'next/server'
import { and, asc, desc, eq, not } from 'drizzle-orm'
import { randomBytes, randomUUID } from 'crypto'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { groups, redeemCodes, user } from '@/lib/db/schema'

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  const [admin] = await db.select({ role: user.role }).from(user).where(eq(user.id, session.user.id)).limit(1)
  if (admin?.role === 'admin') return session.user.id
  const [existingAdmin] = await db.select({ id: user.id }).from(user).where(eq(user.role, 'admin')).limit(1)
  if (!existingAdmin) {
    await db.update(user).set({ role: 'admin' }).where(eq(user.id, session.user.id))
    return session.user.id
  }
  return null
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: '无权访问' }, { status: 403 })
  const rows = await db.select().from(groups).orderBy(asc(groups.createdAt))
  const codes = await db
    .select({
      id: redeemCodes.id,
      code: redeemCodes.code,
      groupId: redeemCodes.groupId,
      groupName: groups.name,
      durationDays: redeemCodes.durationDays,
      expiresAt: redeemCodes.expiresAt,
      redeemedAt: redeemCodes.redeemedAt,
      createdAt: redeemCodes.createdAt,
    })
    .from(redeemCodes)
    .innerJoin(groups, eq(groups.id, redeemCodes.groupId))
    .orderBy(desc(redeemCodes.createdAt))
    .limit(200)
  return NextResponse.json({ groups: rows, codes })
}

function positiveInteger(value: unknown, fallback?: number) {
  if ((value === '' || value == null) && fallback !== undefined) return fallback
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function invalidOptionalLimit(value: unknown, parsed: number | null) {
  return value !== '' && value != null && !parsed
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '无权操作' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (body.type === 'group') {
    const name = String(body.name || '').trim()
    const rateLimit = positiveInteger(body.rateLimit, 60)
    const dailyLimit = body.dailyLimit === '' || body.dailyLimit == null ? null : positiveInteger(body.dailyLimit)
    const weeklyLimit = body.weeklyLimit === '' || body.weeklyLimit == null ? null : positiveInteger(body.weeklyLimit)
    const monthlyLimit = body.monthlyLimit === '' || body.monthlyLimit == null ? null : positiveInteger(body.monthlyLimit)
    if (!name) return NextResponse.json({ error: '请输入用户组名称' }, { status: 400 })
    if (!rateLimit || invalidOptionalLimit(body.dailyLimit, dailyLimit) || invalidOptionalLimit(body.weeklyLimit, weeklyLimit) || invalidOptionalLimit(body.monthlyLimit, monthlyLimit)) return NextResponse.json({ error: '配额必须是正整数' }, { status: 400 })
    if (dailyLimit && weeklyLimit && weeklyLimit < dailyLimit) return NextResponse.json({ error: '每周配额不能低于每日配额' }, { status: 400 })
    if (monthlyLimit && monthlyLimit < Math.max(dailyLimit ?? 0, weeklyLimit ?? 0)) return NextResponse.json({ error: '每月配额不能低于较短周期配额' }, { status: 400 })
    const [sameName] = await db.select({ id: groups.id }).from(groups).where(eq(groups.name, name)).limit(1)
    if (sameName) return NextResponse.json({ error: '用户组名称已存在' }, { status: 409 })
    const [existingGroup] = await db.select({ id: groups.id }).from(groups).limit(1)
    const [created] = await db.insert(groups).values({ id: randomUUID(), name, description: String(body.description || '').trim(), rateLimit, dailyLimit, weeklyLimit, monthlyLimit, isDefault: Boolean(body.isDefault) || !existingGroup }).returning()
    if (created.isDefault) await db.update(groups).set({ isDefault: false }).where(and(eq(groups.isDefault, true), not(eq(groups.id, created.id))))
    return NextResponse.json({ group: created })
  }
  if (body.type === 'codes') {
    const groupId = String(body.groupId || '')
    const requestedCount = positiveInteger(body.count, 1)
    const durationDays = positiveInteger(body.durationDays, 30)
    if (!requestedCount || requestedCount > 1000 || !durationDays) return NextResponse.json({ error: '数量需为 1–1000，有效期需为正整数' }, { status: 400 })
    const count = requestedCount
    const [target] = await db.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId)).limit(1)
    if (!target) return NextResponse.json({ error: '用户组不存在' }, { status: 400 })
    const values = Array.from({ length: count }, () => ({ id: randomUUID(), code: `ACCS-${randomBytes(3).toString('hex').toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`, groupId, durationDays }))
    await db.insert(redeemCodes).values(values)
    return NextResponse.json({ codes: values.map((item) => item.code) })
  }
  return NextResponse.json({ error: '未知操作' }, { status: 400 })
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '无权操作' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (body.type !== 'group') return NextResponse.json({ error: '未知操作' }, { status: 400 })

  const groupId = String(body.groupId || '')
  const name = String(body.name || '').trim()
  const rateLimit = positiveInteger(body.rateLimit)
  const dailyLimit = body.dailyLimit === '' || body.dailyLimit == null ? null : positiveInteger(body.dailyLimit)
  const weeklyLimit = body.weeklyLimit === '' || body.weeklyLimit == null ? null : positiveInteger(body.weeklyLimit)
  const monthlyLimit = body.monthlyLimit === '' || body.monthlyLimit == null ? null : positiveInteger(body.monthlyLimit)
  if (!groupId || !name) return NextResponse.json({ error: '用户组和名称不能为空' }, { status: 400 })
  if (!rateLimit || invalidOptionalLimit(body.dailyLimit, dailyLimit) || invalidOptionalLimit(body.weeklyLimit, weeklyLimit) || invalidOptionalLimit(body.monthlyLimit, monthlyLimit)) return NextResponse.json({ error: '配额必须是正整数' }, { status: 400 })
  if (dailyLimit && weeklyLimit && weeklyLimit < dailyLimit) return NextResponse.json({ error: '每周配额不能低于每日配额' }, { status: 400 })
  if (monthlyLimit && monthlyLimit < Math.max(dailyLimit ?? 0, weeklyLimit ?? 0)) return NextResponse.json({ error: '每月配额不能低于较短周期配额' }, { status: 400 })

  const [target] = await db.select({ id: groups.id, isDefault: groups.isDefault }).from(groups).where(eq(groups.id, groupId)).limit(1)
  if (!target) return NextResponse.json({ error: '用户组不存在' }, { status: 404 })
  const [sameName] = await db.select({ id: groups.id }).from(groups).where(and(eq(groups.name, name), not(eq(groups.id, groupId)))).limit(1)
  if (sameName) return NextResponse.json({ error: '用户组名称已存在' }, { status: 409 })

  const makeDefault = Boolean(body.isDefault)
  if (makeDefault) await db.update(groups).set({ isDefault: false }).where(and(eq(groups.isDefault, true), not(eq(groups.id, groupId))))
  const [updated] = await db.update(groups).set({
    name,
    description: String(body.description || '').trim(),
    rateLimit,
    dailyLimit,
    weeklyLimit,
    monthlyLimit,
    isDefault: target.isDefault || makeDefault,
    updatedAt: new Date(),
  }).where(eq(groups.id, groupId)).returning()
  return NextResponse.json({ group: updated })
}
