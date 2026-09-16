import assert from 'node:assert/strict'
import test from 'node:test'
import { dispatchUpstreamRequest, UpstreamBindingUnavailableError } from './upstream-transport.ts'

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
