# Feature: Mobile overlays P2 — mobile canary harness

## Summary

Add a `canary-mobile` Playwright project that runs a new `e2e/overlay-mobile.spec.ts` against the
live LearningSuite lesson at 390×844 with touch. It comes with test-only helpers that encode the
verification recipe measured on 2026-09-29:

- geometry checks (inside-player, no-overlap)
- seeking
- a real-gesture tap on the host play control
- holding a voice-over open by stubbing `speechSynthesis.speak`
- injecting a quiz by rewriting `[data-vp-config]` client-side

The spec starts with assertions that already pass. The geometry the later phases fix (M3, M4) is
declared as `test.fixme` with the phase that will flip it. P3–P5 then add their own assertions.

## User Story

As a developer changing the overlay runtime
I want the mobile layout checked automatically on the real host page
So that a later change cannot silently break phones again (as `159bf36` papered over)

## Problem Statement

The canary runs only at Playwright's default desktop viewport (`playwright.config.ts:47-71`), so
nothing guards phone-sized geometry. The checks done by hand in Chrome on 2026-09-29 depend on
tricks that are not written down in code:

- local bundles
- real-tap playback
- a TTS stub (TTS ends immediately under automation; 429s)
- client-side quiz injection

## Solution Statement

- **Pure geometry helpers** go in a Playwright-free module (`e2e/support/geometry.ts`), unit-tested
  in vitest like `diag.ts`/`target.ts`.
- **Page helpers** go in `e2e/support/mobile.ts`. The host-control point finding is extracted from
  `assertions.ts` so desktop (mouse) and mobile (touchscreen) share it.
- **Config:** a new project with its own `testMatch`, and a `testIgnore` on `canary` so the
  desktop project never collects the mobile spec. `scripts/e2e.ts` runs both projects in phase 2.

## Metadata

| Field            | Value                                                                        |
| ---------------- | ---------------------------------------------------------------------------- |
| Type             | NEW_CAPABILITY                                                               |
| Complexity       | MEDIUM                                                                       |
| Systems Affected | `e2e/`, `playwright.config.ts`, `scripts/e2e.ts`                             |
| Dependencies     | @playwright/test ^1.62.1 (Chrome channel), vitest ^4.1.10, zod ^4 (e2e only) |
| Estimated Tasks  | 7                                                                            |

---

## Lifecycle (append-only)

- **Created:** 2026-09-29T12:40Z
- **Modified:** 2026-09-29T12:40Z · 2026-09-29T15:55Z (implemented)
- **Commits:** 879fc7a
- **Agent / Session:** claude-opus-5-5 (planning), session c9261ef3-2af4-4ce2-826b-0ee1520bc2a7 · claude-opus-5-5 (implementation), same session
- **Back refs:** `docs/superpowers/specs/2026-09-29-mobile-overlays-sidebar-design.md` (Verification) · `.claude/PRPs/prds/mobile-overlays.prd.md` (phase 2)
- **Forward refs:** `.claude/PRPs/plans/2026-09-29_mobile-overlays_p3-mobile-sheet.plan.md` · `…_p4-compact-overlays.plan.md` · `…_p5-quiz-on-mobile.plan.md` (each adds assertions to `overlay-mobile.spec.ts`)

> **Append-only:** `Created` is set once; every other field is a list you only ever add to — never overwrite or remove existing entries. Keep references bidirectional: when you add a back/forward ref here, add the reciprocal ref on the other plan.

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                     ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  bun run e2e ──► resolve ──► canary (desktop 1280×720) ──► 5 checks           ║
║                                                                               ║
║  Mobile geometry: checked by hand in devtools (2026-09-29), not repeatable    ║
║  PAIN_POINT: a phone regression is invisible to CI and to the schedule        ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                     ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  bun run e2e ──► resolve ──► canary (desktop)         ──► 5 checks (unchanged) ║
║                         └──► canary-mobile (390×844, isMobile, hasTouch)      ║
║                                ├─ mounts; touch emulation active              ║
║                                ├─ pills inside the player                      ║
║                                ├─ injected quiz covers the player              ║
║                                └─ fixme: no overlap / voice-over inside (P4)   ║
║  Local: E2E_RUNTIME_BASE_URL=http://localhost:3000/runtime/loader.js          ║
║  VALUE_ADD: every later phase proves its geometry on the real host page       ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location               | Before                              | After                                                                      | User Impact                     |
| ---------------------- | ----------------------------------- | -------------------------------------------------------------------------- | ------------------------------- |
| `bun run e2e`          | desktop canary only                 | desktop + mobile projects                                                  | Mobile regressions fail the run |
| `playwright.config.ts` | `canary` collects every `*.spec.ts` | `canary` ignores `overlay-mobile.spec.ts`; `canary-mobile` matches only it | No cross-collection             |

