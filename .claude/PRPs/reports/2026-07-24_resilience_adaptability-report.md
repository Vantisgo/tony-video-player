# Implementation Report

**Plan**: `.claude/PRPs/plans/completed/2026-07-24_resilience_adaptability.plan.md`
**Branch**: `feature/mm-refactoring`
**Date**: 2026-07-24
**Status**: COMPLETE (H1, H2, H3 implemented + tested)

---

## Summary

Made player discovery resilient to LearningSuite HTML changes. Added a shared
`runtime-src/common/player.ts` module with `scanPlayers()` (four-strategy
discovery: `[data-vp-player]` contract → known tags → capability sweep incl. open
shadow DOM → none) and `resolveHost()` (anchor overlays to the nearest sized
ancestor instead of blind `parentElement`). Wired both into `reskin-player` and
`demo-overlays`, replacing every hardcoded `hls-video` query on the overlay path.
Added a `ResizeObserver` that re-asserts the host positioning context, a
`_diag().discovery` field, once-per-session discovery logging, and native-control
suppression for non-`hls-video` players. Documented the `data-vp-player`
authoring contract.

---

## Assessment vs Reality

| Metric     | Predicted    | Actual                          | Reasoning                                                                                                                         |
| ---------- | ------------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Complexity | H1 P1, H2/H3 | Low–medium, as expected         | Discovery + host resolution were self-contained; the main subtlety was a perf trap (see Deviations) caught before it shipped.     |
| Confidence | High for H1  | High                            | The `hls-video` coupling inventory in the plan was accurate; all call sites migrated cleanly with green parity tests.             |
| Scope      | H1/H2/H3     | H1/H2/H3; admin-toggle deferred | Test env was happy-dom (plan assumed jsdom) — no material impact; ResizeObserver scope reduced to match the CSS-anchored reality. |

---

## Tasks Completed

| #   | Task                                                                | File                                                                                           | Status |
| --- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------ |
| 1   | Create discovery + host-resolution module (H1/H2)                   | `runtime-src/common/player.ts`                                                                 | ✅     |
| 2   | Wire discovery/resolveHost/ResizeObserver/`_diag`.discovery (H1/H2) | `runtime-src/reskin-player/index.ts`                                                           | ✅     |
| 3   | Wire discovery + host resolution into demo overlays (H1/H2)         | `runtime-src/demo-overlays/index.ts`                                                           | ✅     |
| 4   | Document the `data-vp-player` contract (H3)                         | `docs/learningsuite-enrichment-research.md`                                                    | ✅     |
| 5   | Tests for discovery, shadow DOM, contract, host resolution, resize  | `runtime-src/tests/common/player.test.ts`, `runtime-src/tests/reskin-player/discovery.test.ts` | ✅     |

---

## Validation Results

| Check      | Result | Details                                                                                                                                                                          |
| ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type check | ✅     | `npm run typecheck:runtime` clean                                                                                                                                                |
| Lint       | ✅\*   | Changed files: 0 errors/0 warnings. 7 pre-existing errors + generated-bundle warnings in untouched `app/`/`components/`/`public/runtime` files (left per surgical-changes rule). |
| Unit tests | ✅     | `npm test` → 42 passed (28 existing + 14 new), 0 failed                                                                                                                          |
| Build      | ✅     | `npm run build:runtime` rebuilt `public/runtime/*.js`                                                                                                                            |

---

## Files Changed

| File                                                | Action | Lines       |
| --------------------------------------------------- | ------ | ----------- |
| `runtime-src/common/player.ts`                      | CREATE | +135        |
| `runtime-src/reskin-player/index.ts`                | UPDATE | +40 / −5    |
| `runtime-src/demo-overlays/index.ts`                | UPDATE | +8 / −5     |
| `docs/learningsuite-enrichment-research.md`         | UPDATE | +23         |
| `runtime-src/tests/common/player.test.ts`           | CREATE | +144        |
| `runtime-src/tests/reskin-player/discovery.test.ts` | CREATE | +148        |
| `public/runtime/*.js` (+ maps)                      | BUILD  | regenerated |

---

## Deviations from Plan

1. **admin-toggle deferred (open Q2).** `admin-toggle/index.ts` also hardcodes
   `hls-video`, but it inserts an editor-only authoring banner rather than
   reskinning — migrating it expands scope without addressing the plan's
   overlay-loss risk. Left as-is; documented for a later consistency pass.
2. **Non-`hls-video` chrome hiding (open Q1) simplified.** Instead of a
   speculative tag-agnostic CSS rule, non-`hls-video` media elements get
   `mediaEl.controls = false` (covers the concrete plain-`<video>` fallback).
   Custom-element internals remain out of reach (documented). Avoids speculative
   code with no concrete alternate player in play.
3. **H2 ResizeObserver scope reduced.** The control shell is CSS-anchored
   (`position:absolute; inset:0`), so overlays already track host resizes via
   CSS — manual repositioning would be dead code. The observer instead re-asserts
   the host's positioning context (which a host re-render can reset to `static`).
   No shell-reparenting on resize: the existing MutationObserver already handles
   structural reparenting, and moving the shell would desync from demo-overlays'
   separately-anchored slots.
4. **Discovery perf trap fixed during implementation.** A first draft ran a full
   `*` deep traversal on every `scanPlayers()` when the contract selector missed
   in the light DOM (the common case; `scan()` fires on every mutation).
   Restructured to light-DOM-first: the shadow-DOM traversal and capability sweep
   run only when the light DOM holds no player.
5. **Rebase skipped.** Implemented on the existing long-lived feature branch
   `feature/mm-refactoring`; did not rebase onto `main` to avoid disrupting
   unrelated in-flight work. `git fetch` only.

---

## Issues Encountered

- Test environment is **happy-dom** (plan assumed jsdom). `getBoundingClientRect`
  returns all-zero and `ResizeObserver` needs a controllable fake — handled by
  per-element box stubs and a fake observer in the tests. No functional impact.

---

## Tests Written

| Test File                                           | Test Cases                                                                                                                                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runtime-src/tests/common/player.test.ts`           | H1 AC1/AC3/AC4 (capability, tag parity, none); H2 AC2 (open shadow DOM), AC1/AC4 (host walk-up + parity + unsized fallback); H3 AC1/AC2/AC3 (contract wins, wrapper resolves, fallback) |
| `runtime-src/tests/reskin-player/discovery.test.ts` | H1 AC2 (`_diag().discovery`), H1 AC1 (renamed element reskinned end-to-end); H2 AC3 (ResizeObserver observes + re-asserts positioning; disconnects on teardown)                         |

---

## Next Steps

- [ ] Review implementation (note the 5 deviations above)
- [ ] Consider the deferred safety-net plan (F1/F2) — H1 widens what counts as a
      player, so F1's success-marker CSS gating + F2 rollback strengthen the
      failure paths this plan leans on.
- [ ] Create PR when ready (`/prp-pr`)
