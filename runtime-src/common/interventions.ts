import type { Intervention } from "./types";

// Runtime twin of lib/active-intervention.ts. The config field is `end` (runtime
// naming: `t`/`end`), the lesson model's is `endTimeSec`; they are separate
// authoring surfaces, so the names differ deliberately but the RULE is identical:
//
//   • the latest intervention whose start has passed wins
//   • `end` is EXCLUSIVE — at exactly `end` nothing is active
//   • a completed latest intervention never reactivates an earlier one
//
// The app helper is deliberately not imported: that would pull lib/ into the
// injected bundle. Keep the two in step (both have the same test cases).
//
// `end` arrives from untrusted config, so a non-numeric value behaves as absent
// rather than being trusted from the declared type.
const boundedEnd = (iv: Intervention): number | null =>
  typeof iv.end === "number" && Number.isFinite(iv.end) ? iv.end : null;

export function activeInterventionId(
  interventions: readonly Intervention[],
  t: number,
): string | null {
  let latest: Intervention | undefined;
  for (const iv of interventions) {
    if (t < iv.t) continue;
    if (!latest || iv.t >= latest.t) latest = iv;
  }
  if (!latest) return null;

  const end = boundedEnd(latest);
  if (end != null && t >= end) return null;
  return latest.id;
}

// True once an intervention has started, whether or not it has since ended — the
// section pill and accordion use this to render an ended intervention as
// COMPLETED rather than falling back to "upcoming".
export function hasInterventionStarted(iv: Intervention, t: number): boolean {
  return t >= iv.t;
}
