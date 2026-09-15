import { parseDuration, parseLimit, parsePositiveInteger, type EntitlementUnit, type RedeemKind } from './entitlements.ts'

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

export type GroupPolicyInput = {
  name: string
  description: string
  rateLimit: number
  dailyLimit: number
  weeklyLimit: number
  monthlyLimit: number
  isDefault: boolean
}

export type BenefitInput = {
  kind: RedeemKind
  groupId: string | null
  credits: number | null
  durationValue: number
  durationUnit: EntitlementUnit
}

function invalidQuotaOrder(shorter: number, longer: number) {
  return shorter !== -1 && longer !== -1 && longer < shorter
}

export function parseGroupPolicyInput(body: Record<string, unknown>, rateLimitFallback = -1): ParseResult<GroupPolicyInput> {
  const name = String(body.name || '').trim()
  const rateLimit = parseLimit(body.rateLimit, rateLimitFallback)
  const dailyLimit = parseLimit(body.dailyLimit)
  const weeklyLimit = parseLimit(body.weeklyLimit)
  const monthlyLimit = parseLimit(body.monthlyLimit)
  if (!name) return { ok: false, error: '请输入用户组名称' }
  if (rateLimit == null || dailyLimit == null || weeklyLimit == null || monthlyLimit == null) return { ok: false, error: '配额必须为正整数或 -1（无限制）' }
  if (invalidQuotaOrder(dailyLimit, weeklyLimit)) return { ok: false, error: '每周配额不能低于每日配额' }
  if (invalidQuotaOrder(dailyLimit, monthlyLimit) || invalidQuotaOrder(weeklyLimit, monthlyLimit)) return { ok: false, error: '每月配额不能低于较短周期配额' }
  return { ok: true, value: { name, description: String(body.description || '').trim(), rateLimit, dailyLimit, weeklyLimit, monthlyLimit, isDefault: Boolean(body.isDefault) } }
}

export function parseBenefitInput(body: Record<string, unknown>, durationFallback?: { value: number; unit: EntitlementUnit }): ParseResult<BenefitInput> {
  const kind: RedeemKind = body.kind === 'credits' ? 'credits' : 'group'
  const groupId = kind === 'group' ? String(body.groupId || '').trim() : null
  const credits = kind === 'credits' ? parsePositiveInteger(body.credits) : null
  const duration = parseDuration(body.durationValue ?? durationFallback?.value, body.durationUnit ?? durationFallback?.unit)
  if (!duration) return { ok: false, error: '权益时长需为正整数或 -1，并选择有效周期' }
  if (kind === 'credits' && !credits) return { ok: false, error: 'credits 必须是正整数' }
  if (kind === 'group' && !groupId) return { ok: false, error: '请选择用户组' }
  return { ok: true, value: { kind, groupId, credits, ...duration } }
}
