// The assertion vocabulary, so the spec reads as intent rather than as DOM
// plumbing.
//
// Every target here is a surface the runtime *already* publishes for its own
// reasons (console debugging, the chrome-hiding CSS gate, demo-overlays
// consuming `window.player`). Nothing in this file requires a `data-testid` or
// any other hook added for tests — if an assertion ever seems to need one, the
// more likely reading is that it is reaching past what the runtime promises.
import { expect } from "@playwright/test";
import type { Locator, Page, TestInfo } from "@playwright/test";
import { z } from "zod";

// --- the runtime's published surface ---------------------------------------

const RESKIN_ATTACHED = "reskin attached";
const RESKIN_KILLED = "reskin disabled by kill-switch";
// runtime-src/demo-overlays/index.ts — the string `main()` returns today. The
// plan predates the quiz/remount rewrite and quotes "demo: setup queued", which
// no longer exists anywhere in the runtime.
const DEMO_ACTIVE = "demo overlay controller active";
const DEMO_KILLED = "demo: disabled by kill-switch";

const HOST = '[data-vp-reskinned="true"]';

// Mirrors runtime-src/reskin-player/styles.ts:4-10. Kept as a list rather than
// as prose so a CSS change and this list diverge visibly.
const NATIVE_CHROME_IN_PLAYER: readonly string[] = [
  "media-controls",
  "media-poster",
  "media-play-button",
  "media-gesture",
  "media-time-display",
  "media-volume-slider",
  "media-time-slider",
  "media-fullscreen-button",
  "media-captions-button",
  "media-menu",
  '[slot="ui"]',
  '[slot="layer"]',
];

// The demo mount creates these unconditionally, so their absence means it did
// not mount (as opposed to `#vp-demo-sidebar`, which the config can legitimately
// switch off).
const DEMO_SLOTS: readonly string[] = [
  "#vp-slot-tl",
  "#vp-slot-tr",
  "#vp-slot-br",
  "#vp-slot-lt",
];

// --- diagnostics ------------------------------------------------------------

// `_diag()` crosses out of a page we do not control, so it is validated rather
// than asserted into a type.
const diagSchema = z.object({
  hasVideo: z.boolean(),
  discovery: z.string(),
  paused: z.boolean().nullable().optional(),
  currentTime: z.number().nullable().optional(),
  duration: z.number().nullable().optional(),
  readyState: z.number().nullable().optional(),
});

export type Diag = z.infer<typeof diagSchema>;

type RawDiag = {
  readonly ok: boolean;
  readonly reason: string;
  readonly value: unknown;
};

async function rawDiag(page: Page): Promise<RawDiag> {
  return page.evaluate(() => {
    const player = (
      window as unknown as {
        player?: { _diag?: () => unknown };
      }
    ).player;
    if (!player)
      return { ok: false, reason: "window.player is not set", value: null };
    if (typeof player._diag !== "function")
      return {
        ok: false,
        reason:
          "window.player._diag is missing (an old bundle is being served or cached)",
        value: null,
      };
    return { ok: true, reason: "", value: player._diag() };
  });
}

// Attaches the full `_diag()` payload to the test — on a failure weeks later the
// discovery strategy and readyState are the first things anyone wants, and on a
// passing run it is the record of what "healthy" looked like that day.
export async function attachDiag(
  page: Page,
  testInfo: TestInfo,
): Promise<Diag | null> {
  const raw = await rawDiag(page);
  await testInfo.attach("diag.json", {
    body: JSON.stringify(
      raw.ok ? raw.value : { unavailable: raw.reason },
      null,
      2,
    ),
    contentType: "application/json",
  });
  if (!raw.ok) return null;
  const parsed = diagSchema.safeParse(raw.value);
  return parsed.success ? parsed.data : null;
}

async function requireDiag(page: Page, testInfo: TestInfo): Promise<Diag> {
  const raw = await rawDiag(page);
  await testInfo.attach("diag.json", {
    body: JSON.stringify(
      raw.ok ? raw.value : { unavailable: raw.reason },
      null,
      2,
    ),
    contentType: "application/json",
  });
  expect(raw.ok, `window.player._diag() unavailable: ${raw.reason}`).toBe(true);
  const parsed = diagSchema.safeParse(raw.value);
  expect(
    parsed.success,
    `window.player._diag() returned an unexpected shape: ${JSON.stringify(raw.value)}`,
  ).toBe(true);
  if (!parsed.success) throw new Error("unreachable: asserted above");
  return parsed.data;
}

// --- status strings ---------------------------------------------------------

