# Implementation Report

**Plan**: `.claude/PRPs/plans/completed/2026-09-29_mobile-overlays_p4-compact-overlays.plan.md`
**Source PRD**: `.claude/PRPs/prds/mobile-overlays.prd.md` (phase 4)
**Branch**: `feature/mobile-overlays`
**Date**: 2026-09-29
**Status**: COMPLETE

---

## Summary

A `ResizeObserver` on the player host (`compact.ts`, `observeCompact`) classifies the player with
`isCompact(width, height)` (`width < 750 || height < 280`) and sets `data-vp-compact="1"` on every
`.vp-slot`. The compact variants are CSS:

- **Voice-over:** one row, 58px tall, spanning the player (the slot is widened by JS). Play/pause
  and skip are 40×40, and progress is a 3px line on the bottom edge.
- **Science pill:** 🧪 plus a 40px "Öffnen".
- **Section pill:** reserves the top-right corner, never expands inside the video, and a tap opens
  Coaching (the sheet on phones, the sidebar tab on desktop).
- **Meta pill:** capped width, ellipsis, no "Schritt n / N".

Independently of compact mode:

- every `:hover` rule is under `@media (hover:hover)`;
- on full-size touch players a tap pins the section pill (`data-pinned`);
- the pills' inline styles moved 1:1 into `PILL_CSS` classes;
- the meta slot gained a `max-width`;
- the 58px bottom offset is documented as measured.

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning                                                                                                                                 |
| ---------- | --------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Complexity | HIGH      | HIGH   | CSS-heavy; happy-dom cannot render it, so correctness came from Chrome and e2e                                                            |
| Confidence | 7/10      | met    | Full-size look identical at 1920; compact geometry verified at 390 and 1024; the e2e check fails on the pre-P4 runtime and passes with P4 |

**Deviations:**

1. **User feedback:** the user asked me to write `isCompact` myself instead of the planned user
   contribution. It is written with named constants `FULL_MIN_WIDTH = 750` and
   `FULL_MIN_HEIGHT = 280`.
2. `observeCompact` takes an optional `classify` parameter (default `isCompact`), so the observer's
   tests do not depend on the rule.
3. P1's inline `cursor` became `data-can-open`, and the cursor is CSS keyed on it. The
   `open-affordance.test.ts` assertions were updated. The science pill's 6px-vs-12px right padding
   (with or without the button) is kept through the same attribute.
4. The compact section pill gets `cursor:pointer` from CSS.
5. **e2e:** the voice-over test starts playback first and seeks second. Starting playback makes
   LearningSuite jump to the shared account's saved position, which can lie past the cue.
6. The CSS-contract test strips `/* … */` comments before checking for `:hover`.

---

## Tasks Completed

| #   | Task                                                                                       | File                                                  | Status |
| --- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------- | ------ |
| 1   | `observeCompact` + `isCompact` scaffold                                                    | `runtime-src/demo-overlays/compact.ts`                | ✅     |
| 2   | `isCompact` rule (written on request, see Deviations)                                      | same                                                  | ✅     |
| 3   | Test contract (measured players + boundaries) and observer tests                           | `runtime-src/tests/demo-overlays/compact.test.ts`     | ✅     |
| 4   | `PILL_CSS` (1:1 move + compact)                                                            | `runtime-src/demo-overlays/styles.ts`                 | ✅     |
| 5   | Section/audio compact rules; `(hover:hover)` guards incl. `QUIZ_CSS`                       | `runtime-src/demo-overlays/styles.ts`                 | ✅     |
| 6   | Observe/apply, `#vp-slot-lt` geometry, `slotBR` max-width, `__vp-pill-style`, 58px comment | `runtime-src/demo-overlays/index.ts`                  | ✅     |
| 7   | Pill markup to classes                                                                     | `runtime-src/demo-overlays/index.ts`                  | ✅     |
| 8   | Section-pill tap (compact → Coaching; touch → pin)                                         | `runtime-src/demo-overlays/index.ts`                  | ✅     |
| 9   | Mount-level tests; P1 test update                                                          | `compact-overlays.test.ts`, `open-affordance.test.ts` | ✅     |
| 10  | e2e: fixme flipped + P4 assertions                                                         | `e2e/overlay-mobile.spec.ts`                          | ✅     |
| 11  | Bundle + Chrome                                                                            | `public/runtime/demo-overlays.js`, live lesson        | ✅     |

---

## Validation Results

| Check                           | Result | Details                                                                                                                                                             |
| ------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typecheck:runtime`, root `tsc` | ✅     | 0 errors                                                                                                                                                            |
| Lint (changed files)            | ✅     | 0 problems                                                                                                                                                          |
| Unit tests                      | ✅     | 493 passed / 46 files                                                                                                                                               |
| e2e phone                       | ✅     | See the final run in Agent Notes of the archived plan; the overlap test fails against the pre-P4 runtime (card 56,312 320×164 vs player top 315) and passes with P4 |

**Level 5, Chrome, live lesson with local runtime:**

- **V1 390×844 (compact):**
  - section pill x 14–175; science pill 110×42 at x 270–380, no overlap;
  - "Öffnen" 69×40; meta pill 105×40 with its step label hidden;
  - voice-over bar 362×58 at y 418–476, inside the player (315–534), with 2 buttons of 40×40.
- **V5 1024×768 (compact, desktop host):**
  - no overlap between the pills;
  - a section-pill tap switches the sidebar to Coaching;
  - voice-over bar 431×58, clear of the section pill.
- **V6 1920×1080 (full, 752×424 player):**
  - science pill 309×35, with the label, the name and the original padding and gradient;
  - voice-over 320×168 with 4 buttons.

---

## Tests Written

| Test File                  | Test Cases                                                                                                                                                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compact.test.ts`          | 9 compact players, 2 full, width boundary 749/750, height boundary 279/280; observer: initial apply, change-only apply, unsized = not compact, disconnect, resize fallback                                                                           |
| `compact-overlays.test.ts` | all slots marked + `#vp-slot-lt` widened and restored; pills styled by class; compact tap → Coaching (desktop) and the sheet (phone); touch pin toggle; mouse no pin; `:hover` only under `(hover:hover)` in four stylesheets; compact rules present |
| `overlay-mobile.spec.ts`   | slots marked compact; no overlap and everything inside the player with the voice-over playing (bar ≤ 60px, buttons ≥ 40px); Open ≥ 40px beside the section pill; section-pill tap opens the sheet on Coaching                                        |
