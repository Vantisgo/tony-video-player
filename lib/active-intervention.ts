interface TimedIntervention {
  id: string
  timestampSec: number
  endTimeSec?: number | null
}

function getActiveInterventionId(
  interventions: TimedIntervention[],
  currentTime: number
): string | null {
  let latestStartedIntervention: TimedIntervention | undefined

  for (const intervention of interventions) {
    const hasStarted = currentTime >= intervention.timestampSec
    const isLatest =
      !latestStartedIntervention ||
      intervention.timestampSec >= latestStartedIntervention.timestampSec

    if (hasStarted && isLatest) latestStartedIntervention = intervention
  }

  if (!latestStartedIntervention) return null

  const { endTimeSec } = latestStartedIntervention
  if (endTimeSec != null && currentTime >= endTimeSec) return null

  return latestStartedIntervention.id
}

export { getActiveInterventionId }
export type { TimedIntervention }
