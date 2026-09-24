import { describe, expect, it } from "vitest";
import { describeDiag, diagSchema } from "./diag";

// `_diag()` crosses out of a page we do not control, so it is validated rather
// than asserted into a type. These cases pin what counts as a *shape* problem —
// which must not include a player that simply has not loated its media yet.
//
// Regression: CI run 33624995587 reported
//   window.player._diag() returned an unexpected shape: {… "duration":null …}
// for a payload the schema accepts. The real value was NaN, which
// JSON.stringify renders as null, so the message contradicted itself and hid
// the cause. Both halves are covered below.

const loaded = {
  hasVideo: true,
  discovery: "tag:hls-video",
  paused: true,
  currentTime: 0,
  duration: 5937,
  readyState: 4,
};

describe("diagSchema", () => {
  it("accepts a fully loaded player", () => {
    expect(diagSchema.safeParse(loaded).success).toBe(true);
  });

  it("accepts a player that has not loaded metadata yet", () => {
    // HTMLMediaElement.duration IS NaN until metadata arrives, and Playwright
    // transports NaN faithfully where JSON would flatten it to null. A
    // not-yet-loaded player is a readiness state, never a bad shape — treating
    // it as one pre-empts the readyState diagnostic that explains the real
    // problem.
    const notLoaded = { ...loaded, duration: NaN, readyState: 0 };
    const parsed = diagSchema.safeParse(notLoaded);
    expect(
      parsed.success,
      `rejected a not-yet-loaded player: ${JSON.stringify(parsed.error?.issues)}`,
    ).toBe(true);
  });

  it("accepts NaN currentTime, for a player with no media at all", () => {
    expect(diagSchema.safeParse({ ...loaded, currentTime: NaN }).success).toBe(
      true,
    );
  });

  it("still accepts null and absent optional fields", () => {
    expect(diagSchema.safeParse({ ...loaded, duration: null }).success).toBe(
      true,
    );
    expect(
      diagSchema.safeParse({ hasVideo: true, discovery: "tag:hls-video" })
        .success,
    ).toBe(true);
  });

  it("still rejects a genuinely wrong shape", () => {
    // The case the validation exists for: an old or broken bundle.
    expect(diagSchema.safeParse({ discovery: "tag:hls-video" }).success).toBe(
      false,
    );
    expect(diagSchema.safeParse({ ...loaded, hasVideo: "yes" }).success).toBe(
      false,
    );
    expect(diagSchema.safeParse({ ...loaded, duration: "5937" }).success).toBe(
      false,
    );
  });
});

describe("describeDiag", () => {
  it("renders NaN visibly instead of disguising it as null", () => {
    // The whole point: JSON.stringify({duration: NaN}) === '{"duration":null}',
    // and null is a value the schema ACCEPTS — so the old message pointed the
    // reader at a payload that parses.
    const rendered = describeDiag({ duration: NaN, readyState: 0 });
    expect(rendered).toContain("NaN");
    expect(rendered).not.toBe('{"duration":null,"readyState":0}');
  });

  it("renders infinities visibly too", () => {
    expect(describeDiag({ duration: Infinity })).toContain("Infinity");
    expect(describeDiag({ duration: -Infinity })).toContain("Infinity");
  });

  it("leaves ordinary values alone", () => {
    expect(describeDiag({ a: 1, b: "x", c: null, d: true })).toBe(
      '{"a":1,"b":"x","c":null,"d":true}',
    );
  });
});
