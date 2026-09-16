import { getServiceBinding } from '#accesshub-platform-bindings'
import type { ServiceTransport } from '@/lib/api-services'

type UpstreamRequest = {
  transport: ServiceTransport
  bindingName: string | null
  url: URL
  method: string
  headers: Headers
  body?: BodyInit
  timeoutMs: number
}

export class UpstreamBindingUnavailableError extends Error {
  constructor(bindingName: string | null) {
    super(bindingName ? `Worker Binding ${bindingName} 未在当前部署中配置` : '服务未配置 Worker Binding 名称')
    this.name = 'UpstreamBindingUnavailableError'
  }
}

export async function dispatchUpstreamRequest(input: UpstreamRequest) {
  const signal = AbortSignal.timeout(input.timeoutMs)
  const init: RequestInit = {
    method: input.method,
    headers: input.headers,
    body: input.body,
    redirect: 'manual',
    signal,
  }
  if (input.transport === 'http') return fetch(input.url, init)

  const binding = input.bindingName ? getServiceBinding(input.bindingName) : null
  if (!binding) throw new UpstreamBindingUnavailableError(input.bindingName)
  return binding.fetch(new Request(input.url, init))
}
