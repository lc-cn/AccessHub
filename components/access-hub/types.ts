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

export type ProviderEvent = {
  id: string
  providerId: string
  externalEventId: string
  type: string
  status: string
  error: string | null
  processedAt: string | null
  createdAt: string
  queuedAt?: string | null
  workflowInstanceId?: string | null
  processingStartedAt?: string | null
  nextAttemptAt?: string | null
  attemptCount?: number
  updatedAt?: string
}

export type OrderCode = { id: string; code: string; kind: 'plan' | 'credits'; planId: string | null; planName: string | null; credits: number | null; durationValue: number; durationUnit: 'day' | 'month' | 'quarter' | 'year'; redeemedAt: string | null; redeemedBy: string | null; createdAt?: string }
export type Order = {
  id: string
  providerId: string | null
  externalOrderId: string | null
  externalCustomerId: string | null
  externalOfferId: string | null
  externalOfferTitle: string
  userId: string | null
  skuId: string | null
  skuCode: string | null
  skuName: string | null
  status: string
  termMonths: number
  amount: string
  currency: string
  deliveryStatus: 'pending' | 'sending' | 'sent' | 'failed' | 'unknown' | 'not_requested'
  deliveryAttempts: number
  deliveryAttemptedAt: string | null
  deliveredAt: string | null
  deliveryLastError: string | null
  createdAt: string
  codes: OrderCode[]
  /** Present when the admin read model can correlate the PSP event with this order. */
  providerEvent?: ProviderEvent | null
}

export type Sku = { id: string; code: string; name: string; description: string; kind: 'plan' | 'credits'; planId: string | null; planName: string | null; credits: number | null; durationValue: number; durationUnit: 'day' | 'month' | 'quarter' | 'year'; active: boolean; createdAt: string; updatedAt: string }
export type AdminUser = { id: string; name: string; email: string; image: string | null; role: string; createdAt: string }
export type ActivityLog = { id: string; actorId: string | null; action: string; resourceType: string; resourceId: string | null; detail: string; createdAt: string }
export type Subscription = { id: string; userId: string | null; userName: string | null; planId: string; planName: string; skuId: string | null; skuCode: string | null; providerId: string | null; status: 'pending_activation' | 'trialing' | 'active' | 'past_due' | 'paused' | 'canceled' | 'expired'; currentPeriodStart: string | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; createdAt: string; updatedAt: string }
export type Payment = { id: string; orderId: string; providerId: string | null; externalPaymentId: string | null; status: string; amount: string; currency: string; paidAt: string | null; createdAt: string }
export type ServiceParameter = { name: string; location: 'query' | 'header' | 'path' | 'body'; dataType: 'string' | 'number' | 'boolean' | 'json'; required: boolean; description: string }
export type ServiceApi = { id: string; serviceId: string; code: string; name: string; description: string; path: string; method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; parameters: ServiceParameter[]; usageUnits: number; timeoutMs: number; enabled: boolean; createdAt: string; updatedAt: string }
export type Permission = { id: string; code: string; name: string; description: string; planIds: string[]; serviceCount: number; createdAt: string; updatedAt: string }
export type ApiService = { id: string; code: string; name: string; description: string; transport: 'http' | 'worker_binding'; bindingName: string | null; baseUrl: string; authType: 'none' | 'bearer' | 'header' | 'query' | 'basic'; authConfigured: boolean; authHeader?: string; authQuery?: string; authUsername?: string; requiredPermissionId: string | null; requiredPermissionCode: string | null; requiredPermissionName: string | null; enabled: boolean; createdAt: string; updatedAt: string; apis: ServiceApi[] }
export type WorkerServiceBinding = { binding: string; service: string; label: string }
export type CommerceDeadLetter = { id: string; queueName: string; messageId: string; payload: Record<string, unknown>; replayable: boolean; status: 'pending' | 'replaying' | 'replayed' | 'dismissed'; deliveryAttempts: number; failedAt: string; replayedAt: string | null; replayedBy: string | null; lastError: string | null; createdAt: string; updatedAt: string }
export type CommerceOperationsData = { deadLetters: CommerceDeadLetter[]; summary: { unknownDeliveries: number; failedOutbox: number; failedProviderEvents: number; pendingDeadLetters: number } }
export type GatewayUsageSummary = { requests: number; successes: number; rejected: number; upstreamErrors: number; activeUsers: number; chargedUnits: number; averageDurationMs: number; p95DurationMs: number }
export type GatewayUsageDaily = { date: string; requests: number; successes: number; chargedUnits: number; activeUsers: number }
export type GatewayUsageService = { serviceId: string; serviceCode: string; serviceName: string; requests: number; successes: number; chargedUnits: number; averageDurationMs: number }
export type GatewayUsageApi = { apiId: string; apiCode: string; apiName: string; serviceCode: string; requests: number; successes: number; chargedUnits: number; averageDurationMs: number }
export type GatewayUsageUser = { userId: string; userName: string; userEmail: string; requests: number; successes: number; chargedUnits: number; lastCalledAt: string }
export type GatewayUsageRecent = { id: string; userId: string; userName: string; serviceCode: string; apiCode: string; method: string; outcome: 'success' | 'rejected' | 'upstream_error'; responseStatus: number; upstreamStatus: number | null; configuredUsageUnits: number; chargedUsageUnits: number; durationMs: number; errorCode: string | null; createdAt: string }
export type GatewayUsageReport = { days: number; since: string; summary: GatewayUsageSummary; daily: GatewayUsageDaily[]; services: GatewayUsageService[]; apis: GatewayUsageApi[]; users: GatewayUsageUser[]; recent: GatewayUsageRecent[] }

export type AdminOverviewAttention = {
  kind: 'delivery_unknown' | 'provider_event_failed' | 'dead_letter' | 'outbox_failed'
  id: string
  title: string
  detail: string
  occurredAt: string
  href: string
}

export type AdminOverviewOrder = {
  id: string
  providerId: string | null
  externalOrderId: string | null
  externalOfferTitle: string
  amount: string
  currency: string
  status: string
  deliveryStatus: string
  createdAt: string
}

export type AdminOverviewData = {
  generatedAt: string
  traffic: { requests24h: number; successes24h: number; activeUsers24h: number; chargedUnits24h: number; p95DurationMs24h: number }
  customers: { total: number; new7d: number }
  commerce: { activeSubscriptions: number; expiring7d: number; orders24h: number; fulfilledOrders24h: number }
  catalog: { enabledServices: number; enabledApis: number }
  operations: { unknownDeliveries: number; failedProviderEvents: number; pendingDeadLetters: number; failedOutbox: number; totalAttention: number }
  attention: AdminOverviewAttention[]
  recentOrders: AdminOverviewOrder[]
}

export type AdminData = { plans: AdminPlan[]; codes: RedeemCode[]; afdianMappings: AfdianMapping[]; orders: Order[]; skus: Sku[]; users: AdminUser[]; logs: ActivityLog[]; subscriptions: Subscription[]; payments: Payment[]; providerEvents: ProviderEvent[]; services: ApiService[]; permissions: Permission[]; workerBindings: WorkerServiceBinding[]; afadianWebhookConfigured: boolean; afadianMessengerConfigured?: boolean }
