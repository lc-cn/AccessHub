import { NextResponse } from 'next/server'
import { GET as readAdmin, POST as createAdmin } from '@/lib/admin-api'

const readableSections: Record<string, string> = {
  plans: 'plans',
  skus: 'skus',
  'redeem-codes': 'codes',
  permissions: 'permissions',
  services: 'services',
  subscriptions: 'subscriptions',
  orders: 'orders',
  payments: 'payments',
  users: 'users',
  logs: 'logs',
  'afdian-mappings': 'afdian',
  'afdian-orders': 'afdian-orders',
  'afdian-events': 'afdian-events',
}

const creatableTypes: Record<string, string> = {
  plans: 'plan',
  skus: 'sku',
  'redeem-codes': 'codes',
  permissions: 'permission',
  services: 'service',
  'afdian-mappings': 'afadian-mapping',
}

type Context = { params: Promise<{ resource: string }> }

export async function GET(request: Request, context: Context) {
  const { resource } = await context.params
  const section = readableSections[resource]
  if (!section) return NextResponse.json({ error: '管理资源不存在' }, { status: 404 })
  const url = new URL(request.url)
  url.searchParams.set('section', section)
  return readAdmin(new Request(url, { headers: request.headers }))
}

export async function POST(request: Request, context: Context) {
  const { resource } = await context.params
  const type = creatableTypes[resource]
  if (!type) return NextResponse.json({ error: '该管理资源不支持新增' }, { status: 405 })
  const body = await request.json().catch(() => ({}))
  return createAdmin(new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ ...body, type }),
  }))
}
