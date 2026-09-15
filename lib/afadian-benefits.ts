import type { EntitlementUnit, RedeemKind } from '@/lib/entitlements'

export type MappedEntitlement = {
  kind: RedeemKind
  planId?: string
  credits?: number
  durationValue: number
  durationUnit: EntitlementUnit
  codesPerItem: number
}

export type AfdianOfferMapping = MappedEntitlement & { offerKey: string; enabled: boolean }

type AfdianOrderIdentity = {
  outTradeNo: string
  afdianPlanId: string
  skuIds: string[]
}

// Afdian uses the order from its public webhook documentation when validating
// a callback URL. It is a connectivity probe, not an order owned by the creator.
const AFDIAN_WEBHOOK_PROBE = {
  outTradeNo: '202106232138371083454010626',
  planId: 'a45353328af911eb973052540025c377',
} as const

export function resolveAfdianOffer(mappings: AfdianOfferMapping[], afdianPlanId: string, skuIds: string[]) {
  const config = new Map(mappings.filter((mapping) => mapping.enabled).map((mapping) => [mapping.offerKey, mapping]))
  const key = skuIds.map((id) => `afdian-sku:${id}`).find((candidate) => config.has(candidate)) ?? (config.has(`afdian-plan:${afdianPlanId}`) ? `afdian-plan:${afdianPlanId}` : '')
  if (!key) return null
  const { offerKey: _, enabled: __, ...benefit } = config.get(key)!
  return { key, benefit }
}

export function resolveAfdianWebhookOffer(mappings: AfdianOfferMapping[], order: AfdianOrderIdentity) {
  const resolved = resolveAfdianOffer(mappings, order.afdianPlanId, order.skuIds)
  if (resolved) return { outcome: 'mapped' as const, resolved }

  const isProbe = order.outTradeNo === AFDIAN_WEBHOOK_PROBE.outTradeNo
    && order.afdianPlanId === AFDIAN_WEBHOOK_PROBE.planId
  return isProbe ? { outcome: 'probe' as const } : { outcome: 'unmapped' as const }
}
