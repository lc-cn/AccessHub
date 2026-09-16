import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createRequestDatabaseRunner } from './request-database.ts'

describe('request database runner', () => {
  it('opens one Hyperdrive client for all database work in a request', async () => {
    const events: string[] = []
    const connection = {
      async query(label: string) { events.push(`query:${label}`) },
      async end() { events.push('end') },
    }
    const run = createRequestDatabaseRunner({
      resolveConnectionString: () => 'postgres://hyperdrive/request',
      connect: async () => { events.push('connect'); return connection },
      createDatabase: (client) => client,
      fallback: connection,
    })

    await run(async (database) => {
      await database.query('plans')
      await database.query('usage')
    })

    assert.deepEqual(events, ['connect', 'query:plans', 'query:usage', 'end'])
  })

  it('closes the request client when database work fails', async () => {
    let ended = false
    const connection = { async end() { ended = true } }
    const run = createRequestDatabaseRunner({
      resolveConnectionString: () => 'postgres://hyperdrive/request',
      connect: async () => connection,
      createDatabase: () => ({ fail: true }),
      fallback: { fail: false },
    })

    await assert.rejects(run(async () => { throw new Error('query failed') }), /query failed/)
    assert.equal(ended, true)
  })

  it('uses the Node fallback without opening a Hyperdrive client', async () => {
    let connections = 0
    const fallback = { source: 'node' }
    const run = createRequestDatabaseRunner({
      resolveConnectionString: () => null,
      connect: async () => { connections += 1; return { async end() {} } },
      createDatabase: () => ({ source: 'hyperdrive' }),
      fallback,
    })

    const result = await run(async (database) => database.source)
    assert.equal(result, 'node')
    assert.equal(connections, 0)
  })
})
