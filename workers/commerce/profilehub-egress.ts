const PROFILEHUB_ORIGIN = 'https://profile.l2cl.link'

const ALLOWED_ENDPOINTS = new Map<string, ReadonlySet<string>>([
  ['/.well-known/openid-configuration', new Set(['GET'])],
  ['/.well-known/jwks.json', new Set(['GET'])],
  ['/oauth/token', new Set(['POST'])],
  ['/oauth/userinfo', new Set(['GET', 'POST'])],
])

export async function proxyProfileHubRequest(
  request: Request,
  upstreamFetch: typeof fetch = fetch,
): Promise<Response> {
  const url = new URL(request.url)
  const allowedMethods = url.origin === PROFILEHUB_ORIGIN ? ALLOWED_ENDPOINTS.get(url.pathname) : undefined
  if (!allowedMethods?.has(request.method)) return new Response('Not found', { status: 404 })
  console.info('[profilehub-egress] forwarding allowlisted request', { method: request.method, pathname: url.pathname })
  return upstreamFetch(request)
}
