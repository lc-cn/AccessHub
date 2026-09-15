import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

export function proxy(request: NextRequest) {
  const requestedPath = `${request.nextUrl.pathname}${request.nextUrl.search}`
  if (!getSessionCookie(request)) {
    const login = new URL('/login', request.url)
    login.searchParams.set('next', requestedPath)
    return NextResponse.redirect(login)
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-accesshub-request-path', requestedPath)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!api(?:/|$)|login(?:/|$)|reset-password(?:/|$)|privacy(?:/|$)|terms(?:/|$)|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
