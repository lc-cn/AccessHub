export type PlanAction = 'included' | 'current' | 'downgrade' | 'upgrade'

export function planAction(plan: { id: string; rank: number; isDefault: boolean }, current: { planId: string; rank: number } | null | undefined): PlanAction {
  if (plan.isDefault) return 'included'
  if (plan.id === current?.planId) return 'current'
  return plan.rank < (current?.rank ?? 0) ? 'downgrade' : 'upgrade'
}
