export type ServiceBinding = { fetch(request: Request): Promise<Response> }

export function getServiceBinding(_name: string): ServiceBinding | null {
  return null
}

export function getHyperdriveConnectionString(): string | null {
  return null
}
