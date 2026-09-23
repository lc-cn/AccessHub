import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { and, asc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { withRequestDatabase } from '@/lib/db'
import { apiServices, serviceApis } from '@/lib/db/schema'
import { hasPermission, resolveUserPermissions } from '@/lib/permissions'
import { readModelKeys, readThroughJson } from '@/lib/read-model-cache'

type ServiceCatalogRow = {
  serviceCode: string
  serviceName: string
  serviceDescription: string
  serviceIntroduce: string
  requiredPermissionId: string | null
  apiCode: string
  apiName: string
  apiDescription: string
  apiAccept: string
  apiRequestBodyExample: string
  method: string
  methods: string[]
  parameters: unknown[]
  usageUnits: number
}

function isServiceCatalog(value: unknown): value is ServiceCatalogRow[] {
  return Array.isArray(value) && value.every((row) => {
    if (!row || typeof row !== 'object') return false
    const item = row as Record<string, unknown>
    return typeof item.serviceCode === 'string'
      && typeof item.serviceName === 'string'
      && typeof item.serviceDescription === 'string'
      && typeof item.serviceIntroduce === 'string'
      && (item.requiredPermissionId === null || typeof item.requiredPermissionId === 'string')
      && typeof item.apiCode === 'string'
      && typeof item.apiName === 'string'
      && typeof item.apiDescription === 'string'
      && typeof item.apiAccept === 'string'
      && typeof item.apiRequestBodyExample === 'string'
      && typeof item.method === 'string'
      && Array.isArray(item.methods) && item.methods.length > 0 && item.methods.every((method) => typeof method === 'string')
      && Array.isArray(item.parameters)
      && typeof item.usageUnits === 'number'
  })
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const [permissionSet, candidates] = await Promise.all([
    withRequestDatabase((database) => resolveUserPermissions(database, session.user.id)),
    readThroughJson({
      key: readModelKeys.serviceCatalog,
      validate: isServiceCatalog,
      load: () => withRequestDatabase((database) => database.select({
        serviceCode: apiServices.code, serviceName: apiServices.name, serviceDescription: apiServices.description, serviceIntroduce: apiServices.introduce,
        requiredPermissionId: apiServices.requiredPermissionId,
        apiCode: serviceApis.code, apiName: serviceApis.name, apiDescription: serviceApis.description, apiAccept: serviceApis.accept, apiRequestBodyExample: serviceApis.requestBodyExample,
        method: serviceApis.method, methods: serviceApis.methods, parameters: serviceApis.parameters, usageUnits: serviceApis.usageUnits,
      }).from(apiServices).innerJoin(serviceApis, eq(serviceApis.serviceId, apiServices.id))
        .where(and(eq(apiServices.enabled, true), eq(serviceApis.enabled, true)))
        .orderBy(asc(apiServices.name), asc(serviceApis.name))),
    }),
  ])
  const rows = candidates.filter((row) => hasPermission(permissionSet, row.requiredPermissionId))
  const services = Array.from(new Set(rows.map((row) => row.serviceCode))).map((code) => {
    const matching = rows.filter((row) => row.serviceCode === code)
    return { code, name: matching[0]?.serviceName, description: matching[0]?.serviceDescription, introduce: matching[0]?.serviceIntroduce, apis: matching.map((row) => ({ code: row.apiCode, name: row.apiName, description: row.apiDescription, accept: row.apiAccept, requestBodyExample: row.apiRequestBodyExample, method: row.method, methods: row.methods, path: `/api/gateway/${code}/${row.apiCode}`, parameters: row.parameters, usageUnits: row.usageUnits })) }
  })
  return NextResponse.json({ services })
}
