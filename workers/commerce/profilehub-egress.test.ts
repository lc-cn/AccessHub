import assert from 'node:assert/strict'
import test from 'node:test'
import { proxyProfileHubRequest } from './profilehub-egress.ts'

test('ProfileHub egress only forwards required OAuth endpoints', async () => {
  const calls: Request[] = []
  const upstream = async (request: RequestInfo | URL) => {
    calls.push(request as Request)
    return new Response('upstream')
  }

  const discovery = await proxyProfileHubRequest(
    new Request('https://profile.l2cl.link/.well-known/openid-configuration'),
    upstream,
  )
  const token = await proxyProfileHubRequest(
    new Request('https://profile.l2cl.link/oauth/token', { method: 'POST' }),
    upstream,
  )

  assert.equal(discovery.status, 200)
  assert.equal(token.status, 200)
  assert.equal(calls.length, 2)
})

test('ProfileHub egress rejects other origins, paths, and methods', async () => {
  const unexpectedFetch = async () => {
    throw new Error('must not fetch')
  }

  for (const request of [
    new Request('https://example.com/.well-known/openid-configuration'),
    new Request('https://profile.l2cl.link/admin'),
    new Request('https://profile.l2cl.link/oauth/token', { method: 'GET' }),
  ]) {
    const response = await proxyProfileHubRequest(request, unexpectedFetch)
    assert.equal(response.status, 404)
  }
})
