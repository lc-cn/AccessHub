import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))

test('API Key sensitive operations return to the canonical API Keys page', () => {
  const source = readFileSync(
    new URL('../components/account/api-key-manager.tsx', import.meta.url),
    'utf8',
  )
  const targets = [...source.matchAll(/\/reauthenticate\?next=([^'"`]+)/g)].map(
    ([, encodedTarget]) => decodeURIComponent(encodedTarget),
  )

  assert.deepEqual([...new Set(targets)], ['/api-keys'])
  for (const target of targets) {
    assert.ok(
      existsSync(`${projectRoot}app${target}/page.tsx`),
      `reauthentication target ${target} must have a matching page`,
    )
  }
})
