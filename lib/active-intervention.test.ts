import { describe, expect, it } from "vitest"

import { getActiveInterventionId } from "./active-intervention"

describe("getActiveInterventionId", () => {
  it("an intervention is active within its bounded time frame", () => {
    const interventions = [{ id: "bounded", timestampSec: 10, endTimeSec: 20 }]

    expect(getActiveInterventionId(interventions, 9.99)).toBeNull()
    expect(getActiveInterventionId(interventions, 10)).toBe("bounded")
    expect(getActiveInterventionId(interventions, 19.99)).toBe("bounded")
    expect(getActiveInterventionId(interventions, 20)).toBeNull()
  })

  it("missing and null end times preserve open-ended legacy behavior", () => {
    expect(
      getActiveInterventionId([{ id: "missing", timestampSec: 10 }], 100)
    ).toBe("missing")
    expect(
      getActiveInterventionId(
        [{ id: "null", timestampSec: 10, endTimeSec: null }],
        100
      )
    ).toBe("null")
  })

  it("a completed latest intervention does not reactivate an older one", () => {
    const interventions = [
      { id: "older", timestampSec: 10 },
      { id: "latest", timestampSec: 20, endTimeSec: 30 },
    ]

    expect(getActiveInterventionId(interventions, 25)).toBe("latest")
    expect(getActiveInterventionId(interventions, 30)).toBeNull()
  })

  it("returns null when nothing has started yet", () => {
    expect(getActiveInterventionId([{ id: "a", timestampSec: 10 }], 0)).toBeNull()
    expect(getActiveInterventionId([], 100)).toBeNull()
  })

  it("treats an end time equal to the start as never active", () => {
    expect(
      getActiveInterventionId(
        [{ id: "zero", timestampSec: 10, endTimeSec: 10 }],
        10
      )
    ).toBeNull()
  })
})
