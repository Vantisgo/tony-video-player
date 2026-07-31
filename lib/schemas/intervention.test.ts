import assert from "node:assert/strict"
import test from "node:test"

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

test("endTimeSec is backward-compatible when missing or null", () => {
  assert.equal(InterventionSchema.safeParse(baseIntervention).success, true)
  assert.equal(
    InterventionSchema.safeParse({ ...baseIntervention, endTimeSec: null })
      .success,
    true
  )
})

test("endTimeSec cannot precede the intervention start time", () => {
  assert.equal(
    InterventionSchema.safeParse({ ...baseIntervention, endTimeSec: 9 })
      .success,
    false
  )
})
