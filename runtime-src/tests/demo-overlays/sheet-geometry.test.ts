import { describe, expect, it } from "vitest";
import { sheetMaxTop, sheetTop } from "../../demo-overlays/sheet-geometry";

// Numbers are the live lesson's, measured 2026-09-29 (spec M9/M10).
describe("sheetMaxTop", () => {
  it("keeps 45% of a portrait viewport for the sheet", () => {
    expect(sheetMaxTop(390, 844)).toBe(464);
  });

  it("keeps 60% of a landscape viewport for the sheet", () => {
    expect(sheetMaxTop(844, 390)).toBe(156);
  });

  it("treats a square viewport as portrait", () => {
    expect(sheetMaxTop(800, 800)).toBe(440);
  });
});

describe("sheetTop", () => {
  it("docks under the video on the measured iPhone page (M9)", () => {
    expect(
      sheetTop({
        playerTop: 315,
        playerBottom: 534,
        scrollY: 0,
        maxScroll: 106,
        vw: 390,
        vh: 844,
      }),
    ).toEqual({ top: 428, targetScroll: 106, room: 0 });
  });

  it("clamps to 60% in landscape, where the player is taller than the screen (M10)", () => {
    expect(
      sheetTop({
        playerTop: 405,
        playerBottom: 818,
        scrollY: 0,
        maxScroll: 400,
        vw: 844,
        vh: 390,
      }),
    ).toEqual({ top: 156, targetScroll: 400, room: 0 });
  });

  // 2026-09-30: the lesson lost its attachments and the page could scroll only
  // 24px. The video's bottom stayed at 510, and the 45% minimum put the sheet's
  // top at 464, so the sheet covered the video's bottom 46px — the timeline and
  // play control. M9's player position with that 24px of scroll reproduces it.
  it("asks for the scroll room a short page lacks to lift the video above the sheet", () => {
    // 534 − 464 = 70px of scroll clears the sheet; the page has 24, so 46 more.
    expect(
      sheetTop({
        playerTop: 315,
        playerBottom: 534,
        scrollY: 0,
        maxScroll: 24,
        vw: 390,
        vh: 844,
      }),
    ).toEqual({ top: 464, targetScroll: 70, room: 46 });
  });

  it("asks for no room when the video could not fit above the sheet anyway (landscape)", () => {
    // Clearing the 156px top would need 662px of scroll, past the player's own
    // top at 405: no amount of room makes this video fully visible.
    expect(
      sheetTop({
        playerTop: 405,
        playerBottom: 818,
        scrollY: 0,
        maxScroll: 100,
        vw: 844,
        vh: 390,
      }),
    ).toEqual({ top: 156, targetScroll: 100, room: 0 });
  });

  it("scrolls back up to a player that has scrolled out of view", () => {
    expect(
      sheetTop({
        playerTop: -300,
        playerBottom: -81,
        scrollY: 500,
        maxScroll: 1000,
        vw: 390,
        vh: 844,
      }),
    ).toEqual({ top: 219, targetScroll: 200, room: 0 });
  });

  it("docks at the current player bottom when the page cannot scroll", () => {
    expect(
      sheetTop({
        playerTop: 100,
        playerBottom: 319,
        scrollY: 0,
        maxScroll: 0,
        vw: 390,
        vh: 844,
      }),
    ).toEqual({ top: 319, targetScroll: 0, room: 0 });
    expect(
      sheetTop({
        playerTop: 100,
        playerBottom: 319,
        scrollY: 0,
        maxScroll: -50,
        vw: 390,
        vh: 844,
      }).targetScroll,
    ).toBe(0);
  });

  it("never places the top above the viewport", () => {
    expect(
      sheetTop({
        playerTop: -500,
        playerBottom: -281,
        scrollY: 0,
        maxScroll: 0,
        vw: 390,
        vh: 844,
      }).top,
    ).toBe(0);
  });
});