async function readStatus(
  page: Page,
  key: string,
): Promise<string | undefined> {
  return page.evaluate((name) => {
    const value = (window as unknown as Record<string, unknown>)[name];
    return typeof value === "string" ? value : undefined;
  }, key);
}

// The status globals are set asynchronously (each entry awaits the kill-switch
// first), so "not set yet" and "never ran" need a wait to tell apart.
async function waitForStatus(
  page: Page,
  key: string,
  timeout: number,
): Promise<string | undefined> {
  try {
    await page.waitForFunction(
      (name) =>
        typeof (window as unknown as Record<string, unknown>)[name] ===
        "string",
      key,
      { timeout },
    );
  } catch {
    return undefined;
  }
  return readStatus(page, key);
}

export async function demoScriptRan(
  page: Page,
  timeout = 15_000,
): Promise<boolean> {
  return (await waitForStatus(page, "__vpDemoStatus", timeout)) !== undefined;
}

// A non-asserting wait, for tests whose *subject* is something other than
// mounting (chrome hiding, playback) but which need the runtime settled first.
// Deliberately silent on the outcome: "reskin-player mounts" is the test that
// reports that, and duplicating the verdict here would only double the noise.
export async function waitForReskinSettled(page: Page): Promise<void> {
  await waitForStatus(page, "__vpReskinStatus", 45_000);
}

// --- assertions -------------------------------------------------------------

export async function expectReskinMounted(
  page: Page,
  testInfo: TestInfo,
): Promise<void> {
  const status = await waitForStatus(page, "__vpReskinStatus", 45_000);

  expect(
    status,
    "window.__vpReskinStatus was never set: reskin-player.js did not finish running. " +
      "Either the script never loaded (CSP, a 404 on the bundle, the loader's gate not passing) " +
      "or it threw before publishing its status.",
  ).toBeDefined();

  // Surfaced verbatim so an intentional kill-switch flip is instantly
  // distinguishable from a breakage.
  expect(
    status,
    status === RESKIN_KILLED
      ? `Runtime is switched OFF: __vpReskinStatus === "${RESKIN_KILLED}". ` +
          "This is the kill-switch (Edge Config runtimeConfig.enabled), not a regression."
      : `__vpReskinStatus === ${JSON.stringify(status)}`,
  ).toBe(RESKIN_ATTACHED);

  // Exactly one: two reskinned hosts would mean a double-attach, which is a real
  // (and previously observed) failure mode on this SPA.
  const hosts = page.locator(HOST);
  await expect(
    hosts,
    'Expected exactly one [data-vp-reskinned="true"] host. Zero means attach() rolled back ' +
      "or resolveHost() found no host; more than one means a double-attach.",
  ).toHaveCount(1);

  await expect(
    hosts.locator(".vp-shell"),
    "The reskinned host carries no .vp-shell",
  ).toHaveCount(1);

  // The positive half of the safety-net invariant: our controls are actually
  // usable, not merely present in the DOM.
  await expect(hosts.locator('[data-vp="playpause"]')).toBeVisible();
  await expect(hosts.locator('[data-vp="time"]')).toBeVisible();

  const diag = await requireDiag(page, testInfo);
  expect(
    diag.hasVideo,
    "player._diag().hasVideo is false — no media element was attached",
  ).toBe(true);
  expect(
    diag.discovery,
    'player._diag().discovery === "none": LearningSuite\'s player element was not found at all',
  ).not.toBe("none");

  // An annotation, not a failure: the runtime still works, but it is coasting on
  // its last-resort strategy, which means LearningSuite already renamed the
  // player. That should generate a ticket, not a red build.
  if (diag.discovery === "capability") {
    testInfo.annotations.push({
      type: "drift",
      description:
        'player discovery fell through to the capability sweep (discovery === "capability"). ' +
        "LearningSuite no longer renders a recognised player tag — the runtime is one change " +
        "away from finding nothing.",
    });
  }
}

