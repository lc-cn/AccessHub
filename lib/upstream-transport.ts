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

type ServiceBinding = { fetch(request: Request): Promise<Response> }
type ResolveServiceBinding = (name: string) => ServiceBinding | null

export class UpstreamBindingUnavailableError extends Error {
  constructor(bindingName: string | null) {
    super(bindingName ? `Worker Binding ${bindingName} 未在当前部署中配置` : '服务未配置 Worker Binding 名称')
    this.name = 'UpstreamBindingUnavailableError'
  }
}

export class UpstreamTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`上游服务在 ${timeoutMs} 毫秒内未响应`)
    this.name = 'TimeoutError'
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new UpstreamTimeoutError(timeoutMs)), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function dispatchUpstreamRequest(input: UpstreamRequest, resolveBinding: ResolveServiceBinding = getServiceBinding) {
  const init: RequestInit = {
    method: input.method,
    headers: input.headers,
    body: input.body,
    redirect: 'manual',
  }
  if (input.transport === 'http') {
    return fetch(input.url, { ...init, signal: AbortSignal.timeout(input.timeoutMs) })
  }

  const binding = input.bindingName ? resolveBinding(input.bindingName) : null
  if (!binding) throw new UpstreamBindingUnavailableError(input.bindingName)
  const request = new Request(input.url, init)
  console.info('[upstream-binding] dispatch', {
    bindingName: input.bindingName,
    method: input.method,
    pathname: input.url.pathname,
  })
  try {
    const response = await withTimeout(binding.fetch(request), input.timeoutMs)
    console.info('[upstream-binding] response', {
      bindingName: input.bindingName,
      status: response.status,
    })
    return response
  } catch (error) {
    console.error('[upstream-binding] failed', {
      bindingName: input.bindingName,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
