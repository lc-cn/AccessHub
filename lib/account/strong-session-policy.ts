import { getFreshSessionMaxAgeSeconds } from './fresh-session.ts'

export function isRecentStrongAuthentication(strongAuthAt: Date | string | null, now = new Date()): boolean {
  if (!strongAuthAt) return false
  const verifiedAt = new Date(strongAuthAt).getTime()
  const currentTime = now.getTime()
  if (!Number.isFinite(verifiedAt) || !Number.isFinite(currentTime)) return false
  const age = currentTime - verifiedAt
  return age >= 0 && age < getFreshSessionMaxAgeSeconds() * 1000
}
