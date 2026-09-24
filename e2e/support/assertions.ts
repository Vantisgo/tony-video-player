// The assertion vocabulary, so the spec reads as intent rather than as DOM
// plumbing.
//
// Every target here is a surface the runtime *already* publishes for its own
// reasons (console debugging, the chrome-hiding CSS gate, demo-overlays
// consuming `window.player`). Nothing in this file requires a `data-testid` or
// any other hook added for tests — if an assertion ever seems to need one, the
// more likely reading is that it is reaching past what the runtime promises.
import { expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import { describeDiag, diagSchema, type Diag } from "./diag";

// --- the runtime's published surface ---------------------------------------

const RESKIN_ATTACHED = "reskin attached";
const RESKIN_KILLED = "reskin disabled by kill-switch";
// runtime-src/demo-overlays/index.ts — the string `main()` returns today. The
// plan predates the quiz/remount rewrite and quotes "demo: setup queued", which
// no longer exists anywhere in the runtime.
const DEMO_ACTIVE = "demo overlay controller active";
const DEMO_KILLED = "demo: disabled by kill-switch";

const HOST = '[data-vp-reskinned="true"]';

// LearningSuite's own control bar: a MUI box that is a direct child of the host.
const HOST_BAR = '[class*="PlayerControlsAbsoluteContainer"]';

// Their buttons. A DELIBERATE dependency on third-party markup, taken so the
// canary keeps proving a REAL user gesture reaches the player rather than
// driving window.player.play(). They carry no aria-label, data-testid or title
// — only hashed MUI classes — so these key on FontAwesome's `data-icon`, which
// is the most durable hook available. Measured 2026-09-07, in order:
// play · volume-high · "1x" · subtitles · sliders · fullscreen.
// Their controls, addressed by FontAwesome's `data-icon`. Measured 2026-09-07:
// play · volume-high · "1x" · subtitles · sliders · fullscreen.
const HOST_BAR_BUTTONS = "svg[data-icon]";
const HOST_VOLUME_BUTTON = 'button:has(svg[data-icon^="volume"])';

// Pressing one of LearningSuite's controls.
//
// Deliberate coupling: the canary drives their real controls rather than
// window.player.play(), so it keeps proving a genuine user gesture reaches the
// media element. But their affordances cannot be clicked through a Playwright
// locator — their own wrapper divs sit on top of the icons, so actionability
// checks refuse. (Hit-tested: nothing of OURS intercepts them; this is their
// layering, not ours.) So the icon is used only to FIND the point, and the click
// is a real mouse event at that point — which is both a truer gesture and
// coupled to nothing but the icon name.
async function pressHostControl(
  page: Page,
  selector: string,
  what: string,
): Promise<void> {
  const target = page.locator(HOST).locator(selector).first();
  // getBoundingClientRect via evaluate, NOT locator.boundingBox(): the latter
  // returns null for an element Playwright judges invisible, and their icons sit
  // in a subtree it reads that way even while the browser lays them out and
  // elementsFromPoint returns them.
  //
  // Polled, because their bar renders asynchronously: reading the rect once can
  // catch the control before React has laid it out, which is a race, not a
  // missing control.
  const readBox = async (): Promise<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null> =>
    target
      .evaluate((node) => {
        const r = (node as Element).getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height };
      })
      .catch(() => null);

  let box = await readBox();
  const deadline = Date.now() + 15_000;
  while ((!box || box.w === 0 || box.h === 0) && Date.now() < deadline) {
    await page.waitForTimeout(250);
    box = await readBox();
  }
  if (!box || box.w === 0 || box.h === 0)
    throw new Error(
      `LearningSuite's ${what} control (${selector}) never took a layout box. ` +
        "Their control markup changed shape; this canary's locators need updating.",
    );
  await page.mouse.click(box.x + box.w / 2, box.y + box.h / 2);
}

// LearningSuite renders its full control bar only once playback has started —
// before that the player shows a poster and a centre play affordance. So every
// bar assertion has to start the video first.
async function startHostPlayback(page: Page): Promise<void> {
  const isPaused = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            player?: { _diag?: () => { paused?: boolean } };
          }
        ).player?._diag?.()?.paused !== false,
    );
  if (!(await isPaused())) return;
  // Two `play` icons coexist: the 36px one in their initial-play overlay and a
  // 16px one in the bar. Prefer the overlay's — it is the affordance a learner
  // actually presses first, and the bar's has no layout box until the bar has
  // rendered, which is what made this flaky.
  const overlayPlay =
    '[class*="VideoInitialPlayOverlay"] svg[data-icon="play"]';
  const anyPlay = 'svg[data-icon="play"]';
  const hasOverlay =
    (await page.locator(HOST).locator(overlayPlay).count()) > 0;
  await pressHostControl(page, hasOverlay ? overlayPlay : anyPlay, "play");
  await page.waitForFunction(
    () =>
      (
        window as unknown as { player?: { _diag?: () => { paused?: boolean } } }
      ).player?._diag?.()?.paused === false,
    undefined,
    { timeout: 20_000 },
  );
}

