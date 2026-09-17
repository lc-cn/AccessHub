import nodemailer, { type Transporter } from 'nodemailer'
import { requireEmailConfig } from './config.ts'
import type { EmailMessage } from './index.ts'

let smtpTransport: Transporter | null = null

export async function sendWithConfiguredTransport(message: EmailMessage): Promise<void> {
  const config = requireEmailConfig()
  smtpTransport ??= nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
  })
  await smtpTransport.sendMail({
    from: config.from,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  })
}

export function resetConfiguredTransport(): void {
  smtpTransport = null
}
