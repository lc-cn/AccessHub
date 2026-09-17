import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'

/**
 * The single administrator-authentication seam for every management route.
 * The first-account bootstrap is intentionally retained for fresh installations;
 * after an administrator exists, every other account is denied by default.
 */
export async function requireAdminActor() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  const [admin] = await db.select({ role: user.role }).from(user).where(eq(user.id, session.user.id)).limit(1)
  if (admin?.role === 'admin') return session.user.id
  const [existingAdmin] = await db.select({ id: user.id }).from(user).where(eq(user.role, 'admin')).limit(1)
  if (existingAdmin) return null
  await db.update(user).set({ role: 'admin' }).where(eq(user.id, session.user.id))
  return session.user.id
}

