import { NextResponse } from 'next/server'
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { requireAdminActor } from '@/lib/admin-auth'
import { withRequestDatabase } from '@/lib/db'
import { apiServices, commerceDeadLetters, gatewayRequests, orders, outboxEvents, providerEvents, serviceApis, subscriptions, user } from '@/lib/db/schema'

const count = sql<number>`count(*)::int`.mapWith(Number)

export async function GET() {
  if (!(await requireAdminActor())) return NextResponse.json({ error: '无权访问' }, { status: 403 })
  const now = new Date()
  const since24h = new Date(now.getTime() - 86_400_000)
  const since7d = new Date(now.getTime() - 7 * 86_400_000)
  const in7d = new Date(now.getTime() + 7 * 86_400_000)

  try {
    return await withRequestDatabase(async (db) => {
      const [trafficRows, customerRows, newCustomerRows, activeSubscriptionRows, expiringRows, orderRows, fulfilledRows, serviceRows, apiRows, unknownRows, failedEventRows, deadLetterRows, failedOutboxRows, recentOrders, unknownDeliveries, failedEvents, deadLetters, failedOutbox] = await Promise.all([
        db.select({
          requests24h: count,
          successes24h: sql<number>`count(*) filter (where ${gatewayRequests.outcome} = 'success')::int`.mapWith(Number),
          activeUsers24h: sql<number>`count(distinct ${gatewayRequests.userId})::int`.mapWith(Number),
          chargedUnits24h: sql<number>`coalesce(sum(${gatewayRequests.chargedUsageUnits}), 0)::int`.mapWith(Number),
          p95DurationMs24h: sql<number>`coalesce(round(percentile_cont(0.95) within group (order by ${gatewayRequests.durationMs})), 0)::int`.mapWith(Number),
        }).from(gatewayRequests).where(gte(gatewayRequests.createdAt, since24h)),
        db.select({ value: count }).from(user),
        db.select({ value: count }).from(user).where(gte(user.createdAt, since7d)),
        db.select({ value: count }).from(subscriptions).where(inArray(subscriptions.status, ['active', 'trialing'])),
        db.select({ value: count }).from(subscriptions).where(and(inArray(subscriptions.status, ['active', 'trialing']), gte(subscriptions.currentPeriodEnd, now), lte(subscriptions.currentPeriodEnd, in7d))),
        db.select({ value: count }).from(orders).where(gte(orders.createdAt, since24h)),
        db.select({ value: count }).from(orders).where(and(gte(orders.createdAt, since24h), eq(orders.deliveryStatus, 'sent'))),
        db.select({ value: count }).from(apiServices).where(eq(apiServices.enabled, true)),
        db.select({ value: count }).from(serviceApis).where(eq(serviceApis.enabled, true)),
        db.select({ value: count }).from(orders).where(eq(orders.deliveryStatus, 'unknown')),
        db.select({ value: count }).from(providerEvents).where(eq(providerEvents.status, 'failed')),
        db.select({ value: count }).from(commerceDeadLetters).where(eq(commerceDeadLetters.status, 'pending')),
        db.select({ value: count }).from(outboxEvents).where(eq(outboxEvents.status, 'failed')),
        db.select({ id: orders.id, providerId: orders.providerId, externalOrderId: orders.externalOrderId, externalOfferTitle: orders.externalOfferTitle, amount: orders.amount, currency: orders.currency, status: orders.status, deliveryStatus: orders.deliveryStatus, createdAt: orders.createdAt }).from(orders).orderBy(desc(orders.createdAt)).limit(6),
        db.select({ id: orders.id, externalOrderId: orders.externalOrderId, title: orders.externalOfferTitle, error: orders.deliveryLastError, createdAt: orders.updatedAt }).from(orders).where(eq(orders.deliveryStatus, 'unknown')).orderBy(desc(orders.updatedAt)).limit(5),
        db.select({ id: providerEvents.id, providerId: providerEvents.providerId, externalEventId: providerEvents.externalEventId, type: providerEvents.type, error: providerEvents.error, createdAt: providerEvents.updatedAt }).from(providerEvents).where(eq(providerEvents.status, 'failed')).orderBy(desc(providerEvents.updatedAt)).limit(5),
        db.select({ id: commerceDeadLetters.id, messageId: commerceDeadLetters.messageId, queueName: commerceDeadLetters.queueName, error: commerceDeadLetters.lastError, createdAt: commerceDeadLetters.failedAt }).from(commerceDeadLetters).where(eq(commerceDeadLetters.status, 'pending')).orderBy(desc(commerceDeadLetters.failedAt)).limit(5),
        db.select({ id: outboxEvents.id, eventType: outboxEvents.eventType, destination: outboxEvents.destination, error: outboxEvents.lastError, createdAt: outboxEvents.updatedAt }).from(outboxEvents).where(eq(outboxEvents.status, 'failed')).orderBy(desc(outboxEvents.updatedAt)).limit(5),
      ])

      const operations = {
        unknownDeliveries: unknownRows[0]?.value ?? 0,
        failedProviderEvents: failedEventRows[0]?.value ?? 0,
        pendingDeadLetters: deadLetterRows[0]?.value ?? 0,
        failedOutbox: failedOutboxRows[0]?.value ?? 0,
        totalAttention: 0,
      }
      operations.totalAttention = operations.unknownDeliveries + operations.failedProviderEvents + operations.pendingDeadLetters + operations.failedOutbox
      const attention = [
        ...unknownDeliveries.map((item) => ({ kind: 'delivery_unknown' as const, id: item.id, title: '订单私信结果未知', detail: `${item.title || item.externalOrderId || item.id}${item.error ? ` · ${item.error}` : ''}`, occurredAt: item.createdAt.toISOString(), href: `/admin/orders/${item.id}` })),
        ...failedEvents.map((item) => ({ kind: 'provider_event_failed' as const, id: item.id, title: '支付服务商事件失败', detail: `${item.type} · ${item.externalEventId}${item.error ? ` · ${item.error}` : ''}`, occurredAt: item.createdAt.toISOString(), href: item.providerId === 'psp-afdian' ? '/admin/afdian/events' : '/admin/operations' })),
        ...deadLetters.map((item) => ({ kind: 'dead_letter' as const, id: item.id, title: '队列消息进入死信', detail: `${item.queueName} · ${item.messageId}${item.error ? ` · ${item.error}` : ''}`, occurredAt: item.createdAt.toISOString(), href: '/admin/operations' })),
        ...failedOutbox.map((item) => ({ kind: 'outbox_failed' as const, id: item.id, title: '事务消息发布失败', detail: `${item.eventType} → ${item.destination}${item.error ? ` · ${item.error}` : ''}`, occurredAt: item.createdAt.toISOString(), href: '/admin/operations' })),
      ].sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt)).slice(0, 8)

      return NextResponse.json({
        generatedAt: now.toISOString(),
        traffic: trafficRows[0] ?? { requests24h: 0, successes24h: 0, activeUsers24h: 0, chargedUnits24h: 0, p95DurationMs24h: 0 },
        customers: { total: customerRows[0]?.value ?? 0, new7d: newCustomerRows[0]?.value ?? 0 },
        commerce: { activeSubscriptions: activeSubscriptionRows[0]?.value ?? 0, expiring7d: expiringRows[0]?.value ?? 0, orders24h: orderRows[0]?.value ?? 0, fulfilledOrders24h: fulfilledRows[0]?.value ?? 0 },
        catalog: { enabledServices: serviceRows[0]?.value ?? 0, enabledApis: apiRows[0]?.value ?? 0 },
        operations,
        attention,
        recentOrders: recentOrders.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
      })
    })
  } catch (error) {
    console.error('[admin-overview] failed to read overview', error)
    return NextResponse.json({ error: '暂时无法读取运营总览' }, { status: 503 })
  }
}
