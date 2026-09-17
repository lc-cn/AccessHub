import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { account, user } from '@/lib/db/schema'
import { requireSession } from '@/lib/account'
import { AccountError } from '@/lib/account/errors'
import { requireStrongSession } from '@/lib/account/strong-session'
import { recordSecurityEventBestEffort } from '@/lib/account/security-events'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const current = await requireSession()
    await requireStrongSession(current.session)
    const { id } = await params
    const [identities, [profile]] = await Promise.all([
      db.select({ id: account.id, provider: account.providerId, hasPassword: account.password }).from(account).where(eq(account.userId, current.user.id)),
      db.select({ emailVerified: user.emailVerified }).from(user).where(eq(user.id, current.user.id)).limit(1),
    ])
    const remainingUsable = identities.filter((identity) => identity.id !== id && (identity.provider !== 'credential' || (Boolean(identity.hasPassword) && profile?.emailVerified))).length
    if (remainingUsable === 0) throw new AccountError('last_identity_cannot_be_removed', '至少需要保留一种可用的登录方式。', 400)
    await auth.api.unlinkAccount({ body: { accountId: id }, headers: await headers() })
    await recordSecurityEventBestEffort({ actorId: current.user.id, action: 'account.identity.unlinked', resourceId: id })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof AccountError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    const message = error instanceof Error && /last account|last identity|unlink last/i.test(error.message) ? '至少需要保留一种登录方式。' : '解除绑定失败，请确认登录会话仍然有效。'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
