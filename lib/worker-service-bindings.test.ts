import assert from 'node:assert/strict'
import test from 'node:test'
import { hasWorkerServiceBinding, workerServiceBindings } from './worker-service-bindings.ts'

test('exposes only declared Worker service bindings to the admin catalog', () => {
  assert.deepEqual(workerServiceBindings, [
    { binding: 'QQSIGN', service: 'qsign', label: 'QQSign' },
  ])
  assert.equal(hasWorkerServiceBinding('QQSIGN'), true)
  assert.equal(hasWorkerServiceBinding('UNKNOWN'), false)
  assert.equal(hasWorkerServiceBinding(null), false)
})
