import { AccountError } from './errors.ts'

const DEFAULT_FRESH_SESSION_MAX_AGE_MS = 15 * 60 * 1000

export function getFreshSessionMaxAgeSeconds(): number {
  const rawValue = process.env.FRESH_SESSION_MAX_AGE_MINUTES?.trim() || '15'
  const minutes = Number(rawValue)
  if (!Number.isInteger(minutes) || minutes <= 0) {
    throw new Error('FRESH_SESSION_MAX_AGE_MINUTES 必须是大于 0 的整数。')
  }
  return minutes * 60
}

export function isFreshSession(session: { createdAt: Date | string }, now = new Date()): boolean {
  const createdAt = new Date(session.createdAt).getTime()
  const currentTime = now.getTime()
  if (!Number.isFinite(createdAt) || !Number.isFinite(currentTime)) return false

  const age = currentTime - createdAt
  const maxAge = process.env.FRESH_SESSION_MAX_AGE_MINUTES
    ? getFreshSessionMaxAgeSeconds() * 1000
    : DEFAULT_FRESH_SESSION_MAX_AGE_MS
  return age >= 0 && age < maxAge
}

export function requireFreshSession(session: { createdAt: Date | string }, now = new Date()): void {
  if (!isFreshSession(session, now)) {
    throw new AccountError('fresh_session_required', '此操作需要近期登录会话，请重新登录后再试。', 403)
  }
}
