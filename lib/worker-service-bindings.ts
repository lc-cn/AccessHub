export type WorkerServiceBindingOption = {
  binding: string
  service: string
  label: string
}

/**
 * Public catalog of Worker services that AccessHub is allowed to route to.
 * Keep this list aligned with wrangler.jsonc `services` bindings.
 */
export const workerServiceBindings: readonly WorkerServiceBindingOption[] = [
  { binding: 'QQSIGN', service: 'qsign', label: 'QQSign' },
]

export function hasWorkerServiceBinding(binding: string | null) {
  return Boolean(binding && workerServiceBindings.some((item) => item.binding === binding))
}
