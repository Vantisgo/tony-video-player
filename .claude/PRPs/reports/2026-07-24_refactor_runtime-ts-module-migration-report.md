# Implementation Report

**Plan**: `.claude/PRPs/plans/completed/2026-07-24_refactor_runtime-ts-module-migration.plan.md`
**Branch**: `feature/mm-refactoring`
**Date**: 2026-07-24
**Status**: COMPLETE (code + tooling + tests + CI); live-LS smoke test pending deployment

---

## Summary

Decoupled the runtime augment scripts' **source** from their **injected artifact**.
The three scripts are now authored as TypeScript modules under `runtime-src/` with a
shared `runtime-src/common/`, and bundled by esbuild into self-contained classic IIFEs
at `public/runtime/*.js`. The injected artifact and loading model are unchanged (one
classic `<script src>` per entry, cross-origin-loadable, re-injectable, self-gating).
This delivers shared code, full TypeScript typing (no `any`), and a unit-test suite —
without changing what LearningSuite loads. The prior security fixes were carried into
the TS source verbatim.

---

## Assessment vs Reality

| Metric      | Predicted  | Actual                                                             | Reasoning                                                                                                                      |
| ----------- | ---------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Complexity  | Medium     | Medium                                                             | Mechanical port; the only real design work was typing the third-party `hls-video`/hls.js surfaces and threading closure state. |
| Confidence  | High       | High                                                               | Build is deterministic; typecheck + 24 tests green; DOM test loads the real bundle.                                            |
| Bundle size | Comparable | Comparable after fixing a zod-inlining regression (see Deviations) | demo 52KB, reskin 52KB, admin 15KB — in line with the originals.                                                               |

---

## Tasks Completed

| #   | Task                                                                                                                       | Result                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| T1  | Tooling scaffold (esbuild driver, `tsconfig.runtime.json`, vitest+happy-dom, `.prettierignore`, `.gitignore`, npm scripts) | ✅                                                                          |
| T2  | `common/` modules + types + tests (escape, format, cleanup, dom, bus, origins, tracks, config)                             | ✅                                                                          |
| T3  | Migrate `reskin-player` (index + styles + language-pack)                                                                   | ✅                                                                          |
| T4  | Migrate `demo-overlays` (index + data + styles)                                                                            | ✅                                                                          |
| T5  | Migrate `admin-toggle` (index + prompt + styles)                                                                           | ✅                                                                          |
| T6  | CI drift-check + typecheck + test (`.github/workflows/runtime.yml`)                                                        | ✅                                                                          |
| T7  | Behaviour-parity sign-off                                                                                                  | ⚠️ automated (DOM test + deterministic build); live-LS smoke pending deploy |

---

## Validation Results

| Check                      | Result | Details                                                                                                                     |
| -------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| `typecheck:runtime`        | ✅     | `tsc -p tsconfig.runtime.json` — 0 errors, no `any`.                                                                        |
| `build:runtime`            | ✅     | esbuild → 3 IIFEs; **deterministic** (identical bytes across two builds).                                                   |
| Unit tests (`npm test`)    | ✅     | 24 passed (escape, format, origins, config, + a DOM render test loading the real demo bundle).                              |
| Lint (runtime-src/scripts) | ✅     | 0 errors.                                                                                                                   |
| Drift-check                | ✅     | Fresh build ≡ working tree; CI will enforce vs committed.                                                                   |
| `next build`               | ⚠️ N/A | Still gated on missing `DATABASE_URL`/`BLOB_READ_WRITE_TOKEN`; runtime scripts are static assets outside the compile graph. |

---

## Files Changed (high level)

- **CREATE** `runtime-src/` — 24 `.ts` files (common/ + 3 entries + tests + `global.d.ts`).
- **CREATE** `scripts/build-runtime.mjs`, `tsconfig.runtime.json`, `vitest.config.ts`, `.prettierignore`, `.github/workflows/runtime.yml`.
- **UPDATE (generated)** `public/runtime/{reskin-player,demo-overlays,admin-toggle}.js` — now esbuild output (hand-written source retired).
- **UPDATE** `package.json` (scripts + `vitest`/`happy-dom` devDeps), `.gitignore` (`public/runtime/*.js.map`).

