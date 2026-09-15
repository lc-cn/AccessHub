import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { isAfdianOAuthConfigured, afdianOAuthRedirectUri, parseAfdianOAuthToken } from './afdian-oauth.ts'

describe('Afdian OAuth regression', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('reports unconfigured when env vars are missing', () => {
    delete process.env.AFDIAN_OAUTH_CLIENT_ID
    delete process.env.AFDIAN_OAUTH_CLIENT_SECRET
    assert.equal(isAfdianOAuthConfigured(), false)
  })

  it('reports configured when both env vars are present', () => {
    process.env.AFDIAN_OAUTH_CLIENT_ID = 'test-id'
    process.env.AFDIAN_OAUTH_CLIENT_SECRET = 'test-secret'
    assert.equal(isAfdianOAuthConfigured(), true)
  })

  it('generates redirect URI using BETTER_AUTH_URL', () => {
    process.env.BETTER_AUTH_URL = 'https://www.l2cl.link'
    assert.equal(afdianOAuthRedirectUri(), 'https://www.l2cl.link/api/auth/callback/afdian')
  })

  it('parses valid Afdian OAuth token payload', () => {
    const result = parseAfdianOAuthToken({
      ec: 200,
      data: { user_id: '12345', user_private_id: 'abc' },
    })
    assert.deepEqual(result, { userId: '12345', userPrivateId: 'abc' })
  })

  it('rejects Afdian OAuth payload with non-200 error code', () => {
    assert.throws(
      () => parseAfdianOAuthToken({ ec: 400, em: 'invalid code' }),
      { message: 'invalid code' },
    )
  })

  it('rejects Afdian OAuth payload with empty user_id', () => {
    assert.throws(
      () => parseAfdianOAuthToken({ ec: 200, data: { user_id: '' } }),
      { message: '爱发电 OAuth 返回了无效用户信息' },
    )
  })
})
