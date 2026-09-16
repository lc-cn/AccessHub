import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareUpstreamRequest } from './api-gateway-request.ts'
import { sealServiceAuth, type ServiceParameter } from './api-services.ts'

const parameters: ServiceParameter[] = [
  { name: 'id', location: 'path', dataType: 'string', required: true, description: '' },
  { name: 'page', location: 'query', dataType: 'number', required: false, description: '' },
  { name: 'prompt', location: 'body', dataType: 'string', required: true, description: '' },
]

test('prepares only configured parameters for the upstream request', async () => {
  const request = new Request('https://access.example/api/gateway/demo/chat?id=user-1&page=2&ignored=secret', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: 'hello', ignored: 'secret' }) })
  const result = await prepareUpstreamRequest(request, 'https://upstream.example/v1', '/users/{id}/chat', parameters, 'none', null)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.url.toString(), 'https://upstream.example/v1/users/user-1/chat?page=2')
  assert.equal(result.body, JSON.stringify({ prompt: 'hello' }))
})

test('does not let user parameters override service authentication', async () => {
  const original = process.env.SERVICE_CREDENTIALS_KEY
  process.env.SERVICE_CREDENTIALS_KEY = 'test-only-service-credential-key-32-bytes'
  try {
    const encrypted = sealServiceAuth({ token: 'upstream-secret' })
    const request = new Request('https://access.example/api/gateway/demo/chat', { headers: { authorization: 'Bearer attacker' } })
    const result = await prepareUpstreamRequest(request, 'https://upstream.example', '/chat', [{ name: 'authorization', location: 'header', dataType: 'string', required: true, description: '' }], 'bearer', encrypted)
    assert.deepEqual(result, { ok: false, error: 'Header authorization 由网关保留' })
  } finally {
    if (original == null) delete process.env.SERVICE_CREDENTIALS_KEY
    else process.env.SERVICE_CREDENTIALS_KEY = original
  }
})

test('rejects a missing required parameter before reserving usage', async () => {
  const request = new Request('https://access.example/api/gateway/demo/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  const result = await prepareUpstreamRequest(request, 'https://upstream.example', '/users/{id}/chat', parameters, 'none', null)
  assert.deepEqual(result, { ok: false, error: '缺少必填参数：id' })
})
