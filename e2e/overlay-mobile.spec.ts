// The phone canary: do the demo overlays fit a phone-sized player on the real
// LearningSuite page?
//
// Runs only in the `canary-mobile` project (390×844, isMobile, hasTouch — see
// playwright.config.ts). It starts with what already holds today and declares
// the geometry later phases fix as `test.fixme`, naming the phase that flips it (P4 flipped the last one)
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
  waitForDemoMount,
} from "./support/mobile";
import { contains } from "./support/geometry";
// Pure and dependency-free on purpose (see its header), so the expected sheet
// position is computed by the same rule the runtime uses.
import { sheetTop } from "../runtime-src/demo-overlays/sheet-geometry";
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
const TAB_BAR = "#vp-mobile-tabs";
const SHEET = "#vp-demo-sidebar";

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
      // Ran ≠ mounted: every test below measures mounted nodes.
      await waitForDemoMount(page);
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

    // P5 (replaces P2's "covers the player"): on a phone the whole question and
    // every answer must fit, so the quiz covers the viewport instead of the
    // 219px-tall player (spec M6: 350px of content in a 185px box).
    test("a quiz covers the whole phone screen and needs no scrolling", async ({
      page,
    }) => {
      await injectQuiz(page, QUIZ_FIXTURE);
      // Play first, then seek: see the voice-over test below.
      await tapHostPlay(page);
      await seekTo(page, QUIZ_FIXTURE.quizzes[0].t - 2);
      const card = page.locator("#vp-slot-quiz .vp-quiz-card");
      await expect(card).toHaveCount(1, { timeout: 20_000 });
      await page.waitForTimeout(400);

      const slot = await readBox(page, "#vp-slot-quiz");
      const viewport = { x: 0, y: 0, w: 390, h: 844 };
      expect(
        contains(viewport, slot!) && contains(slot!, viewport),
        `the promoted quiz slot must cover the viewport (${JSON.stringify(slot)})`,
      ).toBe(true);
      expect(
        await page.evaluate(
          () => !!document.elementFromPoint(195, 812)?.closest("#vp-slot-quiz"),
        ),
        "the quiz must cover LearningSuite's fixed bottom bar",
      ).toBe(true);
      expect(
        await card.evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
        "the question and every answer must fit without scrolling the card",
      ).toBe(true);
      const xs = await page
        .locator("#vp-slot-quiz .vp-quiz-option")
        .evaluateAll((els) =>
          els.map((el) => Math.round(el.getBoundingClientRect().left)),
        );
      expect(new Set(xs).size, "answers must be in one column").toBe(1);

      const first = page.locator("#vp-slot-quiz .vp-quiz-option").first();
      await first.tap();
      await expect(first).toHaveAttribute("data-state", "correct");
      // After the feedback the break resumes; the empty promoted slot must
      // then let taps through to the page again.
      await expect(page.locator("#vp-slot-quiz .vp-quiz-scrim")).toHaveCount(
        0,
        { timeout: 20_000 },
      );
      expect(
        await page.evaluate(
          () => !!document.elementFromPoint(195, 812)?.closest("#vp-slot-quiz"),
        ),
        "after the quiz nothing of ours may block the page",
      ).toBe(false);
    });

    // ── P3: the sheet host ──────────────────────────────────────────────────

    test("the tab bar sits directly under the player", async ({ page }) => {
      const player = await playerBox(page);
      const tabs = await readBox(page, TAB_BAR);
      expect(tabs, "#vp-mobile-tabs is missing on a phone").not.toBeNull();
      expect(
        Math.abs(tabs!.y - (player.y + player.h)),
        `the tab bar must start at the player's bottom edge (tabs y=${tabs!.y}, player bottom=${player.y + player.h})`,
      ).toBeLessThanOrEqual(1);
    });

    test("each tab opens the sheet docked at the player's bottom", async ({
      page,
    }) => {
      const keys = await page
        .locator(`${TAB_BAR} [data-sheet-tab]`)
        .evaluateAll((els) =>
          els.map((el) => (el as HTMLElement).dataset.sheetTab ?? ""),
        );
      expect(keys.length, "the tab bar has no tabs").toBeGreaterThan(0);

      for (const key of keys) {
        // Same starting point for every tab, so the expectation is exact.
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(300);
        const input = await page.evaluate(() => {
          const r = document
            .getElementById("vp-slot-tl")!
            .parentElement!.getBoundingClientRect();
          const se = document.scrollingElement ?? document.documentElement;
          return {
            playerTop: r.top,
            playerBottom: r.bottom,
            scrollY: window.scrollY,
            maxScroll: se.scrollHeight - window.innerHeight,
            vw: window.innerWidth,
            vh: window.innerHeight,
          };
        });
        const expected = sheetTop(input);

        await page.locator(`${TAB_BAR} [data-sheet-tab="${key}"]`).tap();
        await expect(page.locator(`${SHEET}[data-open="1"]`)).toHaveCount(1);
        // The smooth scroll plus the 250ms slide.
        await page.waitForTimeout(900);

        const sheet = await readBox(page, SHEET);
        const player = await playerBox(page);
        expect(
          Math.abs(sheet!.y - expected.top),
          `tab ${key}: the sheet's top must be where the player's bottom lands after scrolling (${sheet!.y} vs ${expected.top})`,
        ).toBeLessThanOrEqual(2);
        expect(
          player.y + player.h,
          `tab ${key}: the video must stay fully visible above the sheet`,
        ).toBeLessThanOrEqual(sheet!.y + 1);
        expect(
          sheet!.x === 0 && Math.round(sheet!.w) === 390,
          `tab ${key}: the sheet must span the viewport (a transformed ancestor would capture position:fixed)`,
        ).toBe(true);
        await expect(
          page.locator(`${SHEET} [data-panel="${key}"]`),
        ).toBeVisible();
        expect(
          await page.evaluate(
            (sel) => !!document.elementFromPoint(195, 800)?.closest(sel),
            SHEET,
          ),
          `tab ${key}: the sheet must be on top of LearningSuite's fixed bottom bar`,
        ).toBe(true);

        await page.keyboard.press("Escape");
        await expect(page.locator(`${SHEET}[data-open="1"]`)).toHaveCount(0);
      }
    });

    test("the science pill opens Science Corner", async ({ page }) => {
      const { science } = await demoMoments(page);
      test.skip(science === null, "this lesson's config has no science moment");
      await seekTo(page, science! + 1.5);
      await page.locator(`${SCIENCE_PILL} button`).tap();
      await expect(page.locator(`${SHEET}[data-open="1"]`)).toHaveCount(1);
      await expect(
        page.locator(`${SHEET} [data-panel="science"]`),
      ).toBeVisible();
    });

    test("✕ closes the sheet", async ({ page }) => {
      await page.locator(`${TAB_BAR} [data-sheet-tab]`).first().tap();
      await expect(page.locator(`${SHEET}[data-open="1"]`)).toHaveCount(1);
      await page.locator(`${SHEET} .vp-sheet-close`).tap();
      await expect(page.locator(`${SHEET}[data-open="1"]`)).toHaveCount(0);
    });

    // ── P4: compact overlays ────────────────────────────────────────────────

    test("the slots are marked compact on a phone-sized player", async ({
      page,
    }) => {
      for (const slot of SLOTS)
        await expect(
          page.locator(`${slot}[data-vp-compact="1"]`),
          `${slot} must carry data-vp-compact on a 390px player (isCompact: width < 750)`,
        ).toHaveCount(1);
    });

    // Was fixme until P4: the 320×168 voice-over card started 7px above a
    // 219px-tall player and covered the section pill, and the science pill
    // covered the section pill (spec M3/M4).
    test("pills and the voice-over never overlap and stay inside the player", async ({
      page,
    }) => {
      const { voiceOver } = await demoMoments(page);
      if (voiceOver.kind === "none") {
        test.skip(true, "this lesson's config has no voice-over cue after t:0");
        return;
      }
      // Failed, not skipped: a skip here would hide this layout from the canary
      // for as long as the lesson stays unfixed.
      if (voiceOver.kind === "unplayable")
        throw new Error(
          "The runtime skips every voice-over cue on this lesson (" +
            voiceOver.skipped.map((c) => `${c.id}: ${c.reason}`).join(", ") +
            "), so no card can mount. A cue plays only its uploaded audio: give " +
            "each cue an `asset` in the lesson's code block — see Audio.asset in " +
            "runtime-src/common/types.ts.",
        );
      // Play first, then seek: starting playback makes LearningSuite jump to
      // the shared account's saved watch position, which can lie past the cue
      // (measured: playback resumed at 70s with the cue at 45s).
      await tapHostPlay(page);
      await seekTo(page, Math.max(0, voiceOver.t - 3));
      await expect(page.locator(VOICE_OVER)).toHaveCount(1, {
        timeout: 20_000,
      });
      await expectInsidePlayer(page, [VOICE_OVER, SECTION_PILL]);
      await expectNoOverlap(page, [
        SECTION_PILL,
        SCIENCE_PILL,
        META_PILL,
        VOICE_OVER,
      ]);
      const card = await readBox(page, VOICE_OVER);
      expect(
        card!.h,
        `the compact voice-over bar must be one row, at most 60px tall (was 168)`,
      ).toBeLessThanOrEqual(60);
      const buttons = await page
        .locator(`${VOICE_OVER} .vp-audio-btn:visible`)
        .evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect();
            return { w: r.width, h: r.height };
          }),
        );
      expect(buttons.length, "play/pause and skip must be visible").toBe(2);
      for (const b of buttons)
        expect(
          Math.min(b.w, b.h),
          "compact voice-over buttons must be at least 40px",
        ).toBeGreaterThanOrEqual(40);
    });

    test("the science pill's Open button is at least 40px and fits beside the section pill", async ({
      page,
    }) => {
      const { science } = await demoMoments(page);
      test.skip(science === null, "this lesson's config has no science moment");
      await seekTo(page, science! + 1.5);
      await expect(page.locator(`${SCIENCE_PILL} .vp-sci-open`)).toHaveCount(1);
      await expectNoOverlap(page, [SECTION_PILL, SCIENCE_PILL]);
      const open = await readBox(page, `${SCIENCE_PILL} .vp-sci-open`);
      expect(
        Math.min(open!.w, open!.h),
        "the Open button must be at least 40px (it was 58×23)",
      ).toBeGreaterThanOrEqual(40);
    });

    test("tapping the section pill opens the sheet on Coaching", async ({
      page,
    }) => {
      const pill = page.locator(SECTION_PILL);
      test.skip(
        (await pill.count()) === 0,
        "this lesson has a single phase, so no section pill",
      );
      await pill.tap();
      await expect(page.locator(`${SHEET}[data-open="1"]`)).toHaveCount(1);
      await expect(
        page.locator(`${SHEET} [data-panel="coaching"]`),
      ).toBeVisible();
    });
  });
}
