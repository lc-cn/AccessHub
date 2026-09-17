import type {
  CommerceCommand,
  CommerceCommandError,
  CommerceCommandResult,
} from './contracts.ts'
import type { CommerceEnv } from './env.ts'

const COMMAND_URL = 'https://accesshub.internal/api/internal/commerce/commands'
const MAX_RESPONSE_BYTES = 64 * 1024

export class CommerceCommandFailure extends Error {
  readonly retryable: boolean
  readonly status: number

  constructor(
    message: string,
    retryable: boolean,
    status: number,
  ) {
    super(message)
    this.name = 'CommerceCommandFailure'
    this.retryable = retryable
    this.status = status
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readBoundedJson(response: Response): Promise<unknown> {
  if (!response.body) return null
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const result = await reader.read()
      if (result.done) break
      size += result.value.byteLength
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel('response exceeded size limit')
        throw new Error('internal command response exceeded size limit')
      }
      chunks.push(result.value)
    }
  } finally {
    reader.releaseLock()
  }

  if (size === 0) return null
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    throw new Error('internal command returned invalid JSON')
  }
}

function parseCommandResult(value: unknown): CommerceCommandResult | null {
  if (!isRecord(value) || value.ok !== true || typeof value.outcome !== 'string') return null
  return { ok: true, outcome: value.outcome }
}

function parseCommandError(value: unknown): CommerceCommandError | null {
  if (!isRecord(value) || typeof value.error !== 'string' || typeof value.retryable !== 'boolean') return null
  return { error: value.error, retryable: value.retryable }
}

export async function executeCommerceCommand(
  env: Pick<CommerceEnv, 'ACCESSHUB' | 'COMMERCE_INTERNAL_SECRET'>,
  command: CommerceCommand,
) {
  const response = await env.ACCESSHUB.fetch(new Request(COMMAND_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${env.COMMERCE_INTERNAL_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(command),
  }))
  const payload = await readBoundedJson(response)
  if (response.ok) {
    const result = parseCommandResult(payload)
    if (!result) throw new CommerceCommandFailure('internal command returned an invalid success payload', true, response.status)
    return result
  }

  const commandError = parseCommandError(payload)
  throw new CommerceCommandFailure(
    commandError?.error ?? `internal command failed with HTTP ${response.status}`,
    commandError?.retryable ?? response.status >= 500,
    response.status,
  )
}
