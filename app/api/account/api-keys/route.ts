import { NextResponse } from 'next/server'
import { and, count, eq, gt, isNull, or } from 'drizzle-orm'
import { createApiKey, ensureDefaultApiKey, parseApiKeyCreateInput } from '@/lib/api-keys'
import { requireSession } from '@/lib/account'
import { AccountError } from '@/lib/account/errors'
import { requireFreshSession } from '@/lib/account/fresh-session'
import { getAccountApiKeys, getApiKeyServiceOptions } from '@/lib/account/read-models'
import { recordSecurityEventBestEffort } from '@/lib/account/security-events'
import { db } from '@/lib/db'
import { apiKeys, apiServices } from '@/lib/db/schema'

export async function GET() {
  try {
    const current = await requireSession()
    await ensureDefaultApiKey(current.user.id)
    const [currentKeys, services] = await Promise.all([
      getAccountApiKeys(current.user.id),
      getApiKeyServiceOptions(),
    ])
    return NextResponse.json({ apiKeys: currentKeys, services })
  } catch (error) {
    if (error instanceof AccountError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    console.error('[account] Failed to list API keys')
    return NextResponse.json({ error: '读取 API Key 失败，请稍后重试。' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const current = await requireSession()
    requireFreshSession(current.session)
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const services = await db.select({ code: apiServices.code }).from(apiServices).where(eq(apiServices.enabled, true))
    const parsed = parseApiKeyCreateInput(body, services.map((item) => item.code))
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const now = new Date()
    const [active] = await db.select({ count: count() }).from(apiKeys).where(and(eq(apiKeys.userId, current.user.id), isNull(apiKeys.revokedAt), or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, now))))
    if ((active?.count ?? 0) >= 20) return NextResponse.json({ error: '最多保留 20 个未撤销的 API Key。' }, { status: 409 })
    const created = await createApiKey(current.user.id, parsed.value)
    await recordSecurityEventBestEffort({ actorId: current.user.id, action: 'account.api_key.created', resourceId: created.apiKey.id, detail: created.apiKey.name })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if (error instanceof AccountError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    console.error('[account] Failed to create API key')
    return NextResponse.json({ error: '创建 API Key 失败，请稍后重试。' }, { status: 500 })
  }
}
