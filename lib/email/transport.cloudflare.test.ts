import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMailjetPayload, parseMailAddress, sendViaMailjet } from './transport.cloudflare.ts'
import type { EmailMessage } from './index.ts'
import type { SmtpConfig } from './config.ts'

const config: SmtpConfig = {
  host: 'in-v3.mailjet.com',
  port: 465,
  secure: true,
  user: 'api-key',
  pass: 'secret-key',
  from: 'AccessHub <hello@l2cl.link>',
}
const message: EmailMessage = {
  to: 'user@example.com',
  subject: '测试邮件',
  text: '纯文本',
  html: '<p>HTML</p>',
}

test('builds a Mailjet v3.1 payload from the existing email configuration', () => {
  assert.deepEqual(parseMailAddress('AccessHub <hello@l2cl.link>'), { Email: 'hello@l2cl.link', Name: 'AccessHub' })
  assert.deepEqual(buildMailjetPayload(message, config), {
    Messages: [{
      From: { Email: 'hello@l2cl.link', Name: 'AccessHub' },
      To: [{ Email: 'user@example.com' }],
      Subject: '测试邮件',
      TextPart: '纯文本',
      HTMLPart: '<p>HTML</p>',
    }],
  })
})

test('accepts only a successful Mailjet message result', async () => {
  let authorization = ''
  const fetcher: typeof fetch = async (_input, init) => {
    authorization = new Headers(init?.headers).get('authorization') || ''
    return Response.json({ Messages: [{ Status: 'success' }] })
  }
  await sendViaMailjet(message, config, fetcher)
  assert.match(authorization, /^Basic /)

  await assert.rejects(
    () => sendViaMailjet(message, config, async () => Response.json({ Messages: [{ Status: 'error', Errors: [{ ErrorCode: 'send-0008' }] }] })),
    /send-0008/,
  )
})
