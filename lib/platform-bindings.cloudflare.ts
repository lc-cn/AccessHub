import { env } from 'cloudflare:workers'

type ServiceBinding = { fetch(request: Request): Promise<Response> }
type HyperdriveBinding = { connectionString: string }
export type CommerceQueue = {
  send(
    message: unknown,
    options?: { contentType?: 'json'; delaySeconds?: number },
  ): Promise<void>
}
export type CacheNamespace = {
  get(key: string, options?: { type?: 'text'; cacheTtl?: number }): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
}
type RuntimeBindings = Record<string, unknown> & {
  HYPERDRIVE?: HyperdriveBinding
  ACCESSHUB_CACHE?: CacheNamespace
  COMMERCE_EVENTS?: CommerceQueue
}

const bindings = env as unknown as RuntimeBindings

export function getServiceBinding(name: string): ServiceBinding | null {
  const binding = bindings[name]
  const bindingType = typeof binding
  if (!binding || (bindingType !== 'object' && bindingType !== 'function') || typeof (binding as ServiceBinding).fetch !== 'function') return null
  return binding as ServiceBinding
}

export function getHyperdriveConnectionString(): string | null {
  return bindings.HYPERDRIVE?.connectionString || null
}

export function getReadModelCache(): CacheNamespace | null {
  return bindings.ACCESSHUB_CACHE || null
}

export function getCommerceQueue(): CommerceQueue | null {
  return bindings.COMMERCE_EVENTS || null
}
