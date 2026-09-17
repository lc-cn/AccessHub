declare module 'cloudflare:workers' {
  type ServiceBinding = { fetch(request: Request): Promise<Response> }
  type KVNamespace = {
    get(key: string, options?: { type?: 'text'; cacheTtl?: number }): Promise<string | null>
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
    delete(key: string): Promise<void>
  }
  export const env: Record<string, unknown> & { QQSIGN: ServiceBinding; ACCESSHUB_CACHE?: KVNamespace }
}
