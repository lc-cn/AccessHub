import assert from 'node:assert/strict'
import test from 'node:test'
import { getCommerceQueue, getServiceBinding } from './platform-bindings.ts'
import { handleEdgeRequest, type EdgeEnv } from '../workers/edge/index.ts'

test('QQSIGN private origin bypasses the edge bridge and preserves request details', async () => {
  const previousPrivateUrl = process.env.QQSIGN_PRIVATE_URL
  const originalFetch = globalThis.fetch
  process.env.QQSIGN_PRIVATE_URL = 'http://10.0.0.36:9981'
  const requests: Request[] = []
  globalThis.fetch = async (input, init) => {
    requests.push(new Request(input, init))
    return new Response('{"code":0}', { status: 200 })
  }
  try {
    const binding = getServiceBinding('QQSIGN')
    assert.ok(binding)
    const response = await binding.fetch(new Request('https://ts.internal/sign?uin=123&key=secret', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"cmd":"test"}',
    }))
    assert.equal(response.status, 200)
    assert.equal(requests[0].url, 'http://10.0.0.36:9981/sign?uin=123&key=secret')
    assert.equal(await requests[0].text(), '{"cmd":"test"}')
    await assert.rejects(() => binding.fetch(new Request('https://evil.example/sign')), /Invalid QQSIGN/)
  } finally {
    globalThis.fetch = originalFetch
    if (previousPrivateUrl === undefined) delete process.env.QQSIGN_PRIVATE_URL
    else process.env.QQSIGN_PRIVATE_URL = previousPrivateUrl
  }
})

test('Node adapter carries binding and commerce messages through the edge bridge', async () => {
  const previousUrl = process.env.EDGE_BRIDGE_URL
  const previousSecret = process.env.EDGE_BRIDGE_SECRET
  const originalFetch = globalThis.fetch
  process.env.EDGE_BRIDGE_URL = 'https://accesshub-edge.example.com'
  process.env.EDGE_BRIDGE_SECRET = 'test-edge-secret'
  const requests: Request[] = []
  globalThis.fetch = async (input, init) => {
    requests.push(new Request(input, init))
    return new Response(null, { status: 204 })
  }
  try {
    const binding = getServiceBinding('QQSIGN')
    assert.ok(binding)
    assert.equal(getServiceBinding('UNKNOWN'), null)
    await binding.fetch(new Request('https://qsign.internal/sign', { method: 'POST', headers: { authorization: 'Bearer upstream-key' }, body: 'payload' }))
    const envelope = await requests[0].json()
    assert.equal(requests[0].url, 'https://accesshub-edge.example.com/binding/QQSIGN')
    assert.equal(requests[0].headers.get('x-accesshub-edge-secret'), 'test-edge-secret')
    assert.equal(envelope.url, 'https://qsign.internal/sign')
    assert.equal(Buffer.from(envelope.body, 'base64').toString(), 'payload')
    assert.deepEqual(envelope.headers, [['authorization', 'Bearer upstream-key'], ['content-type', 'text/plain;charset=UTF-8']])

    await getCommerceQueue()!.send({ type: 'order.fulfillment.requested', providerEventId: 'event-1' })
    assert.equal(requests[1].url, 'https://accesshub-edge.example.com/queue/commerce')
    assert.deepEqual(await requests[1].json(), { type: 'order.fulfillment.requested', providerEventId: 'event-1' })
  } finally {
    globalThis.fetch = originalFetch
    if (previousUrl === undefined) delete process.env.EDGE_BRIDGE_URL
    else process.env.EDGE_BRIDGE_URL = previousUrl
    if (previousSecret === undefined) delete process.env.EDGE_BRIDGE_SECRET
    else process.env.EDGE_BRIDGE_SECRET = previousSecret
  }
})

test('Node and edge adapters preserve a private binding response end to end', async () => {
  const previousUrl = process.env.EDGE_BRIDGE_URL
  const previousSecret = process.env.EDGE_BRIDGE_SECRET
  const originalFetch = globalThis.fetch
  process.env.EDGE_BRIDGE_URL = 'https://accesshub-edge.example.com'
  process.env.EDGE_BRIDGE_SECRET = 'test-edge-secret'
  const env: EdgeEnv = {
    EDGE_BRIDGE_SECRET: 'test-edge-secret',
    COMMERCE_INTERNAL_SECRET: 'test-commerce-secret',
    ORIGIN_URL: 'https://origin-accesshub.l2cl.link',
    QQSIGN: { async fetch(request) { return new Response(`${request.method} ${new URL(request.url).pathname}: ${await request.text()}`, { status: 201 }) } },
    PROFILEHUB_EGRESS: { async fetch() { return new Response('{}') } },
    COMMERCE_EVENTS: { async send() {} },
  }
  globalThis.fetch = async (input, init) => handleEdgeRequest(new Request(input, init), env)
  try {
    const response = await getServiceBinding('QQSIGN')!.fetch(new Request('https://qsign.internal/sign', { method: 'POST', body: 'request-body' }))
    assert.equal(response.status, 201)
    assert.equal(await response.text(), 'POST /sign: request-body')
  } finally {
    globalThis.fetch = originalFetch
    if (previousUrl === undefined) delete process.env.EDGE_BRIDGE_URL
    else process.env.EDGE_BRIDGE_URL = previousUrl
    if (previousSecret === undefined) delete process.env.EDGE_BRIDGE_SECRET
    else process.env.EDGE_BRIDGE_SECRET = previousSecret
  }
})
