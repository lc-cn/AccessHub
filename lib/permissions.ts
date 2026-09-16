import { and, eq, gt, isNull, lte, or } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from './db/schema.ts'
import { planEntitlements, planPermissionGrants, subscriptionPlans, user } from './db/schema.ts'

type Database = NodePgDatabase<typeof schema>

export type PermissionSet = { all: boolean; ids: Set<string> }

export function parsePermissionInput(body: Record<string, unknown>) {
  const code = String(body.code || '').trim().toLowerCase()
  const name = String(body.name || '').trim()
  const description = String(body.description || '').trim()
  const planIds = Array.isArray(body.planIds) ? [...new Set(body.planIds.map(String).map((item) => item.trim()).filter(Boolean))] : []
  if (!/^[a-z][a-z0-9._-]{2,127}$/.test(code)) return { ok: false, error: '权限编码需为 3–128 位小写字母、数字、点、横线或下划线，且以字母开头' } as const
  if (!name || name.length > 80) return { ok: false, error: '权限名称需为 1–80 个字符' } as const
  if (description.length > 500) return { ok: false, error: '权限说明不能超过 500 个字符' } as const
  return { ok: true, value: { code, name, description, planIds } } as const
}

export async function resolveUserPermissions(database: Database, userId: string): Promise<PermissionSet> {
  const [account] = await database.select({ role: user.role }).from(user).where(eq(user.id, userId)).limit(1)
  if (account?.role === 'admin') return { all: true, ids: new Set() }

  const now = new Date()
  const grants = await database.selectDistinct({ permissionId: planPermissionGrants.permissionId })
    .from(planPermissionGrants)
    .innerJoin(subscriptionPlans, eq(subscriptionPlans.id, planPermissionGrants.planId))
    .leftJoin(planEntitlements, and(
      eq(planEntitlements.planId, planPermissionGrants.planId),
      eq(planEntitlements.userId, userId),
      lte(planEntitlements.startsAt, now),
      or(isNull(planEntitlements.expiresAt), gt(planEntitlements.expiresAt, now)),
    ))
    .where(or(eq(subscriptionPlans.isDefault, true), eq(planEntitlements.userId, userId)))
  return { all: false, ids: new Set(grants.map((grant) => grant.permissionId)) }
}

export function hasPermission(permissionSet: PermissionSet, requiredPermissionId: string | null) {
  return requiredPermissionId == null || permissionSet.all || permissionSet.ids.has(requiredPermissionId)
}
