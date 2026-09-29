# Implementation Report

**Plan**: `.claude/PRPs/plans/completed/2026-09-29_mobile-overlays_p6-desktop-squeeze.plan.md`
**Source PRD**: `.claude/PRPs/prds/mobile-overlays.prd.md` (phase 6)
**Branch**: `feature/mobile-overlays`
**Date**: 2026-09-29
**Status**: COMPLETE

---

## Summary

On `tryFlexSibling`'s success path (`sidebar-host.ts`), a `childList` `MutationObserver` on
`<main>`'s flex parent hides every element LearningSuite adds there after our mount, other than
`<main>` and our sidebar.

- It records each element's first-seen inline `display` in the same `prevDisplays` map that
  `restoreHost` uses.
- It never hides a `<main>` or an element wrapping one.
- It disconnects on cleanup and does not remount anything.

Widening the window across LearningSuite's 1536px (MUI `xl`) breakpoint no longer squeezes the
player: 1440 → 1600 now goes 553×312 → 641×361, the same as a fresh load, instead of 317×179.

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning                                                                                    |
| ---------- | --------- | ------ | -------------------------------------------------------------------------------------------- |
| Complexity | LOW       | LOW    | 28 lines of runtime code, as designed and probed                                             |
| Confidence | 9/10      | met    | Unit tests (mutation-checked twice), e2e (fails on the pre-P6 runtime), and Chrome all green |

**Deviations:**

- **happy-dom:** `bun update` moved it to 20.14.5 (the newest in range) rather than just ≥ 20.11.2,
  and rewrote the `package.json` specifier to `^20.14.5`. The full suite of 500 tests passed on
  it. Committed separately in `55decb6`.
- The desktop spec's import needed `expect` as well as `test`; it only had `test` before.

---

## Tasks Completed

| #   | Task                                 | File                                                         | Status       |
| --- | ------------------------------------ | ------------------------------------------------------------ | ------------ |
| 1   | happy-dom ≥ 20.11.2                  | `package.json`, `bun.lock`                                   | ✅ (20.14.5) |
| 2   | `siblingWatch` on the success branch | `runtime-src/demo-overlays/sidebar-host.ts`                  | ✅           |
| 3   | Unit tests                           | `runtime-src/tests/demo-overlays/flex-sibling-watch.test.ts` | ✅           |
| 4   | `hostBox` + desktop e2e test         | `e2e/support/assertions.ts`, `e2e/overlay-canary.spec.ts`    | ✅           |
| 5   | Bundle                               | `public/runtime/demo-overlays.js`                            | ✅           |
| 6   | Chrome                               | live lesson                                                  | ✅           |

---

## Validation Results

| Check                           | Result | Details                                                                                                                 |
| ------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| `typecheck:runtime`, root `tsc` | ✅     | 0 errors                                                                                                                |
| Lint (changed files)            | ✅     | 0 problems                                                                                                              |
| Unit tests                      | ✅     | 509 passed / 48 files. Without `observe()`, 4 tests fail; without the `has()` guard, the move and re-insert tests fail  |
| e2e desktop                     | ✅     | "widening past xl never shrinks the player" passes; against the pre-P6 runtime it fails ("the column … must be hidden") |

**Level 5, Chrome, live lesson with local runtime:**

- Fresh load at 1440: 553×312. Widened to 1600: **641×361**, with the new column `display:none`.
- Back to 1440 (LearningSuite removes the column): 553×312. To 1600 again: 641×361, and the new
  column is hidden.
- 30s of playback at 1600 after widening: the size and the hidden column hold.
- Fresh load at 1600: 641×361, unchanged.
- **Teardown** (config rewritten without sidebar content): no sidebar, and LearningSuite's column
  is back to `display: flex`.

---

## Tests Written

| Test File                    | Test Cases                                                                                                                                                                                                                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flex-sibling-watch.test.ts` | inserted sibling hidden; teardown restores `"flex"`; removed and re-inserted stays hidden and restores; moved sibling keeps its first-seen display; text nodes and sidebar ignored; `<main>` / wrapped `<main>` never hidden; fixed rail installs no watcher; no remount (slot identity); nothing is watched after teardown |
| `overlay-canary.spec.ts`     | widening past LearningSuite's xl breakpoint never shrinks the player                                                                                                                                                                                                                                                        |
