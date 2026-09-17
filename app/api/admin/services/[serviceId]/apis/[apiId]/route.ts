import { PATCH as updateAdmin } from '@/lib/admin-api'

type Context = { params: Promise<{ serviceId: string; apiId: string }> }

export async function PATCH(request: Request, context: Context) {
  const { serviceId, apiId } = await context.params
  const body = await request.json().catch(() => ({}))
  return updateAdmin(new Request(request.url, {
    method: 'PATCH',
    headers: request.headers,
    body: JSON.stringify({ ...body, type: 'service-api', serviceId, apiId }),
  }))
}
