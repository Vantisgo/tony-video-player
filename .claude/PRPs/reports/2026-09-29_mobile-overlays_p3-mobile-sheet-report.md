# Implementation Report

**Plan**: `.claude/PRPs/plans/completed/2026-09-29_mobile-overlays_p3-mobile-sheet.plan.md`
**Source PRD**: `.claude/PRPs/prds/mobile-overlays.prd.md` (phase 3)
**Branch**: `feature/mobile-overlays`
**Date**: 2026-09-29
**Status**: COMPLETE. The Level 6 device check for fullscreen is still open.

---

## Summary

The sidebar `<aside>` now has two hosts (`sidebar-host.ts`):

- **Desktop (≥ 1024px):** the flex-sibling and fixed-rail placement, moved unchanged out of
  `index.ts`.
- **Sheet (< 1024px), `mobile-sheet.ts`:**
  - a tab bar is inserted directly after the player;
  - the same `<aside>` becomes a fixed sheet under `<body>` (z-index 1100), `inert` while closed;
  - opening scrolls the page toward the player and docks the sheet at the player's bottom edge,
    as computed by the pure `sheetTop()` (`sheet-geometry.ts`, shared with e2e);
  - while open, the sheet follows the player on scroll and resize, within a 45% portrait / 60%
    landscape minimum;
  - ✕ and Escape close it, and focus returns to the opener;
  - it moves into the fullscreen element on `fullscreenchange`.

`window.__vpSidebarTab` points at `host.open`, so the science and meta pills open the sheet on phones.
A closed sheet no longer lets a science highlight scroll the page.

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning                                                                               |
| ---------- | --------- | ------ | --------------------------------------------------------------------------------------- |
| Complexity | HIGH      | HIGH   | As planned; the moved desktop code was verified to be identical                         |
| Confidence | 7/10      | met    | Every Level 5 check passed on the live lesson; e2e green after two harness timing fixes |

**Deviations:**

