import { describe, expect, it } from "vitest"

import { InterventionSchema } from "./intervention"

const baseIntervention = {
  id: "intervention-1",
  title: "Intervention",
  timestampSec: 10,
  prompt: "Prompt",
  description: "Description",
  methodModelFramework: "Framework",
  function: "Function",
  scientificReferenceFields: [],
}

describe("InterventionSchema", () => {
  it("endTimeSec is backward-compatible when missing or null", () => {
    expect(InterventionSchema.safeParse(baseIntervention).success).toBe(true)
    expect(
      InterventionSchema.safeParse({ ...baseIntervention, endTimeSec: null })
        .success
    ).toBe(true)
  })

  it("accepts an end time at or after the start time", () => {
    expect(
      InterventionSchema.safeParse({ ...baseIntervention, endTimeSec: 10 })
        .success
    ).toBe(true)
    expect(
      InterventionSchema.safeParse({ ...baseIntervention, endTimeSec: 25 })
        .success
    ).toBe(true)
  })

  it("endTimeSec cannot precede the intervention start time", () => {
    const result = InterventionSchema.safeParse({
      ...baseIntervention,
      endTimeSec: 9,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues[0]
      expect(issue.path).toEqual(["endTimeSec"])
      expect(issue.message).toBe("End time must not be before start time")
    }
  })

  it("rejects a negative end time", () => {
    expect(
      InterventionSchema.safeParse({ ...baseIntervention, endTimeSec: -1 })
        .success
    ).toBe(false)
  })
})
