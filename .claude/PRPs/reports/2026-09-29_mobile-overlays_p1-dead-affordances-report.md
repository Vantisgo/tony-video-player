# Implementation Report

**Plan**: `.claude/PRPs/plans/completed/2026-09-29_mobile-overlays_p1-dead-affordances.plan.md`
**Source PRD**: `.claude/PRPs/prds/mobile-overlays.prd.md` (phase 1)
**Branch**: `feature/mobile-overlays`
**Date**: 2026-09-29
**Status**: COMPLETE

---

## Summary

`window.__vpSidebarTab` is now assigned only while a sidebar is installed. The science and meta
pills render their open affordances (the "Öffnen" button, pointer cursor, tooltip and click handler)
only when it exists. Below 1024px the pills are informational instead of dead taps. Desktop behaviour
is unchanged.

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning                                                                                      |
| ---------- | --------- | ------ | ---------------------------------------------------------------------------------------------- |
| Complexity | LOW       | LOW    | Two guarded blocks and one test file, as planned                                               |
| Confidence | 9/10      | met    | Root cause (`index.ts:1399` unconditional assignment) was correct; verified on the live lesson |

**Deviations:**

- The science pill's right padding is 12px when the button is absent (6px was sized for the
  button). Visual polish only, not in the plan.
- A pre-existing `typecheck:runtime` failure (`science-card.ts` used `Array.prototype.at`, which is
  not in the runtime's es2020 lib) blocked Level 1. It is fixed in its own commit, `8bc639b`.

---

## Tasks Completed

| #   | Task                                                                         | File                                                      | Status |
| --- | ---------------------------------------------------------------------------- | --------------------------------------------------------- | ------ |
| 1   | Install-scoped `__vpSidebarTab`                                              | `runtime-src/demo-overlays/index.ts`                      | ✅     |
| 2   | `canOpen` in the science and meta pill renderers; null-guarded button lookup | `runtime-src/demo-overlays/index.ts`                      | ✅     |
| 3   | Tests for AC1–AC4                                                            | `runtime-src/tests/demo-overlays/open-affordance.test.ts` | ✅     |
| 4   | Regenerate the bundle                                                        | `public/runtime/demo-overlays.js`                         | ✅     |
| 5   | Chrome verification V1 and V6                                                | live lesson                                               | ✅     |

---

## Validation Results

| Check                            | Result             | Details                                                                                                                                                                                  |
| -------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type check (`typecheck:runtime`) | ✅                 | Clean after the `.at()` fix                                                                                                                                                              |
| Lint                             | ✅ (changed files) | `bunx eslint` on the touched files: 0 problems. Repo-wide `bun run lint` fails on pre-existing issues: 255 errors in the generated `playwright-report/trace/`, 7 in `app/`/`components/` |
| Unit tests                       | ✅                 | 422 passed / 40 files. The new AC1 test fails on the unfixed code (verified by stashing the fix)                                                                                         |
| Build (`build:runtime`)          | ✅                 | Bundle regenerated and committed with the source                                                                                                                                         |
| Browser (Level 5)                | ✅                 | See below                                                                                                                                                                                |

**Level 5, live lesson with the local runtime (`__vpLocalRuntime === "local"`):**

- **V1, 390×844 touch:**
  - `typeof __vpSidebarTab` is `"undefined"` and no sidebar is installed.
  - `seek(13.5)`: the science pill has no button, `cursor: default` and no handler. It is now 249px
    wide (was 309).
  - `seek(5.5)`: the meta pill has no `title`, `cursor: default` and no handler.
- **V6, 1920×945:**
  - `__vpSidebarTab` is a function. The "Öffnen" button is present with `cursor: pointer`.
  - A real click on it shows the Science Corner panel (coaching hidden).
  - A real click on the meta pill shows the Master-Schritte panel.
  - The console has no `[vp]` errors.

---

## Files Changed

| File                                                      | Action                | Lines             |
| --------------------------------------------------------- | --------------------- | ----------------- |
| `runtime-src/demo-overlays/index.ts`                      | UPDATE                | +27/-15 (approx.) |
| `runtime-src/tests/demo-overlays/open-affordance.test.ts` | CREATE                | +190              |
| `public/runtime/demo-overlays.js`                         | REGENERATE            | generated         |
| `runtime-src/demo-overlays/science-card.ts`               | UPDATE (separate fix) | +1/-1             |

---

## Issues Encountered

- **Bundle contamination:** `build:runtime` bundles the working tree, so the first commit of the
  `.at()` fix contained the uncommitted P1 change in `demo-overlays.js`. It was caught by
  inspecting the committed diff. I stashed P1, rebuilt, amended that (unpushed) commit, and restored
  P1. Recorded as a gotcha in `docs/feature-context.md`.

---

## Tests Written

| Test File                                                 | Test Cases                                                                                                                                                            |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runtime-src/tests/demo-overlays/open-affordance.test.ts` | AC1+AC2 no open action below 1024px; AC3 science pill opens Science Corner on desktop; AC3 meta pill opens meta tab on desktop; AC4 teardown removes `__vpSidebarTab` |

---

## Next Steps

- [ ] P2 (mobile canary harness), running now
- [ ] P3 replaces the assignment with `host.open`. Its plan already records that
      `open-affordance.test.ts` case 1 must then delete the function to reach the no-host branch
