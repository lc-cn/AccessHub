import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getProfileHubOAuthConfig, PROFILEHUB_PROVIDER_ID } from './profilehub-oauth.ts'
import { getRbacOAuthConfig, RBAC_PROVIDER_ID } from './rbac-oauth.ts'

const env = {
  PROFILEHUB_ISSUER_URL: 'https://profile.l2cl.link/',
  PROFILEHUB_CLIENT_ID: 'accesshub',
  PROFILEHUB_CLIENT_SECRET: 'test-secret',
  BETTER_AUTH_URL: 'https://l2cl.link',
}

test('ProfileHub branding keeps existing provider identity and protocol guarantees', () => {
  const config = getProfileHubOAuthConfig(env)!
  assert.equal(config.name, 'ProfileHub')
  assert.equal(config.providerId, 'rbac')
  assert.equal(PROFILEHUB_PROVIDER_ID, RBAC_PROVIDER_ID)
  assert.equal(config.discoveryUrl, 'https://profile.l2cl.link/.well-known/openid-configuration')
  assert.equal(config.requireIdTokenVerification, true)
  assert.equal(config.pkce, true)
  assert.equal(config.postLogoutRedirectURI, 'https://l2cl.link/login')
  assert.deepEqual(getRbacOAuthConfig(env), config)
})

test('new names override legacy values independently during configuration migration', () => {
  const config = getProfileHubOAuthConfig({ ...env, RBAC_ISSUER_URL: 'https://old.example', RBAC_CLIENT_ID: 'old', RBAC_CLIENT_SECRET: 'old-secret' })!
  assert.equal(config.clientId, 'accesshub')
  assert.equal(config.clientSecret, 'test-secret')
  assert.equal(config.discoveryUrl, 'https://profile.l2cl.link/.well-known/openid-configuration')
  const migrated = getProfileHubOAuthConfig({ PROFILEHUB_ISSUER_URL: env.PROFILEHUB_ISSUER_URL, RBAC_CLIENT_ID: 'old', RBAC_CLIENT_SECRET: 'old-secret' })!
  assert.equal(migrated.clientId, 'old')
  assert.equal(migrated.discoveryUrl, config.discoveryUrl)
})

test('empty or partial new configuration is explicit and never silently falls back', () => {
  assert.equal(getProfileHubOAuthConfig({}), null)
  assert.throws(() => getProfileHubOAuthConfig({ PROFILEHUB_CLIENT_ID: 'accesshub' }), /PROFILEHUB_ISSUER_URL/)
  assert.throws(() => getProfileHubOAuthConfig({ ...env, PROFILEHUB_CLIENT_SECRET: '', RBAC_CLIENT_SECRET: 'old-secret' }))
})
