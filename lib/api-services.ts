import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'
import { isIP } from 'node:net'

export const serviceAuthTypes = ['none', 'bearer', 'header', 'query', 'basic'] as const
export const serviceTransportTypes = ['http', 'worker_binding'] as const
export const serviceApiMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
export const parameterLocations = ['query', 'header', 'path', 'body'] as const
export const parameterDataTypes = ['string', 'number', 'boolean', 'json'] as const

export type ServiceAuthType = typeof serviceAuthTypes[number]
export type ServiceTransport = typeof serviceTransportTypes[number]
export type ServiceApiMethod = typeof serviceApiMethods[number]
export type ServiceParameter = { name: string; location: typeof parameterLocations[number]; dataType: typeof parameterDataTypes[number]; required: boolean; description: string }
export type ServiceAuthConfig = { token?: string; header?: string; query?: string; value?: string; username?: string; password?: string }

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

export function parseServiceInput(body: Record<string, unknown>) {
  const code = String(body.code || '').trim().toLowerCase()
  const name = String(body.name || '').trim()
  const description = String(body.description || '').trim()
  const requestedTransport = body.transport == null ? 'http' : String(body.transport)
  if (!serviceTransportTypes.includes(requestedTransport as ServiceTransport)) return { ok: false, error: '服务连接方式无效' } as const
  const transport = requestedTransport as ServiceTransport
  const bindingName = transport === 'worker_binding' ? String(body.bindingName || '').trim().toUpperCase() : null
  const baseUrl = transport === 'worker_binding'
    ? { ok: true, value: `https://${code || 'service'}.internal` } as const
    : normalizeServiceBaseUrl(String(body.baseUrl || ''))
  const authType = serviceAuthTypes.includes(body.authType as ServiceAuthType) ? body.authType as ServiceAuthType : 'none'
  const requiredPermissionId = String(body.requiredPermissionId || '').trim() || null
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(code)) return { ok: false, error: '服务编码需为 2–64 位小写字母、数字、横线或下划线' } as const
  if (!name) return { ok: false, error: '请输入服务名称' } as const
  if (transport === 'worker_binding' && (!bindingName || !/^[A-Z_][A-Z0-9_]{0,63}$/.test(bindingName))) return { ok: false, error: 'Worker Binding 名称需为 1–64 位大写字母、数字或下划线，且不能以数字开头' } as const
  if (!baseUrl.ok) return baseUrl
  return { ok: true, value: { code, name, description, transport, bindingName, baseUrl: baseUrl.value, authType, requiredPermissionId, enabled: body.enabled !== false } } as const
}

export function parseServiceApiInput(body: Record<string, unknown>) {
  const code = String(body.code || '').trim().toLowerCase()
  const name = String(body.name || '').trim()
  const description = String(body.description || '').trim()
  const path = String(body.path || '').trim()
  const method = String(body.method || '').toUpperCase() as ServiceApiMethod
  const usageUnits = Number(body.usageUnits)
  const timeoutMs = Number(body.timeoutMs ?? 30000)
  const parameters = parseParameters(body.parameters)
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(code)) return { ok: false, error: 'API 编码需为 2–64 位小写字母、数字、横线或下划线' } as const
  if (!name) return { ok: false, error: '请输入 API 名称' } as const
  if (!path || !path.startsWith('/') || path.startsWith('//') || /^https?:/i.test(path)) return { ok: false, error: 'API 路径必须是以 / 开头的相对路径' } as const
  if (!serviceApiMethods.includes(method)) return { ok: false, error: '请求方式无效' } as const
  if (!Number.isSafeInteger(usageUnits) || usageUnits < 0 || usageUnits > 10000) return { ok: false, error: '单次计费次数必须是 0–10000 的整数；0 表示免费调用' } as const
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) return { ok: false, error: '超时时间必须在 1000–120000 毫秒之间' } as const
  if (!parameters.ok) return parameters
  if (method === 'GET' && parameters.value.some((item) => item.location === 'body')) return { ok: false, error: 'GET API 不能配置 Body 参数' } as const
  const pathParameters = parameters.value.filter((item) => item.location === 'path')
  if (pathParameters.some((item) => !item.required)) return { ok: false, error: 'Path 参数必须设为必填' } as const
  if (pathParameters.some((item) => !path.includes(`{${item.name}}`) && !path.includes(`:${item.name}`))) return { ok: false, error: '每个 Path 参数都必须在上游路径中有对应占位符' } as const
  const placeholders = [...path.matchAll(/\{([A-Za-z0-9_.-]+)\}|:([A-Za-z0-9_.-]+)/g)].map((match) => match[1] || match[2])
  if (placeholders.some((name) => !pathParameters.some((item) => item.name === name))) return { ok: false, error: '上游路径中的每个占位符都必须配置为 Path 参数' } as const
  return { ok: true, value: { code, name, description, path, method, parameters: parameters.value, usageUnits, timeoutMs, enabled: body.enabled !== false } } as const
}

