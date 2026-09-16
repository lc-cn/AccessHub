import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/account'
import { AccountError } from '@/lib/account/errors'
import { getDefaultApiKeyToken } from '@/lib/api-keys'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const current = await requireSession()
    const token = await getDefaultApiKeyToken(current.user.id)
    return NextResponse.json({ token }, { headers: { 'cache-control': 'no-store, private' } })
  } catch (error) {
    if (error instanceof AccountError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    console.error('[account] Failed to load the default API key')
    return NextResponse.json({ error: '读取默认 API Key 失败，请稍后重试。' }, { status: 500 })
  }
}
