import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getRbacOAuthConfig } from './rbac-oauth.ts'

const complete = { RBAC_ISSUER_URL: 'http://localhost:3000', RBAC_CLIENT_ID: 'l2cl', RBAC_CLIENT_SECRET: 'secret', BETTER_AUTH_URL: 'http://localhost:3001' }
test('RBAC is opt-in and partial configuration fails explicitly', () => {
  assert.equal(getRbacOAuthConfig({}), null)
  assert.throws(() => getRbacOAuthConfig({ RBAC_CLIENT_ID: 'l2cl' }))
})
test('RBAC requires discovery verification and PKCE', () => {
  const config = getRbacOAuthConfig(complete)!
  assert.equal(config.requireIdTokenVerification, true)
  assert.equal(config.pkce, true)
  assert.equal(config.discoveryUrl, 'http://localhost:3000/.well-known/openid-configuration')
  assert.equal(config.postLogoutRedirectURI, 'http://localhost:3001/login')
})
test('issuer permits loopback HTTP but rejects insecure public URLs and embedded credentials', () => {
  for (const issuer of ['http://public.example.com', 'https://user:pass@example.com', 'https://example.com/path', 'https://example.com?query=1']) {
    assert.throws(() => getRbacOAuthConfig({ ...complete, RBAC_ISSUER_URL: issuer }))
  }
  assert.ok(getRbacOAuthConfig({ ...complete, RBAC_ISSUER_URL: 'https://idp.example.com/' }))
})
