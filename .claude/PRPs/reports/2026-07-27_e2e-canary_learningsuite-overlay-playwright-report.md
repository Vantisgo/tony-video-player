# Implementation Report

**Plan**: `.claude/PRPs/plans/2026-07-27_e2e-canary_learningsuite-overlay-playwright.plan.md`
**Branch**: `feature/e2e-canary-playwright` (off `feature/mm-refactoring`)
**Date**: 2026-08-07
**Status**: PARTIAL — harness complete and statically verified; live verification blocked on credentials

---

## Summary

Built the Playwright canary suite: a separate config and directory that logs into
the real LearningSuite tenant, resolves a course/lesson target into an ordered
list of video lessons, and asserts on each one that the injected runtime still
mounts, hides the native chrome, plays, and mounts its overlays — reading only
the surfaces the runtime already publishes (`__vpReskinStatus`, `__vpDemoStatus`,
`window.player._diag()`, `[data-vp-reskinned]`, `[data-vp="…"]`, `#vp-slot-*`).
No file under `runtime-src/**` or `public/runtime/**` was touched.

What is **not** done is everything that needs a live login. The plan's Task 1 is
explicitly a human prerequisite ("collect the facts no agent can invent") and
those facts — the test-account password, the recorded login selectors, the second
fixture lesson, the ≥3-video exercise course, the Vercel bypass secret — do not
exist anywhere in the repo. Task 16's end-to-end verification depends on all of
them. Both are marked `[f]` in the plan; `docs/e2e-canary.md` carries the
outstanding items as a checklist.

---

## Assessment vs Reality

| Metric     | Predicted | Actual                              | Reasoning                                                                                                                                                                        |
| ---------- | --------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complexity | MEDIUM    | MEDIUM                              | The two-phase design was correct as specified and needed no rework. The unplanned work came from the runtime having moved since the plan was written, not from the plan's shape. |
| Confidence | —         | High on code, low on live behaviour | Every static claim is verified. Nothing has ever executed against a LearningSuite page, so all selector and login assumptions remain assumptions.                                |

**Where reality diverged from the plan:** the plan was written on 2026-07-27,
before the runtime loader and the quiz/remount rewrite landed. Three of its
assertion targets no longer match the code (see Deviations 1–3). Those were found
by reading the runtime rather than by trusting the plan's quoted line numbers.

---

## Tasks Completed

| #   | Task                        | File(s)                              | Status     | Note                                                                |
| --- | --------------------------- | ------------------------------------ | ---------- | ------------------------------------------------------------------- |
| 1   | Gather human prerequisites  | `docs/e2e-canary.md`                 | ⛔ `[f]`   | Partially recovered from the repo; rest needs a human               |
| 2   | Install Playwright + config | `playwright.config.ts`               | ✅         | Chrome install needs sudo — blocked on this machine                 |
| 3   | Gitignore playwright output | `.gitignore`                         | ✅         | Verified with a probe file                                          |
| 4   | E2E env trust boundary      | `e2e/support/env.ts`                 | ✅         |                                                                     |
| 5   | Login setup project         | `e2e/support/auth.setup.ts`          | 🔶 `[wip]` | Written; selectors unverified                                       |
| 6   | Default lesson fixtures     | `e2e/fixtures/lessons.ts`            | 🔶 `[wip]` | Empty — tenant is `orbit`, the one recorded lesson is on `vantisgo` |
| 7   | Target parameter parsing    | `e2e/support/target.ts`              | ✅         | Unit-tested                                                         |
| 8   | Phase hand-off contract     | `e2e/support/targets-file.ts`        | ✅         | Refusal paths exercised                                             |
| 9   | Resolve project             | `e2e/support/resolve.setup.ts`       | 🔶 `[wip]` | Written; needs a live run                                           |
| 10  | Two-phase runner            | `scripts/e2e.ts`                     | ✅         | Flag plumbing + exit code verified                                  |
| 11  | Bundle source switch        | `e2e/support/runtime-source.ts`      | 🔶 `[wip]` | Written; preview smoke not run                                      |
| 12  | Assertion vocabulary        | `e2e/support/assertions.ts`          | ✅         |                                                                     |
| 13  | The spec                    | `e2e/overlay-canary.spec.ts`         | 🔶 `[wip]` | Collection verified; assertions never executed live                 |
| 14  | CI workflow                 | `.github/workflows/e2e-canary.yml`   | 🔶 `[wip]` | YAML valid; no dispatch run possible                                |
| 15  | Operator doc + scripts      | `docs/e2e-canary.md`, `package.json` | ✅         |                                                                     |
| 16  | End-to-end verification     | —                                    | ⛔ `[f]`   | Needs a live login                                                  |

