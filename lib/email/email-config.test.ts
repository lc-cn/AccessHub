import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { EmailConfigurationError, getSmtpConfig, requireEmailConfig, resetEmailConfigCache } from './config.ts'

describe('getSmtpConfig', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    resetEmailConfigCache()
    delete process.env.SMTP_HOST
    delete process.env.SMTP_PORT
    delete process.env.SMTP_USER
    delete process.env.SMTP_PASS
    delete process.env.SMTP_FROM
    delete process.env.SMTP_SECURE
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    resetEmailConfigCache()
  })

  it('rejects configuration without SMTP_HOST', () => {
    process.env.SMTP_FROM = 'test@example.com'
    assert.throws(() => getSmtpConfig(), EmailConfigurationError)
  })

  it('rejects configuration without SMTP_FROM', () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    assert.throws(() => getSmtpConfig(), EmailConfigurationError)
  })

  it('returns null when neither SMTP_HOST nor SMTP_FROM is set', () => {
    assert.equal(getSmtpConfig(), null)
  })

  it('returns config when both SMTP_HOST and SMTP_FROM are set', () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_FROM = 'noreply@example.com'
    const config = getSmtpConfig()
    assert.ok(config !== null)
    assert.equal(config.host, 'smtp.example.com')
    assert.equal(config.from, 'noreply@example.com')
    assert.equal(config.port, 587) // default
    assert.equal(config.secure, false) // default
    assert.equal(config.user, null) // default
    assert.equal(config.pass, null) // default
  })

  it('uses custom port from env', () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_FROM = 'noreply@example.com'
    process.env.SMTP_PORT = '465'
    const config = getSmtpConfig()
    assert.equal(config?.port, 465)
  })

  it('uses custom user and pass from env', () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_FROM = 'noreply@example.com'
    process.env.SMTP_USER = 'user'
    process.env.SMTP_PASS = 'pass'
    const config = getSmtpConfig()
    assert.equal(config?.user, 'user')
    assert.equal(config?.pass, 'pass')
  })

  it('uses secure from env', () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_FROM = 'noreply@example.com'
    process.env.SMTP_SECURE = 'true'
    const config = getSmtpConfig()
    assert.equal(config?.secure, true)
  })

  it('rejects a partial SMTP configuration', () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    assert.throws(() => getSmtpConfig(), EmailConfigurationError)
  })

  it('rejects credentials unless both values are present', () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_FROM = 'noreply@example.com'
    process.env.SMTP_USER = 'user'
    assert.throws(() => getSmtpConfig(), EmailConfigurationError)
  })

  it('rejects an invalid port', () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_FROM = 'noreply@example.com'
    process.env.SMTP_PORT = 'not-a-port'
    assert.throws(() => getSmtpConfig(), EmailConfigurationError)
  })

  it('rejects an invalid secure flag', () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_FROM = 'noreply@example.com'
    process.env.SMTP_SECURE = 'yes'
    assert.throws(() => getSmtpConfig(), EmailConfigurationError)
  })

  it('does not cache an invalid configuration', () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    assert.throws(() => getSmtpConfig(), EmailConfigurationError)

    process.env.SMTP_FROM = 'noreply@example.com'
    assert.equal(getSmtpConfig()?.from, 'noreply@example.com')
  })

  it('caches config after first call', () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_FROM = 'noreply@example.com'
    const config1 = getSmtpConfig()
    const config2 = getSmtpConfig()
    assert.strictEqual(config1, config2)
  })
})

describe('requireEmailConfig', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    resetEmailConfigCache()
    delete process.env.SMTP_HOST
    delete process.env.SMTP_FROM
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    resetEmailConfigCache()
  })

  it('throws when email config is missing', () => {
    assert.throws(
      () => requireEmailConfig(),
      (error: Error) => {
        assert.ok(error.message.includes('邮件服务未配置'))
        assert.ok(error.message.includes('SMTP_HOST'))
        assert.ok(error.message.includes('SMTP_FROM'))
        return true
      },
    )
  })

  it('returns config when email config is present', () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_FROM = 'noreply@example.com'
    const config = requireEmailConfig()
    assert.equal(config.host, 'smtp.example.com')
    assert.equal(config.from, 'noreply@example.com')
  })
})
