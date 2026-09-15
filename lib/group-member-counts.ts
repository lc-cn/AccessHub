type Group = { id: string; isDefault: boolean }
type Membership = { userId: string; groupId: string }

export function countEffectiveGroupMembers({ groups, totalUsers, memberships }: { groups: Group[]; totalUsers: number; memberships: Membership[] }) {
  const counts = new Map(groups.map((group) => [group.id, 0]))
  const assignedUsers = new Set<string>()

  for (const membership of memberships) {
    if (assignedUsers.has(membership.userId) || !counts.has(membership.groupId)) continue
    assignedUsers.add(membership.userId)
    counts.set(membership.groupId, (counts.get(membership.groupId) ?? 0) + 1)
  }

  const defaultGroup = groups.find((group) => group.isDefault)
  if (defaultGroup) counts.set(defaultGroup.id, (counts.get(defaultGroup.id) ?? 0) + Math.max(0, totalUsers - assignedUsers.size))
  return counts
}
