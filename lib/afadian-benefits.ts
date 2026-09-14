import type { EntitlementUnit, RedeemKind } from '@/lib/entitlements'

export type AfdianBenefit = {
  kind: RedeemKind
  groupId?: string
  credits?: number
  durationValue: number
  durationUnit: EntitlementUnit
  codesPerItem: number
}

export type AfdianBenefitRule = AfdianBenefit & { benefitKey: string; enabled: boolean }

type AfdianOrderIdentity = {
  outTradeNo: string
  planId: string
  skuIds: string[]
}

// Afdian uses the order from its public webhook documentation when validating
// a callback URL. It is a connectivity probe, not an order owned by the creator.
const AFDIAN_WEBHOOK_PROBE = {
  outTradeNo: '202106232138371083454010626',
  planId: 'a45353328af911eb973052540025c377',
} as const

export function resolveAfdianBenefit(rules: AfdianBenefitRule[], planId: string, skuIds: string[]) {
  const config = new Map(rules.filter((rule) => rule.enabled).map((rule) => [rule.benefitKey, rule]))
  const key = skuIds.map((id) => `sku:${id}`).find((candidate) => config.has(candidate)) ?? (config.has(`plan:${planId}`) ? `plan:${planId}` : '')
  if (!key) return null
  const { benefitKey: _, enabled: __, ...benefit } = config.get(key)!
  return { key, benefit }
}

export function resolveAfdianWebhookBenefit(rules: AfdianBenefitRule[], order: AfdianOrderIdentity) {
  const resolved = resolveAfdianBenefit(rules, order.planId, order.skuIds)
  if (resolved) return { outcome: 'mapped' as const, resolved }

  const isProbe = order.outTradeNo === AFDIAN_WEBHOOK_PROBE.outTradeNo
    && order.planId === AFDIAN_WEBHOOK_PROBE.planId
  return isProbe ? { outcome: 'probe' as const } : { outcome: 'unmapped' as const }
}
