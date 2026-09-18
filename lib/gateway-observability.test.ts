import assert from 'node:assert/strict'
import test from 'node:test'
import { gatewayOutcomeForStatus } from './gateway-observability.ts'

test('classifies gateway responses for reporting', () => {
  assert.equal(gatewayOutcomeForStatus(200), 'success')
  assert.equal(gatewayOutcomeForStatus(204), 'success')
  assert.equal(gatewayOutcomeForStatus(403), 'rejected')
  assert.equal(gatewayOutcomeForStatus(429), 'rejected')
  assert.equal(gatewayOutcomeForStatus(502), 'upstream_error')
})
