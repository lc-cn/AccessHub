export const UNLIMITED = -1

export const entitlementUnits = ['day', 'month', 'quarter', 'year'] as const
export type EntitlementUnit = typeof entitlementUnits[number]
export type RedeemKind = 'plan' | 'credits'

export function isUnlimited(value: number | null | undefined) {
  return value == null || value === UNLIMITED
}

export function parseLimit(value: unknown, fallback = UNLIMITED) {
  if (value === '' || value == null) return fallback
  const parsed = Number(value)
  return Number.isInteger(parsed) && (parsed === UNLIMITED || parsed > 0) ? parsed : null
}

export function parsePositiveInteger(value: unknown, fallback?: number) {
  if ((value === '' || value == null) && fallback !== undefined) return fallback
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export function parseDuration(value: unknown, unit: unknown) {
  const durationValue = Number(value)
  const durationUnit = String(unit || '') as EntitlementUnit
  if (!Number.isInteger(durationValue) || (durationValue !== UNLIMITED && durationValue <= 0)) return null
  if (!entitlementUnits.includes(durationUnit)) return null
  return { durationValue, durationUnit }
}

export function entitlementExpiresAt(start: Date, value: number, unit: EntitlementUnit) {
  if (value === UNLIMITED) return null
  const expiresAt = new Date(start)
  if (unit === 'day') expiresAt.setUTCDate(expiresAt.getUTCDate() + value)
  if (unit !== 'day') {
    const originalDay = expiresAt.getUTCDate()
    const months = value * (unit === 'month' ? 1 : unit === 'quarter' ? 3 : 12)
    expiresAt.setUTCDate(1)
    expiresAt.setUTCMonth(expiresAt.getUTCMonth() + months)
    const lastDay = new Date(Date.UTC(expiresAt.getUTCFullYear(), expiresAt.getUTCMonth() + 1, 0)).getUTCDate()
    expiresAt.setUTCDate(Math.min(originalDay, lastDay))
  }
  return expiresAt
}

export function legacyDurationDays(value: number, unit: EntitlementUnit) {
  if (value === UNLIMITED) return UNLIMITED
  return value * (unit === 'day' ? 1 : unit === 'month' ? 30 : unit === 'quarter' ? 90 : 365)
}
