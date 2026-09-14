export type DashboardGroup = {
  id: string
  name: string
  description: string
  rateLimit: number
  dailyLimit: number | null
  weeklyLimit: number | null
  monthlyLimit: number | null
  isDefault: boolean
  memberCount: number
}

export type DashboardData = {
  authenticated: boolean
  user: { id: string; name: string; image: string | null; role: string; createdAt: string } | null
  currentGroup?: { groupId: string; groupName: string; rateLimit: number; dailyLimit: number | null; weeklyLimit: number | null; monthlyLimit: number | null; expiresAt: string | null } | null
  usage?: { daily: number; weekly: number; monthly: number }
  activeBenefits?: number
  creditsRemaining?: number
  afdian?: { linked: boolean; oauthConfigured: boolean }
  groups: DashboardGroup[]
}

export type AdminGroup = Omit<DashboardGroup, 'memberCount'> & {
  createdAt: string
  updatedAt: string
}

export type RedeemCode = {
  id: string
  code: string
  kind: 'group' | 'credits'
  groupId: string | null
  groupName: string | null
  credits: number | null
  durationDays: number
  durationValue: number
  durationUnit: 'day' | 'month' | 'quarter' | 'year'
  expiresAt: string | null
  redeemedAt: string | null
  createdAt: string
}

export type AfdianRule = {
  id: string
  benefitKey: string
  name: string
  kind: 'group' | 'credits'
  groupId: string | null
  groupName: string | null
  credits: number | null
  durationValue: number
  durationUnit: 'day' | 'month' | 'quarter' | 'year'
  codesPerItem: number
  enabled: boolean
  updatedAt: string
}

export type AdminData = { groups: AdminGroup[]; codes: RedeemCode[]; afdianRules: AfdianRule[]; afadianWebhookConfigured: boolean }
