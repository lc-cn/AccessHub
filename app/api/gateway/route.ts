import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { reserveApiUsage } from '@/lib/gateway-allowance'

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const reservation = await reserveApiUsage(session.user.id)
  if (!reservation.ok) return NextResponse.json(reservation.body, { status: reservation.status })
  return NextResponse.json(reservation)
}
