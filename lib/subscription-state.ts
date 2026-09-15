export const subscriptionStatuses = ['pending_activation', 'trialing', 'active', 'past_due', 'paused', 'canceled', 'expired'] as const
export type SubscriptionStatus = typeof subscriptionStatuses[number]

const transitions: Record<SubscriptionStatus, readonly SubscriptionStatus[]> = {
  pending_activation: ['trialing', 'active', 'canceled', 'expired'],
  trialing: ['active', 'past_due', 'paused', 'canceled', 'expired'],
  active: ['past_due', 'paused', 'canceled', 'expired'],
  past_due: ['active', 'paused', 'canceled', 'expired'],
  paused: ['active', 'canceled', 'expired'],
  canceled: [],
  expired: [],
}

export function canTransitionSubscription(from: SubscriptionStatus, to: SubscriptionStatus) {
  return from === to || transitions[from].includes(to)
}

export function assertSubscriptionTransition(from: SubscriptionStatus, to: SubscriptionStatus) {
  if (!canTransitionSubscription(from, to)) throw new Error(`invalid subscription transition: ${from} -> ${to}`)
}
