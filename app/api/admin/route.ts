import { NextResponse } from 'next/server'
import { and, asc, desc, eq, inArray, not } from 'drizzle-orm'
import { randomBytes, randomUUID } from 'crypto'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { afadianBenefitRules, afadianOrders, groups, redeemCodes, user } from '@/lib/db/schema'
import { legacyDurationDays, parsePositiveInteger } from '@/lib/entitlements'
import { parseBenefitInput, parseGroupPolicyInput } from '@/lib/admin-entitlements'

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

export async function GET(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '无权访问' }, { status: 403 })
  const section = new URL(request.url).searchParams.get('section') || 'all'
  const [rows, codes, afdianRules, orderRows] = await Promise.all([
    db.select().from(groups).orderBy(asc(groups.createdAt)),
    section === 'all' || section === 'codes' ? db
    .select({
      id: redeemCodes.id,
      code: redeemCodes.code,
      kind: redeemCodes.kind,
      groupId: redeemCodes.groupId,
      groupName: groups.name,
      credits: redeemCodes.credits,
      durationDays: redeemCodes.durationDays,
      durationValue: redeemCodes.durationValue,
      durationUnit: redeemCodes.durationUnit,
      expiresAt: redeemCodes.expiresAt,
      redeemedAt: redeemCodes.redeemedAt,
      createdAt: redeemCodes.createdAt,
    })
    .from(redeemCodes)
    .leftJoin(groups, eq(groups.id, redeemCodes.groupId))
    .orderBy(desc(redeemCodes.createdAt))
    .limit(200) : Promise.resolve([]),
    section === 'all' || section === 'afdian' ? db
    .select({
      id: afadianBenefitRules.id,
      benefitKey: afadianBenefitRules.benefitKey,
      name: afadianBenefitRules.name,
      kind: afadianBenefitRules.kind,
      groupId: afadianBenefitRules.groupId,
      groupName: groups.name,
      credits: afadianBenefitRules.credits,
      durationValue: afadianBenefitRules.durationValue,
      durationUnit: afadianBenefitRules.durationUnit,
      codesPerItem: afadianBenefitRules.codesPerItem,
      enabled: afadianBenefitRules.enabled,
      updatedAt: afadianBenefitRules.updatedAt,
    })
    .from(afadianBenefitRules)
    .leftJoin(groups, eq(groups.id, afadianBenefitRules.groupId))
    .orderBy(desc(afadianBenefitRules.updatedAt)) : Promise.resolve([]),
    section === 'all' || section === 'afdian-orders' ? db.select({
      id: afadianOrders.id,
      outTradeNo: afadianOrders.outTradeNo,
      userId: afadianOrders.userId,
      planId: afadianOrders.planId,
      planTitle: afadianOrders.planTitle,
      orderMonths: afadianOrders.orderMonths,
      amount: afadianOrders.amount,
      benefitKey: afadianOrders.benefitKey,
      messageStatus: afadianOrders.messageStatus,
      messageAttempts: afadianOrders.messageAttempts,
      messageAttemptedAt: afadianOrders.messageAttemptedAt,
      messageSentAt: afadianOrders.messageSentAt,
      messageLastError: afadianOrders.messageLastError,
      createdAt: afadianOrders.createdAt,
    }).from(afadianOrders).orderBy(desc(afadianOrders.createdAt)).limit(100) : Promise.resolve([]),
  ])
  const orderCodes = orderRows.length ? await db.select({
    id: redeemCodes.id,
    code: redeemCodes.code,
    afadianOrderId: redeemCodes.afadianOrderId,
    kind: redeemCodes.kind,
    groupId: redeemCodes.groupId,
    groupName: groups.name,
    credits: redeemCodes.credits,
    durationValue: redeemCodes.durationValue,
    durationUnit: redeemCodes.durationUnit,
    redeemedAt: redeemCodes.redeemedAt,
    redeemedBy: redeemCodes.redeemedBy,
  }).from(redeemCodes).leftJoin(groups, eq(groups.id, redeemCodes.groupId)).where(inArray(redeemCodes.afadianOrderId, orderRows.map((order) => order.id))) : []
  const orders = orderRows.map((order) => ({ ...order, codes: orderCodes.filter((code) => code.afadianOrderId === order.id) }))
  return NextResponse.json({ groups: rows, codes, afdianRules, afdianOrders: orders, afadianWebhookConfigured: Boolean(process.env.AFDIAN_WEBHOOK_SECRET), afadianMessengerConfigured: Boolean(process.env.AFDIAN_USER_ID && process.env.AFDIAN_ADMIN_TOKEN) })
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '无权操作' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (body.type === 'group') {
    const parsed = parseGroupPolicyInput(body, 60)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const { name, ...policy } = parsed.value
    const [sameName] = await db.select({ id: groups.id }).from(groups).where(eq(groups.name, name)).limit(1)
    if (sameName) return NextResponse.json({ error: '用户组名称已存在' }, { status: 409 })
    const [existingGroup] = await db.select({ id: groups.id }).from(groups).limit(1)
    const [created] = await db.insert(groups).values({ id: randomUUID(), name, ...policy, isDefault: policy.isDefault || !existingGroup }).returning()
    if (created.isDefault) await db.update(groups).set({ isDefault: false }).where(and(eq(groups.isDefault, true), not(eq(groups.id, created.id))))
    return NextResponse.json({ group: created })
  }
  if (body.type === 'codes') {
    const benefit = parseBenefitInput({ ...body, durationValue: body.durationValue ?? body.durationDays }, { value: 30, unit: 'day' })
    const requestedCount = parsePositiveInteger(body.count, 1)
    if (!requestedCount || requestedCount > 1000) return NextResponse.json({ error: '数量需为 1–1000' }, { status: 400 })
    if (!benefit.ok) return NextResponse.json({ error: benefit.error }, { status: 400 })
    const { kind, groupId, credits, durationValue, durationUnit } = benefit.value
    const count = requestedCount
    if (kind === 'group') {
      const [target] = await db.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId!)).limit(1)
      if (!target) return NextResponse.json({ error: '用户组不存在' }, { status: 400 })
    }
    const values = Array.from({ length: count }, () => ({
      id: randomUUID(),
      code: `ACCS-${randomBytes(3).toString('hex').toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`,
      kind,
      groupId,
      credits,
      durationDays: legacyDurationDays(durationValue, durationUnit),
      durationValue,
      durationUnit,
    }))
    await db.insert(redeemCodes).values(values)
    return NextResponse.json({ codes: values.map((item) => item.code) })
  }
  if (body.type === 'afadian-rule') {
    const benefitKey = String(body.benefitKey || '').trim()
    const name = String(body.name || '').trim()
    const benefit = parseBenefitInput(body)
    const codesPerItem = parsePositiveInteger(body.codesPerItem, 1)
    if (!/^(plan|sku):\S+$/.test(benefitKey)) return NextResponse.json({ error: '标识必须使用 plan:ID 或 sku:ID 格式' }, { status: 400 })
    if (!benefit.ok) return NextResponse.json({ error: benefit.error }, { status: 400 })
    if (!codesPerItem || codesPerItem > 1000) return NextResponse.json({ error: '每件权益份数必须在 1–1000 之间' }, { status: 400 })
    const { kind, groupId, credits, durationValue, durationUnit } = benefit.value
    if (kind === 'group') {
      const [target] = await db.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId!)).limit(1)
      if (!target) return NextResponse.json({ error: '用户组不存在' }, { status: 400 })
    }
    const now = new Date()
    const [rule] = await db.insert(afadianBenefitRules).values({ id: randomUUID(), benefitKey, name, kind, groupId, credits, durationValue, durationUnit, codesPerItem, enabled: body.enabled !== false, updatedAt: now }).onConflictDoUpdate({ target: afadianBenefitRules.benefitKey, set: { name, kind, groupId, credits, durationValue, durationUnit, codesPerItem, enabled: body.enabled !== false, updatedAt: now } }).returning()
    return NextResponse.json({ rule })
  }
  return NextResponse.json({ error: '未知操作' }, { status: 400 })
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '无权操作' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (body.type !== 'group') return NextResponse.json({ error: '未知操作' }, { status: 400 })

  const groupId = String(body.groupId || '')
  const parsed = parseGroupPolicyInput(body)
  if (!groupId) return NextResponse.json({ error: '用户组不能为空' }, { status: 400 })
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { name, ...policy } = parsed.value

  const [target] = await db.select({ id: groups.id, isDefault: groups.isDefault }).from(groups).where(eq(groups.id, groupId)).limit(1)
  if (!target) return NextResponse.json({ error: '用户组不存在' }, { status: 404 })
  const [sameName] = await db.select({ id: groups.id }).from(groups).where(and(eq(groups.name, name), not(eq(groups.id, groupId)))).limit(1)
  if (sameName) return NextResponse.json({ error: '用户组名称已存在' }, { status: 409 })

  const makeDefault = Boolean(body.isDefault)
  if (makeDefault) await db.update(groups).set({ isDefault: false }).where(and(eq(groups.isDefault, true), not(eq(groups.id, groupId))))
  const [updated] = await db.update(groups).set({
    name,
    ...policy,
    isDefault: target.isDefault || policy.isDefault,
    updatedAt: new Date(),
  }).where(eq(groups.id, groupId)).returning()
  return NextResponse.json({ group: updated })
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '无权操作' }, { status: 403 })
  const ruleId = new URL(request.url).searchParams.get('ruleId')
  if (!ruleId) return NextResponse.json({ error: '缺少映射 ID' }, { status: 400 })
  const [deleted] = await db.delete(afadianBenefitRules).where(eq(afadianBenefitRules.id, ruleId)).returning({ id: afadianBenefitRules.id })
  if (!deleted) return NextResponse.json({ error: '映射不存在' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
