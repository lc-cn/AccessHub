import { NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'
import { requireSession } from '@/lib/account'
import { AccountError } from '@/lib/account/errors'
import { requireFreshSession } from '@/lib/account/fresh-session'
import { recordSecurityEventBestEffort } from '@/lib/account/security-events'
import { db } from '@/lib/db'
import { apiKeys } from '@/lib/db/schema'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const current = await requireSession()
    requireFreshSession(current.session)
    const { id } = await params
    const now = new Date()
    const [revoked] = await db.update(apiKeys).set({ revokedAt: now, updatedAt: now }).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, current.user.id), isNull(apiKeys.revokedAt))).returning({ id: apiKeys.id, name: apiKeys.name })
    if (!revoked) throw new AccountError('api_key_not_found', 'API Key 不存在或已经撤销。', 404)
    await recordSecurityEventBestEffort({ actorId: current.user.id, action: 'account.api_key.revoked', resourceId: revoked.id, detail: revoked.name })
    return NextResponse.json({ ok: true, revokedAt: now })
  } catch (error) {
    if (error instanceof AccountError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    console.error('[account] Failed to revoke API key')
    return NextResponse.json({ error: '撤销 API Key 失败，请稍后重试。' }, { status: 500 })
  }
}
