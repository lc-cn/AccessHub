import { isUnlimited } from './entitlements.ts'

export type UsagePeriod = 'minute' | 'day' | 'week' | 'month'
export type UsageSnapshot = { minute: number; daily: number; weekly: number; monthly: number }
export type AllowancePolicy = { rateLimit: number | null; dailyLimit: number | null; weeklyLimit: number | null; monthlyLimit: number | null }

export function exceededAllowance(policy: AllowancePolicy, usage: UsageSnapshot, units = 1) {
  const checks = [
    { period: 'minute' as const, used: usage.minute, limit: policy.rateLimit },
    { period: 'day' as const, used: usage.daily, limit: policy.dailyLimit },
    { period: 'week' as const, used: usage.weekly, limit: policy.weeklyLimit },
    { period: 'month' as const, used: usage.monthly, limit: policy.monthlyLimit },
  ]
  return checks.find((item) => !isUnlimited(item.limit) && item.used + units > item.limit!) ?? null
}

export function selectAllowance<T extends { policy: AllowancePolicy; usage: UsageSnapshot }>(candidates: T[], units = 1) {
  let exceeded: ReturnType<typeof exceededAllowance> = null
  for (const candidate of candidates) {
    const candidateExceeded = exceededAllowance(candidate.policy, candidate.usage, units)
    if (!candidateExceeded) return { selected: candidate, exceeded: null }
    exceeded = candidateExceeded
  }
  return { selected: null, exceeded }
}
