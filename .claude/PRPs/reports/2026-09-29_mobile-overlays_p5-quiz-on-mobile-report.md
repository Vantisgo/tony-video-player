# Implementation Report

**Plan**: `.claude/PRPs/plans/completed/2026-09-29_mobile-overlays_p5-quiz-on-mobile.plan.md`
**Source PRD**: `.claude/PRPs/prds/mobile-overlays.prd.md` (phase 5)
**Branch**: `feature/mobile-overlays`
**Date**: 2026-09-29
**Status**: COMPLETE

---

## Summary

On compact players outside fullscreen, `placeQuizSlot` moves the existing `#vp-slot-quiz` from the
player to `<body>` and makes it `position:fixed` at z-index 1150. That is above LearningSuite's
bottom bar (999) and our sheet (1100), and below LearningSuite's overlay layers (1200). The scrim
stays `absolute` inside the fixed slot. A single `QUIZ_CSS` rule forces one answer column when the
quiz is promoted.

The slot moves back when the player grows to full size or goes fullscreen, and keyboard focus is
restored to the dialog after a move. The quiz controller itself is unchanged: it holds the slot by
reference.

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning                                                                           |
| ---------- | --------- | ------ | ----------------------------------------------------------------------------------- |
| Complexity | MEDIUM    | MEDIUM | As planned; about 40 lines of runtime code                                          |
| Confidence | 8/10      | met    | e2e, unit tests (focus restore mutation-checked) and Chrome at V1/V2/V5/V6 all pass |

**Deviations:**

- **Spec P5 criterion adjusted (plan Questionable, now settled):** after a quiz the empty slot stays
  under `<body>`. Placement follows compact mode, not quiz activity. The e2e test asserts the
  user-visible outcome instead: after the quiz, `elementFromPoint(195, 812)` is no longer inside
  the slot.
- P2's phone test "an injected quiz break covers the player" was replaced. On a phone the quiz now
  covers the viewport, so the old assertion no longer describes the correct behaviour.

---

## Tasks Completed

| #   | Task                                                                             | File                                                     | Status |
| --- | -------------------------------------------------------------------------------- | -------------------------------------------------------- | ------ |
| 1   | `PROMOTED_QUIZ_Z = 1150`                                                         | `runtime-src/demo-overlays/index.ts`                     | ✅     |
| 2   | `placeQuizSlot` in the compact callback and on `fullscreenchange`; focus restore | `runtime-src/demo-overlays/index.ts`                     | ✅     |
| 3   | One column when promoted                                                         | `runtime-src/demo-overlays/styles.ts`                    | ✅     |
| 4   | Placement tests                                                                  | `runtime-src/tests/demo-overlays/quiz-placement.test.ts` | ✅     |
| 5   | Phone e2e: full-screen quiz                                                      | `e2e/overlay-mobile.spec.ts`                             | ✅     |
| 6   | Bundle + Chrome                                                                  | `public/runtime/demo-overlays.js`, live lesson           | ✅     |

---

## Validation Results

| Check                           | Result | Details                                                                                                                                                        |
| ------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typecheck:runtime`, root `tsc` | ✅     | 0 errors                                                                                                                                                       |
| Lint (changed files)            | ✅     | 0 problems                                                                                                                                                     |
| Unit tests                      | ✅     | 500 passed / 47 files. The focus-restore test fails when the restore is removed (mutation-checked)                                                             |
| e2e phone quiz                  | ✅     | Slot = viewport; covers LearningSuite's bottom bar; the card needs no scrolling; one column; answering marks `correct`; afterwards nothing of ours blocks taps |

**Level 5, Chrome, live lesson, client-side injected quiz:**

- **V5 1024×768:** promoted, a 560×329 card with no scrolling, over a dimmed desktop page
  (screenshot taken for the Questionable).
- **V6 1920×1080:** the player is 752×424, full size, so the quiz stays in the player (`absolute`,
  z-index 20), as before.
- **V2 844×390:** promoted, 844×390, and the card fits with no scrolling.

---

## Tests Written

| Test File                | Test Cases                                                                                                                                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quiz-placement.test.ts` | promoted to `body` (fixed, 1150) on a compact player; back in the player at full size (absolute, 20); stays in the player during fullscreen and is re-promoted after; focus stays in the dialog when moved; z between 1100 and 1200; single-column rule; teardown removes the promoted slot |
| `overlay-mobile.spec.ts` | a quiz covers the whole phone screen and needs no scrolling (see above)                                                                                                                                                                                                                     |
