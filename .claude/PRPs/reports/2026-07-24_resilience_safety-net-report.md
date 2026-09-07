# Implementation Report

**Plan**: `.claude/PRPs/plans/completed/2026-07-24_resilience_safety-net.plan.md`
**Branch**: `feature/mm-refactoring`
**Date**: 2026-07-24
**Status**: COMPLETE (F1, F2, F3, F4 implemented + tested)

---

## Summary

Enforced the invariant _"if we can't fully augment the player, leave the native
player exactly as we found it and fully functional."_ Four changes:

- **F1** — scoped every native-chrome-hiding CSS rule under
  `[data-vp-reskinned="true"]`, so native controls are hidden only when a reskin
  actually succeeds (previously hidden unconditionally at script load).
- **F2** — wrapped `attach()` and demo `applySetup()` in try/catch with
  auto-rollback (an incremental `undo` list in reskin; `resetCleanup` + node
  removal in demo), so a mid-augmentation throw restores the native player.
- **F3** — preconditions before mutating: reskin asserts required shell nodes
  exist (→ rollback if not); demo `tryFlexSibling()` skips the invasive sibling
  reshuffle unless `<main>` has a real (non-zero) box.
- **F4** — post-attach `requestAnimationFrame` self-verification: if the overlay
  layer has a zero box over a _visible_ player, tear down (native returns);
  off-screen players are left for a later scan.

---

## Assessment vs Reality

| Metric     | Predicted          | Actual                             | Reasoning                                                                                                                       |
| ---------- | ------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Complexity | F1/F2 P0, F3/F4 P2 | Low (F1), medium (F2), low (F3/F4) | F2's challenge was wrapping ~900-line functions in try/catch without a giant re-indent — solved with a wrapper/inner split.     |
| Confidence | High for F1/F2     | High                               | The CSS/JS asymmetry (F1) and pre-registration mutation window (F2) were exactly as the analysis described.                     |
| Scope      | reskin + demo      | reskin + demo, as planned          | happy-dom (not jsdom) actually _helped_ — it computes the descendant cascade, so F1 is verified behaviorally, not just by text. |

---

## Tasks Completed

| #   | Task                                                                     | File                                  | Status |
| --- | ------------------------------------------------------------------------ | ------------------------------------- | ------ |
| F1  | Scope native-chrome CSS under `[data-vp-reskinned="true"]`               | `runtime-src/reskin-player/styles.ts` | ✅     |
| F2  | `attach()` → wrapper + `attachInner()` with incremental `undo` rollback  | `runtime-src/reskin-player/index.ts`  | ✅     |
| F2  | `applySetup()` → wrapper + `applySetupInner()` with resetCleanup+removal | `runtime-src/demo-overlays/index.ts`  | ✅     |
| F3  | Required-shell-node assertion (→ rollback)                               | `runtime-src/reskin-player/index.ts`  | ✅     |
| F3  | `tryFlexSibling()` non-zero-box precondition                             | `runtime-src/demo-overlays/index.ts`  | ✅     |
| F4  | Post-attach rAF overlay-box self-verification (→ teardown)               | `runtime-src/reskin-player/index.ts`  | ✅     |
| T   | Tests for F1/F2/F3/F4 (reskin) and F2/F3 (demo)                          | 3 new test files                      | ✅     |

---

## Validation Results

| Check      | Result | Details                                                                                                              |
| ---------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| Type check | ✅     | `npm run typecheck:runtime` clean                                                                                    |
| Lint       | ✅\*   | `runtime-src/` 0 problems; Prettier clean. 7 pre-existing errors in untouched `app/`/`components/` files left as-is. |
| Unit tests | ✅     | `npm test` → 54 passed (42 prior + 12 new), 0 failed                                                                 |
| Build      | ✅     | `npm run build:runtime` rebuilt `public/runtime/*.js`                                                                |

---

## Files Changed

