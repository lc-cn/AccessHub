import { sendEmail } from './index.ts'

export async function sendVerificationEmail(email: string, url: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: 'AccessHub - 验证您的邮箱',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #172033;">验证您的邮箱地址</h2>
        <p style="color: #475569; line-height: 1.6;">
          请点击下方链接完成 AccessHub 账户的邮箱验证：
        </p>
        <a href="${url}" style="display: inline-block; background: #3157d5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 16px 0;">
          验证邮箱
        </a>
        <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">
          如果您没有请求验证邮箱，请忽略此邮件。此链接将在 1 小时后过期。
        </p>
      </div>
    `,
    text: `验证您的邮箱地址\n\n请访问以下链接完成 AccessHub 账户的邮箱验证：\n${url}\n\n如果您没有请求验证邮箱，请忽略此邮件。此链接将在 1 小时后过期。`,
  })
}

export async function sendEmailChangeVerification(email: string, url: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: 'AccessHub - 确认邮箱变更',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #172033;">确认邮箱变更</h2>
        <p style="color: #475569; line-height: 1.6;">
          有人请求更改您的 AccessHub 账户主邮箱。请点击下方链接确认您允许这次变更：
        </p>
        <a href="${url}" style="display: inline-block; background: #3157d5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 16px 0;">
          确认邮箱变更
        </a>
        <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">
          如果您没有请求邮箱变更，请忽略此邮件并立即检查账户安全。此链接将在 1 小时后过期。
        </p>
      </div>
    `,
    text: `确认邮箱变更\n\n有人请求更改您的 AccessHub 账户主邮箱。请访问以下链接确认您允许这次变更：\n${url}\n\n如果您没有请求邮箱变更，请忽略此邮件并立即检查账户安全。此链接将在 1 小时后过期。`,
  })
}
