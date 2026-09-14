import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { AFDIAN_PROVIDER_ID, afdianPurchaseUrl } from '@/lib/afdian-oauth'
import { db } from '@/lib/db'
import { account } from '@/lib/db/schema'

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.redirect(new URL('/login', request.url))

  const [linked] = await db.select({ id: account.id }).from(account).where(and(
    eq(account.userId, session.user.id),
    eq(account.providerId, AFDIAN_PROVIDER_ID),
  )).limit(1)
  const purchaseUrl = afdianPurchaseUrl()
  if (!linked || !purchaseUrl) return NextResponse.redirect(new URL('/?afdian=link-failed', request.url))
  return NextResponse.redirect(purchaseUrl)
}
