import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeDatabaseUrl } from './database-url.ts'

test('upgrades ambiguous SSL modes to verify-full', () => {
  assert.equal(
    normalizeDatabaseUrl('postgresql://user:secret@example.com/db?sslmode=require&channel_binding=require'),
    'postgresql://user:secret@example.com/db?sslmode=verify-full&channel_binding=require',
  )
  assert.equal(
    normalizeDatabaseUrl('postgresql://user:secret@example.com/db?pool=true&sslmode=verify-ca'),
    'postgresql://user:secret@example.com/db?pool=true&sslmode=verify-full',
  )
})

test('preserves explicit and local connection modes', () => {
  assert.equal(
    normalizeDatabaseUrl('postgresql://user:secret@example.com/db?sslmode=verify-full'),
    'postgresql://user:secret@example.com/db?sslmode=verify-full',
  )
  assert.equal(
    normalizeDatabaseUrl('postgresql://localhost/db?sslmode=disable'),
    'postgresql://localhost/db?sslmode=disable',
  )
  assert.equal(
    normalizeDatabaseUrl('postgresql://localhost/db'),
    'postgresql://localhost/db',
  )
})

test('fails clearly when DATABASE_URL is missing', () => {
  assert.throws(() => normalizeDatabaseUrl(undefined), /DATABASE_URL is not configured/)
})
