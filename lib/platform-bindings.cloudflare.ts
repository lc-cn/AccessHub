import { env } from 'cloudflare:workers'

type ServiceBinding = { fetch(request: Request): Promise<Response> }
type HyperdriveBinding = { connectionString: string }
export type CacheNamespace = {
  get(key: string, options?: { type?: 'text'; cacheTtl?: number }): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
}
type RuntimeBindings = Record<string, unknown> & { HYPERDRIVE?: HyperdriveBinding; ACCESSHUB_CACHE?: CacheNamespace }

const bindings = env as unknown as RuntimeBindings

export function getServiceBinding(name: string): ServiceBinding | null {
  const binding = bindings[name]
  if (!binding || typeof binding !== 'object' || typeof (binding as ServiceBinding).fetch !== 'function') return null
  return binding as ServiceBinding
}

export function getHyperdriveConnectionString(): string | null {
  return bindings.HYPERDRIVE?.connectionString || null
}

export function getReadModelCache(): CacheNamespace | null {
  return bindings.ACCESSHUB_CACHE || null
}
