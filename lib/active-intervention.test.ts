import assert from "node:assert/strict"
import test from "node:test"

import { getActiveInterventionId } from "./active-intervention"

test("an intervention is active within its bounded time frame", () => {
  const interventions = [{ id: "bounded", timestampSec: 10, endTimeSec: 20 }]

  assert.equal(getActiveInterventionId(interventions, 9.99), null)
  assert.equal(getActiveInterventionId(interventions, 10), "bounded")
  assert.equal(getActiveInterventionId(interventions, 19.99), "bounded")
  assert.equal(getActiveInterventionId(interventions, 20), null)
})

test("missing and null end times preserve open-ended legacy behavior", () => {
  assert.equal(
    getActiveInterventionId([{ id: "missing", timestampSec: 10 }], 100),
    "missing"
  )
  assert.equal(
    getActiveInterventionId(
      [{ id: "null", timestampSec: 10, endTimeSec: null }],
      100
    ),
    "null"
  )
})

test("a completed latest intervention does not reactivate an older one", () => {
  const interventions = [
    { id: "older", timestampSec: 10 },
    { id: "latest", timestampSec: 20, endTimeSec: 30 },
  ]

  assert.equal(getActiveInterventionId(interventions, 25), "latest")
  assert.equal(getActiveInterventionId(interventions, 30), null)
})