1. **The sheet docks at 368 on the live page, not the spec's 428.** The tab bar makes the page
   60px taller, so max scroll is 166 instead of 106 and the player can scroll further up. The rule
   is unchanged (the player's bottom after scrolling) and the video stays fully visible. The sheet
   is taller as a result (476px). The e2e test compares against `sheetTop()` computed on the page;
   the unit test still pins the M9 numbers (a 950px document gives 428).
2. **Two P2 harness races surfaced and were fixed in a separate commit (`0f26c6e`).**
   - Tests measured before the controller had mounted (`__vpDemoStatus` means armed, not
     mounted).
   - LearningSuite's saved-position seek could undo `seekTo`.
3. The ✕ glyph is a literal in `mobile-sheet.ts`, with its accessible name from `demo.sheet.close`.
   The file is not covered by `no-bare-strings`.

---

## Tasks Completed

| #   | Task                                                                                      | File                                                     | Status                                      |
| --- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------- |
| 1   | Pure sheet geometry                                                                       | `runtime-src/demo-overlays/sheet-geometry.ts`            | ✅                                          |
| 2   | Geometry table tests (M9, M10, edges)                                                     | `runtime-src/tests/demo-overlays/sheet-geometry.test.ts` | ✅                                          |
| 3   | EN + DE strings                                                                           | `runtime-src/common/i18n/demo.ts`                        | ✅                                          |
| 4   | Pre-wrap reset for `.vp-sheet-ui`                                                         | `runtime-src/demo-overlays/styles.ts`                    | ✅                                          |
| 5   | Tab bar + sheet                                                                           | `runtime-src/demo-overlays/mobile-sheet.ts`              | ✅                                          |
| 6   | Host module, desktop code moved unchanged                                                 | `runtime-src/demo-overlays/sidebar-host.ts`              | ✅                                          |
| 7   | Wire the host; `__vpSidebarTab = host.open`; `checkAlive`; `OWNED_NODE_IDS`; scroll guard | `runtime-src/demo-overlays/index.ts`                     | ✅                                          |
| 8   | New unit tests                                                                            | `sidebar-host.test.ts`, `mobile-sheet.test.ts`           | ✅                                          |
| 9   | Update the tests that asserted today's mobile behaviour                                   | `lifecycle`, `safety-net`, `open-affordance`             | ✅                                          |
| 10  | Phone e2e assertions for the sheet                                                        | `e2e/overlay-mobile.spec.ts`                             | ✅                                          |
| 11  | Regenerate the bundle                                                                     | `public/runtime/demo-overlays.js`                        | ✅                                          |
| 12  | Chrome verification                                                                       | live lesson                                              | ✅ (the fullscreen device check is Level 6) |

---

## Validation Results

| Check                           | Result | Details                                                                                                                                          |
| ------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `typecheck:runtime`, root `tsc` | ✅     | 0 errors                                                                                                                                         |
| Lint (changed files)            | ✅     | `bunx eslint runtime-src e2e …`: 0 problems                                                                                                      |
| Unit tests                      | ✅     | 458 passed / 44 files. The `scrollIntoView` guard test fails when the guard is removed (mutation-checked)                                        |
| Moved desktop code              | ✅     | After removing the indentation difference, `diff` against HEAD is identical; only the install call changed (the guard moved to `chooseHostMode`) |
| e2e desktop (`canary`)          | ✅     | 5/5, run 3                                                                                                                                       |
| e2e phone (`canary-mobile`)     | ✅     | 8 passed, 1 fixme (P4)                                                                                                                           |

**Level 5, Chrome, live lesson with local runtime:**

- **V1 390×844:**
  - the tab bar sits at y=534, the player's bottom, with 3×44px buttons and `white-space: normal`;
  - the sheet starts `inert` under `body`;
  - tapping Science Corner scrolls the page 166px, and the sheet's top is at 368 = the player's
    bottom, so the video is fully visible;
  - the science panel is shown, focus is on ✕ (44×44), and `elementFromPoint(195,800)` is inside
    the sheet;
  - Escape closes it;
  - a science pill appearing while the sheet is closed left `scrollY` unchanged;
  - the pill's "Öffnen" opens Science Corner at 368;
  - 25s of playback: 0 tab bar removals, same element (no flicker or remount).
- **V2 844×390:** sheet top 156, height 234 = 60%.
- **V5 1024 / V6 1920:** no tab bar; the sidebar is the flex sibling as before (V5 x=597 w=380;
  V6 player 752×424).
- **Breakpoint 1100 → 900 → 1100:** sheet mode at 900, flex sibling at 1100, no LearningSuite
  sibling left hidden.

---

## Files Changed

| File                                                                                 | Action                           |
| ------------------------------------------------------------------------------------ | -------------------------------- |
| `runtime-src/demo-overlays/sheet-geometry.ts`                                        | CREATE                           |
| `runtime-src/demo-overlays/mobile-sheet.ts`                                          | CREATE                           |
| `runtime-src/demo-overlays/sidebar-host.ts`                                          | CREATE                           |
| `runtime-src/demo-overlays/index.ts`                                                 | UPDATE (−124 moved, host wiring) |
| `runtime-src/demo-overlays/styles.ts`                                                | UPDATE                           |
| `runtime-src/common/i18n/demo.ts`                                                    | UPDATE                           |
| `runtime-src/tests/demo-overlays/{sheet-geometry,mobile-sheet,sidebar-host}.test.ts` | CREATE                           |
| `runtime-src/tests/demo-overlays/{lifecycle,safety-net,open-affordance}.test.ts`     | UPDATE                           |
| `e2e/overlay-mobile.spec.ts`                                                         | UPDATE                           |
| `e2e/support/mobile.ts`                                                              | UPDATE (separate harness fix)    |
| `public/runtime/demo-overlays.js`                                                    | REGENERATE                       |

---

## Issues Encountered

- **Race conditions in the phone canary (run 3):** 3 of the new tests failed from timing, not
  behaviour. Fixed in `0f26c6e` (`waitForDemoMount`, and a `seekTo` that retries until the seek
  holds).

---

## Tests Written

| Test File                | Test Cases                                                                                                                                                                                                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sheet-geometry.test.ts` | 45%/60%/square `sheetMaxTop`; M9 → 428/106; M10 → 156/400; scrolled past; cannot scroll; never above viewport                                                                                                                                                                             |
| `sidebar-host.test.ts`   | `chooseHostMode` truth table (4)                                                                                                                                                                                                                                                          |
| `mobile-sheet.test.ts`   | tab bar after the player (labels, 44px, aria); closed + inert at mount; open on the tapped tab at 428 with smooth scroll to 106; ✕/Escape + focus return; science pill opens it; no `scrollIntoView` while closed; follow + clamp; fullscreen re-parent; z between 999 and 1200; teardown |
| `lifecycle.test.ts`      | sheet host below 1024 ↔ desktop above it                                                                                                                                                                                                                                                  |
| `safety-net.test.ts`     | LearningSuite column restored when swapping to the sheet; the phone rollback removes the tab bar and sheet                                                                                                                                                                                |
| `overlay-mobile.spec.ts` | tab bar under the player; each tab docks at computed `sheetTop`, video visible, full width, on top of LearningSuite's bar; science pill opens Science Corner; ✕ closes                                                                                                                    |

---

## Next Steps

- [ ] Level 6: on an Android phone or iPad, enter LearningSuite fullscreen, tap the science pill,
      and record `document.fullscreenElement` (PRD open question M13)
- [ ] P4 (compact overlays) and P6 (desktop squeeze) can start. P6 builds on `sidebar-host.ts`
