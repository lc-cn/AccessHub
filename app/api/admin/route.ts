import { NextResponse } from 'next/server'
import { and, asc, desc, eq, not } from 'drizzle-orm'
import { randomBytes, randomUUID } from 'crypto'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { afadianBenefitRules, groups, redeemCodes, user } from '@/lib/db/schema'
import { legacyDurationDays, parseDuration, parseLimit, parsePositiveInteger } from '@/lib/entitlements'

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
    .limit(200)
  const afdianRules = await db
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
    .orderBy(desc(afadianBenefitRules.updatedAt))
  return NextResponse.json({ groups: rows, codes, afdianRules, afadianWebhookConfigured: Boolean(process.env.AFDIAN_WEBHOOK_SECRET) })
}

function invalidQuotaOrder(shorter: number, longer: number) {
  return shorter !== -1 && longer !== -1 && longer < shorter
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '无权操作' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (body.type === 'group') {
    const name = String(body.name || '').trim()
    const rateLimit = parseLimit(body.rateLimit, 60)
    const dailyLimit = parseLimit(body.dailyLimit)
    const weeklyLimit = parseLimit(body.weeklyLimit)
    const monthlyLimit = parseLimit(body.monthlyLimit)
    if (!name) return NextResponse.json({ error: '请输入用户组名称' }, { status: 400 })
    if (rateLimit == null || dailyLimit == null || weeklyLimit == null || monthlyLimit == null) return NextResponse.json({ error: '配额必须为正整数或 -1（无限制）' }, { status: 400 })
    if (invalidQuotaOrder(dailyLimit, weeklyLimit)) return NextResponse.json({ error: '每周配额不能低于每日配额' }, { status: 400 })
    if (invalidQuotaOrder(dailyLimit, monthlyLimit) || invalidQuotaOrder(weeklyLimit, monthlyLimit)) return NextResponse.json({ error: '每月配额不能低于较短周期配额' }, { status: 400 })
    const [sameName] = await db.select({ id: groups.id }).from(groups).where(eq(groups.name, name)).limit(1)
    if (sameName) return NextResponse.json({ error: '用户组名称已存在' }, { status: 409 })
    const [existingGroup] = await db.select({ id: groups.id }).from(groups).limit(1)
    const [created] = await db.insert(groups).values({ id: randomUUID(), name, description: String(body.description || '').trim(), rateLimit, dailyLimit, weeklyLimit, monthlyLimit, isDefault: Boolean(body.isDefault) || !existingGroup }).returning()
    if (created.isDefault) await db.update(groups).set({ isDefault: false }).where(and(eq(groups.isDefault, true), not(eq(groups.id, created.id))))
    return NextResponse.json({ group: created })
  }
  if (body.type === 'codes') {
    const kind = body.kind === 'credits' ? 'credits' : 'group'
    const groupId = kind === 'group' ? String(body.groupId || '') : null
    const credits = kind === 'credits' ? parsePositiveInteger(body.credits) : null
    const requestedCount = parsePositiveInteger(body.count, 1)
    const duration = parseDuration(body.durationValue ?? body.durationDays ?? 30, body.durationUnit ?? 'day')
    if (!requestedCount || requestedCount > 1000 || !duration) return NextResponse.json({ error: '数量需为 1–1000，权益时长需为正整数或 -1' }, { status: 400 })
    if (kind === 'credits' && !credits) return NextResponse.json({ error: 'credits 必须是正整数' }, { status: 400 })
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
      durationDays: legacyDurationDays(duration.durationValue, duration.durationUnit),
      durationValue: duration.durationValue,
      durationUnit: duration.durationUnit,
    }))
    await db.insert(redeemCodes).values(values)
    return NextResponse.json({ codes: values.map((item) => item.code) })
  }
  if (body.type === 'afadian-rule') {
    const benefitKey = String(body.benefitKey || '').trim()
    const name = String(body.name || '').trim()
    const kind = body.kind === 'credits' ? 'credits' : 'group'
    const groupId = kind === 'group' ? String(body.groupId || '') : null
    const credits = kind === 'credits' ? parsePositiveInteger(body.credits) : null
    const duration = parseDuration(body.durationValue, body.durationUnit)
    const codesPerItem = parsePositiveInteger(body.codesPerItem, 1)
    if (!/^(plan|sku):\S+$/.test(benefitKey)) return NextResponse.json({ error: '标识必须使用 plan:ID 或 sku:ID 格式' }, { status: 400 })
    if (!duration || !codesPerItem || codesPerItem > 1000) return NextResponse.json({ error: '请填写有效的权益周期和每件发码数量' }, { status: 400 })
    if (kind === 'credits' && !credits) return NextResponse.json({ error: 'credits 必须是正整数' }, { status: 400 })
    if (kind === 'group') {
      const [target] = await db.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId!)).limit(1)
      if (!target) return NextResponse.json({ error: '用户组不存在' }, { status: 400 })
    }
    const now = new Date()
    const [rule] = await db.insert(afadianBenefitRules).values({ id: randomUUID(), benefitKey, name, kind, groupId, credits, durationValue: duration.durationValue, durationUnit: duration.durationUnit, codesPerItem, enabled: body.enabled !== false, updatedAt: now }).onConflictDoUpdate({ target: afadianBenefitRules.benefitKey, set: { name, kind, groupId, credits, durationValue: duration.durationValue, durationUnit: duration.durationUnit, codesPerItem, enabled: body.enabled !== false, updatedAt: now } }).returning()
    return NextResponse.json({ rule })
  }
  return NextResponse.json({ error: '未知操作' }, { status: 400 })
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '无权操作' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (body.type !== 'group') return NextResponse.json({ error: '未知操作' }, { status: 400 })

  const groupId = String(body.groupId || '')
  const name = String(body.name || '').trim()
  const rateLimit = parseLimit(body.rateLimit)
  const dailyLimit = parseLimit(body.dailyLimit)
  const weeklyLimit = parseLimit(body.weeklyLimit)
  const monthlyLimit = parseLimit(body.monthlyLimit)
  if (!groupId || !name) return NextResponse.json({ error: '用户组和名称不能为空' }, { status: 400 })
  if (rateLimit == null || dailyLimit == null || weeklyLimit == null || monthlyLimit == null) return NextResponse.json({ error: '配额必须为正整数或 -1（无限制）' }, { status: 400 })
  if (invalidQuotaOrder(dailyLimit, weeklyLimit)) return NextResponse.json({ error: '每周配额不能低于每日配额' }, { status: 400 })
  if (invalidQuotaOrder(dailyLimit, monthlyLimit) || invalidQuotaOrder(weeklyLimit, monthlyLimit)) return NextResponse.json({ error: '每月配额不能低于较短周期配额' }, { status: 400 })

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

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '无权操作' }, { status: 403 })
  const ruleId = new URL(request.url).searchParams.get('ruleId')
  if (!ruleId) return NextResponse.json({ error: '缺少映射 ID' }, { status: 400 })
  const [deleted] = await db.delete(afadianBenefitRules).where(eq(afadianBenefitRules.id, ruleId)).returning({ id: afadianBenefitRules.id })
  if (!deleted) return NextResponse.json({ error: '映射不存在' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
