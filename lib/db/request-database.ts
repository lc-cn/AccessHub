type ClosableConnection = {
  end(): Promise<void> | void
}

type RequestDatabaseRunnerOptions<Database, Connection extends ClosableConnection> = {
  resolveConnectionString(): string | null
  connect(connectionString: string): Promise<Connection>
  createDatabase(connection: Connection): Database
  fallback: Database
}

/**
 * Creates one database client per Worker request and reuses it for every query
 * performed by the callback. Hyperdrive owns the durable pool; this runner only
 * scopes the lightweight pg client and guarantees that it is closed.
 */
export function createRequestDatabaseRunner<Database, Connection extends ClosableConnection>(
  options: RequestDatabaseRunnerOptions<Database, Connection>,
) {
  return async function withRequestDatabase<Result>(
    operation: (database: Database) => Promise<Result>,
  ): Promise<Result> {
    const connectionString = options.resolveConnectionString()
    if (!connectionString) return operation(options.fallback)

    const connection = await options.connect(connectionString)
    try {
      return await operation(options.createDatabase(connection))
    } finally {
      await connection.end()
    }
  }
}
