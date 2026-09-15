import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { activityLogs } from '@/lib/db/schema'

export async function recordActivity({ actorId, action, resourceType, resourceId, detail = '' }: { actorId?: string | null; action: string; resourceType: string; resourceId?: string | null; detail?: string }) {
  await db.insert(activityLogs).values({ id: randomUUID(), actorId: actorId || null, action, resourceType, resourceId: resourceId || null, detail })
}
