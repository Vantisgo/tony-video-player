# Implementation Report

**Plan**: `.claude/PRPs/plans/completed/2026-07-28_runtime-loader_single-script-conditional-injection.plan.md`
**Source Issue**: n/a (no ticket — repo uses topic slugs)
**Branch**: `feature/mm-refactoring`
**Commit**: `97ad07d`
**Date**: 2026-07-28
**Status**: COMPLETE (Level 5 manual validation against the live tenant outstanding — requires the LearningSuite tenant, a Vercel preview deploy and Edge Config access)

---

## Summary

`public/runtime/loader.js` is now the single script the LearningSuite tenant needs
to carry. It resolves its own script URL (copying its query string — the Vercel
protection-bypass secret — onto every child URL), asks the kill-switch once and
publishes the verdict on `window.__vpRuntimeGate`, then injects
`reskin-player.js`, `demo-overlays.js` and `admin-toggle.js` only when each one's
gate passes. Gates are re-evaluated on a debounced MutationObserver plus a URL
poll, because LearningSuite renders `[data-vp-config]` via React after head
scripts run. `demo-overlays` is injected only after `reskin-player` published
`window.player`, which turns the previously implicit ordering into an enforced
one. The three bundles keep their own gates and idempotency and remain
independently injectable.

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning                                                                                                                     |
| ---------- | --------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Complexity | MEDIUM    | MEDIUM | Loader came in at 159 lines as scoped; the only real friction was test-harness behaviour (happy-dom, fake timers), not design |
| Confidence | —         | HIGH   | Every contract the plan relied on (`__vpRuntimeBaseUrl` override, cleanup registry, per-bundle self-gating) held as read      |

**Deviations from the plan** — four, all small:

- `childUrl()` resolves against `location.href` as a base, so a _relative_
  loader URL (or a relative `__vpRuntimeBaseUrl` override) still works. Cost: a
  syntactically-valid relative string is no longer "unparseable", so the
  garbage-input test asserts on `""` and `"http://["` instead of arbitrary text.
- `window.__vpRuntimeBaseUrl` was added to `global.d.ts` as well (the plan listed
  only the three new globals). The loader writes it, so it needs the declaration;
  the pre-existing `window as unknown as {…}` cast in `runtime-url.ts` is
  untouched.
- AC8's "gate set before the first append" is verified by asserting exactly one
  `fetch` for the whole page load and then calling `shouldRun()` directly and
  showing it does not fetch — a stronger and simpler check than spying on
  `document.head.appendChild` call order, which needed a type assertion.
- The plan's Level 2 command was `bun test`; that invokes **bun's own** test
  runner (which has no happy-dom environment and fails immediately). The project
  suite is vitest: `bun run test`. Documented in the plan's Amendments.

---

## Tasks Completed

| #   | Task                                              | File                                              | Status |
| --- | ------------------------------------------------- | ------------------------------------------------- | ------ |
| 1   | Gate predicates + child-URL builder               | `runtime-src/loader/gates.ts`                     | ✅     |
| 2   | Kill-switch short-circuit + window globals        | `runtime-src/common/killswitch.ts`, `global.d.ts` | ✅     |
| 3   | The loader entry                                  | `runtime-src/loader/index.ts`                     | ✅     |
| 4   | Fourth esbuild entry + build                      | `scripts/build-runtime.mjs`                       | ✅     |
| 5   | Gate/URL unit tests                               | `runtime-src/tests/loader/gates.test.ts`          | ✅     |
| 6   | Injection-behaviour unit tests                    | `runtime-src/tests/loader/loader.test.ts`         | ✅     |
| 7   | Kill-switch short-circuit tests                   | `runtime-src/tests/common/killswitch.test.ts`     | ✅     |
| 8   | Docs: gating table, one-tag snippet, deliverables | `docs/learningsuite-enrichment-research.md`       | ✅     |
| 9   | Rebuild, drift check, cross-refs, commit          | `public/runtime/*`, e2e-canary plan               | ✅     |

---

## Validation Results

