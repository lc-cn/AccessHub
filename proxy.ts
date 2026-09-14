import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function proxy(request: NextRequest) {
  let session = null
  try {
    session = await auth.api.getSession({ headers: request.headers })
  } catch {
    if (request.nextUrl.pathname === '/login') return NextResponse.next()
  }

  if (request.nextUrl.pathname === '/login') {
    return session?.user ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next()
  }
  if (!session?.user) {
    const login = new URL('/login', request.url)
    login.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(login)
  }
  return NextResponse.next()
}

export const config = { matcher: ['/', '/login'] }