---

## Mandatory Reading

| Priority | File                                                    | Lines          | Why Read This                                                                                                                           |
| -------- | ------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | `e2e/support/assertions.ts`                             | 1-135          | `pressHostControl` point finding (evaluate `getBoundingClientRect`, 15s poll), `startHostPlayback`, selector constants, comment style   |
| P0       | `e2e/overlay-canary.spec.ts`                            | all (89)       | Spec skeleton to mirror: targets loop, `beforeEach` with `useRuntimeSource` + `goto` + `waitForReskinSettled`, `afterEach` `attachDiag` |
| P0       | `playwright.config.ts`                                  | all (72)       | Projects; why `resolve` is not a dependency of `canary`                                                                                 |
| P0       | `scripts/e2e.ts`                                        | 82-93          | Phase 2 invocation to extend                                                                                                            |
| P1       | `e2e/support/runtime-source.ts`                         | 39-90          | Preview mode: `addInitScript` sets `__vpRuntimeBaseUrl`, `page.route` serves `/runtime/*.js` from the preview URL                       |
| P1       | `e2e/support/diag.ts`, `e2e/support/assertions.test.ts` | all            | Playwright-free helper + vitest test pattern                                                                                            |
| P1       | `e2e/support/target.test.ts`                            | 1-45           | Header comment on the `*.test.ts` vs `*.spec.ts` split; relative imports (no `~/` alias in vitest)                                      |
| P2       | `runtime-src/common/config.ts`                          | 22-64, 160-250 | How `[data-vp-config]` is read; quiz shape (`quizzes[].questions[].options`, `correctOptionId`)                                         |

**External Documentation:**

