# Implementation Report

**Plan**: `.claude/PRPs/plans/2026-09-04_vo-defects_prewrap-reset-and-playback-gate.plan.md`
**Branch**: `feature/e2e-canary-playwright`
**Date**: 2026-09-04
**Status**: COMPLETE

---

## Summary

Both defects fixed and verified in a real browser. A `SLOT_CSS` reset scoped to a new `vp-slot`
class on all five injected slots neutralises the LearningSuite host's inherited
`white-space: pre-wrap`, taking the voice-over banner from 200px to a single 66px row. A sticky
`playbackStarted` latch in front of `quizCtrl.onTime` and `maybeTriggerAudio` stops a cue or
quiz authored at `t: 0` from firing at mount; the learner presses play once, the voice-over
pre-rolls, and the video resumes on its own.

---

## Assessment vs Reality

| Metric     | Predicted | Actual        | Reasoning                                                                                                                                                                                                                                                |
| ---------- | --------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complexity | LOW       | LOW-MED       | The two fixes were as small as planned (one CSS rule, one latch). The extra work was all in verification: the plan's own mitigation for the specificity tie turned out untestable, and the chosen style id collided with a sweep the plan never noticed. |
| Confidence | 9/10      | 8/10 realised | Root causes were exactly right and the pre-roll needed no extra wiring, as predicted. Two implementation-level errors in the plan (below) cost a cycle each.                                                                                             |

**Deviations, with cause:**

1. **Style id renamed `vp-slot-style` → `__vp-slot-style`.** `mountInner`'s defensive sweep
   (`index.ts:340-345`) removes every `OWNED_NODE_IDS` entry whose id starts with `vp-slot-`,
   intended for the slot _elements_. The plan specified the id `vp-slot-style` and reasoned
   about the `vp-*`/`__vp-*` prefix convention without spotting that the prefix is a reserved
   namespace, so the runtime deleted its own stylesheet three lines after injecting it.
2. **Specificity replaces injection order for the quiz nowrap.**
   `.vp-quiz-summary-row-text` raised to `.vp-quiz-card .vp-quiz-summary-row-text` (0,2,0).
   The plan relied on source order to break the 0,1,0 tie against `.vp-slot *` and added a
   test to guard it — but happy-dom does not model equal-specificity source-order tiebreaks
   (it reported the reset winning where Chrome 152 reports the later rule winning), so the
   guard was inexpressible. Specificity makes the outcome order-independent and assertable.
