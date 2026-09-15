type SubscriptionPlan = { id: string; isDefault: boolean }
type Subscription = { userId: string; planId: string }

export function countEffectivePlanSubscribers({ plans, totalUsers, subscriptions }: { plans: SubscriptionPlan[]; totalUsers: number; subscriptions: Subscription[] }) {
  const counts = new Map(plans.map((plan) => [plan.id, 0]))
  const assignedUsers = new Set<string>()

  for (const subscription of subscriptions) {
    if (assignedUsers.has(subscription.userId) || !counts.has(subscription.planId)) continue
    assignedUsers.add(subscription.userId)
    counts.set(subscription.planId, (counts.get(subscription.planId) ?? 0) + 1)
  }

  const defaultPlan = plans.find((plan) => plan.isDefault)
  if (defaultPlan) counts.set(defaultPlan.id, (counts.get(defaultPlan.id) ?? 0) + Math.max(0, totalUsers - assignedUsers.size))
  return counts
}
