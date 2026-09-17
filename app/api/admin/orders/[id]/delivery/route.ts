import { NextResponse } from 'next/server'
import { requireAdminActor } from '@/lib/admin-auth'
import { CommerceCommandError, reconcileUnknownAfdianDelivery } from '@/lib/commerce-orchestration'

type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context) {
  const actorId = await requireAdminActor()
  if (!actorId) return NextResponse.json({ error: '无权操作' }, { status: 403 })
  const { id } = await context.params
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const decision = body.decision
  if (decision !== 'confirmed_sent' && decision !== 'confirmed_not_sent') {
    return NextResponse.json({ error: '请选择明确的核对结果' }, { status: 400 })
  }
  try {
    const result = await reconcileUnknownAfdianDelivery({ orderId: id, actorId, decision })
    return NextResponse.json({ result })
  } catch (error) {
    const message = error instanceof Error ? error.message : '私信核对失败'
    const status = error instanceof CommerceCommandError && !error.retryable ? 409 : 503
    return NextResponse.json({ error: message }, { status })
  }
}
