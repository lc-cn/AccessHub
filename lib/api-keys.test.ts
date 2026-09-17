import assert from 'node:assert/strict'
import test from 'node:test'
import { generateApiKey, hashApiKey, isApiKeyToken, parseApiKeyCreateInput } from './api-keys.ts'

test('generates an opaque API key and stores only its hash', () => {
  const first = generateApiKey()
  const second = generateApiKey()
  assert.equal(isApiKeyToken(first.token), true)
  assert.equal(first.keyHash, hashApiKey(first.token))
  assert.notEqual(first.token, second.token)
  assert.equal(first.keyHash.includes(first.token), false)
  assert.match(first.prefix, /^ahk_.+…$/)
})

test('validates API key lifetime without accepting a service authorization scope', () => {
  const parsed = parseApiKeyCreateInput({ name: '生产服务', expiresInDays: 90, serviceScopes: ['qsign'] })
  assert.equal(parsed.ok, true)
  if (parsed.ok) {
    assert.equal('serviceScopes' in parsed.value, false)
    assert.ok(parsed.value.expiresAt instanceof Date)
  }
  assert.deepEqual(parseApiKeyCreateInput({ name: 'bad', expiresInDays: 7 }), { ok: false, error: '请选择有效的到期时间' })
})
