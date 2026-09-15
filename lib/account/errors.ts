export type AccountErrorCode =
  | 'fresh_session_required'
  | 'email_not_verified'
  | 'email_not_configured'
  | 'last_identity_cannot_be_removed'
  | 'rate_limit_exceeded'
  | 'verification_expired'
  | 'session_not_found'
  | 'unauthorized'

export class AccountError extends Error {
  public readonly code: AccountErrorCode
  public readonly status: number

  constructor(code: AccountErrorCode, message: string, status: number = 400) {
    super(message)
    this.name = 'AccountError'
    this.code = code
    this.status = status
  }
}
