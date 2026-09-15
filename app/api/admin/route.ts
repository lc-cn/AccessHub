import { NextResponse } from 'next/server'
import { and, asc, desc, eq, inArray, not } from 'drizzle-orm'
import { randomBytes, randomUUID } from 'crypto'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { afdianOfferMappings, afadianOrders, subscriptionPlans, redeemCodes, user } from '@/lib/db/schema'
import { legacyDurationDays, parsePositiveInteger } from '@/lib/entitlements'
import { parseBenefitInput, parseSubscriptionPlanPolicyInput } from '@/lib/admin-entitlements'

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
  const [rows, codes, afdianMappings, orderRows] = await Promise.all([
    db.select().from(subscriptionPlans).orderBy(asc(subscriptionPlans.createdAt)),
    section === 'all' || section === 'codes' ? db
    .select({
      id: redeemCodes.id,
      code: redeemCodes.code,
      kind: redeemCodes.kind,
      planId: redeemCodes.planId,
      planName: subscriptionPlans.name,
      credits: redeemCodes.credits,
      durationDays: redeemCodes.durationDays,
      durationValue: redeemCodes.durationValue,
      durationUnit: redeemCodes.durationUnit,
      expiresAt: redeemCodes.expiresAt,
      redeemedAt: redeemCodes.redeemedAt,
      createdAt: redeemCodes.createdAt,
    })
    .from(redeemCodes)
    .leftJoin(subscriptionPlans, eq(subscriptionPlans.id, redeemCodes.planId))
    .orderBy(desc(redeemCodes.createdAt))
    .limit(200) : Promise.resolve([]),
    section === 'all' || section === 'afdian' ? db
    .select({
      id: afdianOfferMappings.id,
      offerKey: afdianOfferMappings.offerKey,
      name: afdianOfferMappings.name,
      kind: afdianOfferMappings.kind,
      planId: afdianOfferMappings.planId,
      planName: subscriptionPlans.name,
      credits: afdianOfferMappings.credits,
      durationValue: afdianOfferMappings.durationValue,
      durationUnit: afdianOfferMappings.durationUnit,
      codesPerItem: afdianOfferMappings.codesPerItem,
      enabled: afdianOfferMappings.enabled,
      updatedAt: afdianOfferMappings.updatedAt,
    })
    .from(afdianOfferMappings)
    .leftJoin(subscriptionPlans, eq(subscriptionPlans.id, afdianOfferMappings.planId))
    .orderBy(desc(afdianOfferMappings.updatedAt)) : Promise.resolve([]),
    section === 'all' || section === 'afdian-orders' ? db.select({
      id: afadianOrders.id,
      outTradeNo: afadianOrders.outTradeNo,
      userId: afadianOrders.userId,
      afdianPlanId: afadianOrders.afdianPlanId,
      afdianPlanTitle: afadianOrders.afdianPlanTitle,
      orderMonths: afadianOrders.orderMonths,
      amount: afadianOrders.amount,
      offerKey: afadianOrders.offerKey,
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
    planId: redeemCodes.planId,
    planName: subscriptionPlans.name,
    credits: redeemCodes.credits,
    durationValue: redeemCodes.durationValue,
    durationUnit: redeemCodes.durationUnit,
    redeemedAt: redeemCodes.redeemedAt,
    redeemedBy: redeemCodes.redeemedBy,
  }).from(redeemCodes).leftJoin(subscriptionPlans, eq(subscriptionPlans.id, redeemCodes.planId)).where(inArray(redeemCodes.afadianOrderId, orderRows.map((order) => order.id))) : []
  const orders = orderRows.map((order) => ({ ...order, codes: orderCodes.filter((code) => code.afadianOrderId === order.id) }))
  return NextResponse.json({ plans: rows, codes, afdianMappings, afdianOrders: orders, afadianWebhookConfigured: Boolean(process.env.AFDIAN_WEBHOOK_SECRET), afadianMessengerConfigured: Boolean(process.env.AFDIAN_USER_ID && process.env.AFDIAN_ADMIN_TOKEN) })
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '无权操作' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (body.type === 'plan') {
    const parsed = parseSubscriptionPlanPolicyInput(body, 60)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const { name, ...policy } = parsed.value
    const [sameName] = await db.select({ id: subscriptionPlans.id }).from(subscriptionPlans).where(eq(subscriptionPlans.name, name)).limit(1)
    if (sameName) return NextResponse.json({ error: '订阅计划名称已存在' }, { status: 409 })
    const [existingPlan] = await db.select({ id: subscriptionPlans.id }).from(subscriptionPlans).limit(1)
    const [created] = await db.insert(subscriptionPlans).values({ id: randomUUID(), name, ...policy, isDefault: policy.isDefault || !existingPlan }).returning()
    if (created.isDefault) await db.update(subscriptionPlans).set({ isDefault: false }).where(and(eq(subscriptionPlans.isDefault, true), not(eq(subscriptionPlans.id, created.id))))
    return NextResponse.json({ plan: created })
  }
  if (body.type === 'codes') {
    const benefit = parseBenefitInput({ ...body, durationValue: body.durationValue ?? body.durationDays }, { value: 30, unit: 'day' })
    const requestedCount = parsePositiveInteger(body.count, 1)
    if (!requestedCount || requestedCount > 1000) return NextResponse.json({ error: '数量需为 1–1000' }, { status: 400 })
    if (!benefit.ok) return NextResponse.json({ error: benefit.error }, { status: 400 })
    const { kind, planId, credits, durationValue, durationUnit } = benefit.value
    const count = requestedCount
    if (kind === 'plan') {
      const [target] = await db.select({ id: subscriptionPlans.id }).from(subscriptionPlans).where(eq(subscriptionPlans.id, planId!)).limit(1)
      if (!target) return NextResponse.json({ error: '订阅计划不存在' }, { status: 400 })
    }
    const values = Array.from({ length: count }, () => ({
      id: randomUUID(),
      code: `ACCS-${randomBytes(3).toString('hex').toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`,
      kind,
      planId,
      credits,
      durationDays: legacyDurationDays(durationValue, durationUnit),
      durationValue,
      durationUnit,
    }))
    await db.insert(redeemCodes).values(values)
    return NextResponse.json({ codes: values.map((item) => item.code) })
  }
  if (body.type === 'afadian-mapping') {
    const offerKey = String(body.offerKey || '').trim()
    const name = String(body.name || '').trim()
    const benefit = parseBenefitInput(body)
    const codesPerItem = parsePositiveInteger(body.codesPerItem, 1)
    if (!/^(afdian-plan|afdian-sku):\S+$/.test(offerKey)) return NextResponse.json({ error: '标识必须使用 afdian-plan:ID 或 afdian-sku:ID 格式' }, { status: 400 })
    if (!benefit.ok) return NextResponse.json({ error: benefit.error }, { status: 400 })
    if (!codesPerItem || codesPerItem > 1000) return NextResponse.json({ error: '每件权益份数必须在 1–1000 之间' }, { status: 400 })
    const { kind, planId, credits, durationValue, durationUnit } = benefit.value
    if (kind === 'plan') {
      const [target] = await db.select({ id: subscriptionPlans.id }).from(subscriptionPlans).where(eq(subscriptionPlans.id, planId!)).limit(1)
      if (!target) return NextResponse.json({ error: '订阅计划不存在' }, { status: 400 })
    }
    const now = new Date()
    const [mapping] = await db.insert(afdianOfferMappings).values({ id: randomUUID(), offerKey, name, kind, planId, credits, durationValue, durationUnit, codesPerItem, enabled: body.enabled !== false, updatedAt: now }).onConflictDoUpdate({ target: afdianOfferMappings.offerKey, set: { name, kind, planId, credits, durationValue, durationUnit, codesPerItem, enabled: body.enabled !== false, updatedAt: now } }).returning()
    return NextResponse.json({ mapping })
  }
  return NextResponse.json({ error: '未知操作' }, { status: 400 })
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '无权操作' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (body.type !== 'plan') return NextResponse.json({ error: '未知操作' }, { status: 400 })

  const planId = String(body.planId || '')
  const parsed = parseSubscriptionPlanPolicyInput(body)
  if (!planId) return NextResponse.json({ error: '订阅计划不能为空' }, { status: 400 })
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { name, ...policy } = parsed.value

  const [target] = await db.select({ id: subscriptionPlans.id, isDefault: subscriptionPlans.isDefault }).from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1)
  if (!target) return NextResponse.json({ error: '订阅计划不存在' }, { status: 404 })
  const [sameName] = await db.select({ id: subscriptionPlans.id }).from(subscriptionPlans).where(and(eq(subscriptionPlans.name, name), not(eq(subscriptionPlans.id, planId)))).limit(1)
  if (sameName) return NextResponse.json({ error: '订阅计划名称已存在' }, { status: 409 })

  const makeDefault = Boolean(body.isDefault)
  if (makeDefault) await db.update(subscriptionPlans).set({ isDefault: false }).where(and(eq(subscriptionPlans.isDefault, true), not(eq(subscriptionPlans.id, planId))))
  const [updated] = await db.update(subscriptionPlans).set({
    name,
    ...policy,
    isDefault: target.isDefault || policy.isDefault,
    updatedAt: new Date(),
  }).where(eq(subscriptionPlans.id, planId)).returning()
  return NextResponse.json({ plan: updated })
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '无权操作' }, { status: 403 })
  const mappingId = new URL(request.url).searchParams.get('mappingId')
  if (!mappingId) return NextResponse.json({ error: '缺少映射 ID' }, { status: 400 })
  const [deleted] = await db.delete(afdianOfferMappings).where(eq(afdianOfferMappings.id, mappingId)).returning({ id: afdianOfferMappings.id })
  if (!deleted) return NextResponse.json({ error: '映射不存在' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
