import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

export function proxy(request: NextRequest) {
  if (request.nextUrl.hostname === 'www.l2cl.link') {
    const canonical = request.nextUrl.clone()
    canonical.hostname = 'l2cl.link'
    return NextResponse.redirect(canonical, 308)
  }

  if (/^\/(?:api(?:\/|$)|login(?:\/|$)|register(?:\/|$)|two-factor(?:\/|$)|reset-password(?:\/|$)|privacy(?:\/|$)|terms(?:\/|$))/.test(request.nextUrl.pathname)) {
    return NextResponse.next()
  }

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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
