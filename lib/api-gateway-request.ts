import { joinServiceUrl, serviceAuthHeaders, type ServiceAuthType, type ServiceParameter } from './api-services.ts'

export async function prepareUpstreamRequest(request: Request, baseUrl: string, path: string, parameters: ServiceParameter[], authType: ServiceAuthType, encryptedAuth: string | null) {
  try {
    const incoming = new URL(request.url)
    const target = joinServiceUrl(baseUrl, path)
    const outboundHeaders = serviceAuthHeaders(authType, encryptedAuth)
    const contentType = request.headers.get('content-type')
    const accept = request.headers.get('accept')
    if (contentType) outboundHeaders.set('content-type', contentType)
    if (accept) outboundHeaders.set('accept', accept)
    let jsonBody: Record<string, unknown> | null = null
    if (parameters.some((item) => item.location === 'body') && request.method !== 'GET') {
      if (!contentType?.includes('application/json')) return { ok: false, error: '此 API 的 Body 参数要求 application/json' } as const
      jsonBody = await request.clone().json().catch(() => null) as Record<string, unknown> | null
      if (!jsonBody || Array.isArray(jsonBody)) return { ok: false, error: '请求 Body 必须是 JSON 对象' } as const
    }
    for (const parameter of parameters) {
      let raw: unknown
      if (parameter.location === 'body') raw = jsonBody?.[parameter.name]
      else if (parameter.location === 'header') raw = request.headers.get(parameter.name)
      else raw = incoming.searchParams.get(parameter.name)
      if (parameter.required && (raw == null || raw === '')) return { ok: false, error: `缺少必填参数：${parameter.name}` } as const
      if (raw == null || raw === '') continue
      if (!matchesType(raw, parameter.dataType)) return { ok: false, error: `参数 ${parameter.name} 必须是 ${parameter.dataType}` } as const
      if (parameter.location === 'path') {
        const markers = [`{${parameter.name}}`, `%7B${parameter.name}%7D`, `:${parameter.name}`]
        const marker = markers.find((candidate) => target.pathname.toLowerCase().includes(candidate.toLowerCase()))
        if (!marker) return { ok: false, error: `路径中缺少参数占位符：${parameter.name}` } as const
        target.pathname = target.pathname.replace(marker, encodeURIComponent(String(raw)))
      } else if (parameter.location === 'header') {
        const normalized = parameter.name.toLowerCase()
        if (['host', 'cookie', 'set-cookie', 'connection', 'content-length', 'transfer-encoding'].includes(normalized) || outboundHeaders.has(parameter.name)) return { ok: false, error: `Header ${parameter.name} 由网关保留` } as const
        outboundHeaders.set(parameter.name, String(raw))
      } else if (parameter.location === 'query') target.searchParams.append(parameter.name, String(raw))
    }
    const bodyParameters = parameters.filter((item) => item.location === 'body')
    const filteredBody = jsonBody && bodyParameters.length ? Object.fromEntries(bodyParameters.filter((item) => jsonBody?.[item.name] !== undefined).map((item) => [item.name, jsonBody?.[item.name]])) : null
    const body = ['GET', 'HEAD'].includes(request.method) ? undefined : filteredBody ? JSON.stringify(filteredBody) : await request.arrayBuffer()
    return { ok: true, url: target, headers: outboundHeaders, body } as const
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : '无法构造上游请求' } as const }
}

function matchesType(value: unknown, type: ServiceParameter['dataType']) {
  if (type === 'string') return typeof value === 'string'
  if (type === 'number') return typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)))
  if (type === 'boolean') return typeof value === 'boolean' || value === 'true' || value === 'false'
  if (typeof value === 'object') return true
  if (typeof value !== 'string') return false
  try { JSON.parse(value); return true } catch { return false }
}
