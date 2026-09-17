export type LogLevel = 'info' | 'warn' | 'error'

export type LogFields = Record<string, string | number | boolean | null>

export function log(level: LogLevel, event: string, fields: LogFields = {}) {
  const entry = JSON.stringify({
    level,
    event,
    worker: 'accesshub-commerce',
    timestamp: new Date().toISOString(),
    ...fields,
  })
  if (level === 'error') console.error(entry)
  else if (level === 'warn') console.warn(entry)
  else console.info(entry)
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
