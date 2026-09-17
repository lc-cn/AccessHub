import assert from 'node:assert/strict'
import test from 'node:test'
import { getGatewayApiKey } from './gateway-auth.ts'

test('accepts a gateway API key from the key query parameter', () => {
  assert.equal(getGatewayApiKey(new Request('https://access.example/api/gateway/demo/ping?key=ahk_query')), 'ahk_query')
})

test('prefers Bearer auth over the key query parameter', () => {
  const request = new Request('https://access.example/api/gateway/demo/ping?key=ahk_query', { headers: { authorization: 'bearer ahk_header' } })
  assert.equal(getGatewayApiKey(request), 'ahk_header')
})

test('returns null when the request has no API key credential', () => {
  assert.equal(getGatewayApiKey(new Request('https://access.example/api/gateway/demo/ping')), null)
})