export function parseServiceAuthInput(authType: ServiceAuthType, body: Record<string, unknown>): Result<ServiceAuthConfig | null> {
  if (authType === 'none') return { ok: true, value: null }
  if (authType === 'bearer') {
    const token = String(body.authToken || '').trim()
    return token ? { ok: true, value: { token } } : { ok: false, error: '请输入 Bearer Token' }
  }
  if (authType === 'header') {
    const header = String(body.authHeader || '').trim()
    const value = String(body.authValue || '').trim()
    if (!header || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(header)) return { ok: false, error: '请输入有效的鉴权 Header 名称' }
    return value ? { ok: true, value: { header, value } } : { ok: false, error: '请输入鉴权 Header 值' }
  }
  if (authType === 'query') {
    const query = String(body.authQuery || '').trim()
    const value = String(body.authValue || '').trim()
    if (!query || !/^[A-Za-z0-9_.-]+$/.test(query)) return { ok: false, error: '请输入有效的鉴权 Query 参数名' }
    return value ? { ok: true, value: { query, value } } : { ok: false, error: '请输入鉴权 Query 参数值' }
  }
  const username = String(body.authUsername || '').trim()
  const password = String(body.authPassword || '')
  return username && password ? { ok: true, value: { username, password } } : { ok: false, error: '请输入 Basic Auth 用户名和密码' }
}

export function sealServiceAuth(config: ServiceAuthConfig) {
  const key = credentialKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(config), 'utf8'), cipher.final()])
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`
}

export function openServiceAuth(value: string): ServiceAuthConfig {
  const [version, iv, tag, encrypted] = value.split('.')
  if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('服务鉴权配置格式无效')
  const decipher = createDecipheriv('aes-256-gcm', credentialKey(), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8')) as ServiceAuthConfig
}

export function serviceAuthHeaders(type: ServiceAuthType, encrypted: string | null) {
  if (type === 'none' || type === 'query') return new Headers()
  if (!encrypted) throw new Error('服务鉴权信息未配置')
  const config = openServiceAuth(encrypted)
  const headers = new Headers()
  if (type === 'bearer' && config.token) headers.set('authorization', `Bearer ${config.token}`)
  else if (type === 'header' && config.header && config.value) headers.set(config.header, config.value)
  else if (type === 'basic' && config.username != null && config.password != null) headers.set('authorization', `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`)
  else throw new Error('服务鉴权信息不完整')
  return headers
}

export function applyServiceQueryAuth(target: URL, type: ServiceAuthType, encrypted: string | null) {
  if (type !== 'query') return
  if (!encrypted) throw new Error('服务鉴权信息未配置')
  const config = openServiceAuth(encrypted)
  if (!config.query || config.value == null) throw new Error('服务 Query 鉴权信息不完整')
  target.searchParams.set(config.query, config.value)
}

export function joinServiceUrl(baseUrl: string, path: string) {
  const base = new URL(baseUrl)
  base.pathname = `${base.pathname.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
  base.search = ''
  base.hash = ''
  return base
}

function normalizeServiceBaseUrl(value: string): Result<string> {
  try {
    const url = new URL(value.trim())
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error()
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') return { ok: false, error: '生产环境服务 Base URL 必须使用 HTTPS' }
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
    if (host === 'localhost' || host.endsWith('.local') || isPrivateAddress(host)) return { ok: false, error: 'Base URL 不允许指向本机或私有网络' }
    return { ok: true, value: url.toString().replace(/\/$/, '') }
  } catch { return { ok: false, error: '请输入有效的服务 Base URL' } }
}

function isPrivateAddress(host: string) {
  if (isIP(host) === 6) return host === '::1' || host === '::' || host.startsWith('fc') || host.startsWith('fd') || /^fe[89ab]/.test(host)
  if (isIP(host) !== 4) return false
  const [a, b] = host.split('.').map(Number)
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}

function parseParameters(input: unknown): Result<ServiceParameter[]> {
  if (!Array.isArray(input)) return { ok: false, error: '请求参数格式无效' }
  const result: ServiceParameter[] = []
  const keys = new Set<string>()
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: '请求参数格式无效' }
    const item = raw as Record<string, unknown>
    const name = String(item.name || '').trim()
    const location = String(item.location || '') as ServiceParameter['location']
    const dataType = String(item.dataType || '') as ServiceParameter['dataType']
    if (!name || !/^[A-Za-z0-9_.-]+$/.test(name)) return { ok: false, error: '参数名只能包含字母、数字、点、横线和下划线' }
    if (!parameterLocations.includes(location) || !parameterDataTypes.includes(dataType)) return { ok: false, error: `参数 ${name} 的位置或类型无效` }
    const key = `${location}:${name.toLowerCase()}`
    if (keys.has(key)) return { ok: false, error: `参数 ${name} 重复` }
    keys.add(key)
    result.push({ name, location, dataType, required: item.required === true, description: String(item.description || '').trim() })
  }
  return { ok: true, value: result }
}

function credentialKey() {
  const secret = process.env.SERVICE_CREDENTIALS_KEY
  if (!secret || secret.length < 32) throw new Error('SERVICE_CREDENTIALS_KEY 未配置或长度不足 32 位')
  return createHash('sha256').update(secret).digest()
}
