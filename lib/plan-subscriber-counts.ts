type SubscriptionPlan = { id: string; isDefault: boolean }
type PlanEntitlement = { userId: string; planId: string }

export function countEffectivePlanSubscribers({ plans, totalUsers, entitlements }: { plans: SubscriptionPlan[]; totalUsers: number; entitlements: PlanEntitlement[] }) {
  const counts = new Map(plans.map((plan) => [plan.id, 0]))
  const assignedUsers = new Set<string>()

  for (const entitlement of entitlements) {
    if (assignedUsers.has(entitlement.userId) || !counts.has(entitlement.planId)) continue
    assignedUsers.add(entitlement.userId)
    counts.set(entitlement.planId, (counts.get(entitlement.planId) ?? 0) + 1)
  }

  const defaultPlan = plans.find((plan) => plan.isDefault)
  if (defaultPlan) counts.set(defaultPlan.id, (counts.get(defaultPlan.id) ?? 0) + Math.max(0, totalUsers - assignedUsers.size))
  return counts
}
