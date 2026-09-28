import assert from 'node:assert/strict'
import test from 'node:test'
import edgeWorker, { handleEdgeRequest, type EdgeEnv } from './index.ts'

function environment() {
  const calls: { binding?: Request; queued?: unknown } = {}
  const env: EdgeEnv = {
    EDGE_BRIDGE_SECRET: 'test-edge-secret',
    COMMERCE_INTERNAL_SECRET: 'test-commerce-secret',
    ORIGIN_URL: 'https://origin-accesshub.l2cl.link',
    QQSIGN: { async fetch(request) { calls.binding = request; return new Response('signed', { status: 200 }) } },
    PROFILEHUB_EGRESS: { async fetch(request) { calls.binding = request; return new Response('{}', { status: 200 }) } },
    COMMERCE_EVENTS: { async send(message) { calls.queued = message } },
  }
  return { env, calls }
}

function bridgeRequest(path: string, body: unknown, secret = 'test-edge-secret') {
  return new Request(`https://accesshub-edge.example.com${path}`, {
    method: 'POST',
    headers: { 'x-accesshub-edge-secret': secret, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

test('edge bridge rejects unauthenticated binding and queue calls', async () => {
  const { env, calls } = environment()
  for (const path of ['/binding/QQSIGN', '/queue/commerce']) {
    const response = await handleEdgeRequest(bridgeRequest(path, {}, 'wrong'), env)
    assert.equal(response.status, 404)
    assert.equal(response.headers.get('x-accesshub-bridge-error'), '1')
  }
  assert.equal(calls.binding, undefined)
  assert.equal(calls.queued, undefined)
})

test('edge bridge forwards a QQSIGN request with its body and upstream credentials', async () => {
  const { env, calls } = environment()
  const response = await handleEdgeRequest(bridgeRequest('/binding/QQSIGN', {
    url: 'https://qsign.internal/sign', method: 'POST', headers: [['authorization', 'Bearer upstream-key']],
    body: btoa('{"value":1}'),
  }), env)
  assert.equal(response.status, 200)
  assert.equal(calls.binding?.url, 'https://qsign.internal/sign')
  assert.equal(calls.binding?.headers.get('authorization'), 'Bearer upstream-key')
  assert.equal(await calls.binding?.text(), '{"value":1}')
})

test('edge bridge rejects a binding request for another origin', async () => {
  const { env, calls } = environment()
  const response = await handleEdgeRequest(bridgeRequest('/binding/PROFILEHUB_EGRESS', {
    url: 'https://untrusted.example/token', method: 'POST', headers: [], body: null,
  }), env)
  assert.equal(response.status, 400)
  assert.equal(calls.binding, undefined)
})

test('edge bridge validates commerce messages before publishing', async () => {
  const { env, calls } = environment()
  const invalid = await handleEdgeRequest(bridgeRequest('/queue/commerce', { type: 'unexpected' }), env)
  assert.equal(invalid.status, 400)
  assert.equal(calls.queued, undefined)
  const valid = await handleEdgeRequest(bridgeRequest('/queue/commerce', { type: 'order.fulfillment.requested', providerEventId: 'event-1' }), env)
  assert.equal(valid.status, 204)
  assert.deepEqual(calls.queued, { type: 'order.fulfillment.requested', providerEventId: 'event-1' })
})

test('commerce Worker command can only reach the configured origin with its bearer secret', async () => {
  const { env } = environment()
  let forwarded: { url: string; authorization: string | null; body: string; redirect: RequestRedirect | undefined } | undefined
  const upstreamFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    forwarded = { url: String(input), authorization: new Headers(init?.headers).get('authorization'), body: new TextDecoder().decode(init?.body as ArrayBuffer), redirect: init?.redirect }
    return new Response('{"ok":true,"outcome":"done"}', { status: 200 })
  }
  const url = 'https://accesshub.internal/api/internal/commerce/commands'
  const denied = await handleEdgeRequest(new Request(url, { method: 'POST', body: '{}', headers: { authorization: 'Bearer wrong' } }), env, upstreamFetch)
  assert.equal(denied.status, 401)
  assert.equal(forwarded, undefined)
  const response = await handleEdgeRequest(new Request(url, { method: 'POST', body: '{"type":"outbox.dispatch"}', headers: { authorization: 'Bearer test-commerce-secret' } }), env, upstreamFetch)
  assert.equal(response.status, 200)
  assert.deepEqual(forwarded, { url: 'https://origin-accesshub.l2cl.link/api/internal/commerce/commands', authorization: 'Bearer test-commerce-secret', body: '{"type":"outbox.dispatch"}', redirect: 'manual' })
})

test('deployed fetch handler ignores the Workers execution context when forwarding commerce commands', async () => {
  const { env } = environment()
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response('{"error":"invalid commerce command","retryable":false}', { status: 400 })
  try {
    const handler = edgeWorker.fetch as (request: Request, env: EdgeEnv, context: object) => Promise<Response>
    const response = await handler(new Request('https://accesshub.internal/api/internal/commerce/commands', {
      method: 'POST', headers: { authorization: 'Bearer test-commerce-secret' }, body: '{}',
    }), env, {})
    assert.equal(response.status, 400)
  } finally {
    globalThis.fetch = originalFetch
  }
})
