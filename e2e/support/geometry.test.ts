import { describe, expect, it } from "vitest";
import {
  contains,
  formatBox,
  intersectionArea,
  overlappingPairs,
  type Box,
} from "./geometry";

// Fixtures are the boxes measured on the live lesson at 390×844 on 2026-09-29
// (spec M2–M4), so these cases pin the exact defects the mobile canary exists
// to catch.
const player: Box = { x: 0, y: 315, w: 390, h: 219 };
const sectionPill: Box = { x: 14, y: 329, w: 161, h: 54 };
const sciencePill: Box = { x: 71, y: 325, w: 309, h: 35 };
const voiceOverCard: Box = { x: 56, y: 308, w: 320, h: 168 };

describe("intersectionArea", () => {
  it("measures the science pill covering the section pill (M3)", () => {
    // x overlap 71..175 = 104, y overlap 329..360 = 31
    expect(intersectionArea(sciencePill, sectionPill)).toBe(104 * 31);
  });

  it("is symmetric", () => {
    expect(intersectionArea(sectionPill, sciencePill)).toBe(
      intersectionArea(sciencePill, sectionPill),
    );
  });

  it("is 0 for boxes that only touch", () => {
    const left: Box = { x: 0, y: 0, w: 10, h: 10 };
    const right: Box = { x: 10, y: 0, w: 10, h: 10 };
    expect(intersectionArea(left, right)).toBe(0);
  });

  it("is 0 for disjoint boxes", () => {
    expect(
      intersectionArea(
        { x: 0, y: 0, w: 5, h: 5 },
        { x: 50, y: 50, w: 5, h: 5 },
      ),
    ).toBe(0);
  });
});

describe("contains", () => {
  it("rejects the voice-over card that starts 7px above the player (M4)", () => {
    expect(contains(player, voiceOverCard)).toBe(false);
  });

  it("accepts the pills that sit inside the player", () => {
    expect(contains(player, sectionPill)).toBe(true);
    expect(contains(player, sciencePill)).toBe(true);
  });

  it("tolerates sub-pixel rounding on the edges", () => {
    const nearlyFlush: Box = { x: -0.5, y: 315, w: 390.8, h: 219 };
    expect(contains(player, nearlyFlush)).toBe(true);
    expect(contains(player, nearlyFlush, 0)).toBe(false);
  });

  it("counts an empty slot inside when its origin is inside", () => {
    expect(contains(player, { x: 380, y: 325, w: 0, h: 0 })).toBe(true);
  });
});

describe("overlappingPairs", () => {
  it("names the overlapping pair with its area", () => {
    expect(
      overlappingPairs({ section: sectionPill, science: sciencePill }),
    ).toEqual([`section × science (${104 * 31} px²)`]);
  });

  it("skips overlays that are not on screen", () => {
    expect(
      overlappingPairs({ section: sectionPill, science: null, meta: null }),
    ).toEqual([]);
  });

  it("ignores zero-size boxes", () => {
    expect(
      overlappingPairs({
        section: sectionPill,
        empty: { x: 20, y: 330, w: 0, h: 0 },
      }),
    ).toEqual([]);
  });

  it("reports every overlapping pair once", () => {
    expect(
      overlappingPairs({
        section: sectionPill,
        science: sciencePill,
        voiceOver: voiceOverCard,
      }),
    ).toHaveLength(3);
  });
});

describe("formatBox", () => {
  it("renders a rounded box for failure messages", () => {
    expect(formatBox({ x: 0.4, y: 315.6, w: 390, h: 218.7 })).toBe(
      "0,316 390×219",
    );
  });
});
