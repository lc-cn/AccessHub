import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { recordSecurityEvent, recordSecurityEventBestEffort, type ActivityRecorder } from './security-events.ts'

describe('recordSecurityEvent', () => {
  it('maps a security event to the account activity log', async () => {
    const recorded: Parameters<ActivityRecorder>[0][] = []
    await recordSecurityEvent({
      actorId: 'user-1',
      action: 'account.email.change_requested',
      resourceId: 'request-1',
      detail: 'new_email_domain:example.com',
    }, async (entry) => { recorded.push(entry) })

    assert.deepEqual(recorded, [{
      actorId: 'user-1',
      action: 'account.email.change_requested',
      resourceType: 'account',
      resourceId: 'request-1',
      detail: 'new_email_domain:example.com',
    }])
  })

  it('logs only the action when best-effort persistence fails', async () => {
    const messages: string[] = []
    await recordSecurityEventBestEffort(
      { actorId: 'user-1', action: 'account.password.reset_requested', detail: 'private detail' },
      async () => { throw new Error('database secret') },
      (message) => { messages.push(message) },
    )

    assert.deepEqual(messages, ['[account] Failed to record security event: account.password.reset_requested'])
  })
})
