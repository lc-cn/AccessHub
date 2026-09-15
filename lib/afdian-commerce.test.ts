import assert from 'node:assert/strict'
import test from 'node:test'
import { afdianCheckoutUrl, buildAfdianMessageRequest, buildRedemptionMessage, messageDeliveryAction, orderDurationMonths, signAfdianOpenApi } from './afdian-commerce.ts'

test('builds the documented checkout URL for a mapped plan', () => {
  assert.equal(
    afdianCheckoutUrl('202f346ab02311f1b17f52540025c377'),
    'https://afdian.com/order/create?plan_id=202f346ab02311f1b17f52540025c377&product_type=0&remark=&affiliate_code=',
  )
})

test('uses the paid order month as the redeemable entitlement term', () => {
  assert.equal(orderDurationMonths(3), 3)
  assert.equal(orderDurationMonths('12'), 12)
  assert.equal(orderDurationMonths(0), null)
})

test('signs OpenAPI params using the documented canonical string', () => {
  assert.equal(signAfdianOpenApi('123', 'abc', '{"a":333}', 1624339905), 'a4acc28b81598b7e5d84ebdc3e91710c')
})

test('addresses the order user and includes the generated code in the private message', () => {
  const content = buildRedemptionMessage({ codes: ['AFD-AAA-BBB'], months: 3, siteUrl: 'https://www.l2cl.link' })
  const request = buildAfdianMessageRequest({ token: 'secret', userId: 'creator', recipient: 'buyer', content, timestamp: 100 })

  assert.deepEqual(JSON.parse(request.params), { recipient: 'buyer', content })
  assert.match(content, /AFD-AAA-BBB/)
  assert.match(content, /核销之日起 3 个月/)
  assert.match(content, /https:\/\/www\.l2cl\.link\/redeem-codes/)
})

test('never blindly resends a private message with an unknown outcome', () => {
  assert.equal(messageDeliveryAction('pending'), 'send')
  assert.equal(messageDeliveryAction('failed'), 'send')
  assert.equal(messageDeliveryAction('sent'), 'complete')
  assert.equal(messageDeliveryAction('sending'), 'mark_unknown')
  assert.equal(messageDeliveryAction('unknown'), 'hold')
})
