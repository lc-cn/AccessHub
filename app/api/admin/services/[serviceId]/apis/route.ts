import { POST as createAdmin } from '@/lib/admin-api'

type Context = { params: Promise<{ serviceId: string }> }

export async function POST(request: Request, context: Context) {
  const { serviceId } = await context.params
  const body = await request.json().catch(() => ({}))
  return createAdmin(new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ ...body, type: 'service-api', serviceId }),
  }))
}