export async function expectNativeChromeHidden(page: Page): Promise<void> {
  const host = page.locator(HOST);
  await expect(host).toHaveCount(1);

  // Anchor first. A "chrome is hidden" suite that only checks for absence passes
  // perfectly on a page where our runtime never ran at all — this is the check
  // that makes the rest of the helper mean something.
  await expect(
    host.locator(".vp-shell .vp-controls"),
    "Our own controls are not visible, so 'native chrome is hidden' would pass vacuously",
  ).toBeVisible();

  for (const selector of NATIVE_CHROME_IN_PLAYER) {
    const chrome = host.locator(`hls-video ${selector}`);
    const count = await chrome.count();
    // count === 0 is a pass: LearningSuite is free to stop rendering an element.
    // What must never happen is it being present AND visible on top of our shell.
    for (let i = 0; i < count; i++) {
      await expect(
        chrome.nth(i),
        `Native player chrome is visible over our shell: ${selector} (#${i + 1} of ${count}). ` +
          "The chrome-hiding CSS in runtime-src/reskin-player/styles.ts no longer matches this markup.",
      ).toBeHidden();
    }
  }

  // LearningSuite's own absolutely-positioned control container, a direct child
  // of the host rather than of the player element.
  const overlayControls = host.locator(
    '> [class*="PlayerControlsAbsoluteContainer"]',
  );
  const overlayCount = await overlayControls.count();
  for (let i = 0; i < overlayCount; i++) {
    await expect(
      overlayControls.nth(i),
      "LearningSuite's PlayerControlsAbsoluteContainer is visible over our shell",
    ).toBeHidden();
  }
}

export async function expectPlaybackAdvances(
  page: Page,
  testInfo: TestInfo,
): Promise<void> {
  const playPause: Locator = page
    .locator(HOST)
    .locator('[data-vp="playpause"]');
  await expect(playPause).toBeVisible();

  // Autoplay is permitted in this browser (--autoplay-policy), so the video may
  // already be running. Clicking blindly would then *pause* it and the assertion
  // would fail for the wrong reason — start from a known paused state.
  if ((await requireDiag(page, testInfo)).paused === false) {
    await playPause.click();
    await page
      .waitForFunction(
        () =>
          (
            window as unknown as {
              player?: { _diag?: () => { paused?: boolean } };
            }
          ).player?._diag?.()?.paused === true,
        undefined,
        { timeout: 10_000 },
      )
      .catch(() => {});
  }

  const before = await currentTime(page);

  await playPause.click();

  try {
    await page.waitForFunction(
      (start: number) =>
        ((window as unknown as { player?: { current?: number } }).player
          ?.current ?? 0) >=
        start + 0.5,
      before,
      { timeout: 45_000 },
    );
  } catch (cause) {
    const diag = await attachDiag(page, testInfo);
    throw new Error(
      `Playback did not advance: window.player.current stayed at ~${before}s for 45s after ` +
        "clicking our play button.\n" +
        `_diag(): ${JSON.stringify(diag)}\n` +
        "readyState < 2 points at the media never loading (expired signed manifest, CDN, or a " +
        "codec the browser lacks); a moving readyState with a frozen currentTime points at our " +
        "play button no longer being wired to the media element.",
      { cause },
    );
  }

  const after = await requireDiag(page, testInfo);
  expect(
    after.paused,
    "player._diag().paused is not false while playback is advancing",
  ).toBe(false);
}

async function currentTime(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as unknown as { player?: { current?: number } }).player
        ?.current ?? 0,
  );
}

export async function expectDemoMounted(
  page: Page,
  testInfo: TestInfo,
): Promise<void> {
  const status = await waitForStatus(page, "__vpDemoStatus", 30_000);

  expect(
    status,
    "window.__vpDemoStatus was never set: demo-overlays.js did not run. " +
      "In loader mode it is only injected after reskin-player publishes window.player.",
  ).toBeDefined();

  expect(
    status,
    status === DEMO_KILLED
      ? `Demo overlays are switched OFF: __vpDemoStatus === "${DEMO_KILLED}" (kill-switch, not a regression).`
      : `__vpDemoStatus === ${JSON.stringify(status)}`,
  ).toBe(DEMO_ACTIVE);

  // The controller being active only means it is watching; the slots are what
  // prove it actually mounted against this lesson's config.
  for (const slot of DEMO_SLOTS) {
    await expect(
      page.locator(slot),
      `Demo overlay slot ${slot} is missing — the controller armed but never mounted. ` +
        "Most often the lesson's [data-vp-config] was removed or is unparseable.",
    ).toHaveCount(1);
  }

  // Conditional by design: the sidebar is only built when the config carries
  // coaching, science or meta content (demo-overlays/index.ts:265). Asserting it
  // unconditionally would red-flag a perfectly healthy overlay-only lesson.
  const sidebar = page.locator("#vp-demo-sidebar");
  if ((await sidebar.count()) > 0) {
    await expect(sidebar).toBeVisible();
  } else {
    testInfo.annotations.push({
      type: "info",
      description:
        "#vp-demo-sidebar absent: this lesson's config declares no coaching/science/meta content, " +
        "so the sidebar is legitimately not built.",
    });
  }
}
