import { NextResponse } from 'next/server'
import { DELETE as deleteAdmin, PATCH as updateAdmin } from '@/lib/admin-api'

const updateResources: Record<string, { type: string; idField: string }> = {
  plans: { type: 'plan', idField: 'planId' },
  skus: { type: 'sku', idField: 'skuId' },
  permissions: { type: 'permission', idField: 'permissionId' },
  services: { type: 'service', idField: 'serviceId' },
  subscriptions: { type: 'subscription', idField: 'subscriptionId' },
}

type Context = { params: Promise<{ resource: string; id: string }> }

export async function PATCH(request: Request, context: Context) {
  const { resource, id } = await context.params
  const mapping = updateResources[resource]
  if (!mapping) return NextResponse.json({ error: '该管理资源不支持编辑' }, { status: 405 })
  const body = await request.json().catch(() => ({}))
  return updateAdmin(new Request(request.url, {
    method: 'PATCH',
    headers: request.headers,
    body: JSON.stringify({ ...body, type: mapping.type, [mapping.idField]: id }),
  }))
}

export async function DELETE(request: Request, context: Context) {
  const { resource, id } = await context.params
  if (resource !== 'afdian-mappings') return NextResponse.json({ error: '该管理资源不支持删除' }, { status: 405 })
  const url = new URL(request.url)
  url.searchParams.set('mappingId', id)
  return deleteAdmin(new Request(url, { method: 'DELETE', headers: request.headers }))
}
