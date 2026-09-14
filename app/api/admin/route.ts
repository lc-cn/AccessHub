import { NextResponse } from 'next/server'
import { and, asc, eq, isNull, not } from 'drizzle-orm'
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
  const codes = await db.select({ code: redeemCodes.code, groupId: redeemCodes.groupId, durationDays: redeemCodes.durationDays, redeemedAt: redeemCodes.redeemedAt, createdAt: redeemCodes.createdAt }).from(redeemCodes).orderBy(asc(redeemCodes.createdAt)).limit(100)
  return NextResponse.json({ groups: rows, codes })
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '无权操作' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (body.type === 'group') {
    const name = String(body.name || '').trim()
    const rateLimit = Math.max(1, Number(body.rateLimit) || 60)
    const dailyLimit = body.dailyLimit === '' || body.dailyLimit == null ? null : Math.max(1, Number(body.dailyLimit) || 1)
    if (!name) return NextResponse.json({ error: '请输入用户组名称' }, { status: 400 })
    const [created] = await db.insert(groups).values({ id: randomUUID(), name, description: String(body.description || ''), rateLimit, dailyLimit, isDefault: Boolean(body.isDefault) }).returning()
    if (created.isDefault) await db.update(groups).set({ isDefault: false }).where(and(eq(groups.isDefault, true), not(eq(groups.id, created.id))))
    return NextResponse.json({ group: created })
  }
  if (body.type === 'codes') {
    const groupId = String(body.groupId || '')
    const count = Math.min(1000, Math.max(1, Number(body.count) || 1))
    const durationDays = Math.max(1, Number(body.durationDays) || 30)
    const [target] = await db.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId)).limit(1)
    if (!target) return NextResponse.json({ error: '用户组不存在' }, { status: 400 })
    const values = Array.from({ length: count }, () => ({ id: randomUUID(), code: `ACCS-${randomBytes(3).toString('hex').toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`, groupId, durationDays }))
    await db.insert(redeemCodes).values(values)
    return NextResponse.json({ codes: values.map((item) => item.code) })
  }
  return NextResponse.json({ error: '未知操作' }, { status: 400 })
}
