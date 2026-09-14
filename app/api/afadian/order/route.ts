import { NextResponse } from 'next/server'
import { createHash, randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { afadianOrders, redeemCodes, groups } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

function sign(payload: string) { return createHash('md5').update(`${process.env.AFDIAN_USER_ID}${process.env.AFDIAN_ADMIN_TOKEN}${payload}`).digest('hex') }
export async function POST(request: Request) {
  const raw = await request.text()
  const signature = request.headers.get('x-afdian-signature') || request.headers.get('x-signature')
  const expected = sign(raw)
  if (!signature || signature !== expected) return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  const data = JSON.parse(raw)
  const order = data?.data?.order || data?.order || data?.data
  const outTradeNo = String(order?.out_trade_no || order?.outTradeNo || '')
  if (!outTradeNo) return NextResponse.json({ error: 'missing order' }, { status: 400 })
  const exists = await db.select({ id: afadianOrders.id }).from(afadianOrders).where(eq(afadianOrders.outTradeNo, outTradeNo)).limit(1)
  if (exists.length) return NextResponse.json({ ok: true })
  const [defaultGroup] = await db.select({ id: groups.id }).from(groups).where(eq(groups.isDefault, true)).limit(1)
  if (defaultGroup) await db.insert(redeemCodes).values({ id: randomUUID(), code: `AFD-${randomUUID().slice(0, 8).toUpperCase()}`, groupId: defaultGroup.id, durationDays: 30 })
  await db.insert(afadianOrders).values({ id: randomUUID(), outTradeNo, payload: raw })
  return NextResponse.json({ ok: true })
}
