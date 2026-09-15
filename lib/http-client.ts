export class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'HttpError'
  }
}

export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  const data = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new HttpError(data.error || `请求失败（${response.status}）`, response.status)
  return data
}
