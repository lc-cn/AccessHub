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

test('validates API key lifetime and service scopes', () => {
  const parsed = parseApiKeyCreateInput({ name: '生产服务', expiresInDays: 90, serviceScopes: ['qsign', 'qsign'] }, ['qsign'])
  assert.equal(parsed.ok, true)
  if (parsed.ok) {
    assert.deepEqual(parsed.value.serviceScopes, ['qsign'])
    assert.ok(parsed.value.expiresAt instanceof Date)
  }
  assert.deepEqual(parseApiKeyCreateInput({ name: 'bad', expiresInDays: 7, serviceScopes: ['*'] }, ['qsign']), { ok: false, error: '请选择有效的到期时间' })
  assert.deepEqual(parseApiKeyCreateInput({ name: 'bad', expiresInDays: -1, serviceScopes: ['unknown'] }, ['qsign']), { ok: false, error: '包含无效的服务范围' })
})
