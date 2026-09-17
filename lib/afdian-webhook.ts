import { resolveAfdianWebhookOffer } from './afadian-benefits.ts'
import { orderDurationMonths } from './afdian-commerce.ts'

export type AfdianOrderPayload = Record<string, unknown>

export type ParsedAfdianWebhook =
  | { outcome: 'invalid'; message: string }
  | { outcome: 'ignored'; message: string }
  | { outcome: 'probe'; order: AfdianOrderPayload; outTradeNo: string }
  | { outcome: 'paid'; order: AfdianOrderPayload; outTradeNo: string; afdianUserId: string; months: number }

export function parseAfdianWebhook(raw: string): ParsedAfdianWebhook {
  let payload: { data?: { type?: string; order?: AfdianOrderPayload } }
  try {
    payload = JSON.parse(raw || '{}') as typeof payload
  } catch {
    return { outcome: 'invalid', message: 'invalid json' }
  }

  const order = payload.data?.order
  const outTradeNo = String(order?.out_trade_no || '').trim()
  if (payload.data?.type !== 'order' || !order || !outTradeNo) return { outcome: 'invalid', message: 'missing order' }
  if (Number(order.status) !== 2) return { outcome: 'ignored', message: 'ignored unpaid order' }

  const afdianPlanId = String(order.plan_id || '').trim()
  const probe = resolveAfdianWebhookOffer([], { outTradeNo, afdianPlanId, skuIds: [] })
  if (probe.outcome === 'probe') return { outcome: 'probe', order, outTradeNo }

  const afdianUserId = String(order.user_id || '').trim()
  const months = orderDurationMonths(order.month)
  if (!afdianUserId) return { outcome: 'invalid', message: 'paid order has no user_id' }
  if (!months) return { outcome: 'invalid', message: 'paid order has invalid month' }
  return { outcome: 'paid', order, outTradeNo, afdianUserId, months }
}
