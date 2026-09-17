'use client'

import { useCallback, useEffect, useState } from 'react'

const DEFAULT_COOLDOWN_SECONDS = 60
const STORAGE_PREFIX = 'accesshub.code-send-cooldown.'

function secondsUntil(endsAt: number) {
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
}

export function useCodeSendCooldown(key: string, durationSeconds = DEFAULT_COOLDOWN_SECONDS) {
  const storageKey = `${STORAGE_PREFIX}${key}`
  const [endsAt, setEndsAt] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState(0)

  useEffect(() => {
    try {
      const storedEndsAt = Number(window.localStorage.getItem(storageKey))
      setEndsAt(Number.isFinite(storedEndsAt) && storedEndsAt > Date.now() ? storedEndsAt : 0)
    } catch {
      setEndsAt(0)
    }
  }, [storageKey])

  useEffect(() => {
    const update = () => {
      const remaining = secondsUntil(endsAt)
      setRemainingSeconds(remaining)
      if (remaining === 0) {
        try { window.localStorage.removeItem(storageKey) } catch { /* Storage is an optional persistence enhancement. */ }
      }
    }

    update()
    if (endsAt <= Date.now()) return
    const timer = window.setInterval(update, 250)
    return () => window.clearInterval(timer)
  }, [endsAt, storageKey])

  const startCooldown = useCallback(() => {
    const nextEndsAt = Date.now() + durationSeconds * 1000
    try { window.localStorage.setItem(storageKey, String(nextEndsAt)) } catch { /* The in-memory cooldown still applies. */ }
    setEndsAt(nextEndsAt)
    setRemainingSeconds(durationSeconds)
  }, [durationSeconds, storageKey])

  return { isCoolingDown: remainingSeconds > 0, remainingSeconds, startCooldown }
}
