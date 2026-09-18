import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { resetEmailSender, setEmailSender, type EmailMessage } from './index.ts'
import { sendSecurityCode } from './security-code.ts'

afterEach(() => resetEmailSender())

test('a sign-in OTP uses identity verification copy that is also accurate for reauthentication', async () => {
  const delivered: EmailMessage[] = []
  setEmailSender(async (message) => { delivered.push(message) })

  await sendSecurityCode('user@example.com', '123456', 'sign-in')

  assert.equal(delivered.length, 1)
  assert.equal(delivered[0]?.subject, 'AccessHub - 身份验证码')
  assert.match(delivered[0]?.text ?? '', /^确认您的身份/)
  assert.doesNotMatch(delivered[0]?.text ?? '', /登录/)
})