| Check                       | Result | Details                                                                                                                                                                   |
| --------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run typecheck:runtime` | ✅     | 0 errors                                                                                                                                                                  |
| Lint (touched files)        | ✅     | `bunx eslint runtime-src/loader runtime-src/tests/loader …` exits 0                                                                                                       |
| `bun run lint` (whole repo) | ⚠️     | 17 errors / 29 warnings, **all pre-existing** in `app/**`, `components/**`, `lib/**` and the generated bundles — none in files this change touches                        |
| `bunx tsc --noEmit` (root)  | ⚠️     | 9 errors, **all pre-existing**: `prisma/generated/client` is absent in this checkout (needs `bun prisma generate`), which cascades into implicit-`any` errors in `app/**` |
| `bun run test`              | ✅     | 20 files, 135 tests passed (111 before → +24 new)                                                                                                                         |
| Build + drift               | ✅     | `bun run build:runtime && git diff --exit-code -- public/runtime` clean                                                                                                   |
| Loader bundle shape         | ✅     | 7,927 bytes, GENERATED banner present, no top-level `import`/`export`                                                                                                     |
| Level 5 manual (live)       | ⏭️     | Not runnable here — needs the LearningSuite tenant, a preview deploy and Edge Config. Checklist preserved in the archived plan                                            |

---

## Files Changed

| File                                          | Action    | Lines   |
| --------------------------------------------- | --------- | ------- |
| `runtime-src/loader/index.ts`                 | CREATE    | +159    |
| `runtime-src/loader/gates.ts`                 | CREATE    | +47     |
| `runtime-src/tests/loader/loader.test.ts`     | CREATE    | +194    |
| `runtime-src/tests/loader/gates.test.ts`      | CREATE    | +92     |
| `runtime-src/common/killswitch.ts`            | UPDATE    | +7      |
| `runtime-src/global.d.ts`                     | UPDATE    | +10     |
| `runtime-src/tests/common/killswitch.test.ts` | UPDATE    | +23     |
| `scripts/build-runtime.mjs`                   | UPDATE    | +1      |
| `docs/learningsuite-enrichment-research.md`   | UPDATE    | +56/-34 |
| `public/runtime/loader.js`                    | GENERATED | +254    |
| `public/runtime/reskin-player.js`             | GENERATED | +2      |
| `public/runtime/demo-overlays.js`             | GENERATED | +2      |

---

## Issues Encountered

1. **`bun test` ≠ the project's test runner.** It ran bun's built-in runner, so
   every DOM test failed with `document is not defined`. Resolved by using
   `bun run test` / `bunx vitest run`.
2. **happy-dom refuses to load injected `<script src>`** and logs a
   `NotSupportedError` ("JavaScript file loading is disabled") per injected tag.
   Harmless — the tag is still appended and the run exits 0 — but it is noisy in
   test output. Tests drive the chain by dispatching `load` manually.
3. **Fake timers must be installed before the loader arms its player poll.**
   Installing them afterwards orphans the already-created real interval, so
   `advanceTimersByTime` could not reach it — the AC5 test failed until the
   `vi.useFakeTimers({ shouldAdvanceTime: true })` call moved above `runLoader()`.
4. **`window.location.href` is assignable under happy-dom**, which is what makes
   the loader-level admin-gate tests (AC1) possible without extra plumbing.

---

## Tests Written

| Test File                                     | Test Cases                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runtime-src/tests/loader/gates.test.ts`      | `isAdminEditMode` truth table (edit / preview / non-editor / bare `/admin/editor`); `hasVpConfig` across script, element, HTML-comment shapes, invalid JSON, and absent; `childUrl` query propagation, no-query, relative base, empty/unparseable                                                                                                                                |
| `runtime-src/tests/loader/loader.test.ts`     | nothing injected without gates; reskin injected once with the bypass secret; demo withheld until reskin `load` + `window.player`; demo injected after the 3s backstop with a warning; config appearing later still activates; admin edit vs preview; kill-switch off injects nothing at all; verdict published so children never re-fetch; second injection loads no child twice |
| `runtime-src/tests/common/killswitch.test.ts` | published `true` and published `false` verdicts both honoured without fetching (pre-existing fail-open cases retained, flag deleted in `afterEach`)                                                                                                                                                                                                                              |

---

## Next Steps

- [ ] Run Level 5 manual validation against a preview deployment (5 checks in the
      archived plan), including the Edge Config kill-switch flip that now also
      disables the admin banner
- [ ] Replace the three `<script>` tags in the LearningSuite tenant with the
      single `loader.js` tag (human step; the three tags keep working until then)
- [ ] Optional follow-ups recorded in the plan: propagate the bypass secret into
      `runtimeApiUrl()` (kill-switch/telemetry currently lose it), add
      `window.player` to `demo-overlays`' own `readyContext()`
- [ ] Create PR: `/prp-pr`
