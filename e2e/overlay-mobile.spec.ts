// The phone canary: do the demo overlays fit a phone-sized player on the real
// LearningSuite page?
//
// Runs only in the `canary-mobile` project (390×844, isMobile, hasTouch — see
// playwright.config.ts). It starts with what already holds today and declares
// the geometry later phases fix as `test.fixme`, naming the phase that flips it
// (spec docs/superpowers/specs/2026-09-29-mobile-overlays-sidebar-design.md,
// measurements M2–M6). Targets are read at MODULE SCOPE for the same reason as
// in overlay-canary.spec.ts: tests must exist before the module finishes.
import { expect, test } from "@playwright/test";

import {
  attachDiag,
  demoScriptRan,
  waitForReskinSettled,
} from "./support/assertions";
import { e2eEnv } from "./support/env";
import {
  demoMoments,
  expectInsidePlayer,
  expectNoOverlap,
  holdVoiceOver,
  injectQuiz,
  playerBox,
  QUIZ_FIXTURE,
  readBox,
  seekTo,
  tapHostPlay,
} from "./support/mobile";
import { contains } from "./support/geometry";
import { useRuntimeSource } from "./support/runtime-source";
import { parseTargetSpec, targetSpecKey } from "./support/target";
import { readTargetsFile } from "./support/targets-file";

const { videos, courseLabel } = readTargetsFile(
  targetSpecKey(parseTargetSpec(e2eEnv)),
);

// The runtime's published string — see DEMO_ACTIVE in support/assertions.ts.
const DEMO_ACTIVE = "demo overlay controller active";
const SLOTS = ["#vp-slot-tl", "#vp-slot-tr", "#vp-slot-br", "#vp-slot-lt"];
const SECTION_PILL = "#vp-slot-tl .vp-section-pill";
const SCIENCE_PILL = '#vp-slot-tr [data-overlay-action="science"]';
const META_PILL = '#vp-slot-br [data-overlay-action="meta"]';
const VOICE_OVER = "#vp-slot-lt .vp-audio-card";

for (const video of videos) {
  test.describe(`${courseLabel} · ${video.index}/${video.total} · ${video.title} · phone`, () => {
    test.beforeEach(async ({ page }, testInfo) => {
      // Before goto: init scripts only apply to the next navigation.
      await holdVoiceOver(page);
      const source = await useRuntimeSource(page);
      testInfo.annotations.push({
        type: "runtime",
        description:
          source.mode === "preview"
            ? `preview bundle: ${source.scriptUrl}`
            : "deployed bundle (LearningSuite's own script tag)",
      });
      await page.goto(video.url, { waitUntil: "domcontentloaded" });
      await waitForReskinSettled(page);
      test.skip(
        !(await demoScriptRan(page)),
        "demo-overlays.js never ran on this lesson (no demo config, or its gate did not pass)",
      );
    });

    test.afterEach(async ({ page }, testInfo) => {
      await attachDiag(page, testInfo);
    });

    test("demo-overlays mounts on a phone", async ({ page }) => {
      await page.waitForFunction(
        (active) =>
          (window as unknown as { __vpDemoStatus?: string }).__vpDemoStatus ===
          active,
        DEMO_ACTIVE,
        { timeout: 30_000 },
      );
      for (const slot of SLOTS)
        await expect(
          page.locator(slot),
          `Demo overlay slot ${slot} is missing on the phone viewport — the controller armed but never mounted.`,
        ).toHaveCount(1);
    });

    // Guards the project config itself: the compact CSS keys on hover/pointer,
    // and it is hasTouch — not isMobile — that flips them (verified, Chrome 154).
    test("the page is emulated as a touch phone", async ({ page }) => {
      const env = await page.evaluate(() => ({
        hover: matchMedia("(hover: hover)").matches,
        coarse: matchMedia("(pointer: coarse)").matches,
        width: innerWidth,
      }));
      expect(
        env,
        "canary-mobile must emulate a 390px touch phone (hasTouch: true)",
      ).toEqual({ hover: false, coarse: true, width: 390 });
    });

    test("the section and science pills sit inside the player", async ({
      page,
    }) => {
      const { science } = await demoMoments(page);
      test.skip(science === null, "this lesson's config has no science moment");
      await seekTo(page, science! + 1.5);
      await expect(page.locator(SCIENCE_PILL)).toHaveCount(1);
      await expectInsidePlayer(page, [SECTION_PILL, SCIENCE_PILL]);
    });

    test("an injected quiz break covers the player", async ({ page }) => {
      await injectQuiz(page, QUIZ_FIXTURE);
      const player = await playerBox(page);
      const slot = await readBox(page, "#vp-slot-quiz");
      expect(slot, "#vp-slot-quiz was not created").not.toBeNull();
      expect(
        contains(player, slot!) && contains(slot!, player),
        "the quiz slot must cover exactly the player (inset:0)",
      ).toBe(true);
    });

    // Fails today: the 320×168 voice-over card starts 7px above a 219px-tall
    // player and covers the section pill, and the science pill covers the
    // section pill (spec M3/M4). P4's compact overlays flip this to `test`.
    test.fixme("pills and the voice-over never overlap — spec M3/M4, fixed in P4", async ({
      page,
    }) => {
      const { audio } = await demoMoments(page);
      test.skip(audio === null, "this lesson's config has no voice-over cue");
      await seekTo(page, Math.max(0, audio! - 5));
      await tapHostPlay(page);
      await expect(page.locator(VOICE_OVER)).toHaveCount(1, {
        timeout: 20_000,
      });
      // Let the 350ms slide-in animation settle before measuring.
      await page.waitForTimeout(600);
      await expectInsidePlayer(page, [VOICE_OVER]);
      await expectNoOverlap(page, [
        SECTION_PILL,
        SCIENCE_PILL,
        META_PILL,
        VOICE_OVER,
      ]);
    });
  });
}
