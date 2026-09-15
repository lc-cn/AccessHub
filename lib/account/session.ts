import { auth } from '@/lib/auth.ts'
import { headers } from 'next/headers'
import { AccountError } from './errors.ts'

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

export async function requireSession() {
  const session = await getSession()
  if (!session?.user) {
    throw new AccountError('unauthorized', '请先登录。', 401)
  }
  return session
}
