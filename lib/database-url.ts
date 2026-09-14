const LEGACY_SSL_MODE = /([?&]sslmode=)(prefer|require|verify-ca)(?=&|$)/i

export function normalizeDatabaseUrl(connectionString: string | undefined) {
  if (!connectionString) throw new Error('DATABASE_URL is not configured')
  return connectionString.replace(LEGACY_SSL_MODE, '$1verify-full')
}
