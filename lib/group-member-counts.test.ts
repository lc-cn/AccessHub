import assert from 'node:assert/strict'
import test from 'node:test'
import { countEffectiveGroupMembers } from './group-member-counts.ts'

test('counts users without an explicit membership in the default group', () => {
  const counts = countEffectiveGroupMembers({
    groups: [{ id: 'basic', isDefault: true }, { id: 'pro', isDefault: false }],
    totalUsers: 3,
    memberships: [{ userId: 'u2', groupId: 'pro' }],
  })

  assert.deepEqual(counts, new Map([['basic', 2], ['pro', 1]]))
})

test('counts only the selected effective membership for each user', () => {
  const counts = countEffectiveGroupMembers({
    groups: [{ id: 'basic', isDefault: true }, { id: 'plus', isDefault: false }],
    totalUsers: 2,
    memberships: [{ userId: 'u1', groupId: 'plus' }, { userId: 'u2', groupId: 'basic' }],
  })

  assert.deepEqual(counts, new Map([['basic', 1], ['plus', 1]]))
})
