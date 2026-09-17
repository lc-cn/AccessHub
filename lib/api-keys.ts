import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { apiKeys } from './db/schema.ts'
import { openServiceAuth, sealServiceAuth } from './api-services.ts'

const API_KEY_PREFIX = 'ahk_'

export type ApiKeyRecord = {
  id: string
  name: string
  kind: 'default' | 'custom'
  prefix: string
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

export function parseApiKeyCreateInput(body: Record<string, unknown>) {
  const name = String(body.name || '').trim()
  const expiresInDays = Number(body.expiresInDays ?? 90)
  if (!name || name.length > 64) return { ok: false, error: 'Key 名称需为 1–64 个字符' } as const
  if (!Number.isSafeInteger(expiresInDays) || ![-1, 30, 90, 365].includes(expiresInDays)) return { ok: false, error: '请选择有效的到期时间' } as const
  const expiresAt = expiresInDays === -1 ? null : new Date(Date.now() + expiresInDays * 86_400_000)
  return { ok: true, value: { name, expiresAt } } as const
}

export async function createApiKey(userId: string, input: { name: string; expiresAt: Date | null; kind?: 'default' | 'custom'; storeSecret?: boolean }) {
  const { db } = await import('./db/index.ts')
  const generated = generateApiKey()
  const kind = input.kind ?? 'custom'
  const [created] = await db.insert(apiKeys).values({ id: randomUUID(), userId, name: input.name, kind, prefix: generated.prefix, keyHash: generated.keyHash, secretEncrypted: input.storeSecret ? sealServiceAuth({ token: generated.token }) : null, expiresAt: input.expiresAt }).returning({ id: apiKeys.id, name: apiKeys.name, kind: apiKeys.kind, prefix: apiKeys.prefix, expiresAt: apiKeys.expiresAt, lastUsedAt: apiKeys.lastUsedAt, revokedAt: apiKeys.revokedAt, createdAt: apiKeys.createdAt })
  return { apiKey: created, token: generated.token }
}

export async function ensureDefaultApiKey(userId: string): Promise<{ id: string; secretEncrypted: string }> {
  const { db } = await import('./db/index.ts')
  const selectDefault = () => db.select({ id: apiKeys.id, secretEncrypted: apiKeys.secretEncrypted }).from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.kind, 'default'), isNull(apiKeys.revokedAt))).limit(1)
  const [existing] = await selectDefault()
  if (existing?.secretEncrypted) return { id: existing.id, secretEncrypted: existing.secretEncrypted }

  const generated = generateApiKey()
  const [created] = await db.insert(apiKeys).values({
    id: randomUUID(),
    userId,
    name: '默认 API Key',
    kind: 'default',
    prefix: generated.prefix,
    keyHash: generated.keyHash,
    secretEncrypted: sealServiceAuth({ token: generated.token }),
    expiresAt: null,
  }).onConflictDoNothing().returning({ id: apiKeys.id, secretEncrypted: apiKeys.secretEncrypted })
  if (created?.secretEncrypted) return { id: created.id, secretEncrypted: created.secretEncrypted }
  const [concurrent] = await selectDefault()
  if (!concurrent?.secretEncrypted) throw new Error('Default API key could not be initialized')
  return { id: concurrent.id, secretEncrypted: concurrent.secretEncrypted }
}

export async function getDefaultApiKeyToken(userId: string) {
  const key = await ensureDefaultApiKey(userId)
  const token = openServiceAuth(key.secretEncrypted).token
  if (typeof token !== 'string' || !isApiKeyToken(token)) throw new Error('Default API key secret is invalid')
  return token
}

export async function authenticateApiKey(token: string) {
  if (!isApiKeyToken(token)) return null
  const { db } = await import('./db/index.ts')
  const now = new Date()
  const [key] = await db.select({ id: apiKeys.id, userId: apiKeys.userId, lastUsedAt: apiKeys.lastUsedAt }).from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hashApiKey(token)), isNull(apiKeys.revokedAt), or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, now)))).limit(1)
  if (!key) return null
  if (!key.lastUsedAt || now.getTime() - key.lastUsedAt.getTime() >= 60_000) await db.update(apiKeys).set({ lastUsedAt: now, updatedAt: now }).where(eq(apiKeys.id, key.id))
  return { userId: key.userId, apiKeyId: key.id }
}
