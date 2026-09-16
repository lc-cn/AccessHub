declare module 'cloudflare:workers' {
  type ServiceBinding = { fetch(request: Request): Promise<Response> }
  export const env: Record<string, unknown> & { QQSIGN: ServiceBinding }
}
