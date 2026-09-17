import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { invalidateReadModel, readThroughJson } from './read-model-cache.ts'
import type { CacheNamespace } from './platform-bindings.ts'

function fakeCache(initial: string | null = null) {
  const state = { value: initial, reads: 0, writes: 0, deletes: 0 }
  const cache: CacheNamespace = {
    async get() { state.reads += 1; return state.value },
    async put(_key, value) { state.writes += 1; state.value = value },
    async delete() { state.deletes += 1; state.value = null },
  }
  return { cache, state }
}

const isCatalog = (value: unknown): value is Array<{ code: string }> => Array.isArray(value)
  && value.every((item) => Boolean(item) && typeof item === 'object' && typeof (item as { code?: unknown }).code === 'string')

describe('read model cache', () => {
  it('returns a valid cached read model without loading the database', async () => {
    const { cache, state } = fakeCache(JSON.stringify([{ code: 'qsign' }]))
    let loads = 0

    const value = await readThroughJson({
      key: 'catalog',
      cache,
      validate: isCatalog,
      load: async () => { loads += 1; return [{ code: 'database' }] },
    })

    assert.deepEqual(value, [{ code: 'qsign' }])
    assert.equal(loads, 0)
    assert.equal(state.reads, 1)
    assert.equal(state.writes, 0)
  })

  it('loads and stores the database read model on a cache miss', async () => {
    const { cache, state } = fakeCache()

    const value = await readThroughJson({
      key: 'catalog',
      cache,
      validate: isCatalog,
      load: async () => [{ code: 'qsign' }],
    })

    assert.deepEqual(value, [{ code: 'qsign' }])
    assert.deepEqual(JSON.parse(state.value || 'null'), [{ code: 'qsign' }])
    assert.equal(state.writes, 1)
  })

  it('replaces malformed or obsolete cache content from the database', async () => {
    const { cache, state } = fakeCache('{"unexpected":true}')

    const value = await readThroughJson({
      key: 'catalog',
      cache,
      validate: isCatalog,
      load: async () => [{ code: 'fresh' }],
    })

    assert.deepEqual(value, [{ code: 'fresh' }])
    assert.deepEqual(JSON.parse(state.value || 'null'), [{ code: 'fresh' }])
    assert.equal(state.writes, 1)
  })

  it('falls back directly to the database when no KV binding exists', async () => {
    let loads = 0
    const value = await readThroughJson({
      key: 'catalog',
      cache: null,
      validate: isCatalog,
      load: async () => { loads += 1; return [{ code: 'local' }] },
    })

    assert.deepEqual(value, [{ code: 'local' }])
    assert.equal(loads, 1)
  })

  it('invalidates the selected read model key', async () => {
    const { cache, state } = fakeCache(JSON.stringify([{ code: 'qsign' }]))
    await invalidateReadModel('catalog', cache)
    assert.equal(state.deletes, 1)
    assert.equal(state.value, null)
  })
})
