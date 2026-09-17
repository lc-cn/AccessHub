import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { requireSession } from '@/lib/account'
import { AccountError } from '@/lib/account/errors'
import { requireStrongSession } from '@/lib/account/strong-session'
import { recordSecurityEventBestEffort } from '@/lib/account/security-events'

export async function POST() {
  try {
    const current = await requireSession()
    await requireStrongSession(current.session)
    await auth.api.revokeOtherSessions({ headers: await headers() })
    await recordSecurityEventBestEffort({ actorId: current.user.id, action: 'account.sessions.revoked_all' })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof AccountError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    console.error('[account] Failed to revoke other sessions')
    return NextResponse.json({ error: '结束其他会话失败，请稍后重试。' }, { status: 500 })
  }
}
