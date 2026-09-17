import { randomUUID } from 'node:crypto'
import { and, desc, eq, sql } from 'drizzle-orm'
import { recordActivity } from '@/lib/activity-log'
import { db } from '@/lib/db'
import { commerceDeadLetters, orders, outboxEvents, providerEvents } from '@/lib/db/schema'
import { getCommerceQueue } from '#accesshub-platform-bindings'

export async function recordCommerceDeadLetter(input: {
  queueName: string
  messageId: string
  payload: Record<string, unknown>
  deliveryAttempts: number
  failedAt: string
  replayable: boolean
}) {
  const failedAt = new Date(input.failedAt)
  if (!Number.isFinite(failedAt.getTime())) throw new Error('invalid dead-letter timestamp')
  const [created] = await db.insert(commerceDeadLetters).values({
    id: randomUUID(),
    queueName: input.queueName,
    messageId: input.messageId,
    payload: input.payload,
    replayable: input.replayable,
    deliveryAttempts: Math.max(0, Math.floor(input.deliveryAttempts)),
    failedAt,
    lastError: input.replayable ? null : '消息结构无效，禁止自动重放',
  }).onConflictDoNothing({ target: [commerceDeadLetters.queueName, commerceDeadLetters.messageId] }).returning({ id: commerceDeadLetters.id })
  return { id: created?.id ?? null, duplicate: !created }
}

export async function readCommerceOperations() {
  const [deadLetters, [pendingDeadLetters], [unknownDeliveries], [failedOutbox], [failedProviderEvents]] = await Promise.all([
    db.select().from(commerceDeadLetters).orderBy(desc(commerceDeadLetters.failedAt)).limit(200),
    db.select({ count: sql<number>`count(*)::int` }).from(commerceDeadLetters).where(eq(commerceDeadLetters.status, 'pending')),
    db.select({ count: sql<number>`count(*)::int` }).from(orders).where(eq(orders.deliveryStatus, 'unknown')),
    db.select({ count: sql<number>`count(*)::int` }).from(outboxEvents).where(eq(outboxEvents.status, 'failed')),
    db.select({ count: sql<number>`count(*)::int` }).from(providerEvents).where(eq(providerEvents.status, 'failed')),
  ])
  return { deadLetters, summary: { unknownDeliveries: unknownDeliveries?.count ?? 0, failedOutbox: failedOutbox?.count ?? 0, failedProviderEvents: failedProviderEvents?.count ?? 0, pendingDeadLetters: pendingDeadLetters?.count ?? 0 } }
}

export async function replayCommerceDeadLetter(id: string, actorId: string) {
  const queue = getCommerceQueue()
  if (!queue) throw new Error('commerce queue is not configured')
  const [claimed] = await db.update(commerceDeadLetters).set({ status: 'replaying', updatedAt: new Date(), lastError: null }).where(and(
    eq(commerceDeadLetters.id, id),
    eq(commerceDeadLetters.replayable, true),
    eq(commerceDeadLetters.status, 'pending'),
  )).returning()
  if (!claimed) throw new Error('死信不存在、不可重放或正在处理中')
  try {
    await queue.send(claimed.payload, { contentType: 'json' })
    const replayedAt = new Date()
    await db.update(commerceDeadLetters).set({ status: 'replayed', replayedAt, replayedBy: actorId, updatedAt: replayedAt }).where(eq(commerceDeadLetters.id, id))
    await recordActivity({ actorId, action: 'commerce.dead_letter_replayed', resourceType: 'commerce_dead_letter', resourceId: id, detail: claimed.messageId })
    return { id, status: 'replayed' as const }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'dead-letter replay failed'
    await db.update(commerceDeadLetters).set({ status: 'pending', lastError: message.slice(0, 500), updatedAt: new Date() }).where(eq(commerceDeadLetters.id, id))
    throw error
  }
}
