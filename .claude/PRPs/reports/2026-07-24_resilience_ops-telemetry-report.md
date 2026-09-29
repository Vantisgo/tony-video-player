# Implementation Report

**Plan**: `.claude/PRPs/plans/completed/2026-07-24_resilience_ops-telemetry.plan.md`
**Branch**: `feature/mm-refactoring`
**Date**: 2026-07-24
**Status**: COMPLETE (F5 kill-switch, F6/Part 5 telemetry — code + tests)

---

## Summary

- **F5 — remote kill-switch.** New `runtime-src/common/killswitch.ts#shouldRun()`
  fetches a flag from our own `app/api/runtime-config` (backed by Vercel Edge
  Config) and **fails open** on any error/timeout/unknown-origin. Both entrypoints
  now gate `main()` behind it via an async IIFE. Control-hiding CSS injection was
  moved from `main()` into `attachInner()` so a page with no player is never
  touched (F5 AC3).
- **F6 / Part 5 — failure telemetry.** New `runtime-src/common/beacon.ts#report()`
  (sendBeacon + fetch fallback, per-session dedup, config size cap) posts to the
  new `app/api/runtime-telemetry` relay, which validates (Zod), rate-limits
  (in-memory), and forwards to `env.RUNTIME_ALERT_WEBHOOK_URL` (software-agnostic
  REST). Instrumented failure points: reskin attach-error, overlay-verification
  failure, no-player-after-deadline; demo setup-error, context-timeout.
