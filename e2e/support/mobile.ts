// Page helpers for the phone canary (`overlay-mobile.spec.ts`).
//
// They encode the verification recipe measured on the live lesson on
// 2026-09-29 (spec docs/superpowers/specs/2026-09-29-mobile-overlays-sidebar-design.md,
// "Verification"): real-gesture playback, a held voice-over, a client-side
// quiz, and box geometry read the same way `pressHostControl` reads it. All of
// it is test-only instrumentation of the page — nothing here exists in the
// runtime, and nothing here is persisted to LearningSuite.
import { expect, type Page } from "@playwright/test";

import { startHostPlayback } from "./assertions";
import { contains, formatBox, overlappingPairs, type Box } from "./geometry";

type PlayerWindow = {
  player: { seek(t: number): void; current: number };
};

// The box of the first element matching `selector`, or null when there is none.
// getBoundingClientRect via evaluate, never locator.boundingBox(): the latter is
// null for elements Playwright judges invisible (see pressHostControl).
export async function readBox(
  page: Page,
  selector: string,
): Promise<Box | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }, selector);
}

// The player host is the slots' parent by construction: makeSlot appends every
// #vp-slot-* to it (runtime-src/demo-overlays/index.ts).
export async function playerBox(page: Page): Promise<Box> {
  const box = await page.evaluate(() => {
    const host = document.getElementById("vp-slot-tl")?.parentElement;
    if (!host) return null;
    const r = host.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
  if (!box)
    throw new Error(
      "#vp-slot-tl has no parent: demo-overlays did not mount on this page, " +
        "so there is no player box to measure against.",
    );
  return box;
}

// Seeks through the runtime's PlayerApi and waits until the time has landed.
// Seeking is not the subject of any mobile test (the overlays are), so driving
// window.player here is fine; playback itself is always started by a real tap.
//
// Re-issued until it sticks: LearningSuite restores the account's saved watch
// position right after load (measured 2026-09-29: playback resumed at 70s), and
// that seek can land after ours and silently undo it.
export async function seekTo(page: Page, t: number): Promise<void> {
  const deadline = Date.now() + 15_000;
  for (;;) {
    await page.evaluate((to) => {
      (window as unknown as PlayerWindow).player.seek(to);
    }, t);
    const landed = await page
      .waitForFunction(
        (to) =>
          Math.abs((window as unknown as PlayerWindow).player.current - to) < 1,
        t,
        { timeout: 1_500 },
      )
      .then(() => true)
      .catch(() => false);
    if (landed) {
      // A late host seek can still arrive; confirm the time held.
      await page.waitForTimeout(500);
      const current = await page.evaluate(
        () => (window as unknown as PlayerWindow).player.current,
      );
      if (Math.abs(current - t) < 2) return;
    }
    if (Date.now() > deadline)
      throw new Error(
        `seekTo(${t}) never held: window.player.current kept returning elsewhere. ` +
          "LearningSuite's own resume seek (or a stalled player) is overriding ours.",
      );
  }
}

// The demo controller has MOUNTED against this lesson: its config is published
// and the slots exist. `__vpDemoStatus` (what demoScriptRan waits for) is set
// when the controller ARMS, a couple of frames earlier — tests that measure
// straight after it raced the mount (2026-09-29).
export async function waitForDemoMount(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      !!(window as unknown as { __vpConfig?: unknown }).__vpConfig &&
      !!document.getElementById("vp-slot-tl")?.parentElement,
    undefined,
    { timeout: 30_000 },
  );
}

// Starts playback with a real touchscreen tap on LearningSuite's play control.
// A script play() carries no user activation (measured 2026-09-29), so a
// voice-over cue could not start its audio.
export async function tapHostPlay(page: Page): Promise<void> {
  await startHostPlayback(page, (p, point) =>
    p.touchscreen.tap(point.x, point.y),
  );
}

// Keeps a TTS voice-over cue open for its full `dur`. In automated Chrome the
// utterance ends at once (the voice requests are rate-limited, 429s observed),
// which closes the card before it can be measured. MUST be registered before
// page.goto: init scripts run on the next navigation.
export async function holdVoiceOver(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const synth = window.speechSynthesis;
    if (synth) synth.speak = () => {};
  });
}

