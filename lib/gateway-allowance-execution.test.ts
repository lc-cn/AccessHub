import assert from 'node:assert/strict'
import test from 'node:test'
import { runAllowanceOperation } from './gateway-allowance-execution.ts'

test('preflight evaluates allowance without opening a write transaction', async () => {
  const events: string[] = []
  const result = await runAllowanceOperation({
    commit: false,
    read: async () => { events.push('read'); return 'available' },
    transaction: async () => { events.push('transaction'); return 'committed' },
  })

  assert.equal(result, 'available')
  assert.deepEqual(events, ['read'])
})

test('commit evaluates and mutates allowance inside one transaction', async () => {
  const events: string[] = []
  const result = await runAllowanceOperation({
    commit: true,
    read: async () => { events.push('read'); return 'available' },
    transaction: async () => { events.push('transaction'); return 'committed' },
  })

  assert.equal(result, 'committed')
  assert.deepEqual(events, ['transaction'])
})
