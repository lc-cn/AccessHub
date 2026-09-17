export type ServiceBinding = { fetch(request: Request): Promise<Response> }
export type CacheNamespace = {
  get(key: string, options?: { type?: 'text'; cacheTtl?: number }): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
}

export function getServiceBinding(_name: string): ServiceBinding | null {
  return null
}

export function getHyperdriveConnectionString(): string | null {
  return null
}

export function getReadModelCache(): CacheNamespace | null {
  return null
}
