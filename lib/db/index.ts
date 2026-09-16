import { drizzle } from 'drizzle-orm/node-postgres'
import { Client, Pool, type PoolClient, type QueryResult } from 'pg'
import { normalizeDatabaseUrl } from '@/lib/database-url'
import { getHyperdriveConnectionString } from '#accesshub-platform-bindings'
import * as schema from './schema'

let nodePool: Pool | null = null

function getNodePool() {
  nodePool ??= new Pool({
    connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL),
    max: 5,
  })
  return nodePool
}

async function connectHyperdrive(connectionString: string) {
  const client = new Client({ connectionString: normalizeDatabaseUrl(connectionString) })
  await client.connect()
  return client
}

/**
 * Drizzle expects a Pool-like client at module initialization time, while
 * Workers only permits database connections inside a request. Hyperdrive
 * already owns the durable connection pool, so create a lightweight pg Client
 * for each operation instead of creating a pg Pool in module scope.
 */
class RequestScopedPool {
  async query(query: unknown, values?: unknown): Promise<QueryResult> {
    const connectionString = getHyperdriveConnectionString()
    if (!connectionString) return getNodePool().query(query as never, values as never)

    const client = await connectHyperdrive(connectionString)
    try {
      return await client.query(query as never, values as never)
    } finally {
      await client.end()
    }
  }

  async connect(): Promise<PoolClient> {
    const connectionString = getHyperdriveConnectionString()
    if (!connectionString) return getNodePool().connect()

    const client = await connectHyperdrive(connectionString) as Client & { release: () => void }
    client.release = () => { void client.end() }
    return client as unknown as PoolClient
  }
}

export const pool = new RequestScopedPool() as unknown as Pool
export const db = drizzle(pool, { schema })
