interface TimedIntervention {
  id: string
  timestampSec: number
  endTimeSec?: number | null
}

/**
 * The intervention that is current at `currentTime`, or null.
 *
 * The latest intervention whose start has passed wins. An `endTimeSec` is
 * EXCLUSIVE: at exactly that time nothing is current, and a completed latest
 * intervention never hands control back to an earlier one. Without an end time
 * the previous open-ended behaviour is preserved.
 *
 * The injected runtime has its own copy of this rule in
 * runtime-src/common/interventions.ts (its config field is `t`/`end`, not
 * `timestampSec`/`endTimeSec`) — keep the two in step.
 */
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
