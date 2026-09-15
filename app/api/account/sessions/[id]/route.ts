import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { session as sessionTable } from '@/lib/db/schema'
import { requireSession } from '@/lib/account'
import { AccountError } from '@/lib/account/errors'
import { requireFreshSession } from '@/lib/account/fresh-session'
import { recordSecurityEventBestEffort } from '@/lib/account/security-events'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const current = await requireSession()
    requireFreshSession(current.session)
    const { id } = await params
    if (id === current.session.id) throw new AccountError('session_not_found', '当前会话请使用退出登录结束。', 400)
    const deleted = await db.delete(sessionTable).where(and(eq(sessionTable.id, id), eq(sessionTable.userId, current.user.id))).returning({ id: sessionTable.id })
    if (!deleted.length) throw new AccountError('session_not_found', '会话不存在或已经失效。', 404)
    await recordSecurityEventBestEffort({ actorId: current.user.id, action: 'account.session.revoked', resourceId: id })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof AccountError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    console.error('[account] Failed to revoke session')
    return NextResponse.json({ error: '结束会话失败，请稍后重试。' }, { status: 500 })
  }
}
