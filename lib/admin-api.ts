import { randomBytes, randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { and, asc, desc, eq, inArray, not, sql } from 'drizzle-orm'
import { requireAdminActor } from '@/lib/admin-auth'
import { recordActivity } from '@/lib/activity-log'
import { parseBenefitInput, parseSubscriptionPlanPolicyInput } from '@/lib/admin-entitlements'
import { db, withRequestDatabase } from '@/lib/db'
import { activityLogs, apiServices, orders, payments, permissions as permissionDefinitions, planPermissionGrants, providerEvents, providerOfferMappings, redeemCodes, serviceApis, skus, subscriptionPlans, subscriptions, user } from '@/lib/db/schema'
import { legacyDurationDays, parsePositiveInteger } from '@/lib/entitlements'
import { openServiceAuth, parseServiceApiInput, parseServiceAuthInput, parseServiceAuthUpdate, parseServiceInput, presentServiceAuth, sealServiceAuth, type ServiceAuthType } from '@/lib/api-services'
import { subscriptionStatuses, type SubscriptionStatus } from '@/lib/subscription-state'
import { transitionSubscription } from '@/lib/subscription-service'
import { hasWorkerServiceBinding, workerServiceBindings } from '@/lib/worker-service-bindings'
import { parsePermissionInput } from '@/lib/permissions'
import { invalidateServiceCatalog } from '@/lib/read-model-cache'

// Internal handlers shared by the resource-oriented administrator routes.
function serializeApiService<T extends { authType: string; authConfigEncrypted: string | null }>(service: T) {
  const { authConfigEncrypted, ...publicService } = service
  return { ...publicService, ...presentServiceAuth(service.authType as ServiceAuthType, authConfigEncrypted) }
}

export async function GET(request: Request) {
  if (!(await requireAdminActor())) return NextResponse.json({ error: '无权访问' }, { status: 403 })
  return withRequestDatabase(async (db) => {
    const section = new URL(request.url).searchParams.get('section') || 'all'
    const wants = (...names: string[]) => section === 'all' || names.includes(section)
    const [plans, codes, mappings, orderRows, skuRows, users, logs] = await Promise.all([
      db.select().from(subscriptionPlans).orderBy(asc(subscriptionPlans.rank), asc(subscriptionPlans.createdAt)),
      wants('codes') ? db.select({
        id: redeemCodes.id, code: redeemCodes.code, kind: redeemCodes.kind,
        planId: redeemCodes.planId, planName: subscriptionPlans.name, credits: redeemCodes.credits,
        durationDays: redeemCodes.durationDays, durationValue: redeemCodes.durationValue,
        durationUnit: redeemCodes.durationUnit, expiresAt: redeemCodes.expiresAt,
        redeemedAt: redeemCodes.redeemedAt, createdAt: redeemCodes.createdAt,
      }).from(redeemCodes).leftJoin(subscriptionPlans, eq(subscriptionPlans.id, redeemCodes.planId)).orderBy(desc(redeemCodes.createdAt)).limit(200) : Promise.resolve([]),
      wants('afdian') ? db.select({
        id: providerOfferMappings.id, externalOfferType: providerOfferMappings.externalOfferType, externalOfferId: providerOfferMappings.externalOfferId, name: providerOfferMappings.externalName,
        skuId: providerOfferMappings.skuId, skuCode: skus.code, skuName: skus.name,
        kind: skus.kind, planId: skus.planId, planName: subscriptionPlans.name, credits: skus.credits,
        durationValue: skus.durationValue, durationUnit: skus.durationUnit,
        codesPerItem: providerOfferMappings.unitsPerItem, enabled: providerOfferMappings.enabled,
        updatedAt: providerOfferMappings.updatedAt,
      }).from(providerOfferMappings).innerJoin(skus, eq(skus.id, providerOfferMappings.skuId)).leftJoin(subscriptionPlans, eq(subscriptionPlans.id, skus.planId)).where(eq(providerOfferMappings.providerId, 'psp-afdian')).orderBy(desc(providerOfferMappings.updatedAt)) : Promise.resolve([]),
      wants('orders', 'afdian-orders') ? db.select({
        id: orders.id, providerId: orders.providerId, externalOrderId: orders.externalOrderId,
        externalCustomerId: orders.externalCustomerId, externalOfferId: orders.externalOfferId,
        externalOfferTitle: orders.externalOfferTitle, userId: orders.userId, skuId: orders.skuId,
        skuCode: skus.code, skuName: skus.name, status: orders.status, termMonths: orders.termMonths, amount: orders.amount, currency: orders.currency,
        deliveryStatus: orders.deliveryStatus, deliveryAttempts: orders.deliveryAttempts,
        deliveryAttemptedAt: orders.deliveryAttemptedAt, deliveredAt: orders.deliveredAt,
        deliveryLastError: orders.deliveryLastError, createdAt: orders.createdAt,
      }).from(orders).leftJoin(skus, eq(skus.id, orders.skuId)).orderBy(desc(orders.createdAt)).limit(200) : Promise.resolve([]),
      wants('skus', 'afdian', 'codes') ? db.select({
        id: skus.id, code: skus.code, name: skus.name, description: skus.description, kind: skus.kind,
        planId: skus.planId, planName: subscriptionPlans.name, credits: skus.credits,
        durationValue: skus.durationValue, durationUnit: skus.durationUnit, active: skus.active,
        createdAt: skus.createdAt, updatedAt: skus.updatedAt,
      }).from(skus).leftJoin(subscriptionPlans, eq(subscriptionPlans.id, skus.planId)).orderBy(desc(skus.updatedAt)) : Promise.resolve([]),
      wants('users') ? db.select({ id: user.id, name: user.name, email: user.email, image: user.image, role: user.role, createdAt: user.createdAt }).from(user).orderBy(desc(user.createdAt)).limit(500) : Promise.resolve([]),
      wants('logs') ? db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(500) : Promise.resolve([]),
    ])
    const orderCodes = orderRows.length ? await db.select({
      id: redeemCodes.id, code: redeemCodes.code, orderId: redeemCodes.orderId, kind: redeemCodes.kind,
      planId: redeemCodes.planId, planName: subscriptionPlans.name, credits: redeemCodes.credits,
      durationValue: redeemCodes.durationValue, durationUnit: redeemCodes.durationUnit,
      redeemedAt: redeemCodes.redeemedAt, redeemedBy: redeemCodes.redeemedBy,
    }).from(redeemCodes).leftJoin(subscriptionPlans, eq(subscriptionPlans.id, redeemCodes.planId)).where(inArray(redeemCodes.orderId, orderRows.map((order) => order.id))) : []
    const [subscriptionRows, paymentRows, eventRows] = await Promise.all([
      wants('subscriptions') ? db.select({ id: subscriptions.id, userId: subscriptions.userId, userName: user.name, planId: subscriptions.planId, planName: subscriptionPlans.name, skuId: subscriptions.skuId, skuCode: skus.code, providerId: subscriptions.providerId, status: subscriptions.status, currentPeriodStart: subscriptions.currentPeriodStart, currentPeriodEnd: subscriptions.currentPeriodEnd, cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd, createdAt: subscriptions.createdAt, updatedAt: subscriptions.updatedAt }).from(subscriptions).innerJoin(subscriptionPlans, eq(subscriptionPlans.id, subscriptions.planId)).leftJoin(skus, eq(skus.id, subscriptions.skuId)).leftJoin(user, eq(user.id, subscriptions.userId)).orderBy(desc(subscriptions.updatedAt)).limit(500) : Promise.resolve([]),
      wants('payments') ? db.select({ id: payments.id, orderId: payments.orderId, providerId: payments.providerId, externalPaymentId: payments.externalPaymentId, status: payments.status, amount: payments.amount, currency: payments.currency, paidAt: payments.paidAt, createdAt: payments.createdAt }).from(payments).orderBy(desc(payments.createdAt)).limit(500) : Promise.resolve([]),
      wants('logs', 'afdian-events', 'orders', 'afdian-orders') ? db.select({
        id: providerEvents.id,
        providerId: providerEvents.providerId,
        externalEventId: providerEvents.externalEventId,
        type: providerEvents.type,
        status: providerEvents.status,
        error: providerEvents.error,
        attemptCount: providerEvents.attemptCount,
        queuedAt: providerEvents.queuedAt,
        processingStartedAt: providerEvents.processingStartedAt,
        nextAttemptAt: providerEvents.nextAttemptAt,
        workflowInstanceId: providerEvents.workflowInstanceId,
        processedAt: providerEvents.processedAt,
        createdAt: providerEvents.createdAt,
        updatedAt: providerEvents.updatedAt,
      }).from(providerEvents).where(section === 'afdian-events' ? eq(providerEvents.providerId, 'psp-afdian') : undefined).orderBy(desc(providerEvents.createdAt)).limit(500) : Promise.resolve([]),
    ])
    const [serviceRows, serviceApiRows, permissionRows, permissionGrantRows] = await Promise.all([
      wants('services', 'permissions') ? db.select({ id: apiServices.id, code: apiServices.code, name: apiServices.name, description: apiServices.description, transport: apiServices.transport, bindingName: apiServices.bindingName, baseUrl: apiServices.baseUrl, authType: apiServices.authType, authConfigEncrypted: apiServices.authConfigEncrypted, requiredPermissionId: apiServices.requiredPermissionId, requiredPermissionCode: permissionDefinitions.code, requiredPermissionName: permissionDefinitions.name, enabled: apiServices.enabled, createdAt: apiServices.createdAt, updatedAt: apiServices.updatedAt }).from(apiServices).leftJoin(permissionDefinitions, eq(permissionDefinitions.id, apiServices.requiredPermissionId)).orderBy(desc(apiServices.updatedAt)) : Promise.resolve([]),
      wants('services') ? db.select().from(serviceApis).orderBy(asc(serviceApis.serviceId), asc(serviceApis.createdAt)) : Promise.resolve([]),
      wants('services', 'permissions') ? db.select().from(permissionDefinitions).orderBy(asc(permissionDefinitions.name), asc(permissionDefinitions.code)) : Promise.resolve([]),
      wants('services', 'permissions') ? db.select({ permissionId: planPermissionGrants.permissionId, planId: planPermissionGrants.planId }).from(planPermissionGrants) : Promise.resolve([]),
    ])
    const permissionCatalog = permissionRows.map((permission) => ({ ...permission, planIds: permissionGrantRows.filter((grant) => grant.permissionId === permission.id).map((grant) => grant.planId), serviceCount: serviceRows.filter((service) => service.requiredPermissionId === permission.id).length }))
    const fulfilledOrders = orderRows.filter((order) => section !== 'afdian-orders' || order.providerId === 'psp-afdian').map((order) => ({
      ...order,
      codes: orderCodes.filter((code) => code.orderId === order.id),
      providerEvent: eventRows.find((event) => event.providerId === order.providerId && event.externalEventId === order.externalOrderId) ?? null,
    }))
    return NextResponse.json({ plans, codes, afdianMappings: mappings, orders: fulfilledOrders, skus: skuRows, users, logs, subscriptions: subscriptionRows, payments: paymentRows, providerEvents: eventRows, services: serviceRows.map((service) => ({ ...serializeApiService(service), apis: serviceApiRows.filter((api) => api.serviceId === service.id) })), permissions: permissionCatalog, workerBindings: wants('services') ? workerServiceBindings : [], afadianWebhookConfigured: Boolean(process.env.AFDIAN_WEBHOOK_SECRET), afadianMessengerConfigured: Boolean(process.env.AFDIAN_USER_ID && process.env.AFDIAN_ADMIN_TOKEN) })
  })
}

export async function POST(request: Request) {
  const actorId = await requireAdminActor()
  if (!actorId) return NextResponse.json({ error: '无权操作' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (body.type === 'permission') {
    const parsed = parsePermissionInput(body)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const [sameCode] = await db.select({ id: permissionDefinitions.id }).from(permissionDefinitions).where(eq(permissionDefinitions.code, parsed.value.code)).limit(1)
    if (sameCode) return NextResponse.json({ error: '权限编码已存在' }, { status: 409 })
    if (parsed.value.planIds.length) {
      const assignedPlans = await db.select({ id: subscriptionPlans.id }).from(subscriptionPlans).where(inArray(subscriptionPlans.id, parsed.value.planIds))
      if (assignedPlans.length !== parsed.value.planIds.length) return NextResponse.json({ error: '包含不存在的订阅计划' }, { status: 400 })
    }
    const permissionId = randomUUID()
    const created = await db.transaction(async (tx) => {
      const [permission] = await tx.insert(permissionDefinitions).values({ id: permissionId, code: parsed.value.code, name: parsed.value.name, description: parsed.value.description }).returning()
      if (parsed.value.planIds.length) await tx.insert(planPermissionGrants).values(parsed.value.planIds.map((planId) => ({ id: randomUUID(), planId, permissionId })))
      return permission
    })
    await recordActivity({ actorId, action: 'permission.created', resourceType: 'permission', resourceId: created.id, detail: created.code })
    return NextResponse.json({ permission: { ...created, planIds: parsed.value.planIds, serviceCount: 0 } })
  }
  if (body.type === 'plan') {
    const parsed = parseSubscriptionPlanPolicyInput(body, 60)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const { name, ...policy } = parsed.value
    const [sameName] = await db.select({ id: subscriptionPlans.id }).from(subscriptionPlans).where(eq(subscriptionPlans.name, name)).limit(1)
    if (sameName) return NextResponse.json({ error: '订阅计划名称已存在' }, { status: 409 })
    const [sameRank] = await db.select({ id: subscriptionPlans.id }).from(subscriptionPlans).where(eq(subscriptionPlans.rank, policy.rank)).limit(1)
    if (sameRank) return NextResponse.json({ error: '计划阶梯等级已被占用' }, { status: 409 })
    const created = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('subscription_plans.default'))`)
      const [existingPlan] = await tx.select({ id: subscriptionPlans.id }).from(subscriptionPlans).limit(1)
      const isDefault = policy.isDefault || !existingPlan
      if (isDefault) await tx.update(subscriptionPlans).set({ isDefault: false }).where(eq(subscriptionPlans.isDefault, true))
      const [inserted] = await tx.insert(subscriptionPlans).values({ id: randomUUID(), name, ...policy, isDefault }).returning()
      return inserted
    })
    await recordActivity({ actorId, action: 'plan.created', resourceType: 'subscription_plan', resourceId: created.id, detail: created.name })
    return NextResponse.json({ plan: created })
  }
  if (body.type === 'sku') {
    const code = String(body.code || '').trim().toUpperCase()
    const name = String(body.name || '').trim()
    const benefit = parseBenefitInput(body)
    if (!/^[A-Z0-9][A-Z0-9._-]{1,63}$/.test(code)) return NextResponse.json({ error: 'SKU 编码需为 2–64 位大写字母、数字、点、横线或下划线' }, { status: 400 })
    if (!name) return NextResponse.json({ error: '请输入 SKU 名称' }, { status: 400 })
    if (!benefit.ok) return NextResponse.json({ error: benefit.error }, { status: 400 })
    const [sameCode] = await db.select({ id: skus.id }).from(skus).where(eq(skus.code, code)).limit(1)
    if (sameCode) return NextResponse.json({ error: 'SKU 编码已存在' }, { status: 409 })
    const [created] = await db.insert(skus).values({ id: randomUUID(), code, name, description: String(body.description || '').trim(), ...benefit.value, active: body.active !== false }).returning()
    await recordActivity({ actorId, action: 'sku.created', resourceType: 'sku', resourceId: created.id, detail: `${created.code} ${created.name}` })
    return NextResponse.json({ sku: created })
  }
  if (body.type === 'codes') {
    const requestedCount = parsePositiveInteger(body.count, 1)
    if (!requestedCount || requestedCount > 1000) return NextResponse.json({ error: '数量需为 1–1000' }, { status: 400 })
    const [sku] = await db.select().from(skus).where(and(eq(skus.id, String(body.skuId || '')), eq(skus.active, true))).limit(1)
    if (!sku) return NextResponse.json({ error: '请选择有效 SKU' }, { status: 400 })
    const values = Array.from({ length: requestedCount }, () => ({
      id: randomUUID(), code: `ACCS-${randomBytes(3).toString('hex').toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`,
      kind: sku.kind, planId: sku.planId, credits: sku.credits,
      durationDays: legacyDurationDays(sku.durationValue, sku.durationUnit as 'day' | 'month' | 'quarter' | 'year'),
      durationValue: sku.durationValue, durationUnit: sku.durationUnit,
    }))
    await db.insert(redeemCodes).values(values)
    await recordActivity({ actorId, action: 'codes.generated', resourceType: 'sku', resourceId: sku.id, detail: `${sku.code} x ${requestedCount}` })
    return NextResponse.json({ codes: values.map((item) => item.code) })
  }
  if (body.type === 'afadian-mapping') {
    const externalOfferType = body.externalOfferType === 'sku' ? 'sku' : 'plan'
    const externalOfferId = String(body.externalOfferId || '').trim()
    const name = String(body.name || '').trim()
    const skuId = String(body.skuId || '')
    const codesPerItem = parsePositiveInteger(body.codesPerItem, 1)
    if (!externalOfferId || /\s/.test(externalOfferId)) return NextResponse.json({ error: '请输入有效的爱发电商品 ID' }, { status: 400 })
    if (!codesPerItem || codesPerItem > 1000) return NextResponse.json({ error: '每件权益份数必须在 1–1000 之间' }, { status: 400 })
    const [targetSku] = await db.select({ id: skus.id }).from(skus).where(eq(skus.id, skuId)).limit(1)
    if (!targetSku) return NextResponse.json({ error: 'SKU 不存在' }, { status: 400 })
    const now = new Date()
    const [mapping] = await db.insert(providerOfferMappings).values({ id: randomUUID(), providerId: 'psp-afdian', externalOfferType, externalOfferId, externalName: name, skuId, unitsPerItem: codesPerItem, enabled: body.enabled !== false, updatedAt: now }).onConflictDoUpdate({ target: [providerOfferMappings.providerId, providerOfferMappings.externalOfferType, providerOfferMappings.externalOfferId], set: { externalName: name, skuId, unitsPerItem: codesPerItem, enabled: body.enabled !== false, updatedAt: now } }).returning()
    await recordActivity({ actorId, action: 'provider_mapping.saved', resourceType: 'offer_mapping', resourceId: mapping.id, detail: `afdian:${externalOfferType}:${externalOfferId} -> ${skuId}` })
    return NextResponse.json({ mapping })
  }
  if (body.type === 'service') {
    const parsed = parseServiceInput(body)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    if (parsed.value.transport === 'worker_binding' && !hasWorkerServiceBinding(parsed.value.bindingName)) return NextResponse.json({ error: '请选择当前部署中已配置的 Worker 服务' }, { status: 400 })
    if (parsed.value.requiredPermissionId) {
      const [permission] = await db.select({ id: permissionDefinitions.id }).from(permissionDefinitions).where(eq(permissionDefinitions.id, parsed.value.requiredPermissionId)).limit(1)
      if (!permission) return NextResponse.json({ error: '所选权限不存在' }, { status: 400 })
    }
    const auth = parseServiceAuthInput(parsed.value.authType, body)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 400 })
    const [sameCode] = await db.select({ id: apiServices.id }).from(apiServices).where(eq(apiServices.code, parsed.value.code)).limit(1)
    if (sameCode) return NextResponse.json({ error: '服务编码已存在' }, { status: 409 })
    let authConfigEncrypted: string | null = null
    try { authConfigEncrypted = auth.value ? sealServiceAuth(auth.value) : null }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '服务鉴权配置加密失败' }, { status: 503 }) }
    const [created] = await db.insert(apiServices).values({ id: randomUUID(), ...parsed.value, authConfigEncrypted }).returning()
    await recordActivity({ actorId, action: 'api_service.created', resourceType: 'api_service', resourceId: created.id, detail: `${created.code} ${created.name}` })
    await invalidateServiceCatalog()
    return NextResponse.json({ service: { ...serializeApiService(created), apis: [] } })
  }
  if (body.type === 'service-api') {
    const serviceId = String(body.serviceId || '')
    const parsed = parseServiceApiInput(body)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const [service] = await db.select({ id: apiServices.id }).from(apiServices).where(eq(apiServices.id, serviceId)).limit(1)
    if (!service) return NextResponse.json({ error: '服务不存在' }, { status: 404 })
    const [sameCode] = await db.select({ id: serviceApis.id }).from(serviceApis).where(and(eq(serviceApis.serviceId, serviceId), eq(serviceApis.code, parsed.value.code))).limit(1)
    if (sameCode) return NextResponse.json({ error: '该服务下的 API 编码已存在' }, { status: 409 })
    const [created] = await db.insert(serviceApis).values({ id: randomUUID(), serviceId, ...parsed.value }).returning()
    await recordActivity({ actorId, action: 'service_api.created', resourceType: 'service_api', resourceId: created.id, detail: `${serviceId}:${created.code}` })
    await invalidateServiceCatalog()
    return NextResponse.json({ api: created })
  }
  return NextResponse.json({ error: '未知操作' }, { status: 400 })
}

export async function PATCH(request: Request) {
  const actorId = await requireAdminActor()
  if (!actorId) return NextResponse.json({ error: '无权操作' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (body.type === 'permission') {
    const permissionId = String(body.permissionId || '')
    const parsed = parsePermissionInput(body)
    if (!permissionId || !parsed.ok) return NextResponse.json({ error: parsed.ok ? '权限不能为空' : parsed.error }, { status: 400 })
    const [existing] = await db.select({ id: permissionDefinitions.id }).from(permissionDefinitions).where(eq(permissionDefinitions.id, permissionId)).limit(1)
    if (!existing) return NextResponse.json({ error: '权限不存在' }, { status: 404 })
    const [sameCode] = await db.select({ id: permissionDefinitions.id }).from(permissionDefinitions).where(and(eq(permissionDefinitions.code, parsed.value.code), not(eq(permissionDefinitions.id, permissionId)))).limit(1)
    if (sameCode) return NextResponse.json({ error: '权限编码已存在' }, { status: 409 })
    if (parsed.value.planIds.length) {
      const assignedPlans = await db.select({ id: subscriptionPlans.id }).from(subscriptionPlans).where(inArray(subscriptionPlans.id, parsed.value.planIds))
      if (assignedPlans.length !== parsed.value.planIds.length) return NextResponse.json({ error: '包含不存在的订阅计划' }, { status: 400 })
    }
    const updated = await db.transaction(async (tx) => {
      const [permission] = await tx.update(permissionDefinitions).set({ code: parsed.value.code, name: parsed.value.name, description: parsed.value.description, updatedAt: new Date() }).where(eq(permissionDefinitions.id, permissionId)).returning()
      await tx.delete(planPermissionGrants).where(eq(planPermissionGrants.permissionId, permissionId))
      if (parsed.value.planIds.length) await tx.insert(planPermissionGrants).values(parsed.value.planIds.map((planId) => ({ id: randomUUID(), planId, permissionId })))
      return permission
    })
    await recordActivity({ actorId, action: 'permission.updated', resourceType: 'permission', resourceId: updated.id, detail: updated.code })
    return NextResponse.json({ permission: { ...updated, planIds: parsed.value.planIds } })
  }
  if (body.type === 'subscription') {
    const subscriptionId = String(body.subscriptionId || '')
    const nextStatus = String(body.status || '') as SubscriptionStatus
    if (!subscriptionId || !subscriptionStatuses.includes(nextStatus)) return NextResponse.json({ error: '订阅状态无效' }, { status: 400 })
    try {
      const updated = await db.transaction(async (tx) => {
        return transitionSubscription(tx, { subscriptionId, toStatus: nextStatus, eventType: 'admin_transition', actorId, detail: `actor:${actorId}` })
      })
      return NextResponse.json({ subscription: updated })
    } catch (error) {
      const message = error instanceof Error ? error.message : '订阅状态更新失败'
      return NextResponse.json({ error: message }, { status: message === '订阅不存在' ? 404 : 409 })
    }
  }
  if (body.type === 'sku') {
    const skuId = String(body.skuId || '')
    const code = String(body.code || '').trim().toUpperCase()
    const name = String(body.name || '').trim()
    const benefit = parseBenefitInput(body)
    if (!skuId || !/^[A-Z0-9][A-Z0-9._-]{1,63}$/.test(code) || !name || !benefit.ok) return NextResponse.json({ error: benefit.ok ? 'SKU 信息不完整' : benefit.error }, { status: 400 })
    const [sameCode] = await db.select({ id: skus.id }).from(skus).where(and(eq(skus.code, code), not(eq(skus.id, skuId)))).limit(1)
    if (sameCode) return NextResponse.json({ error: 'SKU 编码已存在' }, { status: 409 })
    const [updated] = await db.update(skus).set({ code, name, description: String(body.description || '').trim(), ...benefit.value, active: body.active !== false, updatedAt: new Date() }).where(eq(skus.id, skuId)).returning()
    if (!updated) return NextResponse.json({ error: 'SKU 不存在' }, { status: 404 })
    await recordActivity({ actorId, action: 'sku.updated', resourceType: 'sku', resourceId: updated.id, detail: `${updated.code} ${updated.name}` })
    return NextResponse.json({ sku: updated })
  }
  if (body.type === 'service') {
    const serviceId = String(body.serviceId || '')
    const parsed = parseServiceInput(body)
    if (!serviceId || !parsed.ok) return NextResponse.json({ error: parsed.ok ? '服务不能为空' : parsed.error }, { status: 400 })
    if (parsed.value.transport === 'worker_binding' && !hasWorkerServiceBinding(parsed.value.bindingName)) return NextResponse.json({ error: '请选择当前部署中已配置的 Worker 服务' }, { status: 400 })
    if (parsed.value.requiredPermissionId) {
      const [permission] = await db.select({ id: permissionDefinitions.id }).from(permissionDefinitions).where(eq(permissionDefinitions.id, parsed.value.requiredPermissionId)).limit(1)
      if (!permission) return NextResponse.json({ error: '所选权限不存在' }, { status: 400 })
    }
    const [existing] = await db.select().from(apiServices).where(eq(apiServices.id, serviceId)).limit(1)
    if (!existing) return NextResponse.json({ error: '服务不存在' }, { status: 404 })
    const [sameCode] = await db.select({ id: apiServices.id }).from(apiServices).where(and(eq(apiServices.code, parsed.value.code), not(eq(apiServices.id, serviceId)))).limit(1)
    if (sameCode) return NextResponse.json({ error: '服务编码已存在' }, { status: 409 })
    let existingAuth = null
    try {
      if (parsed.value.authType === existing.authType && existing.authConfigEncrypted) existingAuth = openServiceAuth(existing.authConfigEncrypted)
    } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '现有服务鉴权配置读取失败' }, { status: 503 }) }
    const auth = parseServiceAuthUpdate(parsed.value.authType, body, existingAuth)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 400 })
    let authConfigEncrypted: string | null = null
    try { authConfigEncrypted = auth.value ? sealServiceAuth(auth.value) : null }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '服务鉴权配置加密失败' }, { status: 503 }) }
    const [updated] = await db.update(apiServices).set({ ...parsed.value, authConfigEncrypted, updatedAt: new Date() }).where(eq(apiServices.id, serviceId)).returning()
    await recordActivity({ actorId, action: 'api_service.updated', resourceType: 'api_service', resourceId: updated.id, detail: `${updated.code} ${updated.name}` })
    await invalidateServiceCatalog()
    return NextResponse.json({ service: serializeApiService(updated) })
  }
  if (body.type === 'service-api') {
    const serviceId = String(body.serviceId || '')
    const apiId = String(body.apiId || '')
    const parsed = parseServiceApiInput(body)
    if (!serviceId || !apiId || !parsed.ok) return NextResponse.json({ error: parsed.ok ? 'API 信息不完整' : parsed.error }, { status: 400 })
    const [sameCode] = await db.select({ id: serviceApis.id }).from(serviceApis).where(and(eq(serviceApis.serviceId, serviceId), eq(serviceApis.code, parsed.value.code), not(eq(serviceApis.id, apiId)))).limit(1)
    if (sameCode) return NextResponse.json({ error: '该服务下的 API 编码已存在' }, { status: 409 })
    const [updated] = await db.update(serviceApis).set({ ...parsed.value, updatedAt: new Date() }).where(and(eq(serviceApis.id, apiId), eq(serviceApis.serviceId, serviceId))).returning()
    if (!updated) return NextResponse.json({ error: 'API 不存在' }, { status: 404 })
    await recordActivity({ actorId, action: 'service_api.updated', resourceType: 'service_api', resourceId: updated.id, detail: `${serviceId}:${updated.code}` })
    await invalidateServiceCatalog()
    return NextResponse.json({ api: updated })
  }
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
  const [sameRank] = await db.select({ id: subscriptionPlans.id }).from(subscriptionPlans).where(and(eq(subscriptionPlans.rank, policy.rank), not(eq(subscriptionPlans.id, planId)))).limit(1)
  if (sameRank) return NextResponse.json({ error: '计划阶梯等级已被占用' }, { status: 409 })
  const updated = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('subscription_plans.default'))`)
    if (body.isDefault) await tx.update(subscriptionPlans).set({ isDefault: false }).where(and(eq(subscriptionPlans.isDefault, true), not(eq(subscriptionPlans.id, planId))))
    const [changed] = await tx.update(subscriptionPlans).set({ name, ...policy, isDefault: target.isDefault || policy.isDefault, updatedAt: new Date() }).where(eq(subscriptionPlans.id, planId)).returning()
    return changed
  })
  await recordActivity({ actorId, action: 'plan.updated', resourceType: 'subscription_plan', resourceId: updated.id, detail: updated.name })
  return NextResponse.json({ plan: updated })
}

export async function DELETE(request: Request) {
  const actorId = await requireAdminActor()
  if (!actorId) return NextResponse.json({ error: '无权操作' }, { status: 403 })
  const mappingId = new URL(request.url).searchParams.get('mappingId')
  if (!mappingId) return NextResponse.json({ error: '缺少映射 ID' }, { status: 400 })
  const [deleted] = await db.delete(providerOfferMappings).where(and(eq(providerOfferMappings.id, mappingId), eq(providerOfferMappings.providerId, 'psp-afdian'))).returning({ id: providerOfferMappings.id })
  if (!deleted) return NextResponse.json({ error: '映射不存在' }, { status: 404 })
  await recordActivity({ actorId, action: 'provider_mapping.deleted', resourceType: 'offer_mapping', resourceId: deleted.id, detail: 'afdian' })
  return NextResponse.json({ ok: true })
}
