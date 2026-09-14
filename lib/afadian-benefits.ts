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

export function resolveAfdianBenefit(rules: AfdianBenefitRule[], planId: string, skuIds: string[]) {
  const config = new Map(rules.filter((rule) => rule.enabled).map((rule) => [rule.benefitKey, rule]))
  const key = skuIds.map((id) => `sku:${id}`).find((candidate) => config.has(candidate)) ?? (config.has(`plan:${planId}`) ? `plan:${planId}` : '')
  if (!key) return null
  const { benefitKey: _, enabled: __, ...benefit } = config.get(key)!
  return { key, benefit }
}
