import { getReadModelCache, type CacheNamespace } from '#accesshub-platform-bindings'

const EDGE_CACHE_TTL_SECONDS = 30
const ENTRY_TTL_SECONDS = 300

export const readModelKeys = {
  serviceCatalog: 'read-model:v1:service-catalog',
} as const

type ReadThroughOptions<T> = {
  key: string
  load(): Promise<T>
  validate(value: unknown): value is T
  cache?: CacheNamespace | null
}

export async function readThroughJson<T>({ key, load, validate, cache = getReadModelCache() }: ReadThroughOptions<T>): Promise<T> {
  if (!cache) return load()

  try {
    const cached = await cache.get(key, { type: 'text', cacheTtl: EDGE_CACHE_TTL_SECONDS })
    if (cached != null) {
      const value: unknown = JSON.parse(cached)
      if (validate(value)) return value
    }
  } catch (error) {
    console.warn('[read-model-cache] read failed; falling back to database', { key, error: error instanceof Error ? error.message : String(error) })
  }

  const value = await load()
  try {
    await cache.put(key, JSON.stringify(value), { expirationTtl: ENTRY_TTL_SECONDS })
  } catch (error) {
    console.warn('[read-model-cache] write failed; returning database result', { key, error: error instanceof Error ? error.message : String(error) })
  }
  return value
}

export async function invalidateReadModel(key: string, cache: CacheNamespace | null = getReadModelCache()) {
  if (!cache) return
  try {
    await cache.delete(key)
  } catch (error) {
    console.warn('[read-model-cache] invalidation failed', { key, error: error instanceof Error ? error.message : String(error) })
  }
}

export function invalidateServiceCatalog() {
  return invalidateReadModel(readModelKeys.serviceCatalog)
}
