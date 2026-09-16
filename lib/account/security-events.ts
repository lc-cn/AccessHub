export type SecurityAction =
  | 'account.password.created'
  | 'account.password.changed'
  | 'account.password.reset_requested'
  | 'account.password.reset_completed'
  | 'account.email.verification_sent'
  | 'account.email.verified'
  | 'account.email.change_requested'
  | 'account.email.changed'
  | 'account.session.revoked'
  | 'account.sessions.revoked_all'
  | 'account.identity.unlinked'
  | 'account.identity.linked'
  | 'account.api_key.created'
  | 'account.api_key.revoked'

export type SecurityEvent = {
  actorId: string
  action: SecurityAction
  resourceId?: string
  detail?: string
}

export type ActivityRecorder = (entry: {
  actorId?: string | null
  action: string
  resourceType: string
  resourceId?: string | null
  detail?: string
}) => Promise<void>

const defaultActivityRecorder: ActivityRecorder = async (entry) => {
  const { recordActivity } = await import('../activity-log.ts')
  await recordActivity(entry)
}

export async function recordSecurityEvent({
  actorId,
  action,
  resourceId,
  detail,
}: SecurityEvent, recorder: ActivityRecorder = defaultActivityRecorder): Promise<void> {
  await recorder({
    actorId,
    action,
    resourceType: 'account',
    resourceId: resourceId || null,
    detail: detail || '',
  })
}

export async function recordSecurityEventBestEffort(
  event: SecurityEvent,
  recorder: ActivityRecorder = defaultActivityRecorder,
  logError: (message: string) => void = console.error,
): Promise<void> {
  try {
    await recordSecurityEvent(event, recorder)
  } catch {
    logError(`[account] Failed to record security event: ${event.action}`)
  }
}
