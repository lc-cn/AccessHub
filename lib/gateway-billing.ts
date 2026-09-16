export function chargedUsageUnits(upstreamStatus: number, configuredUnits: number) {
  return upstreamStatus === 200 ? configuredUnits : 0
}
