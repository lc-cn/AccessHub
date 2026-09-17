import { NextResponse } from 'next/server'
import { requireAdminActor } from '@/lib/admin-auth'
import { readCommerceOperations } from '@/lib/commerce-operations'

export async function GET() {
  const actorId = await requireAdminActor()
  if (!actorId) return NextResponse.json({ error: '无权访问' }, { status: 403 })
  try {
    return NextResponse.json(await readCommerceOperations())
  } catch (error) {
    console.error('[admin-operations] failed to read commerce operations', error)
    return NextResponse.json({ error: '暂时无法读取商业任务状态' }, { status: 503 })
  }
}
