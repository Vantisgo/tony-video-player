// The shape of `window.player._diag()`, and how to render it in a failure.
//
// Pure by design — environment in, verdict out, no `@playwright/test` import —
// for the same reason `target.ts` is: so the rules can be unit-tested without a
// browser. `assertions.ts` cannot be, because it value-imports Playwright.
import { z } from "zod";

// A number that may legitimately be NaN.
//
// `HTMLMediaElement.duration` IS NaN until metadata loads, and `currentTime` is
// NaN with no media at all — that is the DOM's own way of saying "unknown", not
// a malformed payload. Playwright's protocol transports NaN faithfully where
// JSON would flatten it to null, and `z.number()` rejects NaN, so the plain
// `z.number()` this replaces classified an ordinary not-yet-loaded player as an
// "unexpected shape".
//
// That mattered twice over: it failed the run for the wrong reason, and it did
// so *before* the readyState diagnostic in `expectPlaybackAdvances` — the one
// that actually explains a stalled media element — could ever run. Shape
// validation must not double as a readiness check; readiness is asserted
// separately, and on purpose.
const maybeNaN = () => z.number().or(z.nan()).nullable().optional();

export const diagSchema = z.object({
  hasVideo: z.boolean(),
  discovery: z.string(),
  paused: z.boolean().nullable().optional(),
  currentTime: maybeNaN(),
  duration: maybeNaN(),
  readyState: maybeNaN(),
});

export type Diag = z.infer<typeof diagSchema>;

// Render a diag payload for a human reading a red build.
//
// NOT `JSON.stringify`: it renders NaN and ±Infinity as `null`, which is a
// value this schema *accepts*. A NaN duration therefore printed as
// `"duration":null` and the failure message contradicted itself — it pointed
// the reader at a payload that parses cleanly. Non-finite numbers are spelled
// out instead.
export function describeDiag(value: unknown): string {
  return JSON.stringify(value, (_key, val) =>
    typeof val === "number" && !Number.isFinite(val) ? `<${String(val)}>` : val,
  );
}
