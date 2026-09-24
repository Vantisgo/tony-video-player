# Implementation Report

**Plan**: `.claude/PRPs/plans/completed/2026-07-24_perf_runtime-playback-hotpath.plan.md`
**Branch**: `feature/mm-refactoring`
**Date**: 2026-07-24
**Status**: COMPLETE

---

## Summary

Removed four sources of wasted per-`timeupdate` work (~4×/s during playback) from the two
injected runtime IIFEs, all behaviour-preserving:

- **F1** — reskin no longer calls `apollo.cache.extract()` on every `timeupdate` when no
  LearningSuite subtitle is selected (the default).
- **F2** — demo-overlays `renderCoaching`/`renderMeta` now dirty-check a signature and skip the
  full `innerHTML` rebuild + listener rebind when nothing relevant changed.
- **F3** — reskin broadcasts to trusted iframes from a cached target list, refreshed on DOM
  mutation, instead of `querySelectorAll("iframe")` + `new URL()` per bus emit.
- **F4** — reskin skips rewriting the subtitle cue DOM while the displayed cue text is unchanged.

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning                                                                 |
| ---------- | --------- | ------ | ------------------------------------------------------------------------- |
| Complexity | Low       | Low    | All four edits landed as scoped; no hidden coupling surfaced.             |
| Confidence | High      | High   | Root-cause reads from the review held; guards are localized and testable. |

F3 used the recommended **cache-and-refresh** approach (behaviour-preserving), not the throttle
alternative. No functional deviation from the plan.

---

## Tasks Completed

| #   | Task                                                      | File                                                  | Status |
| --- | --------------------------------------------------------- | ----------------------------------------------------- | ------ |
| F1  | Gate Apollo extraction on subtitle selection              | `runtime-src/reskin-player/index.ts`                  | ✅     |
| F2  | Signature dirty-check on coaching/meta panels             | `runtime-src/demo-overlays/index.ts`                  | ✅     |
| F3  | Cached trusted-iframe target list + observer `src` filter | `runtime-src/reskin-player/index.ts`                  | ✅     |
| F4  | Skip subtitle-cue rewrite when unchanged                  | `runtime-src/reskin-player/index.ts`                  | ✅     |
| T   | Tests for F1/F3/F4                                        | `runtime-src/tests/reskin-player/index.test.ts` (new) | ✅     |
| T   | Tests for F2                                              | `runtime-src/tests/demo-overlays/render.test.ts`      | ✅     |
| B   | Regenerate committed IIFE bundles                         | `public/runtime/{reskin-player,demo-overlays}.js`     | ✅     |

---

## Validation Results

| Check                            | Result | Details                                                                                    |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| Type check (`typecheck:runtime`) | ✅     | No errors                                                                                  |
| Unit tests (`test`)              | ✅     | 28 passed (24 baseline + 4 new), 6 files                                                   |
| Build (`build:runtime`)          | ✅     | 3 IIFEs emitted; bundles regenerated                                                       |
| Runtime drift                    | ✅     | Regenerated `public/runtime/*.js` staged (CI drift-check will pass once committed)         |
| Lint (changed files)             | ✅     | 0 errors; 13 warnings, all the pre-existing generated-IIFE `no-unused-expressions` pattern |

Note: full `npm run build` (Next) is not run — it fails locally on missing
`DATABASE_URL`/`BLOB_READ_WRITE_TOKEN` and is unrelated to the runtime scripts (documented in
`docs/feature-context.md`). Repo-wide `eslint .` reports 7 pre-existing errors in unrelated
app/component files (`app/admin/...`, `app/api/...`, `components/video-player/...`) — untouched.

---

## Files Changed

| File                                             | Action    | Lines   |
| ------------------------------------------------ | --------- | ------- |
| `runtime-src/reskin-player/index.ts`             | UPDATE    | +34/-15 |
| `runtime-src/demo-overlays/index.ts`             | UPDATE    | +8      |
| `runtime-src/tests/reskin-player/index.test.ts`  | CREATE    | +~200   |
| `runtime-src/tests/demo-overlays/render.test.ts` | UPDATE    | +~120   |
| `public/runtime/reskin-player.js`                | GENERATED | +34/-16 |
| `public/runtime/demo-overlays.js`                | GENERATED | +9      |

---

## Deviations from Plan

- **Skipped the `git pull --rebase origin main`** step from the skill's Phase 2. Work is on an
  active feature branch (`feature/mm-refactoring`); rebasing it onto `main` mid-task was judged
  disruptive and unnecessary for a localized change. `git fetch` was run.
- **No commit made.** Per repo policy ("commit only when the user asks"), changes are left staged
  for review.

---

## Issues Encountered

- **happy-dom iframe navigation noise (F3 test).** A real `<iframe>` with an http `src` made
  happy-dom attempt a page load, emitting `AbortError`/`NotSupportedError` traces (tests still
  passed). Resolved by appending the iframe with **no** `src` attribute and exposing a trusted
  `src` + a spyable `contentWindow` via instance getters — no global vitest-config change needed.

---

## Tests Written

| Test File                                        | Test Cases                                                                                                                                                                          |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runtime-src/tests/reskin-player/index.test.ts`  | no Apollo extract on timeupdate without LS subtitle (F1); trusted-iframe broadcast from cached list + no per-emit iframe scan (F3); subtitle cue not rewritten while unchanged (F4) |
| `runtime-src/tests/demo-overlays/render.test.ts` | coaching/meta panels not rebuilt while signature unchanged, rebuilt on phase/meta change (F2); existing XSS-escaping test retained                                                  |

---

## Next Steps

- [ ] Review staged changes (source + regenerated bundles)
- [ ] Commit (suggested: one `[TASK]` covering the four hot-path fixes) and push
- [ ] Create PR: `/prp-pr` or `gh pr create`
