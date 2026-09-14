import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { AFDIAN_PROVIDER_ID, afdianPurchaseUrl, isAfdianOAuthConfigured } from '@/lib/afdian-oauth'
import { db } from '@/lib/db'
import { account } from '@/lib/db/schema'

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', '/api/afadian/purchase')
    return NextResponse.redirect(loginUrl)
  }

  const purchaseUrl = afdianPurchaseUrl()
  if (!purchaseUrl) return NextResponse.json({ error: '爱发电购买地址尚未配置' }, { status: 503 })

  const [linked] = await db.select({ id: account.id }).from(account).where(and(
    eq(account.userId, session.user.id),
    eq(account.providerId, AFDIAN_PROVIDER_ID),
  )).limit(1)
  if (linked || !isAfdianOAuthConfigured()) return NextResponse.redirect(purchaseUrl)

  const result = await auth.api.linkSocialAccount({
    headers: await headers(),
    body: {
      provider: AFDIAN_PROVIDER_ID,
      callbackURL: '/api/afadian/purchase/continue',
      errorCallbackURL: '/?afdian=link-failed',
      disableRedirect: true,
    },
  })
  if (!result.url) return NextResponse.redirect(new URL('/?afdian=link-failed', request.url))
  return NextResponse.redirect(result.url)
}