- Shared `runtime-src/common/runtime-url.ts` resolves _our_ origin (the injected
  script's) so the runtime can call our API from the third-party page.

---

## Assessment vs Reality

| Metric     | Predicted        | Actual                             | Reasoning                                                                                                                       |
| ---------- | ---------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Complexity | F5 P1, F6 P3     | Medium-high (largest of the three) | Two API routes + async-gating the injected IIFEs + a real CORS/preflight subtlety the plan didn't anticipate (see Deviation 2). |
| Confidence | High             | High                               | Fail-open kill-switch + relay-not-direct-webhook were the right calls; the only pivot was the beacon content-type.              |
| Scope      | runtime + routes | runtime + 2 routes + env + vitest  | Added the pure-logic extraction (`relay.ts`/`config-flag.ts`) to keep routes testable without Next/env coupling.                |

---

## Tasks Completed

| #   | Task                                                                   | File                                                 | Status |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------- | ------ |
| F5  | `shouldRun()` fail-open kill-switch                                    | `runtime-src/common/killswitch.ts`                   | ✅     |
| F5  | Our-origin resolver (shared)                                           | `runtime-src/common/runtime-url.ts`                  | ✅     |
| F5  | Edge Config flag route + pure `resolveFlag`                            | `app/api/runtime-config/{route,config-flag}.ts`      | ✅     |
| F5  | Async kill-switch gate + lazy CSS injection (AC3)                      | `runtime-src/{reskin-player,demo-overlays}/index.ts` | ✅     |
| F6  | Beacon (`report`, `capConfig`, dedup)                                  | `runtime-src/common/beacon.ts`                       | ✅     |
| F6  | Relay route + pure logic (schema, CORS, rate-limit, forward)           | `app/api/runtime-telemetry/{route,relay}.ts`         | ✅     |
| F6  | env vars (optional) + vitest include for app tests                     | `env.ts`, `vitest.config.ts`                         | ✅     |
| F6  | Failure-point instrumentation (5 kinds across reskin + demo)           | both entrypoints                                     | ✅     |
| T   | Tests (killswitch, beacon, relay, config-flag, reskin ops integration) | 5 new test files                                     | ✅     |

---

## Validation Results

| Check      | Result | Details                                                                                                                                                                                         |
| ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type check | ✅     | `typecheck:runtime` clean; project `tsc` shows 0 errors in any new file                                                                                                                         |
| Lint       | ✅\*   | New files: 0 errors/0 warnings. Full project: 17 pre-existing errors (all in untouched `components/`/`lib/hooks/`/`app/admin`/`app/api/lessons`; matches the prior security report's baseline). |
| Unit tests | ✅     | `npm test` → 82 passed (54 prior + 28 new), 0 failed                                                                                                                                            |
| Build      | ✅     | `build:runtime` regenerated `public/runtime/*.js`; bundle contains the kill-switch + telemetry logic                                                                                            |

---

## Files Changed

**New (runtime):** `common/runtime-url.ts` (+39), `common/killswitch.ts` (+44),
`common/beacon.ts` (+67).
**New (app):** `api/runtime-telemetry/relay.ts` (+88), `api/runtime-telemetry/route.ts`
(+48), `api/runtime-config/config-flag.ts` (+20), `api/runtime-config/route.ts` (+30).
**New (tests):** killswitch (+51), beacon (+102), reskin ops (+182), relay (+97),
config-flag (+29).
**Modified:** `reskin-player/index.ts` (+178/-…), `demo-overlays/index.ts` (+76/-…),
`env.ts` (+5), `vitest.config.ts` (+1/-1).
**Dependency:** none added — Edge Config is read via its REST API with `fetch`
(see Deviation 8), so no lockfile change.
**Build:** `public/runtime/*.js` regenerated.

---

## Deviations from Plan

1. **env vars OPTIONAL, not required `.url()`.** Making `RUNTIME_ALERT_WEBHOOK_URL`
   / `EDGE_CONFIG` required would break `next build` and route tests when the ops
   infra isn't provisioned. They're `.optional()`; features degrade/fail-open when
   unset (relay skips forwarding; kill-switch defaults enabled). Matches the
   fail-open intent.
2. **Beacon sends `text/plain`, not `application/json`.** The plan's
   `application/json` would make `sendBeacon` a non-simple cross-origin request →
   preflight → which `sendBeacon` cannot satisfy → the beacon would silently fail
   from the LearningSuite origin. `text/plain` is CORS-safelisted (no preflight);
   the relay reads the raw text and `JSON.parse`s it. This is a correctness fix.
3. **Pure-logic extraction for testability.** Route handlers depend on `next` +
   `env`; the testable logic (`telemetrySchema`, `corsHeaders`, `createRateLimiter`,
   `forwardToSink`, `resolveFlag`) lives in `relay.ts` / `config-flag.ts` (no
   framework/env imports) and is unit-tested. `route.ts` is thin wiring, covered by
   typecheck/build.
4. **Shared origin resolver added, `language-pack.ts` left as-is.** Added a generic
   `getRuntimeBaseUrl` in `common/runtime-url.ts` rather than refactoring the
   reskin-specific copy in `language-pack.ts` — avoids regressing its tested path
   (small, noted duplication).
5. **Kill-switch has a 3s AbortController timeout** so a hanging config endpoint
   can't delay attach indefinitely (fail-open on abort). Not explicit in the plan.
6. **`minHostVersion` carried but not enforced** — there's no runtime version to
   compare against yet; the field round-trips for a future version-pin.
7. **Both scripts may report "no player"** (reskin `reskin-no-player-after-deadline`,
   demo `demo-context-timeout`) — separate bundles, distinct errorTypes; the sink
   can correlate. Kept both per the plan's listed signals.
8. **No `@vercel/edge-config` SDK dependency** (plan called for it). The SDK is a
   thin wrapper over the Edge Config Read API; `app/api/runtime-config` reads the
   `runtimeConfig` item via `fetch` on the `EDGE_CONFIG` connection string
   (`edgeConfigItemUrl` in `config-flag.ts`, unit-tested). This avoids a runtime
   dependency and, critically, a large `pnpm-lock.yaml` regeneration (the repo's
   canonical package manager wasn't available here; `npx pnpm@9` produced ~8.8k
   lines of churn). Same behaviour, zero lockfile change.

---

## Issues Encountered

- **happy-dom blocks real `<script src>` loading.** The reskin ops test resolves
  our origin via the `window.__vpRuntimeBaseUrl` override (checked first by the
  resolver) instead of a real script tag — avoids a `NotSupportedError`.
- **Async gating vs existing tests.** Gating `main()` behind `await shouldRun()`
  could have delayed it past the existing tests' single-microtask waits — but with
  no runtime `<script>` in those tests the base URL is empty, so `shouldRun`
  returns `true` without fetching, and all 54 prior tests still pass unchanged.
- **Full-project lint baseline is 17 errors** (not 7 as an earlier cached run
  suggested) — confirmed all pre-existing and in untouched files.

---

## Tests Written

| Test File                                     | Coverage                                                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `runtime-src/tests/common/killswitch.test.ts` | F5 AC2 fail-open (reject / non-OK / unknown-origin-no-fetch); AC1/AC4 disable only on `enabled:false`                                       |
| `runtime-src/tests/common/beacon.test.ts`     | F6 AC6 payload shape + config truncation/unserializable; AC1 dedup; no-op on unknown origin                                                 |
| `runtime-src/tests/reskin-player/ops.test.ts` | F5 AC1 (disabled → no shell/CSS), AC3 (no player → no CSS); F6 AC1 (attach-error once), AC2 (success → none), AC3 (deadline w/ fake timers) |
| `app/api/runtime-telemetry/relay.test.ts`     | F6 AC4 Zod 400 / valid, CORS allowlist, forward POST; AC5 rate-limit window + per-key                                                       |
| `app/api/runtime-config/config-flag.test.ts`  | F5 fail-open default; AC4 disable only on explicit `false`; minHostVersion parsing                                                          |

---

## Next Steps (operational — do NOT block the code)

- [ ] Provision **Vercel Edge Config** and set `EDGE_CONFIG`; seed a `runtimeConfig`
      key (`{ "enabled": true }`). Until then the kill-switch fails open (always runs).
- [ ] Set `RUNTIME_ALERT_WEBHOOK_URL` to a REST sink and
      `RUNTIME_TELEMETRY_ALLOWED_ORIGINS` to the LearningSuite origin(s). Until then
      the relay accepts + 204s but forwards nothing.
- [ ] Confirm LearningSuite CSP `connect-src` permits our origin (assumed; F5
      fail-open is the safety net if not — see plan decision #4).
- [ ] Create PR (`/prp-pr`). All three resilience plans are uncommitted on
      `feature/mm-refactoring`, incl. regenerated `public/runtime/*.js` (CI drift-checked).
