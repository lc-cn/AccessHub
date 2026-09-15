import nodemailer, { type Transporter } from 'nodemailer'
import { requireEmailConfig } from './config.ts'

export type EmailMessage = {
  to: string
  subject: string
  html: string
  text?: string
}

export type EmailSender = (msg: EmailMessage) => Promise<void>

let senderOverride: EmailSender | null = null
let smtpTransport: Transporter | null = null

export function setEmailSender(sender: EmailSender | null): void {
  senderOverride = sender
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  if (senderOverride) {
    await senderOverride(msg)
    return
  }

  const config = requireEmailConfig()
  smtpTransport ??= nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
  })

  await smtpTransport.sendMail({
    from: config.from,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  })
}

export function resetEmailSender(): void {
  senderOverride = null
  smtpTransport = null
}

export { getSmtpConfig, isEmailAvailable, requireEmailConfig } from './config.ts'
export type { SmtpConfig } from './config.ts'