3. **One existing test's setup changed.** `falls back when play() is rejected by the autoplay
policy` stubs `HTMLMediaElement.prototype.play` globally and never played the video, so
   under the gate its cue legitimately never fired. It now plays the video _before_ installing
   the stub. Assertions unchanged. The plan's Task 4 GOTCHA claimed the element-state gate
   would keep the whole suite green; that was wrong for this one test.
4. **Quiz gate tests live in `audio.test.ts`, not `quiz.test.ts`.** The plan said
   `quiz.test.ts`, but that file has no mount harness at all (992 lines of
   `createQuizController` unit tests). The gate is one mechanism in `recomputeActive`; its
   tests belong together rather than duplicating a mount harness into a second file.

---

## Tasks Completed

| #   | Task                           | File                                             | Status          |
| --- | ------------------------------ | ------------------------------------------------ | --------------- |
| 1   | Add `SLOT_CSS` export          | `runtime-src/demo-overlays/styles.ts`            | ✅              |
| 2   | `vp-slot` class in `makeSlot`  | `runtime-src/demo-overlays/index.ts`             | ✅              |
| 3   | Inject `SLOT_CSS`, register id | `runtime-src/demo-overlays/index.ts`             | ✅ (id renamed) |
| 4   | Playback-start gate            | `runtime-src/demo-overlays/index.ts`             | ✅              |
| 5   | Reset tests                    | `runtime-src/tests/demo-overlays/render.test.ts` | ✅              |
| 6   | Gate + pre-roll tests          | `runtime-src/tests/demo-overlays/audio.test.ts`  | ✅              |
| 7   | Quiz-at-t:0 tests              | `runtime-src/tests/demo-overlays/audio.test.ts`  | ✅ (relocated)  |
| 8   | Rebuild bundles                | `public/runtime/demo-overlays.js`                | ✅              |
| 9   | Distil to feature context      | `docs/feature-context.md`                        | ✅              |

---

## Validation Results

| Check                     | Result | Details                                                                                                                                                  |
| ------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type check                | ✅     | `bun run typecheck:runtime` exit 0                                                                                                                       |
| Lint                      | ✅     | 17 problems (7 errors, 10 warnings) — all pre-existing in `app/admin/`, `app/api/lessons/`, `components/video-player/`; **0 findings in `runtime-src/`** |
| Unit tests                | ✅     | 359 passed, 0 failed (32 files); `demo-overlays` 93 passed, up from 81                                                                                   |
| Build                     | ✅     | `bun run build:runtime`; only `demo-overlays.js` changed                                                                                                 |
| Drift                     | ✅     | Bundle regenerated and staged; `git diff -- public/runtime` clean once committed                                                                         |
| Browser (real Chrome 152) | ✅     | See below                                                                                                                                                |

### Browser validation

Run against a local harness reproducing the host condition (`white-space: pre-wrap` wrapper +
the real built bundle + a `t: 0` cue), **not** the live tenant — see Issues.

- Reset injected (`__vp-slot-style` present); wrapper inherits `pre-wrap`, slot subtree
  computes `normal`
- Banner renders **66px** in one row; its two `display:block` wrappers measure 44px and 34px,
  against 160px and 178px before the fix
- Page loaded, nothing touched: video paused @ 0, `audioState: "idle"`, no banner
- Meta pill still rendered while paused — confirms only the two triggers were gated
- Press play once: `audioState: "playing"`, banner shown, video paused for the pre-roll
- Cue ends: video playing again @ 0, banner gone, **no second press**

---

## Files Changed

| File                                             | Action             | Lines   |
| ------------------------------------------------ | ------------------ | ------- |
| `runtime-src/demo-overlays/styles.ts`            | UPDATE             | +29/-2  |
| `runtime-src/demo-overlays/index.ts`             | UPDATE             | +71/-3  |
| `runtime-src/tests/demo-overlays/audio.test.ts`  | UPDATE             | +190/-4 |
| `runtime-src/tests/demo-overlays/render.test.ts` | UPDATE             | +74     |
| `public/runtime/demo-overlays.js`                | UPDATE (generated) | +29/-3  |
| `docs/feature-context.md`                        | UPDATE             | +60     |

---

## Issues Encountered

1. **The runtime deleted its own stylesheet.** Diagnosed by running the real bundle in real
   Chrome and finding `vp-anim-style` present but `vp-slot-style` absent, three lines apart in
   the source. Cause: the `vp-slot-` prefix sweep. Fixed by renaming; the prefix contract is
   now commented at both the injection site and the sweep, and a mount-level test pins it
   (verified red with the collision reintroduced, green after).
2. **Level 5 could not run against the live tenant.** The tenant loads `demo-overlays.js` as a
   direct tag from an immutable per-commit Vercel URL, so the loader's local-first probe never
   governs it; injecting the local bundle by hand was refused by Chrome with _"Permission was
   denied for this request to access the `loopback` address space"_ — Local Network Access, not
   CSP. `bun dev` also cannot start here (`env.ts` requires `DATABASE_URL` and
   `BLOB_READ_WRITE_TOKEN`, unset locally — `feature-context.md:124` documents the same for
   `build`). Mitigated with a local harness reproducing the `pre-wrap` wrapper and serving the
   real built bundle, which exercises the same rendering engine. **What remains unverified on
   the tenant itself** is the integration with LearningSuite's actual DOM and fonts; the
   harness measured 66px where the tenant's design target is 62px, a font-metric difference.
3. **The height defect is not assertable in the unit suite.** happy-dom returns 0 from
   `getBoundingClientRect()`/`offsetHeight`/`clientHeight` by design. Tests pin the computed
   `white-space` as a proxy; the height itself is a browser-only check.

---

## Tests Written

| Test File        | Test Cases                                                                                                                                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `render.test.ts` | inherits `pre-wrap` without the reset; computes `normal` with it; quiz `nowrap` survives the tie; quiz `nowrap` survives even with the reset injected last                                                                                                                                        |
| `audio.test.ts`  | runtime injects the reset and it survives the owned-id sweep; t:0 cue idle at mount; passive pills render while paused; cue fires on first play and pauses the video; video resumes with no second press; latch stays open across a pause; quiz at t:0 closed at mount; quiz at t:0 opens on play |

Net: `demo-overlays` suite 81 → 93 cases.

---

## Observation (not fixed, out of scope)

`renderAudio`'s fast-update branch pokes `[data-fill]`, `[data-elapsed]` and the play/pause
button, but not the "SPIELT"/"PAUSIERT" status span — so after a pause the icon is correct
while the label is stale. Pre-existing, unrelated to these fixes, and the plan explicitly
excludes touching `renderAudio`'s markup. Natural to fold into the redesign plan, which
rewrites that markup anyway.

---

## Next Steps

- [ ] Review the implementation, especially the two plan deviations
- [ ] Verify on the live tenant once the runtime is deployed and the tenant tag bumped — the
      62px height and the pre-roll are the two things to look at
- [ ] Commit (bundle included — CI drift-checks `public/runtime`)
- [ ] Then `2026-09-04_vo-redesign_main-composition-dark-card.plan.md`, whose Task 0 gates on
      this plan's Tasks 1–3
