import assert from 'node:assert/strict'
import test from 'node:test'
import { applyServiceQueryAuth, joinServiceUrl, openServiceAuth, parseServiceApiInput, parseServiceAuthUpdate, parseServiceInput, presentServiceAuth, sealServiceAuth, serviceAuthHeaders } from './api-services.ts'

test('parses a public API service and rejects private upstreams', () => {
  assert.equal(parseServiceInput({ code: 'open-ai', name: 'OpenAI', baseUrl: 'https://api.example.com/v1/' }).ok, true)
  assert.deepEqual(parseServiceInput({ code: 'internal', name: 'Internal', baseUrl: 'http://127.0.0.1:8080' }), { ok: false, error: 'Base URL 不允许指向本机或私有网络' })
})

test('parses a private Worker Binding service without a public base URL', () => {
  const parsed = parseServiceInput({ code: 'image-api', name: 'Image API', transport: 'worker_binding', bindingName: 'image_worker' })
  assert.equal(parsed.ok, true)
  if (parsed.ok) {
    assert.equal(parsed.value.transport, 'worker_binding')
    assert.equal(parsed.value.bindingName, 'IMAGE_WORKER')
    assert.equal(parsed.value.baseUrl, 'https://image-api.internal')
  }
  assert.equal(parseServiceInput({ code: 'image-api', name: 'Image API', transport: 'worker_binding', bindingName: '123-worker' }).ok, false)
  assert.deepEqual(parseServiceInput({ code: 'image-api', name: 'Image API', transport: 'invalid', baseUrl: 'https://api.example.com' }), { ok: false, error: '服务连接方式无效' })
})

test('validates an endpoint and its request parameters', () => {
  const parsed = parseServiceApiInput({ code: 'chat', name: 'Chat', path: '/chat/completions', method: 'post', usageUnits: 3, parameters: [{ name: 'model', location: 'body', dataType: 'string', required: true, description: '' }] })
  assert.equal(parsed.ok, true)
  if (parsed.ok) assert.equal(parsed.value.method, 'POST')
  assert.equal(parseServiceApiInput({ code: 'chat', name: 'Chat', path: 'https://evil.example', method: 'GET', usageUnits: 1, parameters: [] }).ok, false)
  assert.equal(parseServiceApiInput({ code: 'user', name: 'User', path: '/users/{id}', method: 'GET', usageUnits: 1, parameters: [] }).ok, false)
  assert.equal(parseServiceApiInput({ code: 'user', name: 'User', path: '/users/{id}', method: 'GET', usageUnits: 1, parameters: [{ name: 'id', location: 'path', dataType: 'string', required: true }] }).ok, true)
  assert.equal(parseServiceApiInput({ code: 'health', name: 'Health', path: '/health', method: 'GET', usageUnits: 0, parameters: [] }).ok, true)
  assert.deepEqual(parseServiceApiInput({ code: 'invalid', name: 'Invalid', path: '/invalid', method: 'GET', usageUnits: -1, parameters: [] }), { ok: false, error: '单次计费次数必须是 0–10000 的整数；0 表示免费调用' })
})

test('encrypts service credentials and materializes auth headers', () => {
  const original = process.env.SERVICE_CREDENTIALS_KEY
  process.env.SERVICE_CREDENTIALS_KEY = 'test-only-service-credential-key-32-bytes'
  try {
    const encrypted = sealServiceAuth({ token: 'secret-token' })
    assert.notEqual(encrypted.includes('secret-token'), true)
    assert.deepEqual(openServiceAuth(encrypted), { token: 'secret-token' })
    assert.equal(serviceAuthHeaders('bearer', encrypted).get('authorization'), 'Bearer secret-token')
  } finally {
    if (original == null) delete process.env.SERVICE_CREDENTIALS_KEY
    else process.env.SERVICE_CREDENTIALS_KEY = original
  }
})

test('joins a service base path without allowing endpoint URL replacement', () => {
  assert.equal(joinServiceUrl('https://api.example.com/v1', '/chat').toString(), 'https://api.example.com/v1/chat')
})

test('injects encrypted query authentication into the upstream URL', () => {
  const original = process.env.SERVICE_CREDENTIALS_KEY
  process.env.SERVICE_CREDENTIALS_KEY = 'test-only-service-credential-key-32-bytes'
  try {
    const encrypted = sealServiceAuth({ query: 'api_key', value: 'secret-query-value' })
    const target = new URL('https://upstream.example/resource?lang=zh')
    applyServiceQueryAuth(target, 'query', encrypted)
    assert.equal(target.searchParams.get('api_key'), 'secret-query-value')
    assert.equal(encrypted.includes('secret-query-value'), false)
  } finally {
    if (original == null) delete process.env.SERVICE_CREDENTIALS_KEY
    else process.env.SERVICE_CREDENTIALS_KEY = original
  }
})

test('updates a query auth parameter name while preserving the stored secret', () => {
  const result = parseServiceAuthUpdate('query', { authQuery: 'key', authValue: '' }, { query: 'api_key', value: 'stored-secret' })
  assert.deepEqual(result, { ok: true, value: { query: 'key', value: 'stored-secret' } })
})

test('presents editable auth metadata without exposing secrets', () => {
  const original = process.env.SERVICE_CREDENTIALS_KEY
  process.env.SERVICE_CREDENTIALS_KEY = 'test-only-service-credential-key-32-bytes'
  try {
    const encrypted = sealServiceAuth({ query: 'api_key', value: 'stored-secret' })
    const presented = presentServiceAuth('query', encrypted)
    assert.deepEqual(presented, { authConfigured: true, authQuery: 'api_key' })
    assert.equal('authValue' in presented, false)
  } finally {
    if (original == null) delete process.env.SERVICE_CREDENTIALS_KEY
    else process.env.SERVICE_CREDENTIALS_KEY = original
  }
})
