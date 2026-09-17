type AllowanceOperation<T> = {
  commit: boolean
  read(): Promise<T>
  transaction(): Promise<T>
}

/**
 * A preflight check is advisory and must never contend on the write lock.
 * The post-upstream commit remains authoritative and rechecks allowance inside
 * the same transaction that records usage.
 */
export function runAllowanceOperation<T>(operation: AllowanceOperation<T>) {
  return operation.commit ? operation.transaction() : operation.read()
}