`[wip]` means the code is complete and type/lint-clean but its VALIDATE step
needs credentials. It does not mean unfinished code.

---

## Validation Results

| Check                       | Result | Details                                                                                    |
| --------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| `bunx tsc --noEmit`         | ✅     | 0 errors                                                                                   |
| `bun run typecheck:runtime` | ✅     | 0 errors                                                                                   |
| `bun run lint`              | ✅\*   | 7 errors / 10 warnings — **all pre-existing** in `app/`, `components/`. New code adds none |
| `bun run test` (vitest)     | ✅     | 259 passed (244 before + 15 new), 27 files                                                 |
| Workflow YAML               | ✅     | `bunx js-yaml` parses                                                                      |
| Prettier                    | ✅     | All new files clean                                                                        |
| Collection mechanics        | ✅     | Synthetic 3-video `targets.json` → exactly 12 canary tests + 1 setup                       |
| Missing `targets.json`      | ✅     | Refuses with "run `bun run e2e`" instead of collecting zero tests                          |
| Stale `targets.json`        | ✅     | `specKey` mismatch names both the resolved and requested parameters                        |
| Env boundary                | ✅     | Names each missing/invalid var; password never echoed                                      |
| `E2E_VIDEO` guards          | ✅     | `0`, `1.5` and "video without target" all rejected at the boundary                         |
| Cross-tenant URL            | ✅     | Refused, naming both origins                                                               |
| Phase-1 exit code           | ✅     | Propagates; phase 2 does not run                                                           |
| **Live canary (L4/4b)**     | ⛔     | Needs `.env.local` + Chrome                                                                |
| **CI dispatch (L5)**        | ⛔     | Needs repo secrets                                                                         |
| **Manual checks (L6)**      | ⛔     | Needs a live run                                                                           |

\* `bun run lint` exits 1 on this branch for reasons that predate this work — see
`docs/feature-context.md`. Compared cache-free against the documented baseline;
the counts are identical.

> **`bun test` ≠ `bun run test`.** `bun test` invokes Bun's own runner, which
> collects all 260 files without happy-dom and reports 182 failures. The plan's
> validation commands say `bun test`; the correct command is `bun run test`.

---

## Files Changed

| File                               | Action | Lines  |
| ---------------------------------- | ------ | ------ |
| `e2e/support/assertions.ts`        | CREATE | +402   |
| `e2e/support/resolve.setup.ts`     | CREATE | +339   |
| `docs/e2e-canary.md`               | CREATE | +270   |
| `e2e/support/target.test.ts`       | CREATE | +154   |
| `e2e/support/env.ts`               | CREATE | +125   |
| `e2e/support/runtime-source.ts`    | CREATE | +120   |
| `.github/workflows/e2e-canary.yml` | CREATE | +113   |
| `e2e/support/auth.setup.ts`        | CREATE | +113   |
| `e2e/support/target.ts`            | CREATE | +98    |
| `scripts/e2e.ts`                   | CREATE | +93    |
| `e2e/support/targets-file.ts`      | CREATE | +82    |
| `e2e/overlay-canary.spec.ts`       | CREATE | +80    |
| `playwright.config.ts`             | CREATE | +72    |
| `e2e/fixtures/lessons.ts`          | CREATE | +41    |
| `.gitignore`                       | UPDATE | +8     |
| `package.json`                     | UPDATE | +5     |
| `vitest.config.ts`                 | UPDATE | +4     |
| `bun.lock`                         | UPDATE | +14/-5 |

