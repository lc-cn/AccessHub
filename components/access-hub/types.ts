export type DashboardPlan = {
  id: string
  name: string
  description: string
  rateLimit: number
  dailyLimit: number | null
  weeklyLimit: number | null
  monthlyLimit: number | null
  isDefault: boolean
  subscriberCount: number
  purchaseUrl: string | null
}

export type DashboardData = {
  authenticated: boolean
  user: { id: string; name: string; image: string | null; role: string; createdAt: string } | null
  currentPlan?: { planId: string; planName: string; rateLimit: number; dailyLimit: number | null; weeklyLimit: number | null; monthlyLimit: number | null; expiresAt: string | null } | null
  usage?: { daily: number; weekly: number; monthly: number }
  activeBenefits?: number
  creditsRemaining?: number
  afdian?: { linked: boolean; oauthConfigured: boolean }
  plans: DashboardPlan[]
}

export type AdminPlan = Omit<DashboardPlan, 'subscriberCount' | 'purchaseUrl'> & {
  createdAt: string
  updatedAt: string
}

export type RedeemCode = {
  id: string
  code: string
  kind: 'plan' | 'credits'
  planId: string | null
  planName: string | null
  credits: number | null
  durationDays: number
  durationValue: number
  durationUnit: 'day' | 'month' | 'quarter' | 'year'
  expiresAt: string | null
  redeemedAt: string | null
  createdAt: string
}

export type AfdianMapping = {
  id: string
  offerKey: string
  name: string
  kind: 'plan' | 'credits'
  planId: string | null
  planName: string | null
  credits: number | null
  durationValue: number
  durationUnit: 'day' | 'month' | 'quarter' | 'year'
  codesPerItem: number
  enabled: boolean
  updatedAt: string
}

export type AfdianOrderCode = { id: string; code: string; kind: 'plan' | 'credits'; planId: string | null; planName: string | null; credits: number | null; durationValue: number; durationUnit: 'day' | 'month' | 'quarter' | 'year'; redeemedAt: string | null; redeemedBy: string | null }
export type AfdianOrder = { id: string; outTradeNo: string; userId: string | null; afdianPlanId: string | null; afdianPlanTitle: string; orderMonths: number; amount: string; offerKey: string | null; messageStatus: 'pending' | 'sending' | 'sent' | 'failed' | 'unknown' | 'not_requested'; messageAttempts: number; messageAttemptedAt: string | null; messageSentAt: string | null; messageLastError: string | null; createdAt: string; codes: AfdianOrderCode[] }

export type AdminData = { plans: AdminPlan[]; codes: RedeemCode[]; afdianMappings: AfdianMapping[]; afdianOrders?: AfdianOrder[]; afadianWebhookConfigured: boolean; afadianMessengerConfigured?: boolean }
