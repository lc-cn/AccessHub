import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { normalizeDatabaseUrl } from '@/lib/database-url'
import * as schema from './schema'

export const pool = new Pool({ connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL) })
export const db = drizzle(pool, { schema })
