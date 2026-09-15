import { createHash } from 'node:crypto'

export type AfdianMessageStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'unknown' | 'not_requested'

export function messageDeliveryAction(status: AfdianMessageStatus | undefined) {
  if (status === 'pending' || status === 'failed') return 'send' as const
  if (status === 'sent' || status === 'not_requested') return 'complete' as const
  if (status === 'sending') return 'mark_unknown' as const
  return 'hold' as const
}

export function afdianCheckoutUrl(planId: string) {
  const url = new URL('https://afdian.com/order/create')
  url.searchParams.set('plan_id', planId)
  url.searchParams.set('product_type', '0')
  url.searchParams.set('remark', '')
  url.searchParams.set('affiliate_code', '')
  return url.toString()
}

export function orderDurationMonths(value: unknown) {
  const months = Number(value)
  return Number.isInteger(months) && months > 0 ? months : null
}

export function signAfdianOpenApi(token: string, userId: string, paramsJson: string, timestamp: number) {
  return createHash('md5').update(`${token}params${paramsJson}ts${timestamp}user_id${userId}`).digest('hex')
}

export function buildRedemptionMessage({ codes, months, siteUrl }: { codes: string[]; months: number; siteUrl: string }) {
  const codeLines = codes.map((code) => `- ${code}`).join('\n')
  return `感谢你在爱发电支持 L2CL！\n\n本次订单兑换码：\n${codeLines}\n\n权益自成功核销之日起 ${months} 个月内有效。请登录 ${siteUrl.replace(/\/$/, '')}/redeem-codes 完成核销。每个兑换码仅可使用一次，请妥善保管。`
}

export function buildAfdianMessageRequest({ token, userId, recipient, content, timestamp = Math.floor(Date.now() / 1000) }: { token: string; userId: string; recipient: string; content: string; timestamp?: number }) {
  const params = JSON.stringify({ recipient, content })
  return { user_id: userId, params, ts: timestamp, sign: signAfdianOpenApi(token, userId, params, timestamp) }
}
