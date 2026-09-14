import assert from 'node:assert/strict'
import test from 'node:test'
import { parseAfdianOAuthToken } from './afdian-oauth.ts'

test('accepts the documented Afdian OAuth user response', () => {
  assert.deepEqual(parseAfdianOAuthToken({
    ec: 200,
    em: 'ok',
    data: { user_id: 'afdian-user', user_private_id: 'private-user' },
  }), { userId: 'afdian-user', userPrivateId: 'private-user' })
})

test('rejects unsuccessful or incomplete Afdian OAuth responses', () => {
  assert.throws(() => parseAfdianOAuthToken({ ec: 400, em: 'invalid code' }), /invalid code/)
  assert.throws(() => parseAfdianOAuthToken({ ec: 200, data: {} }), /无效用户信息/)
})
