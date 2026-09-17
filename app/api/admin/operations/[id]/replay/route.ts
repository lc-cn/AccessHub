import { NextResponse } from 'next/server'
import { requireAdminActor } from '@/lib/admin-auth'
import { replayCommerceDeadLetter } from '@/lib/commerce-operations'

type Context = { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: Context) {
  const actorId = await requireAdminActor()
  if (!actorId) return NextResponse.json({ error: '无权操作' }, { status: 403 })
  const { id } = await context.params
  try {
    return NextResponse.json({ result: await replayCommerceDeadLetter(id, actorId) })
  } catch (error) {
    const message = error instanceof Error ? error.message : '死信重放失败'
    const status = message === 'commerce queue is not configured' ? 503 : 409
    return NextResponse.json({ error: message }, { status })
  }
}
