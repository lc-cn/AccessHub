import { requireEmailConfig, type SmtpConfig } from './config.ts'
import type { EmailMessage } from './index.ts'

const MAILJET_SEND_URL = 'https://api.mailjet.com/v3.1/send'

type MailjetAddress = { Email: string; Name?: string }
type MailjetResponse = {
  ErrorMessage?: string
  Messages?: Array<{
    Status?: string
    Errors?: Array<{ ErrorMessage?: string; ErrorCode?: string }>
  }>
}

export function parseMailAddress(value: string): MailjetAddress {
  const formatted = value.match(/^\s*"?([^"<]*)"?\s*<([^<>]+)>\s*$/)
  if (formatted) {
    const name = formatted[1].trim()
    return { Email: formatted[2].trim(), ...(name ? { Name: name } : {}) }
  }
  return { Email: value.trim() }
}

export function buildMailjetPayload(message: EmailMessage, config: SmtpConfig) {
  return {
    Messages: [{
      From: parseMailAddress(config.from),
      To: [parseMailAddress(message.to)],
      Subject: message.subject,
      TextPart: message.text,
      HTMLPart: message.html,
    }],
  }
}

export async function sendViaMailjet(
  message: EmailMessage,
  config: SmtpConfig,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  if (!config.user || !config.pass) throw new Error('Mailjet API 发送需要 SMTP_USER 和 SMTP_PASS。')
  const response = await fetcher(MAILJET_SEND_URL, {
    method: 'POST',
    headers: {
      authorization: `Basic ${btoa(`${config.user}:${config.pass}`)}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(buildMailjetPayload(message, config)),
  })
  const result = await response.json().catch(() => null) as MailjetResponse | null
  const failed = result?.Messages?.find((item) => item.Status !== 'success')
  if (!response.ok || !result?.Messages?.length || failed) {
    const detail = failed?.Errors?.[0]
    const reason = detail?.ErrorMessage || detail?.ErrorCode || result?.ErrorMessage || `HTTP ${response.status}`
    throw new Error(`Mailjet 邮件发送失败：${reason}`)
  }
}

export async function sendWithConfiguredTransport(message: EmailMessage): Promise<void> {
  const config = requireEmailConfig()
  if (!/(^|\.)mailjet\.com$/i.test(config.host)) {
    throw new Error('Cloudflare 邮件传输当前要求 SMTP_HOST 使用 Mailjet。')
  }
  await sendViaMailjet(message, config)
}

export function resetConfiguredTransport(): void {}