| File                                                 | Action | Notes                                                                   |
| ---------------------------------------------------- | ------ | ----------------------------------------------------------------------- |
| `runtime-src/reskin-player/styles.ts`                | UPDATE | F1 — 6 rules re-scoped under the marker                                 |
| `runtime-src/reskin-player/index.ts`                 | UPDATE | F2 wrapper/inner split + undo, F3 assertion, F4 rAF, teardown extracted |
| `runtime-src/demo-overlays/index.ts`                 | UPDATE | F2 wrapper/inner split, F3 box precondition                             |
| `runtime-src/tests/reskin-player/styles.test.ts`     | CREATE | F1 (4 cases)                                                            |
| `runtime-src/tests/reskin-player/safety-net.test.ts` | CREATE | F2/F3/F4 reskin (5 cases)                                               |
| `runtime-src/tests/demo-overlays/safety-net.test.ts` | CREATE | F2/F3 demo (3 cases)                                                    |
| `public/runtime/*.js` (+ maps)                       | BUILD  | regenerated                                                             |

---

## Deviations from Plan

1. **try/catch via wrapper/inner split (both files).** Wrapping the ~900-line
   `attach()`/`applySetup()` bodies directly would re-indent the whole function
   (huge, noisy diff + Prettier churn). Instead each became a small wrapper
   (guards + try/catch) delegating to a sibling `attachInner()`/`applySetupInner()`
   at the same nesting level — the body keeps its indentation. Functionally
   identical to the plan's intent.
2. **F2 early `if (!host) return` → `throw`.** So the catch runs the `undo`
   rollback (clearing `__vpAttached`) instead of leaving a half-set flag; a later
   scan can then retry once a host exists.
3. **F3 demo — dropped the "≥2 children" sub-precondition.** The normal layout
   has `<main>` as the sole child with the sidebar becoming the 2nd, so requiring
   ≥2 children _before_ appending would wrongly force the fixed-rail path. The
   non-zero-box check is the meaningful "is this a real layout" guard; kept only
   that.
4. **F4 rollback reuses the registered `teardown`** (extracted to a named const)
   rather than the `undo` list, because by the rAF tick the full teardown is
   already registered; `teardown()` is idempotent (guards on `disposed`).

---

## Issues Encountered

- **happy-dom, not jsdom** (plan assumed jsdom). Upside: it computes the
  `[data-vp-reskinned] hls-video media-*` descendant cascade, so F1 is verified
  via `getComputedStyle` (display `''` vs `none`), not just string assertions.
  For F2/F4, faults/boxes are injected with `vi.spyOn` on
  `Element.prototype.{querySelector,getBoundingClientRect}` and a throwing
  `audioTracks` getter.
- **Known limitation (F4)**: a _persistently_ broken-but-visible host will
  attach→verify→tear down on each scan tick (~every 250ms). Bounded and harmless
  (native player works); the dedup/deadline that quiets it lives in the
  ops-telemetry plan (F6).

---

## Tests Written

| Test File                                            | Test Cases                                                                                                                                                                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runtime-src/tests/reskin-player/styles.test.ts`     | F1: every native-chrome selector is marker-scoped; AC1 visible without marker; AC2 hidden with marker; AC3 returns after marker removed                                                                          |
| `runtime-src/tests/reskin-player/safety-net.test.ts` | F2 AC1 (throw after shell → full rollback); F3 AC1 (missing node → bail, no partial shell); F4 AC1 (zero-box overlay over visible player → teardown), AC2 (off-screen not torn down), AC3 (sized overlay passes) |
| `runtime-src/tests/demo-overlays/safety-net.test.ts` | F2 AC2 (throw during setup removes slots+sidebar); F3 AC2 (unsized main → siblings untouched, fixed rail); AC3 (sized layout → flex sibling)                                                                     |

---

## Next Steps

- [ ] Review (note the 4 deviations)
- [ ] The ops-telemetry plan (F5/F6) consumes F2/F4 failure signals — the
      `console.error` sites in the reskin catch and the F4 rollback are where the
      beacon hooks in.
- [ ] Create PR when ready (`/prp-pr`). All resilience work (adaptability +
      safety-net) is uncommitted on `feature/mm-refactoring`, including
      regenerated `public/runtime/*.js` (CI drift-checks these).