| Source                                                                                      | Section                      | Why Needed                                                                                                         |
| ------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [Playwright projects](https://playwright.dev/docs/test-projects)                            | Configure projects           | `testMatch`/`testIgnore`/`use` per project                                                                         |
| [Playwright emulation](https://playwright.dev/docs/emulation#devices)                       | viewport, isMobile, hasTouch | `hasTouch` (not `isMobile`) is what makes `(hover:hover)` false and `(pointer:coarse)` true (verified, Chrome 154) |
| [`page.addInitScript`](https://playwright.dev/docs/api/class-page#page-add-init-script)     | ordering                     | Runs before page scripts on every navigation, in registration order                                                |
| [`locator.boundingBox`](https://playwright.dev/docs/api/class-locator#locator-bounding-box) | semantics                    | Viewport-relative, `null` when invisible. That is why we read rects via `evaluate` (as `pressHostControl` does)    |
| [`page.touchscreen.tap`](https://playwright.dev/docs/api/class-touchscreen#touchscreen-tap) | tap                          | Requires `hasTouch`; dispatches real touch events                                                                  |

---

## Patterns to Mirror

**POINT FINDING (extract; do not duplicate):**

```typescript
// SOURCE: e2e/support/assertions.ts:49-88
async function pressHostControl(
  page: Page,
  selector: string,
  what: string,
): Promise<void> {
  const target = page.locator(HOST).locator(selector).first();
  const readBox = async () =>
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
      `LearningSuite's ${what} control (${selector}) never took a layout box. …`,
    );
  await page.mouse.click(box.x + box.w / 2, box.y + box.h / 2);
}
```

**SPEC SKELETON:**

```typescript
// SOURCE: e2e/overlay-canary.spec.ts (structure)
const { videos, courseLabel } = readTargetsFile(targetSpecKey(parseTargetSpec(e2eEnv)));
for (const video of videos)
  test.describe(`${courseLabel} · ${video.index}/${video.total} · ${video.title}`, () => {
    test.beforeEach(async ({ page }, testInfo) => {
      const source = await useRuntimeSource(page);
      testInfo.annotations.push({ type: "runtime", description: … });
      await page.goto(video.url, { waitUntil: "domcontentloaded" });
      await waitForReskinSettled(page);
    });
    test.afterEach(async ({ page }, testInfo) => attachDiag(page, testInfo));
    …
  });
```

**ASSERTION MESSAGE STYLE:**

```typescript
// SOURCE: e2e/support/assertions.ts (expect* helpers)
await expect(locator, "<what a failure means, in plain words>").toHaveCount(1);
```

**PLAYWRIGHT-FREE HELPER + VITEST:**

```typescript
// SOURCE: e2e/support/assertions.test.ts (imports)
import { describe, expect, it } from "vitest";
import { describeDiag, diagSchema } from "./diag";
```

---

## Files to Change

| File                           | Action | Justification                                                                                                           |
| ------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| `e2e/support/geometry.ts`      | CREATE | Pure `Box` math: `intersectionArea`, `contains`, `overlappingPairs`                                                     |
| `e2e/support/geometry.test.ts` | CREATE | vitest coverage of the pure helpers                                                                                     |
| `e2e/support/assertions.ts`    | UPDATE | Extract `hostControlPoint()` from `pressHostControl`; export `startHostPlayback` variant taking a press strategy        |
| `e2e/support/mobile.ts`        | CREATE | `readBox`, `playerBox`, `seekTo`, `tapHostPlay`, `holdVoiceOver`, `injectQuiz`, `expectInsidePlayer`, `expectNoOverlap` |
| `e2e/overlay-mobile.spec.ts`   | CREATE | The mobile spec                                                                                                         |
| `playwright.config.ts`         | UPDATE | `canary.testIgnore`; new `canary-mobile` project                                                                        |
| `scripts/e2e.ts`               | UPDATE | Phase 2 runs `--project=canary --project=canary-mobile`                                                                 |

---

## NOT Building (Scope Limits)

- Tablet or landscape projects. V2–V5 stay devtools checks; one phone project covers the
  regressions that matter.
- Assertions for P3–P5 behaviour. Each later plan adds its own.
- Any runtime change. P2 touches only `e2e/`, config and the runner script.

---

## Step-by-Step Tasks

### `[x]` Task 1: CREATE `e2e/support/geometry.ts`

- **ACTION**: CREATE a Playwright-free module.
- **IMPLEMENT**:
  ```ts
  // Viewport-relative boxes read with getBoundingClientRect (never
  // locator.boundingBox(), which is null for elements Playwright deems
  // invisible — see pressHostControl).
  export type Box = {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
  };
  export function intersectionArea(a: Box, b: Box): number; // 0 when disjoint or touching
  export function contains(outer: Box, inner: Box, tolerance = 1): boolean; // edges within ±tolerance
  export function overlappingPairs(
    boxes: Readonly<Record<string, Box | null>>,
  ): string[];
  // "a × b (N px²)" for every pair with area > 0; null boxes (absent overlays) are skipped
  ```
- **MIRROR**: `e2e/support/diag.ts` (a pure module, no `@playwright/test` import, header comment explaining why).
- **GOTCHA**: zero-size boxes (empty slots) must count as inside when their origin is inside, and must never overlap anything.
- **VALIDATE**: `bunx tsc --noEmit -p tsconfig.json`

### `[x]` Task 2: CREATE `e2e/support/geometry.test.ts`

- **ACTION**: CREATE vitest tests.
- **IMPLEMENT**: Use the measured numbers as fixtures:
  - The science pill `{x:71,y:325,w:309,h:35}` overlaps the section pill `{x:14,y:329,w:161,h:54}`: area `(175-71)*(360-329)=3224`.
  - The voice-over card `{x:56,y:308,w:320,h:168}` is not contained in the player `{x:0,y:315,w:390,h:219}`.
  - Touching edges give area 0.
  - `null` entries are skipped.
- **MIRROR**: `e2e/support/assertions.test.ts`, `e2e/support/target.test.ts` (relative imports).
- **VALIDATE**: `bun run test e2e/support/geometry.test.ts`

### `[x]` Task 3: UPDATE `e2e/support/assertions.ts` — share the point finding

- **ACTION**: Split `pressHostControl` (49-88) into `export async function hostControlPoint(page, selector, what): Promise<{ x: number; y: number }>` (poll and throw exactly as today) plus the existing mouse click. Add an optional `press` parameter to `startHostPlayback` (93-122), defaulting to `(p, pt) => p.mouse.click(pt.x, pt.y)`, and export it.
- **MIRROR**: the existing function bodies, verbatim.
- **GOTCHA**: The desktop canary's behaviour must not change. Every existing caller keeps the default mouse press.
- **VALIDATE**: `bunx tsc --noEmit -p tsconfig.json`

### `[x]` Task 4: CREATE `e2e/support/mobile.ts`

- **ACTION**: CREATE the page helpers.
- **IMPLEMENT** (each helper has a "why" comment in the style of `assertions.ts`):
  - `readBox(page, selector): Promise<Box | null>` evaluates `getBoundingClientRect` on `document.querySelector(selector)`, returning `null` if absent.
  - `playerBox(page)` returns the box of `document.getElementById("vp-slot-tl")?.parentElement`. The slots' parent is the player host by construction (`makeSlot` → `playerHost.appendChild`).
  - `seekTo(page, t)` runs `page.evaluate((t) => window.player.seek(t), t)`, then `waitForFunction` until `Math.abs(window.player.current - t) < 1` (15s).
  - `tapHostPlay(page)` calls `startHostPlayback(page, (p, pt) => p.touchscreen.tap(pt.x, pt.y))`. A real tap: script `play()` carries no user activation (measured 2026-09-29).
  - `holdVoiceOver(page)` calls `page.addInitScript(() => { const s = window.speechSynthesis; if (s) s.speak = () => {}; })`. **Must be registered before `page.goto`**. TTS ends at once under automation (429s), which would close the cue before it can be measured.
  - `injectQuiz(page, quiz)`:
    - `evaluate`: parse `[data-vp-config]:not(script)` `textContent`, set `.quiz = quiz`, write it back.
    - Then `waitForFunction(() => !!document.getElementById("vp-slot-quiz"))`. The controller remounts when the config JSON changes (`index.ts:239-244`, 200ms debounce plus 2 rAF).
  - `expectInsidePlayer(page, selectors: string[])`:
    - For each selector with a non-null box, `expect(contains(player, box), \`${sel} must stay inside the player (${fmt(box)} vs ${fmt(player)})\`).toBe(true)`.
  - `expectNoOverlap(page, selectors: string[])`:
    - `expect(overlappingPairs(boxes), "no two visible overlays may cover each other").toEqual([])`.
  - `export const QUIZ_FIXTURE`: one break at `t: 70`, one 4-option question with a 30s timeout. Copy the shape used in the 2026-09-29 Chrome check (a prompt ending in "… Erwartungen zu klären?", the correct option "Was soll am Ende dieser Stunde anders sein?").
- **IMPORTS**: `import { expect, type Page } from "@playwright/test"; import { contains, overlappingPairs, type Box } from "./geometry"; import { startHostPlayback } from "./assertions";`
- **GOTCHA**:
  - `window.player` typing: use the `window as unknown as { player: { seek(t: number): void; current: number } }` cast style from `assertions.ts`.
  - Do not use `locator.boundingBox()` for overlays: slot children can be judged invisible.
- **VALIDATE**: `bunx tsc --noEmit -p tsconfig.json && bun run lint`

### `[x]` Task 5: CREATE `e2e/overlay-mobile.spec.ts`

- **ACTION**: CREATE the spec, mirroring `overlay-canary.spec.ts`.
- **IMPLEMENT**:
  - `beforeEach`: `holdVoiceOver(page)` → `useRuntimeSource(page)` → `goto` → `waitForReskinSettled`.
  - Tests:
    1. `"demo-overlays mounts on a phone"`: `__vpDemoStatus === "demo overlay controller active"` and `#vp-slot-tl/-tr/-br/-lt` attached.
       - Do **not** call `expectDemoMounted`: its sidebar `toBeVisible()` branch would fail once P3 hides the sheet with `inert`.
    2. `"the page is emulated as a touch phone"`: `matchMedia("(hover: hover)").matches === false`, `matchMedia("(pointer: coarse)").matches === true`, `innerWidth === 390`.
       - This guards the project config: the compact CSS in P4 depends on it.
    3. `"the section and science pills sit inside the player"`: `seekTo(13.5)`, `expectInsidePlayer(["#vp-slot-tl .vp-section-pill", '#vp-slot-tr [data-overlay-action="science"]'])`.
    4. `"an injected quiz break covers the player"`: `injectQuiz(QUIZ_FIXTURE)` then `contains(playerBox, slotBox, 1) && contains(slotBox, playerBox, 1)`.
    5. `test.fixme("pills and the voice-over never overlap — spec M3/M4, fixed in P4", …)`:
       - `seekTo(40)`, `tapHostPlay`, wait for `.vp-audio-card`.
       - `expectInsidePlayer([".vp-audio-card"])`, then `expectNoOverlap([".vp-section-pill", '[data-overlay-action="science"]', '[data-overlay-action="meta"]', ".vp-audio-card"])`.
- **MIRROR**: `e2e/overlay-canary.spec.ts` (structure, annotations, `attachDiag`).
- **GOTCHA**:
  - The science timestamp at 12s and the voice-over at 45s are specific to the canary lesson `pgWcT1Bk`. Read them from `window.__vpConfig.data` rather than hard-coding where practical (e.g. `sciences[0].timestampsSec[0] + 1.5`), and skip with a reason when absent. A different `E2E_TARGET` may not have them.
- **VALIDATE**: `bunx playwright test --list --project=canary-mobile` lists 5 tests (1 fixme).

### `[x]` Task 6: UPDATE `playwright.config.ts` and `scripts/e2e.ts`

- **ACTION**: Add the project and run it.
- **IMPLEMENT**:
  - `canary`: add `testIgnore: /overlay-mobile\.spec\.ts$/`, with a comment on why the top-level `testMatch` would otherwise hand the mobile spec to the desktop project.
  - New project:
    ```ts
    // Phone geometry on the real host page. hasTouch — not isMobile — is what
    // flips (hover:hover) to false and (pointer:coarse) to true (verified,
    // Chrome 154), and the compact CSS keys on both.
    {
      name: "canary-mobile",
      testMatch: /overlay-mobile\.spec\.ts$/,
      dependencies: ["setup"],
      use: {
        storageState: STORAGE_STATE,
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
    ```
  - `scripts/e2e.ts:93`: `run("run canary", ["test", "--project=canary", "--project=canary-mobile", ...parsed.rest])`. Update the header comment (one line) to say phase 2 runs both device projects.
- **MIRROR**: `playwright.config.ts:65-70` (`canary` entry and its comment style).
- **GOTCHA**: Keep `resolve` out of `dependencies` (config comment 51-57). `canary-mobile` reads the same `targets.json` written by phase 1.
- **VALIDATE**: `bunx playwright test --list` shows `canary` without `overlay-mobile.spec.ts` and `canary-mobile` with only it.

### `[x]` Task 7: RUN the mobile project against local bundles

- **ACTION**: With `bun dev` running: `E2E_RUNTIME_BASE_URL=http://localhost:3000/runtime/loader.js bun run e2e`.
- **VALIDATE**: exit 0. The `canary-mobile` report shows 4 passed and 1 fixme; `canary` is unchanged.

---

## Testing Strategy

### Unit Tests to Write

| Test File                      | Test Cases                                                                                               | Validates        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- | ---------------- |
| `e2e/support/geometry.test.ts` | measured overlap (3224px²), voice-over not contained, touching edges = 0, null skipped, zero-size inside | Geometry helpers |

### Edge Cases Checklist

- [ ] A target lesson without sciences/audios: the dependent tests skip with a reason instead of failing
- [ ] LearningSuite's control bar not yet rendered: `hostControlPoint` polls 15s (unchanged)
- [ ] Session reuse: `auth.setup.ts` reuses a session under 30 minutes old (unchanged)

---

## Validation Commands

🔁 **Validation loop:** the plan is not complete until every command below passes (exit 0). On any failure, fix the cause and re-run — loop until all pass. If a check is genuinely impossible, mark it `[f]`, note why in Agent Notes, and move on.

### Level 1: STATIC_ANALYSIS

```bash
bun run lint && bunx tsc --noEmit -p tsconfig.json
```

**EXPECT**: Exit 0

### Level 2: UNIT_TESTS

```bash
bun run test e2e/support/
```

**EXPECT**: All pass

### Level 3: FULL_SUITE

```bash
bun run test && bunx playwright test --list
```

**EXPECT**: vitest green; the listing shows the split described in Task 6

### Level 4: DATABASE_VALIDATION

Not applicable.

### Level 5: BROWSER_VALIDATION

```bash
# bun dev must be running; .env.local holds E2E_LS_* credentials
E2E_RUNTIME_BASE_URL=http://localhost:3000/runtime/loader.js bun run e2e
```

**EXPECT**: `canary` unchanged (all pass); `canary-mobile` 4 passed, 1 fixme.

- [ ] Open `bun run e2e:report` and confirm the mobile tests ran at 390×844. The trace's viewport is 390 wide.

### Level 6: MANUAL_VALIDATION

None.

---

## Acceptance Criteria

- [ ] **AC1**: `bun run e2e` runs a `canary-mobile` project at 390×844 with touch against the resolved lesson(s).
- [ ] **AC2**: The desktop `canary` project does not collect the mobile spec.
- [ ] **AC3**: Helpers exist for seek, real-tap play, voice-over hold, quiz injection, inside-player and no-overlap, and are test-only (nothing under `runtime-src/` changes).
- [ ] **AC4**: The mobile spec passes today against local bundles, with the P4 geometry declared as `fixme`.
- [ ] **AC5**: The pure geometry helpers have vitest coverage.

---

## Completion Checklist

- [ ] All tasks completed in dependency order
- [ ] Level 1–3 pass; Level 5 run recorded (pass counts) in Agent Notes
- [ ] Commit with prefix `[TASK]` on `feature/mobile-overlays`

---

## Risks and Mitigations

| Risk                                                   | Likelihood | Impact | Mitigation                                                                                |
| ------------------------------------------------------ | ---------- | ------ | ----------------------------------------------------------------------------------------- |
| The mobile run logs out the shared account             | LOW        | MED    | Same `workers: 1`, same storageState reuse; the projects run sequentially                 |
| LearningSuite serves a different layout to a mobile UA | MED        | MED    | `isMobile` does not change the UA string (no `userAgent` set), same as the devtools check |
| The watch progress the canary accrues                  | LOW        | LOW    | The canary lesson lives in the throwaway `Test` course (`e2e/fixtures/lessons.ts`)        |

---

## Questionables

<details>
<summary>Run mobile in the same phase-2 invocation, or separately?</summary>

Assumed the same invocation (two `--project` flags). Both read the same `targets.json`, and one
invocation keeps the exit code logic in `scripts/e2e.ts` unchanged.

</details>

---

## Agent Notes

- Preview mode pins `__vpRuntimeBaseUrl`, which disables the loader's local probe
  (`loader/index.ts:187-195`). It routes `/runtime/*.js` from the Node side, so the cold-start
  probe miss seen in devtools cannot happen here.

---

## Amendments

_Append-only history of changes made **after** this plan was first built (newest at the bottom)._

<details>
<summary>2026-09-29T15:55Z — implemented</summary>

- **Built as planned:** `geometry.ts` (+ vitest), `mobile.ts`, the `hostControlPoint` split, the
  phone spec with a P4 `fixme`, the `canary-mobile` project, `canary.testIgnore`, and the runner
  running both projects.
- **Deviations** (each found on the live run):
  1. `runtime-source.ts` serves loopback previews from the Node side. Chrome's Local Network
     Access blocked the https tenant from loading http://localhost bundles, so this plan's Task 7
     could not work unmodified.
  2. `settleAnimations` runs before every geometry assertion. The science pill was measured
     mid-slide, 4px outside the player.
  3. `demoMoments` waits for `__vpConfig`. An early read silently skipped a test.
- **Result:** desktop 5/5; phone 4 passed + 1 fixme.

</details>
