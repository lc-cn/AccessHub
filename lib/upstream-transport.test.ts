import assert from 'node:assert/strict'
import test from 'node:test'
import { dispatchUpstreamRequest, UpstreamBindingUnavailableError, UpstreamTimeoutError } from './upstream-transport.ts'

test('fails closed when a Worker Binding is unavailable on Node', async () => {
  await assert.rejects(
    dispatchUpstreamRequest({
      transport: 'worker_binding',
      bindingName: 'IMAGE_API',
      url: new URL('https://image-api.internal/v1/generate'),
      method: 'POST',
      headers: new Headers({ 'content-type': 'application/json' }),
      body: JSON.stringify({ prompt: 'test' }),
      timeoutMs: 1000,
    }),
    (error: unknown) => error instanceof UpstreamBindingUnavailableError && error.message.includes('IMAGE_API'),
  )
})

test('bounds a Worker Binding request even when the binding never settles', async () => {
  const startedAt = Date.now()

  await assert.rejects(
    dispatchUpstreamRequest(
      {
        transport: 'worker_binding',
        bindingName: 'QSIGN',
        url: new URL('https://qsign.internal/testing'),
        method: 'GET',
        headers: new Headers(),
        timeoutMs: 20,
      },
      () => ({ fetch: async () => new Promise<Response>(() => undefined) }),
    ),
    (error: unknown) => error instanceof UpstreamTimeoutError && error.name === 'TimeoutError',
  )

  assert.ok(Date.now() - startedAt < 500, 'Worker Binding timeout should not wait for the unresolved request')
})
