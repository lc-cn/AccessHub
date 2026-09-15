import { sendEmail } from './index.ts'

export async function sendPasswordResetEmail(email: string, url: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: 'AccessHub - 重置密码',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #172033;">重置您的密码</h2>
        <p style="color: #475569; line-height: 1.6;">
          您请求了密码重置。请点击下方链接设置新密码：
        </p>
        <a href="${url}" style="display: inline-block; background: #3157d5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 16px 0;">
          重置密码
        </a>
        <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">
          如果您没有请求密码重置，请忽略此邮件。此链接将在 1 小时后过期。
        </p>
      </div>
    `,
    text: `重置您的密码\n\n您请求了密码重置。请访问以下链接设置新密码：\n${url}\n\n如果您没有请求密码重置，请忽略此邮件。此链接将在 1 小时后过期。`,
  })
}
