import assert from 'node:assert/strict'
import test from 'node:test'
import { hasPermission, parsePermissionInput } from './permissions.ts'

test('normalizes permission definitions and assigned plans', () => {
  assert.deepEqual(parsePermissionInput({ code: 'Service.QSign.Invoke', name: '调用 QQSign', planIds: ['pro', 'pro', '', 'plus'] }), {
    ok: true,
    value: { code: 'service.qsign.invoke', name: '调用 QQSign', description: '', planIds: ['pro', 'plus'] },
  })
  assert.equal(parsePermissionInput({ code: '1bad', name: 'Bad' }).ok, false)
})

test('allows public requirements and explicit grants while administrators bypass grants', () => {
  const userPermissions = { all: false, ids: new Set(['permission-a']) }
  assert.equal(hasPermission(userPermissions, null), true)
  assert.equal(hasPermission(userPermissions, 'permission-a'), true)
  assert.equal(hasPermission(userPermissions, 'permission-b'), false)
  assert.equal(hasPermission({ all: true, ids: new Set() }, 'permission-b'), true)
})
