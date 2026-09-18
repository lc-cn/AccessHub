import { randomUUID } from 'node:crypto'

export type GatewayOutcome = 'success' | 'rejected' | 'upstream_error'

export type GatewayRequestFact = {
  userId: string
  apiKeyId: string | null
  serviceId: string
  apiId: string
  requestMethod: string
  responseStatus: number
  upstreamStatus?: number | null
  configuredUsageUnits: number
  chargedUsageUnits?: number
  allowanceSource?: string | null
  errorCode?: string | null
  outcome?: GatewayOutcome
  startedAt: number
}

export function gatewayOutcomeForStatus(status: number): GatewayOutcome {
  if (status >= 200 && status < 300) return 'success'
  if (status >= 500) return 'upstream_error'
  return 'rejected'
}

export async function recordGatewayRequest(fact: GatewayRequestFact) {
  try {
    const [{ db }, { gatewayRequests }] = await Promise.all([import('./db/index.ts'), import('./db/schema.ts')])
    await db.insert(gatewayRequests).values({
      id: randomUUID(),
      userId: fact.userId,
      apiKeyId: fact.apiKeyId,
      serviceId: fact.serviceId,
      apiId: fact.apiId,
      requestMethod: fact.requestMethod,
      outcome: fact.outcome ?? gatewayOutcomeForStatus(fact.responseStatus),
      responseStatus: fact.responseStatus,
      upstreamStatus: fact.upstreamStatus ?? null,
      configuredUsageUnits: fact.configuredUsageUnits,
      chargedUsageUnits: fact.chargedUsageUnits ?? 0,
      allowanceSource: fact.allowanceSource ?? null,
      durationMs: Math.max(0, Date.now() - fact.startedAt),
      errorCode: fact.errorCode ?? null,
    })
  } catch (error) {
    console.error('[gateway-observability] failed to persist request fact', error instanceof Error ? error.message : error)
  }
}