14 created, 4 updated. No change under `runtime-src/**` or `public/runtime/**` (AC9).

---

## Deviations from Plan

Full list with rationale in the plan's Amendments section. The three that matter:

1. **The demo status string in the plan does not exist.** `demo-overlays` returns
   `"demo overlay controller active"`; `"demo: setup queued"` was removed by the
   quiz/remount rewrite. Asserting the plan's string verbatim would have produced
   a canary that failed on a perfectly healthy page.
2. **`#vp-demo-sidebar` is conditional** on the config carrying coaching/science/
   meta content, so it is asserted-if-present and annotated otherwise. The four
   `#vp-slot-*` nodes are unconditional on mount and carry the mount assertion.
3. **The loader changed the interception surface.** The tenant now loads
   `loader.js`, which forwards its query string to children, so a glob route
   pattern would miss every request carrying `?x-vercel-protection-bypass=…`. A
   URL predicate is used instead, and `E2E_RUNTIME_BASE_URL` is normalised to a
   loader script URL with the bypass as a query parameter — verified against
   `runtime-url.ts` and `loader/gates.ts`.

Plus: vitest's `include` gained `e2e/**/*.test.ts` (the plan advised against
touching it — the property it protects, that vitest never collects Playwright
specs, is enforced by the `.spec.ts`/`.test.ts` split and is unaffected);
`targetSpecKey` lives in `target.ts`; `scripts/e2e.ts` uses `spawnSync` rather
than `Bun.spawn` (the `Bun` global is not in the type environment); two optional
env vars were added for unrecorded Task 1 paths; the fixture list is empty;
`expectsDemoOverlays` was dropped as unreadable.

---

## Issues Encountered

| Issue                                                       | Resolution                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Chrome cannot be installed (WSL2, sudo needs a TTY)         | Left `channel: "chrome"` pinned per Task 2's gotcha. User must run the install themselves        |
| Top-level `await` in `playwright.config.ts` is fragile      | Moved the dotenv load into `env.ts`, so every entry point gets the same ordering by construction |
| `bun test` ran Bun's runner, not vitest                     | Used `bun run test`. Recorded, since the plan's validation commands say `bun test`               |
| `~/` alias unresolvable in vitest                           | Relative imports in the test file                                                                |
| `/s` regex flag needs ES2018; tsconfig targets ES2017       | `[\s\S]*`                                                                                        |
| Default fixtures could silently shrink if a lesson changed  | The resolver fails when a default fixture no longer holds a player, rather than dropping the row |
| Autoplay could make the play-button click _pause_ the video | `expectPlaybackAdvances` establishes a paused state first                                        |

---

## Tests Written

| Test File                    | Test Cases                                                                                                                                                                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/support/target.test.ts` | 15 cases over `parseTargetSpec` (default/url/id/name classification, video default and passthrough, cross-tenant refusal, unparseable URL), `targetSpecKey` (all kinds distinct, index vs all, stability, name normalisation) and `describeTarget` |

The suite itself is the test artifact for everything else; the plan's Testing
Strategy says so explicitly, and correctness of the harness is meant to be proven
by Task 16's parameter matrix and deliberate-failure check — neither of which
could run.

---

## Next Steps

- [ ] **Work the Task 1 checklist in `docs/e2e-canary.md`** — password, codegen
      the login form, second fixture, ≥3-video course, Vercel bypass secret.
- [ ] `bunx playwright install --with-deps chrome` (needs sudo — run it in a
      terminal, e.g. `! bunx playwright install --with-deps chrome`).
- [ ] Run Task 16's matrix, then flip Tasks 1, 5, 6, 9, 11, 13, 14, 16 to `[x]`.
- [ ] Add the repo variables/secrets, then `gh workflow run e2e-canary.yml`.
- [ ] Keep the PR job advisory until its flake rate is known.
- [ ] **Do not archive the plan yet** — Tasks 1 and 16 are outstanding, and
      `.claude/CLAUDE.md` makes `plans/completed/` invisible to future context.
