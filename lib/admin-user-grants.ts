export type AdminUserGrantInput =
  | { kind: 'plan'; planId: string; durationDays: number; reason: string }
  | { kind: 'credits'; credits: number; durationDays: number; reason: string }

export function parseAdminUserGrantInput(input: Record<string, unknown>): { ok: true; value: AdminUserGrantInput } | { ok: false; error: string } {
  const reason = String(input.reason || '').trim()
  const durationDays = Number(input.durationDays)
  if (reason.length < 4 || reason.length > 240) return { ok: false, error: '请填写 4–240 字的补发原因' }
  if (!Number.isInteger(durationDays) || (durationDays !== -1 && (durationDays < 1 || durationDays > 3650))) return { ok: false, error: '有效期需为 1–3650 天，或 -1 表示永久' }
  if (input.kind === 'plan') {
    const planId = String(input.planId || '').trim()
    if (!planId) return { ok: false, error: '请选择订阅计划' }
    return { ok: true, value: { kind: 'plan', planId, durationDays, reason } }
  }
  if (input.kind === 'credits') {
    const credits = Number(input.credits)
    if (!Number.isInteger(credits) || credits < 1 || credits > 10_000_000) return { ok: false, error: 'Credits 数量需为 1–10,000,000' }
    return { ok: true, value: { kind: 'credits', credits, durationDays, reason } }
  }
  return { ok: false, error: '权益类型无效' }
}
