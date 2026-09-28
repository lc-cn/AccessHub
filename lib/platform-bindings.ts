export type ServiceBinding = { fetch(request: Request): Promise<Response> }
export type CommerceQueue = {
  send(message: unknown, options?: { contentType?: 'json'; delaySeconds?: number }): Promise<void>
}
export type CacheNamespace = {
  get(key: string, options?: { type?: 'text'; cacheTtl?: number }): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
}

const BINDINGS = new Set(['QQSIGN', 'PROFILEHUB_EGRESS'])
const MAX_BINDING_BODY_BYTES = 64 * 1024

function bridgeConfig() {
  const rawUrl = process.env.EDGE_BRIDGE_URL
  const secret = process.env.EDGE_BRIDGE_SECRET
  if (!rawUrl || !secret) return null
  const url = new URL(rawUrl)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('EDGE_BRIDGE_URL must be an HTTPS origin')
  }
  return { url, secret }
}

async function bridgePost(path: string, payload: unknown): Promise<Response> {
  const config = bridgeConfig()
  if (!config) throw new Error('Cloudflare edge bridge is not configured')
  const response = await fetch(new URL(path, config.url), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-accesshub-edge-secret': config.secret,
    },
    body: JSON.stringify(payload),
    redirect: 'manual',
  })
  if (response.headers.get('x-accesshub-bridge-error') === '1') {
    throw new Error(`Cloudflare edge bridge failed with HTTP ${response.status}`)
  }
  return response
}

export function getServiceBinding(name: string): ServiceBinding | null {
  if (!BINDINGS.has(name) || !bridgeConfig()) return null
  return {
    async fetch(request) {
      const body = request.method === 'GET' || request.method === 'HEAD' ? null : Buffer.from(await request.arrayBuffer())
      if (body && body.length > MAX_BINDING_BODY_BYTES) throw new Error('Worker Binding request body is too large')
      return bridgePost(`/binding/${name}`, {
        url: request.url,
        method: request.method,
        headers: [...request.headers.entries()],
        body: body?.toString('base64') ?? null,
      })
    },
  }
}

export function getHyperdriveConnectionString(): string | null {
  return null
}

export function getReadModelCache(): CacheNamespace | null {
  return null
}

export function getCommerceQueue(): CommerceQueue | null {
  if (!bridgeConfig()) return null
  return {
    async send(message, options) {
      if (options?.delaySeconds) throw new Error('Delayed commerce queue messages are not supported by the edge bridge')
      const response = await bridgePost('/queue/commerce', message)
      if (!response.ok) throw new Error(`Commerce queue publish failed with HTTP ${response.status}`)
    },
  }
}
