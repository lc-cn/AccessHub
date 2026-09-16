import assert from 'node:assert/strict'
import test from 'node:test'
import { chargedUsageUnits } from './gateway-billing.ts'

test('charges configured units only for an exact HTTP 200 response', () => {
  assert.equal(chargedUsageUnits(200, 3), 3)
  assert.equal(chargedUsageUnits(201, 3), 0)
  assert.equal(chargedUsageUnits(204, 3), 0)
  assert.equal(chargedUsageUnits(400, 3), 0)
  assert.equal(chargedUsageUnits(500, 3), 0)
})

test('keeps free APIs free after a successful response', () => {
  assert.equal(chargedUsageUnits(200, 0), 0)
})