// The bar fades with inactivity; a pointer move over the player brings it back.
async function revealHostBar(page: Page): Promise<void> {
  await page.locator(HOST).first().hover();
  await page.waitForTimeout(400);
}

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
// than asserted into a type. The schema and the failure-message renderer live in
// `./diag` because that module is Playwright-free and therefore unit-testable —
// see `e2e/support/assertions.test.ts`.
export type { Diag } from "./diag";

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
    body: describeDiag(raw.ok ? raw.value : { unavailable: raw.reason }),
    contentType: "application/json",
  });
  if (!raw.ok) return null;
  const parsed = diagSchema.safeParse(raw.value);
  return parsed.success ? parsed.data : null;
}

async function requireDiag(page: Page, testInfo: TestInfo): Promise<Diag> {
  const raw = await rawDiag(page);
  await testInfo.attach("diag.json", {
    body: describeDiag(raw.ok ? raw.value : { unavailable: raw.reason }),
    contentType: "application/json",
  });
  expect(raw.ok, `window.player._diag() unavailable: ${raw.reason}`).toBe(true);
  const parsed = diagSchema.safeParse(raw.value);
  expect(
    parsed.success,
    `window.player._diag() returned an unexpected shape: ${describeDiag(raw.value)}`,
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

  // The control bar we used to assert here no longer exists — LearningSuite's
  // own chrome owns playback again. What is still ours is the shell above, the
  // PlayerApi, and _diag() below.

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

// The inverse of the old expectNativeChromeHidden. Until 2026-09-07 the runtime
// hid LearningSuite's chrome and replaced it with a bar of its own; two of that
// bar's controls did not work (mute, subtitles) and it re-implemented what the
// host already does. The host's chrome is now left alone, and THAT is what has
// to be true on a healthy page.
export async function expectHostChromePresent(page: Page): Promise<void> {
  const host = page.locator(HOST);
  await expect(host).toHaveCount(1);

  // Their bar only renders its controls once playback has started.
  await startHostPlayback(page);
  await revealHostBar(page);

  // Anchor first. An assertion that only checks the host's bar is visible would
  // pass perfectly on a page where our runtime never ran at all — this is what
  // makes the rest mean something.
  await expect(
    host.locator(".vp-shell"),
    "Our own shell is not present, so 'the host's chrome is visible' would pass vacuously",
  ).toHaveCount(1);

  await expect(
    host.locator(HOST_BAR).first(),
    "LearningSuite's own control bar is missing or hidden. The runtime must not " +
      "hide it — check that no chrome-hiding rule crept back into RESKIN_CSS.",
  ).toBeVisible();

  // Their bar is populated and interactive, not merely a present container.
  await expect(
    host.locator(HOST_BAR).locator(HOST_BAR_BUTTONS).first(),
    "LearningSuite's control bar rendered no icon buttons after playback started. " +
      "Their control markup changed shape; this canary's locators need updating.",
  ).toBeVisible();
}

// Their mute must work while we are mounted. This is the assertion that would
// have caught the defect this whole change came from: our own mute wrote
// `muted`, it read back as false moments later, and nothing noticed for months.
//
// Measured 2026-09-07: LearningSuite's mute sets `volume = 0` and never touches
// `muted` at all (their icon goes volume-high → volume-xmark). That is also why
// our old button lost — it wrote a property their state machine normalises back.
// So audibility, not `muted`, is what this asserts.
export async function expectHostMuteWorks(page: Page): Promise<void> {
  const audible = () =>
    page.evaluate(() => {
      const el = document.querySelector("hls-video") as {
        muted?: boolean;
        volume?: number;
      } | null;
      return !el?.muted && (el?.volume ?? 0) > 0;
    });

  await startHostPlayback(page);
  await revealHostBar(page);

  const before = await audible();
  await pressHostControl(page, HOST_VOLUME_BUTTON, "mute");
  await page.waitForTimeout(1000);

  expect(
    await audible(),
    "Pressing LearningSuite's own mute did not change whether the media element " +
      "is audible (it sets volume, not muted). Either their bar changed shape and " +
      "the wrong control was pressed, or something in our runtime is fighting it.",
  ).toBe(!before);
}

export async function expectPlaybackAdvances(
  page: Page,
  testInfo: TestInfo,
): Promise<void> {
  // Driven through LearningSuite's own play affordance, never window.player —
  // the point of this test is that a real user gesture reaches the media
  // element. See startHostPlayback for why the first press is the centre of the
  // player rather than a bar button.
  const before = await currentTime(page);
  await startHostPlayback(page);

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
        "pressing LearningSuite's own play control.\n" +
        `_diag(): ${describeDiag(diag)}\n` +
        "readyState < 2 points at the media never loading (expired signed manifest, CDN, or a " +
        "codec the browser lacks). A moving readyState with a frozen currentTime points at " +
        "their play control no longer driving the media element — or at this test's locators " +
        "having matched the wrong thing after a restyle.",
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
