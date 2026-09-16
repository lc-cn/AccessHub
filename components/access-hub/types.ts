export type DashboardPlan = {
  id: string
  name: string
  description: string
  rank: number
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
  currentPlan?: { planId: string; planName: string; rank: number; rateLimit: number; dailyLimit: number | null; weeklyLimit: number | null; monthlyLimit: number | null; expiresAt: string | null } | null
  usage?: { daily: number; weekly: number; monthly: number }
  defaultPlan?: { planId: string; planName: string; rateLimit: number; dailyLimit: number | null; weeklyLimit: number | null; monthlyLimit: number | null } | null
  defaultUsage?: { daily: number; weekly: number; monthly: number }
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
  externalOfferType: 'plan' | 'sku'
  externalOfferId: string
  name: string
  skuId: string
  skuCode: string
  skuName: string
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

export type OrderCode = { id: string; code: string; kind: 'plan' | 'credits'; planId: string | null; planName: string | null; credits: number | null; durationValue: number; durationUnit: 'day' | 'month' | 'quarter' | 'year'; redeemedAt: string | null; redeemedBy: string | null }
export type Order = { id: string; providerId: string | null; externalOrderId: string | null; externalCustomerId: string | null; externalOfferId: string | null; externalOfferTitle: string; userId: string | null; skuId: string | null; skuCode: string | null; skuName: string | null; status: string; termMonths: number; amount: string; currency: string; deliveryStatus: 'pending' | 'sending' | 'sent' | 'failed' | 'unknown' | 'not_requested'; deliveryAttempts: number; deliveryAttemptedAt: string | null; deliveredAt: string | null; deliveryLastError: string | null; createdAt: string; codes: OrderCode[] }

export type Sku = { id: string; code: string; name: string; description: string; kind: 'plan' | 'credits'; planId: string | null; planName: string | null; credits: number | null; durationValue: number; durationUnit: 'day' | 'month' | 'quarter' | 'year'; active: boolean; createdAt: string; updatedAt: string }
export type AdminUser = { id: string; name: string; email: string; image: string | null; role: string; createdAt: string }
export type ActivityLog = { id: string; actorId: string | null; action: string; resourceType: string; resourceId: string | null; detail: string; createdAt: string }
export type Subscription = { id: string; userId: string | null; userName: string | null; planId: string; planName: string; skuId: string | null; skuCode: string | null; providerId: string | null; status: 'pending_activation' | 'trialing' | 'active' | 'past_due' | 'paused' | 'canceled' | 'expired'; currentPeriodStart: string | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; createdAt: string; updatedAt: string }
export type Payment = { id: string; orderId: string; providerId: string | null; externalPaymentId: string | null; status: string; amount: string; currency: string; paidAt: string | null; createdAt: string }
export type ProviderEvent = { id: string; providerId: string; externalEventId: string; type: string; status: string; error: string | null; processedAt: string | null; createdAt: string }
export type ServiceParameter = { name: string; location: 'query' | 'header' | 'path' | 'body'; dataType: 'string' | 'number' | 'boolean' | 'json'; required: boolean; description: string }
export type ServiceApi = { id: string; serviceId: string; code: string; name: string; description: string; path: string; method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; parameters: ServiceParameter[]; usageUnits: number; timeoutMs: number; enabled: boolean; createdAt: string; updatedAt: string }
export type ApiService = { id: string; code: string; name: string; description: string; transport: 'http' | 'worker_binding'; bindingName: string | null; baseUrl: string; authType: 'none' | 'bearer' | 'header' | 'query' | 'basic'; authConfigured: boolean; enabled: boolean; createdAt: string; updatedAt: string; apis: ServiceApi[] }
export type WorkerServiceBinding = { binding: string; service: string; label: string }

export type AdminData = { plans: AdminPlan[]; codes: RedeemCode[]; afdianMappings: AfdianMapping[]; orders: Order[]; skus: Sku[]; users: AdminUser[]; logs: ActivityLog[]; subscriptions: Subscription[]; payments: Payment[]; providerEvents: ProviderEvent[]; services: ApiService[]; workerBindings: WorkerServiceBinding[]; afadianWebhookConfigured: boolean; afadianMessengerConfigured?: boolean }
