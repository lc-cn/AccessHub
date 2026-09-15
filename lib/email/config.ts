export type SmtpConfig = {
  host: string
  port: number
  user: string | null
  pass: string | null
  from: string
  secure: boolean
}

export class EmailConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmailConfigurationError'
  }
}

let cachedConfig: SmtpConfig | null = null
let configChecked = false

export function getSmtpConfig(): SmtpConfig | null {
  if (configChecked) return cachedConfig

  const host = process.env.SMTP_HOST?.trim()
  const from = process.env.SMTP_FROM?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS
  const rawPort = process.env.SMTP_PORT?.trim() || '587'
  const rawSecure = process.env.SMTP_SECURE?.trim().toLowerCase()
  const hasAnySmtpSetting = [host, from, user, pass, process.env.SMTP_PORT, process.env.SMTP_SECURE]
    .some((value) => value !== undefined && value !== '')

  if (!hasAnySmtpSetting) {
    configChecked = true
    return null
  }
  if (!host || !from) {
    throw new EmailConfigurationError('SMTP 配置不完整：必须同时设置 SMTP_HOST 和 SMTP_FROM。')
  }
  if (Boolean(user) !== Boolean(pass)) {
    throw new EmailConfigurationError('SMTP 配置不完整：SMTP_USER 和 SMTP_PASS 必须同时设置或同时省略。')
  }

  const port = Number(rawPort)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new EmailConfigurationError('SMTP_PORT 必须是 1 到 65535 之间的整数。')
  }
  if (rawSecure && rawSecure !== 'true' && rawSecure !== 'false') {
    throw new EmailConfigurationError('SMTP_SECURE 只能设置为 true 或 false。')
  }

  cachedConfig = {
    host,
    port,
    user: user || null,
    pass: pass || null,
    from,
    secure: rawSecure === 'true',
  }
  configChecked = true
  return cachedConfig
}

export function requireEmailConfig(): SmtpConfig {
  const config = getSmtpConfig()
  if (!config) {
    throw new Error(
      '邮件服务未配置。请设置 SMTP_HOST 和 SMTP_FROM 环境变量。' +
      '账户验证、邮箱变更和密码重置功能需要邮件服务支持。'
    )
  }
  return config
}

export function isEmailAvailable(): boolean {
  return Boolean(getSmtpConfig())
}

export function resetEmailConfigCache(): void {
  cachedConfig = null
  configChecked = false
}
