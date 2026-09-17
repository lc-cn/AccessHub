import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import {
  dispatchPendingCommerceEvents,
  recordAfdianProviderEvent,
} from '@/lib/commerce-orchestration'
import { parseAfdianWebhook } from '@/lib/afdian-webhook'

function response(ec: number, em: string, data?: Record<string, unknown>, status = 200) {
  return NextResponse.json({ ec, em, ...(data ? { data } : {}) }, { status })
}

function safeEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

function requestSecret(request: Request) {
  const authorization = request.headers.get('authorization')
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7)
  return request.headers.get('x-webhook-secret') || new URL(request.url).searchParams.get('token') || ''
}

export async function POST(request: Request) {
  const expectedSecret = process.env.AFDIAN_WEBHOOK_SECRET
  if (!expectedSecret) return response(503, 'webhook secret is not configured', undefined, 503)
  if (!safeEqual(requestSecret(request), expectedSecret)) return response(401, 'invalid webhook secret', undefined, 401)

  const rawPayload = await request.text()
  const parsed = parseAfdianWebhook(rawPayload)
  if (parsed.outcome === 'invalid') return response(400, parsed.message)
  if (parsed.outcome === 'ignored') return response(200, parsed.message)

  try {
    const recorded = await recordAfdianProviderEvent(rawPayload, parsed)
    if (recorded.probe) return response(200, 'ok', { probe: true })
    const dispatch = recorded.outboxEventId
      ? await dispatchPendingCommerceEvents({ ids: [recorded.outboxEventId], limit: 1 })
      : { available: true, published: 0, failed: 0 }
    if (!dispatch.available) return response(503, 'commerce queue is not configured', { accepted: true }, 503)
    if (dispatch.failed) return response(503, 'order accepted but queue delivery failed', { accepted: true }, 503)
    return response(200, 'ok', { accepted: true, queued: dispatch.published > 0 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'failed to accept order'
    return response(500, message, undefined, 500)
  }
}