// Adds a quiz to the lesson's config in THIS page only (nothing is saved to
// LearningSuite) and waits for the controller's remount to create the quiz slot.
// The controller compares the config JSON on every debounced scan, so a rewrite
// remounts within ~200ms plus two frames.
export async function injectQuiz(page: Page, quiz: unknown): Promise<void> {
  const injected = await page.evaluate((q) => {
    const el =
      document.querySelector(
        'script[type="application/json"][data-vp-config]',
      ) ?? document.querySelector("[data-vp-config]");
    if (!el?.textContent) return false;
    const cfg = JSON.parse(el.textContent) as Record<string, unknown>;
    cfg.quiz = q;
    el.textContent = JSON.stringify(cfg);
    return true;
  }, quiz);
  if (!injected)
    throw new Error(
      "This lesson has no readable [data-vp-config] element to inject a quiz into.",
    );
  await page.waitForFunction(() => !!document.getElementById("vp-slot-quiz"), {
    timeout: 15_000,
  });
}

// The first timestamp of each overlay kind in the resolved lesson's config, so
// tests seek to real moments instead of hard-coding the canary lesson's.
export type DemoMoments = {
  readonly science: number | null;
  readonly audio: number | null;
  readonly meta: number | null;
};

export async function demoMoments(page: Page): Promise<DemoMoments> {
  // Reading before the mount returned nulls and silently skipped a test.
  await waitForDemoMount(page);
  return page.evaluate(() => {
    const data = (
      window as unknown as {
        __vpConfig?: {
          data?: {
            sciences?: { timestampsSec?: number[] }[];
            audios?: { t?: number }[];
            metaSteps?: { t?: number }[];
          };
        };
      }
    ).__vpConfig?.data;
    return {
      science: data?.sciences?.[0]?.timestampsSec?.[0] ?? null,
      audio: data?.audios?.[0]?.t ?? null,
      meta: data?.metaSteps?.[0]?.t ?? null,
    };
  });
}

// Waits until each element's own entrance animation has finished. The pills and
// the voice-over card slide in (`vp-anim-right`: translateX(20px→0) over 350ms),
// and a box read mid-slide sits up to 20px off — measured 2026-09-29, the science
// pill read 4px outside the player because of it. Infinite animations (the
// status dot's pulse) never finish, so only finite ones are waited for.
async function settleAnimations(
  page: Page,
  selectors: readonly string[],
): Promise<void> {
  await page.waitForFunction(
    (sels) =>
      sels.every((sel) => {
        const el = document.querySelector(sel);
        if (!el) return true;
        return el
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
          .every((a) => a.playState === "finished");
      }),
    selectors,
    { timeout: 5_000 },
  );
}

export async function expectInsidePlayer(
  page: Page,
  selectors: readonly string[],
): Promise<void> {
  await settleAnimations(page, selectors);
  const player = await playerBox(page);
  for (const selector of selectors) {
    const box = await readBox(page, selector);
    if (!box) continue;
    expect(
      contains(player, box),
      `${selector} must stay inside the player (${formatBox(box)} vs player ${formatBox(player)}) — ` +
        "the player clips its content, so anything outside it is cut off.",
    ).toBe(true);
  }
}

export async function expectNoOverlap(
  page: Page,
  selectors: readonly string[],
): Promise<void> {
  await settleAnimations(page, selectors);
  const boxes: Record<string, Box | null> = {};
  for (const selector of selectors)
    boxes[selector] = await readBox(page, selector);
  expect(
    overlappingPairs(boxes),
    "No two visible overlays may cover each other on a phone-sized player",
  ).toEqual([]);
}

// One break at 70s with a four-option question — the shape used for the
// 2026-09-29 Chrome check (spec M6). Normalised by runtime-src/common/config.ts.
export const QUIZ_FIXTURE = {
  showScore: true,
  showSummary: true,
  quizzes: [
    {
      id: "qz-canary",
      t: 70,
      title: "Kurzer Check",
      questions: [
        {
          id: "q1",
          prompt:
            "Welche Frage stellt der Coach zu Beginn, um die Erwartungen zu klären?",
          options: [
            { id: "a", text: "Was soll am Ende dieser Stunde anders sein?" },
            { id: "b", text: "Wie lange haben wir heute Zeit?" },
            { id: "c", text: "Was hast du letzte Woche gemacht?" },
            { id: "d", text: "Welche Methode möchtest du ausprobieren?" },
          ],
          correctOptionId: "a",
          explanation: "Die Zielfrage spart Umwege.",
          timeoutSec: 30,
          showCountdown: true,
        },
      ],
    },
  ],
} as const;
