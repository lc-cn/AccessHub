export function usagePeriodKeys(now = new Date()) {
  const today = dateKey(now)
  const week = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const weekday = week.getUTCDay() || 7
  week.setUTCDate(week.getUTCDate() - weekday + 1)
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return { today, weekStart: dateKey(week), monthStart: dateKey(month) }
}

export function retryAfterSeconds(period: 'minute' | 'day' | 'week' | 'month', now: Date, windowStartedAt?: Date) {
  if (period === 'minute' && windowStartedAt) return Math.max(1, Math.ceil((windowStartedAt.getTime() + 60_000 - now.getTime()) / 1000))
  const reset = new Date(now)
  if (period === 'day') reset.setUTCDate(reset.getUTCDate() + 1)
  if (period === 'week') reset.setUTCDate(reset.getUTCDate() + (8 - (reset.getUTCDay() || 7)))
  if (period === 'month') reset.setUTCMonth(reset.getUTCMonth() + 1, 1)
  reset.setUTCHours(0, 0, 0, 0)
  return Math.max(1, Math.ceil((reset.getTime() - now.getTime()) / 1000))
}

function dateKey(date: Date) { return date.toISOString().slice(0, 10) }
