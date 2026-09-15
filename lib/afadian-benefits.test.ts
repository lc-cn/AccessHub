import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveAfdianWebhookOffer, type AfdianOfferMapping } from './afadian-benefits.ts'

const mappings: AfdianOfferMapping[] = [{
  offerKey: 'afdian-plan:real-plan',
  enabled: true,
  kind: 'credits',
  credits: 5_000,
  durationValue: -1,
  durationUnit: 'month',
  codesPerItem: 1,
}]

test('accepts the official Afdian webhook connectivity probe', () => {
  const result = resolveAfdianWebhookOffer(mappings, {
    outTradeNo: '202106232138371083454010626',
    afdianPlanId: 'a45353328af911eb973052540025c377',
    skuIds: [
      '2172ea4e3a2311edbcaa52540025c377',
      '2172ea4e3a2311edbcaa52540025c378',
    ],
  })

  assert.deepEqual(result, { outcome: 'probe' })
})

test('keeps unknown real orders retryable', () => {
  const result = resolveAfdianWebhookOffer(mappings, {
    outTradeNo: 'real-order',
    afdianPlanId: 'a45353328af911eb973052540025c377',
    skuIds: [],
  })

  assert.deepEqual(result, { outcome: 'unmapped' })
})

test('continues resolving configured mappings', () => {
  const result = resolveAfdianWebhookOffer(mappings, {
    outTradeNo: 'real-order',
    afdianPlanId: 'real-plan',
    skuIds: [],
  })

  assert.equal(result.outcome, 'mapped')
  if (result.outcome === 'mapped') assert.equal(result.resolved.key, 'afdian-plan:real-plan')
})
