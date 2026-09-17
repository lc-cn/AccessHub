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

  // A Request received through a Service Binding carries internal dispatch
  // metadata. Reusing it with fetch() sends it back to this Worker. Rebuild
  // the public request from HTTP fields only so it resolves via normal DNS.
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer()
  const upstreamRequest = new Request(url, {
    method: request.method,
    headers: request.headers,
    body,
    redirect: 'follow',
  })
  return upstreamFetch(upstreamRequest)
}
