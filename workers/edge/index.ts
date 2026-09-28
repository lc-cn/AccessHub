import { parseCommerceQueueMessage } from '../commerce/contracts.ts'

type FetchBinding = { fetch(request: Request): Promise<Response> }
type QueueBinding = { send(message: unknown, options?: { contentType?: 'json' }): Promise<void> }

export type EdgeEnv = {
  EDGE_BRIDGE_SECRET: string
  COMMERCE_INTERNAL_SECRET: string
  ORIGIN_URL: string
  QQSIGN: FetchBinding
  PROFILEHUB_EGRESS: FetchBinding
  COMMERCE_EVENTS: QueueBinding
}

const MAX_BODY_BYTES = 64 * 1024
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])

function bridgeError(status: number, message: string) {
  return new Response(message, { status, headers: { 'x-accesshub-bridge-error': '1' } })
}

async function readJson(request: Request): Promise<unknown> {
  const bytes = await request.arrayBuffer()
  if (bytes.byteLength > MAX_BODY_BYTES * 2) return null
  try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown } catch { return null }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function originUrl(raw: string) {
  const url = new URL(raw)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('ORIGIN_URL must be an HTTPS origin')
  }
  return url
}

export async function handleEdgeRequest(request: Request, env: EdgeEnv, upstreamFetch: typeof fetch = fetch): Promise<Response> {
  const path = new URL(request.url).pathname
  if (path === '/api/internal/commerce/commands') {
    if (request.method !== 'POST' || !env.COMMERCE_INTERNAL_SECRET || request.headers.get('authorization') !== `Bearer ${env.COMMERCE_INTERNAL_SECRET}`) {
      return bridgeError(401, 'Unauthorized')
    }
    const target = new URL(path, originUrl(env.ORIGIN_URL))
    return upstreamFetch(target, {
      method: 'POST',
      headers: { authorization: request.headers.get('authorization')!, 'content-type': 'application/json' },
      body: await request.arrayBuffer(),
      redirect: 'manual',
    })
  }

  if (request.method !== 'POST' || request.headers.get('x-accesshub-edge-secret') !== env.EDGE_BRIDGE_SECRET || !env.EDGE_BRIDGE_SECRET) {
    return bridgeError(404, 'Not found')
  }

  if (path === '/queue/commerce') {
    const message = parseCommerceQueueMessage(await readJson(request))
    if (!message) return bridgeError(400, 'Invalid commerce event')
    await env.COMMERCE_EVENTS.send(message, { contentType: 'json' })
    return new Response(null, { status: 204 })
  }

  const binding = path === '/binding/QQSIGN' ? env.QQSIGN : path === '/binding/PROFILEHUB_EGRESS' ? env.PROFILEHUB_EGRESS : null
  if (!binding) return bridgeError(404, 'Not found')
  const payload = await readJson(request)
  if (!isRecord(payload) || typeof payload.url !== 'string' || typeof payload.method !== 'string' || !ALLOWED_METHODS.has(payload.method) || !Array.isArray(payload.headers) ||
      (payload.body !== null && typeof payload.body !== 'string')) return bridgeError(400, 'Invalid binding request')
  let target: URL
  try { target = new URL(payload.url) } catch { return bridgeError(400, 'Invalid binding URL') }
  if (target.protocol !== 'https:' || target.username || target.password) return bridgeError(400, 'Invalid binding URL')
  if (path === '/binding/PROFILEHUB_EGRESS' && target.origin !== 'https://profile.l2cl.link') return bridgeError(400, 'Invalid ProfileHub origin')
  if (path === '/binding/QQSIGN' && target.hostname !== 'qsign.internal') return bridgeError(400, 'Invalid QQSIGN origin')
  if (!payload.headers.every((item) => Array.isArray(item) && item.length === 2 && item.every((part) => typeof part === 'string'))) return bridgeError(400, 'Invalid binding headers')
  const headers = new Headers(payload.headers as [string, string][])
  let body: Uint8Array | undefined
  if (payload.body !== null) {
    try { body = Uint8Array.from(atob(payload.body as string), (char) => char.charCodeAt(0)) } catch { return bridgeError(400, 'Invalid binding body') }
    if (body.byteLength > MAX_BODY_BYTES) return bridgeError(413, 'Binding body is too large')
  }
  try {
    return await binding.fetch(new Request(target, { method: payload.method, headers, body }))
  } catch (error) {
    console.error('[edge-bridge] binding failed', { path, error: error instanceof Error ? error.message : String(error) })
    return bridgeError(502, 'Binding unavailable')
  }
}

export default {
  fetch(request: Request, env: EdgeEnv) {
    return handleEdgeRequest(request, env)
  },
}
