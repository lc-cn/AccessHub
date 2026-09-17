import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { authenticateApiKey } from '@/lib/api-keys'
import { getGatewayApiKey } from '@/lib/gateway-auth'
import type { ServiceAuthType, ServiceParameter, ServiceTransport } from '@/lib/api-services'
import { prepareUpstreamRequest } from '@/lib/api-gateway-request'
import { dispatchUpstreamRequest, UpstreamBindingUnavailableError } from '@/lib/upstream-transport'
import { db } from '@/lib/db'
import { apiServices, serviceApis } from '@/lib/db/schema'
import { reserveApiUsage } from '@/lib/gateway-allowance'
import { chargedUsageUnits } from '@/lib/gateway-billing'
import { hasPermission, resolveUserPermissions } from '@/lib/permissions'

type Context = { params: Promise<{ service: string; api: string }> }

async function gateway(request: Request, context: Context) {
  const { service: serviceCode, api: apiCode } = await context.params
  const principal = await authenticateGatewayRequest(request)
  if (!principal) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: { 'www-authenticate': 'Bearer' } })
  const [target] = await db.select({
    transport: apiServices.transport, bindingName: apiServices.bindingName,
    baseUrl: apiServices.baseUrl, authType: apiServices.authType, authConfigEncrypted: apiServices.authConfigEncrypted,
    requiredPermissionId: apiServices.requiredPermissionId,
    apiId: serviceApis.id, path: serviceApis.path, method: serviceApis.method, parameters: serviceApis.parameters,
    usageUnits: serviceApis.usageUnits, timeoutMs: serviceApis.timeoutMs,
  }).from(apiServices).innerJoin(serviceApis, eq(serviceApis.serviceId, apiServices.id)).where(and(eq(apiServices.code, serviceCode), eq(serviceApis.code, apiCode), eq(apiServices.enabled, true), eq(serviceApis.enabled, true))).limit(1)
  if (!target) return NextResponse.json({ error: 'api_not_found' }, { status: 404 })
  const permissionSet = await resolveUserPermissions(db, principal.userId)
  if (!hasPermission(permissionSet, target.requiredPermissionId)) return NextResponse.json({ error: 'permission_denied' }, { status: 403 })
  if (request.method !== target.method) return NextResponse.json({ error: 'method_not_allowed', expected: target.method }, { status: 405, headers: { allow: target.method } })

  const prepared = await prepareUpstreamRequest(request, target.baseUrl, target.path, target.parameters as ServiceParameter[], target.authType as ServiceAuthType, target.authConfigEncrypted)
  if (!prepared.ok) return NextResponse.json({ error: 'invalid_request', detail: prepared.error }, { status: 400 })
  const referenceId = `service_api:${target.apiId}`
  const preflight = await reserveApiUsage(principal.userId, target.usageUnits, referenceId, { commit: false })
  if (!preflight.ok) return NextResponse.json(preflight.body, { status: preflight.status })

  try {
    const upstream = await dispatchUpstreamRequest({
      transport: target.transport as ServiceTransport,
      bindingName: target.bindingName,
      url: prepared.url,
      method: target.method,
      headers: prepared.headers,
      body: prepared.body,
      timeoutMs: target.timeoutMs,
    })
    const unitsToCharge = chargedUsageUnits(upstream.status, target.usageUnits)
    let reservation = preflight
    if (unitsToCharge > 0) {
      const committed = await reserveApiUsage(principal.userId, unitsToCharge, referenceId)
      if (!committed.ok) return NextResponse.json(committed.body, { status: committed.status })
      reservation = committed
    }
    const responseHeaders = new Headers()
    for (const name of ['content-type', 'content-language', 'cache-control', 'etag', 'last-modified']) {
      const value = upstream.headers.get(name)
      if (value) responseHeaders.set(name, value)
    }
    responseHeaders.set('x-accesshub-usage-units', String(unitsToCharge))
    responseHeaders.set('x-accesshub-configured-usage-units', String(target.usageUnits))
    responseHeaders.set('x-accesshub-allowance-source', reservation.allowanceSource)
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
  } catch (error) {
    if (error instanceof UpstreamBindingUnavailableError) return NextResponse.json({ error: 'upstream_binding_unavailable', detail: error.message, usageUnits: 0, configuredUsageUnits: target.usageUnits }, { status: 503 })
    const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    return NextResponse.json({ error: timeout ? 'upstream_timeout' : 'upstream_unavailable', usageUnits: 0, configuredUsageUnits: target.usageUnits }, { status: timeout ? 504 : 502 })
  }
}

async function authenticateGatewayRequest(request: Request) {
  const apiKey = getGatewayApiKey(request)
  if (apiKey) return authenticateApiKey(apiKey)
  const session = await auth.api.getSession({ headers: request.headers })
  return session?.user ? { userId: session.user.id, apiKeyId: null } : null
}

export const GET = gateway
export const POST = gateway
export const PUT = gateway
export const PATCH = gateway
export const DELETE = gateway
