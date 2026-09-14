import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveAfdianWebhookBenefit, type AfdianBenefitRule } from './afadian-benefits.ts'

const rules: AfdianBenefitRule[] = [{
  benefitKey: 'plan:real-plan',
  enabled: true,
  kind: 'credits',
  credits: 5_000,
  durationValue: -1,
  durationUnit: 'month',
  codesPerItem: 1,
}]

test('accepts the official Afdian webhook connectivity probe', () => {
  const result = resolveAfdianWebhookBenefit(rules, {
    outTradeNo: '202106232138371083454010626',
    planId: 'a45353328af911eb973052540025c377',
    skuIds: [
      '2172ea4e3a2311edbcaa52540025c377',
      '2172ea4e3a2311edbcaa52540025c378',
    ],
  })

  assert.deepEqual(result, { outcome: 'probe' })
})

test('keeps unknown real orders retryable', () => {
  const result = resolveAfdianWebhookBenefit(rules, {
    outTradeNo: 'real-order',
    planId: 'a45353328af911eb973052540025c377',
    skuIds: [],
  })

  assert.deepEqual(result, { outcome: 'unmapped' })
})

test('continues resolving configured mappings', () => {
  const result = resolveAfdianWebhookBenefit(rules, {
    outTradeNo: 'real-order',
    planId: 'real-plan',
    skuIds: [],
  })

  assert.equal(result.outcome, 'mapped')
  if (result.outcome === 'mapped') assert.equal(result.resolved.key, 'plan:real-plan')
})
