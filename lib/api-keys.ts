import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { apiKeys } from './db/schema.ts'

const API_KEY_PREFIX = 'ahk_'

export type ApiKeyRecord = {
  id: string
  name: string
  prefix: string
  serviceScopes: string[]
  expiresAt: Date | null
  lastUsedAt: Date | null
  revokedAt: Date | null
  createdAt: Date
}

export function generateApiKey() {
  const token = `${API_KEY_PREFIX}${randomBytes(32).toString('base64url')}`
  return { token, prefix: `${token.slice(0, 12)}…`, keyHash: hashApiKey(token) }
}

export function hashApiKey(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function isApiKeyToken(value: string) {
  return value.startsWith(API_KEY_PREFIX) && value.length >= 40
}

export function parseApiKeyCreateInput(body: Record<string, unknown>, knownServiceCodes: string[]) {
  const name = String(body.name || '').trim()
  const expiresInDays = Number(body.expiresInDays ?? 90)
  const requestedScopes = Array.isArray(body.serviceScopes) ? body.serviceScopes.map(String) : ['*']
  const serviceScopes = requestedScopes.includes('*') ? ['*'] : [...new Set(requestedScopes.map((item) => item.trim().toLowerCase()).filter(Boolean))]
  if (!name || name.length > 64) return { ok: false, error: 'Key 名称需为 1–64 个字符' } as const
  if (!Number.isSafeInteger(expiresInDays) || ![-1, 30, 90, 365].includes(expiresInDays)) return { ok: false, error: '请选择有效的到期时间' } as const
  if (!serviceScopes.length) return { ok: false, error: '请至少选择一个可调用服务' } as const
  if (serviceScopes[0] !== '*' && serviceScopes.some((code) => !knownServiceCodes.includes(code))) return { ok: false, error: '包含无效的服务范围' } as const
  const expiresAt = expiresInDays === -1 ? null : new Date(Date.now() + expiresInDays * 86_400_000)
  return { ok: true, value: { name, serviceScopes, expiresAt } } as const
}

export async function createApiKey(userId: string, input: { name: string; serviceScopes: string[]; expiresAt: Date | null }) {
  const { db } = await import('./db/index.ts')
  const generated = generateApiKey()
  const [created] = await db.insert(apiKeys).values({ id: randomUUID(), userId, ...input, prefix: generated.prefix, keyHash: generated.keyHash }).returning({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, serviceScopes: apiKeys.serviceScopes, expiresAt: apiKeys.expiresAt, lastUsedAt: apiKeys.lastUsedAt, revokedAt: apiKeys.revokedAt, createdAt: apiKeys.createdAt })
  return { apiKey: created, token: generated.token }
}

export async function authenticateApiKey(token: string, serviceCode: string) {
  if (!isApiKeyToken(token)) return null
  const { db } = await import('./db/index.ts')
  const now = new Date()
  const [key] = await db.select({ id: apiKeys.id, userId: apiKeys.userId, serviceScopes: apiKeys.serviceScopes, lastUsedAt: apiKeys.lastUsedAt }).from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hashApiKey(token)), isNull(apiKeys.revokedAt), or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, now)))).limit(1)
  if (!key || (!key.serviceScopes.includes('*') && !key.serviceScopes.includes(serviceCode))) return null
  if (!key.lastUsedAt || now.getTime() - key.lastUsedAt.getTime() >= 60_000) await db.update(apiKeys).set({ lastUsedAt: now, updatedAt: now }).where(eq(apiKeys.id, key.id))
  return { userId: key.userId, apiKeyId: key.id }
}
