import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { session } from '@/lib/db/schema'
import { AccountError } from './errors.ts'
import { isRecentStrongAuthentication } from './strong-session-policy.ts'

export { isRecentStrongAuthentication } from './strong-session-policy.ts'

export async function requireStrongSession(current: { id: string }, now = new Date()): Promise<void> {
  const [record] = await db.select({ strongAuthAt: session.strongAuthAt }).from(session).where(eq(session.id, current.id)).limit(1)
  if (!record || !isRecentStrongAuthentication(record.strongAuthAt, now)) {
    throw new AccountError('strong_authentication_required', '此操作需要近期 Passkey 或 MFA 验证。', 403)
  }
}