---

## Deviations from Plan

1. **No zod in the runtime bundle.** The plan called for a zod schema at the config parse
   boundary. Importing zod inlined ~50KB into `demo-overlays.js` (it ballooned to ~16k
   lines). Since this ships into a third-party page, that's an unacceptable size
   regression. `parseVpConfig` keeps the exact lenient per-section behaviour (used when a
   section is a present array; otherwise fall back to defaults, logged) **without** zod.
   Strict schema validation belongs server-side in the future content service.
2. **Lighter intra-entry decomposition than specified.** Extracted the cohesive, low-risk
   chunks (`styles`, `language-pack`, `data`, `prompt`) and kept each entry's tightly
   coupled renderer/attach logic as nested functions in `index.ts` rather than threading an
   `AttachContext` across 6 files. Rationale: "behaviour-preserving" is a hard constraint,
   and splitting closure-shared state risks subtle bugs for marginal gain — matches the
   plan's own "do not over-split" guidance. The core wins (TS, shared `common/`, build,
   tests) are fully delivered.
3. **Status return captured to a global.** esbuild bundles are ES modules, so the original
   top-level `return 'status'` is illegal. Each entry wraps its logic in `main()` and
   assigns the result to `window.__vp{Reskin,Demo,Admin}Status` — works under both
   `<script src>` and eval-injection, and is inspectable.

---

## Issues Encountered

- **zod bundle bloat** — caught by inspecting output line counts after the first full
  build; resolved by removing zod (Deviation #1).
- **`MediaTrackList` typing** — the non-standard `hls-video.audioTracks` list needed to be
  both `ArrayLike` and an `EventTarget`; typed accordingly in `common/types.ts`.
- **`bun` unavailable in this environment** — used `npm`. Note: `bun.lock` was not updated
  for the new `vitest`/`happy-dom` devDeps; run `bun install` to sync it (these deps are
  test/CI-only and do not affect the Vercel build).

---

## Beneficial side-fix (single-run behaviour unchanged)

`demo-overlays` originally added capture-phase document `click`/`keydown` listeners without
registering teardown, so re-injection stacked them. The port registers them in the cleanup
registry, so re-injection no longer leaks. Single-run behaviour is identical.

---

## Tests Written

| Test File                      | Coverage                                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `common/escape.test.ts`        | XSS payload neutralization, entity escaping, null/number coercion                                                 |
| `common/format.test.ts`        | m:ss formatting, clamping, non-finite                                                                             |
| `common/origins.test.ts`       | trusted-origin set, asset-origin allowlist (same/cross/trusted)                                                   |
| `common/config.test.ts`        | `parseVpConfig` leniency, `loadVpConfig` source precedence                                                        |
| `demo-overlays/render.test.ts` | loads the **real** demo bundle; asserts a malicious config value renders as escaped text with no injected `<img>` |

---

## Parity Sign-off (T7)

- **Automated**: deterministic build, `typecheck:runtime` clean, 24 tests incl. a real-bundle
  DOM test. Public API (`window.player`, `window.__vp*`, cleanup registries, return-status
  globals) and activation gates preserved.
- **Pending**: live smoke test on the LearningSuite lesson (controls mount, seek, external
  listeners still fire, overlays, both sidebar strategies, audio takeover, track menus) —
  requires deploying the rebuilt bundles. Use `scratchpad/verify-security.html` locally as a
  first check.

---

## Next Steps

- [ ] `bun install` to sync `bun.lock` with the new devDeps.
- [ ] Commit generated `public/runtime/*.js` alongside source (drift-check depends on it).
- [ ] Deploy branch preview and run the live-LS parity checklist (T7).
- [ ] Follow-up plan: Preact/JSX for the `demo-overlays` UI (structurally removes the XSS class).
