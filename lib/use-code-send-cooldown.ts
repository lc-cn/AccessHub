'use client'

import { useCallback, useEffect, useState } from 'react'

const DEFAULT_COOLDOWN_SECONDS = 60
const STORAGE_PREFIX = 'accesshub.code-send-cooldown.'

function secondsUntil(endsAt: number) {
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
}

export function useCodeSendCooldown(key: string, durationSeconds = DEFAULT_COOLDOWN_SECONDS) {
  const storageKey = `${STORAGE_PREFIX}${key}`
  const [remainingSeconds, setRemainingSeconds] = useState(0)

  useEffect(() => {
    const storedEndsAt = Number(window.localStorage.getItem(storageKey))
    const update = () => {
      const remaining = Number.isFinite(storedEndsAt) ? secondsUntil(storedEndsAt) : 0
      setRemainingSeconds(remaining)
      if (remaining === 0) window.localStorage.removeItem(storageKey)
    }

    update()
    if (!Number.isFinite(storedEndsAt) || storedEndsAt <= Date.now()) return
    const timer = window.setInterval(update, 250)
    return () => window.clearInterval(timer)
  }, [storageKey])

  const startCooldown = useCallback(() => {
    const endsAt = Date.now() + durationSeconds * 1000
    window.localStorage.setItem(storageKey, String(endsAt))
    setRemainingSeconds(durationSeconds)
  }, [durationSeconds, storageKey])

  return { isCoolingDown: remainingSeconds > 0, remainingSeconds, startCooldown }
}
