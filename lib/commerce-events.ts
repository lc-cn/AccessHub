export const providerEventStatuses = ['received', 'queued', 'processing', 'workflow_started', 'processed', 'ignored', 'failed'] as const

export type ProviderEventStatus = (typeof providerEventStatuses)[number]

const providerEventTransitions: Readonly<Record<ProviderEventStatus, ReadonlySet<ProviderEventStatus>>> = {
  received: new Set(['queued', 'processing', 'ignored', 'failed']),
  queued: new Set(['processing', 'failed']),
  processing: new Set(['queued', 'workflow_started', 'processed', 'ignored', 'failed']),
  workflow_started: new Set(['processed', 'ignored', 'failed']),
  processed: new Set(),
  ignored: new Set(),
  failed: new Set(['queued', 'processing']),
}

export function canTransitionProviderEvent(from: ProviderEventStatus, to: ProviderEventStatus): boolean {
  return from === to || providerEventTransitions[from].has(to)
}

export function isTerminalProviderEventStatus(status: ProviderEventStatus): boolean {
  return status === 'processed' || status === 'ignored'
}

export type RetryBackoffOptions = {
  baseDelayMs?: number
  maxDelayMs?: number
}

export function retryDelayMs(attemptCount: number, options: RetryBackoffOptions = {}): number {
  if (!Number.isSafeInteger(attemptCount) || attemptCount < 1) {
    throw new RangeError('attemptCount must be a positive safe integer')
  }

  const baseDelayMs = options.baseDelayMs ?? 1_000
  const maxDelayMs = options.maxDelayMs ?? 15 * 60_000
  if (!Number.isSafeInteger(baseDelayMs) || baseDelayMs < 1) throw new RangeError('baseDelayMs must be a positive safe integer')
  if (!Number.isSafeInteger(maxDelayMs) || maxDelayMs < baseDelayMs) throw new RangeError('maxDelayMs must be a safe integer greater than or equal to baseDelayMs')

  return Math.min(maxDelayMs, baseDelayMs * 2 ** Math.min(attemptCount - 1, 52))
}

export function nextRetryAt(now: Date, attemptCount: number, options: RetryBackoffOptions = {}): Date {
  if (!Number.isFinite(now.getTime())) throw new RangeError('now must be a valid Date')
  return new Date(now.getTime() + retryDelayMs(attemptCount, options))
}

export function outboxDeduplicationKey(...parts: readonly string[]): string {
  if (parts.length === 0 || parts.some((part) => part.length === 0)) {
    throw new RangeError('deduplication key parts must be non-empty')
  }
  const encoder = new TextEncoder()
  return parts.map((part) => `${encoder.encode(part).byteLength}:${part}`).join('|')
}
