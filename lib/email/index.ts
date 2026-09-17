import { sendWithConfiguredTransport, resetConfiguredTransport } from '#accesshub-email-transport'

export type EmailMessage = {
  to: string
  subject: string
  html: string
  text?: string
}

export type EmailSender = (msg: EmailMessage) => Promise<void>

let senderOverride: EmailSender | null = null
export function setEmailSender(sender: EmailSender | null): void {
  senderOverride = sender
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  if (senderOverride) {
    await senderOverride(msg)
    return
  }

  await sendWithConfiguredTransport(msg)
}

export function resetEmailSender(): void {
  senderOverride = null
  resetConfiguredTransport()
}

export { getSmtpConfig, isEmailAvailable, requireEmailConfig } from './config.ts'
export type { SmtpConfig } from './config.ts'
