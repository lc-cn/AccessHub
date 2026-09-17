import { sendEmail } from './index.ts'

export type SecurityCodePurpose = 'sign-in' | 'email-verification' | 'forget-password' | 'change-email' | 'mfa'

const purposeCopy: Record<SecurityCodePurpose, { subject: string; title: string }> = {
  'sign-in': { subject: 'AccessHub - 登录验证码', title: '登录 AccessHub' },
  'email-verification': { subject: 'AccessHub - 邮箱验证码', title: '验证您的邮箱' },
  'forget-password': { subject: 'AccessHub - 重置密码验证码', title: '重置账户密码' },
  'change-email': { subject: 'AccessHub - 邮箱变更验证码', title: '确认邮箱变更' },
  mfa: { subject: 'AccessHub - 安全验证码', title: '确认敏感操作' },
}

export async function sendSecurityCode(email: string, code: string, purpose: SecurityCodePurpose): Promise<void> {
  const copy = purposeCopy[purpose]
  await sendEmail({
    to: email,
    subject: copy.subject,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px"><h2 style="color:#172033">${copy.title}</h2><p style="color:#475569;line-height:1.6">请输入以下一次性验证码：</p><p style="margin:24px 0;font-size:32px;font-weight:700;letter-spacing:.2em;color:#172033">${code}</p><p style="color:#94a3b8;font-size:13px;line-height:1.6">验证码将在 10 分钟后失效。请勿将验证码转发给任何人；如果这不是您的操作，请忽略此邮件。</p></div>`,
    text: `${copy.title}\n\n验证码：${code}\n\n验证码将在 10 分钟后失效。请勿将验证码转发给任何人。`,
  })
}
