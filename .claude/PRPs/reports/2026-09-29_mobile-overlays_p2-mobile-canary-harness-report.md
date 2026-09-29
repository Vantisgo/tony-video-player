# Implementation Report

**Plan**: `.claude/PRPs/plans/completed/2026-09-29_mobile-overlays_p2-mobile-canary-harness.plan.md`
**Source PRD**: `.claude/PRPs/prds/mobile-overlays.prd.md` (phase 2)
**Branch**: `feature/mobile-overlays`
**Date**: 2026-09-29
**Status**: COMPLETE

---

## Summary

Added a `canary-mobile` Playwright project that runs `e2e/overlay-mobile.spec.ts` on the live
LearningSuite lesson at 390×844 with touch. New test-only helpers:

- Playwright-free geometry: `geometry.ts`, with vitest coverage.
- Page helpers (`mobile.ts`): `readBox`, `playerBox`, `seekTo`, `tapHostPlay`, `holdVoiceOver`,
  `injectQuiz`, `demoMoments`, `expectInsidePlayer`, `expectNoOverlap`, `QUIZ_FIXTURE`.

The point-finding in `assertions.ts` is shared, so desktop presses with the mouse and the phone
project taps. The desktop project no longer collects the phone spec, and `bun run e2e` runs both
projects. The spec asserts what already holds and declares the P4 geometry as `fixme`.

---

## Assessment vs Reality

| Metric     | Predicted | Actual          | Reasoning                                                                            |
| ---------- | --------- | --------------- | ------------------------------------------------------------------------------------ |
| Complexity | MEDIUM    | MEDIUM          | Structure as planned, but three harness issues only showed up on the live run        |
| Confidence | 7/10      | met after fixes | The plan's "run against local bundles" step did not work unmodified (see Deviations) |

**Deviations:**

1. **`runtime-source.ts`: loopback previews are served from the Node side.**
   - Symptom: with `E2E_RUNTIME_BASE_URL=http://localhost:3000/runtime/loader.js`, the desktop test
     "reskin-player mounts" failed (`__vpReskinStatus` never set).
   - Cause: the loader resolves child bundles at the pinned localhost base. `serveFromPreview`
     passed same-origin requests through (`route.fallback()`), so the https page itself requested
     `http://localhost`, and Chrome's Local Network Access check silently blocked it.
   - Fix: for a loopback preview, every request to that origin (bundles, kill-switch, language
     packs, telemetry) is fetched with `route.fetch()` and fulfilled with its own headers. Remote
     (Vercel) previews are unchanged.
2. **`settleAnimations` before every geometry assertion.** The science pill read 4px outside the
   player because the box was taken during its 350ms `translateX(20px→0)` entrance. The plan's
   gotcha only named the voice-over card. The helper waits for the element's own finite
   animations (infinite ones such as the status-dot pulse are ignored).
3. **`demoMoments` waits for `window.__vpConfig`.** `__vpDemoStatus`, which `demoScriptRan` waits
   for, is set when the controller arms; `__vpConfig` only at mount, two frames later. Reading
   early returned nulls and silently skipped a test once.
4. Minor: `formatBox` added to `geometry.ts` for failure messages.

---

## Tasks Completed

| #   | Task                                                        | File                                     | Status                    |
| --- | ----------------------------------------------------------- | ---------------------------------------- | ------------------------- |
| 1   | Pure box math                                               | `e2e/support/geometry.ts`                | ✅                        |
| 2   | vitest coverage with the measured M2–M4 boxes               | `e2e/support/geometry.test.ts`           | ✅                        |
| 3   | `hostControlPoint` + press strategy for `startHostPlayback` | `e2e/support/assertions.ts`              | ✅                        |
| 4   | Page helpers                                                | `e2e/support/mobile.ts`                  | ✅                        |
| 5   | Phone spec (4 tests + 1 fixme)                              | `e2e/overlay-mobile.spec.ts`             | ✅                        |
| 6   | `canary.testIgnore`, `canary-mobile` project, runner        | `playwright.config.ts`, `scripts/e2e.ts` | ✅                        |
| 7   | Run against local bundles                                   | live tenant                              | ✅ (after deviations 1–3) |

---

## Validation Results

| Check                                             | Result | Details                                                                                                                      |
| ------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Type check (`bunx tsc --noEmit -p tsconfig.json`) | ✅     | 0 errors                                                                                                                     |
| Lint (changed files)                              | ✅     | `bunx eslint e2e playwright.config.ts scripts/e2e.ts`: 0 problems                                                            |
| Unit tests                                        | ✅     | 443 passed (includes 13 new geometry tests)                                                                                  |
| `playwright test --list`                          | ✅     | `canary`: 5 desktop tests, no phone spec; `canary-mobile`: 5 phone tests                                                     |
| Live e2e, local bundles                           | ✅     | Run 2 (full `bun run e2e`): desktop 5/5 passed. Final phone run: 4 passed, 1 fixme (skipped), setup skipped (session reused) |

---

## Files Changed

| File                            | Action               |
| ------------------------------- | -------------------- |
| `e2e/support/geometry.ts`       | CREATE               |
| `e2e/support/geometry.test.ts`  | CREATE               |
| `e2e/support/mobile.ts`         | CREATE               |
| `e2e/overlay-mobile.spec.ts`    | CREATE               |
| `e2e/support/assertions.ts`     | UPDATE               |
| `e2e/support/runtime-source.ts` | UPDATE (deviation 1) |
| `playwright.config.ts`          | UPDATE               |
| `scripts/e2e.ts`                | UPDATE               |

---

## Issues Encountered

- **First run hung silently for 580s.** The output was piped through `grep`, which buffers until
  the end, so nothing appeared. Rerun in the background with a log and a line-buffered monitor.
  The underlying failure was deviation 1.

---

## Tests Written

| Test File                      | Test Cases                                                                                                                                                                                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/support/geometry.test.ts` | measured science-over-section overlap (104×31); symmetry; touching = 0; disjoint = 0; voice-over not contained (M4); pills contained; sub-pixel tolerance; empty slot inside; named pair with area; off-screen skipped; zero-size ignored; all pairs once; `formatBox` |
| `e2e/overlay-mobile.spec.ts`   | mounts on a phone; touch-phone emulation (hover none, pointer coarse, 390); section + science pills inside the player; injected quiz covers the player; fixme: no overlap / voice-over inside (P4)                                                                     |

---

## Next Steps

- [ ] P3 adds sheet assertions to `overlay-mobile.spec.ts` (in progress)
- [ ] P4 flips the `fixme`
