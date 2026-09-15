import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resetEmailConfigCache } from './config.ts'
import { resetEmailSender, sendEmail, setEmailSender, type EmailMessage } from './index.ts'

const message: EmailMessage = {
  to: 'user@example.com',
  subject: 'Test message',
  html: '<p>Test message</p>',
  text: 'Test message',
}

describe('sendEmail', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
    resetEmailConfigCache()
    resetEmailSender()
  })

  it('uses an injected sender in tests', async () => {
    const delivered: EmailMessage[] = []
    setEmailSender(async (candidate) => { delivered.push(candidate) })

    await sendEmail(message)

    assert.deepEqual(delivered, [message])
  })

  it('propagates delivery failures to the auth caller', async () => {
    setEmailSender(async () => { throw new Error('provider unavailable') })

    await assert.rejects(() => sendEmail(message), /provider unavailable/)
  })

  it('fails clearly when neither SMTP nor an injected sender is configured', async () => {
    for (const key of ['SMTP_HOST', 'SMTP_FROM', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_SECURE']) {
      delete process.env[key]
    }
    resetEmailConfigCache()

    await assert.rejects(() => sendEmail(message), /邮件服务未配置/)
  })
})
