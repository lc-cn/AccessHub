import { env } from 'cloudflare:workers'

type ServiceBinding = { fetch(request: Request): Promise<Response> }
type HyperdriveBinding = { connectionString: string }
type RuntimeBindings = Record<string, unknown> & { HYPERDRIVE?: HyperdriveBinding }

const bindings = env as unknown as RuntimeBindings

export function getServiceBinding(name: string): ServiceBinding | null {
  const binding = bindings[name]
  if (!binding || typeof binding !== 'object' || typeof (binding as ServiceBinding).fetch !== 'function') return null
  return binding as ServiceBinding
}

export function getHyperdriveConnectionString(): string | null {
  return bindings.HYPERDRIVE?.connectionString || null
}
