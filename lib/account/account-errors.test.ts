import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AccountError } from './errors.ts'

describe('AccountError', () => {
  it('has correct name', () => {
    const error = new AccountError('unauthorized', '请先登录。')
    assert.equal(error.name, 'AccountError')
  })

  it('has correct code', () => {
    const error = new AccountError('fresh_session_required', '需要近期会话')
    assert.equal(error.code, 'fresh_session_required')
  })

  it('has correct message', () => {
    const error = new AccountError('email_not_verified', '邮箱未验证')
    assert.equal(error.message, '邮箱未验证')
  })

  it('has default status 400', () => {
    const error = new AccountError('rate_limit_exceeded', '请求过于频繁')
    assert.equal(error.status, 400)
  })

  it('accepts custom status', () => {
    const error = new AccountError('unauthorized', '未授权', 401)
    assert.equal(error.status, 401)
  })

  it('is instanceof Error', () => {
    const error = new AccountError('session_not_found', '会话不存在')
    assert.ok(error instanceof Error)
  })

  it('has all valid error codes', () => {
    const codes = [
      'fresh_session_required',
      'strong_authentication_required',
      'email_not_verified',
      'email_not_configured',
      'last_identity_cannot_be_removed',
      'rate_limit_exceeded',
      'verification_expired',
      'session_not_found',
      'unauthorized',
    ] as const
    for (const code of codes) {
      const error = new AccountError(code, 'test')
      assert.equal(error.code, code)
    }
  })
})
