import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createProfileHubFetchRouter, getProfileHubOAuthConfig, PROFILEHUB_PROVIDER_ID } from './profilehub-oauth.ts'

const env = {
  PROFILEHUB_ISSUER_URL: 'https://profile.l2cl.link/',
  PROFILEHUB_CLIENT_ID: 'accesshub',
  PROFILEHUB_CLIENT_SECRET: 'test-secret',
  BETTER_AUTH_URL: 'https://l2cl.link',
}

test('ProfileHub uses its canonical provider identity and protocol guarantees', () => {
  const config = getProfileHubOAuthConfig(env)!
  assert.equal(config.name, 'ProfileHub')
  assert.equal(config.providerId, 'profilehub')
  assert.equal(PROFILEHUB_PROVIDER_ID, 'profilehub')
  assert.equal(config.discoveryUrl, 'https://profile.l2cl.link/.well-known/openid-configuration')
  assert.equal(config.requireIdTokenVerification, true)
  assert.equal(config.pkce, true)
  assert.equal(config.postLogoutRedirectURI, 'https://l2cl.link/login')
})

test('empty or partial configuration fails explicitly', () => {
  assert.equal(getProfileHubOAuthConfig({}), null)
  assert.throws(() => getProfileHubOAuthConfig({ PROFILEHUB_CLIENT_ID: 'accesshub' }), /PROFILEHUB_ISSUER_URL/)
  assert.throws(() => getProfileHubOAuthConfig({ ...env, PROFILEHUB_CLIENT_SECRET: '' }))
})

test('ProfileHub fetch router only sends issuer requests through the service binding', async () => {
  const bound: string[] = []
  const fallback: string[] = []
  const routedFetch = createProfileHubFetchRouter(
    'https://profile.l2cl.link/.well-known/openid-configuration',
    { fetch: async (request) => {
      bound.push(request.url)
      return new Response('bound')
    } },
    (async (input) => {
      fallback.push(String(input))
      return new Response('fallback')
    }) as typeof fetch,
  )

  assert.equal(await (await routedFetch('https://profile.l2cl.link/oauth/token')).text(), 'bound')
  assert.equal(await (await routedFetch('https://example.com/data')).text(), 'fallback')
  assert.deepEqual(bound, ['https://profile.l2cl.link/oauth/token'])
  assert.deepEqual(fallback, ['https://example.com/data'])
})
