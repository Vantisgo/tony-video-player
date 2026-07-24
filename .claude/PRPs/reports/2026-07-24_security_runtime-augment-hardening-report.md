# Implementation Report

**Plan**: `.claude/PRPs/plans/completed/2026-07-24_security_runtime-augment-hardening.plan.md`
**Branch**: `feature/mm-refactoring`
**Date**: 2026-07-24
**Status**: COMPLETE (code); 3 operational/tooling decisions deferred — see Open Decisions

---

## Summary

Closed all four security implications identified for the injected runtime augment
scripts, without changing observable behaviour for valid configs and without
introducing a build step or shared module (the scripts still ship verbatim):

1. **Stored XSS (HIGH)** — added an `esc()` helper in `demo-overlays.js` and wrapped
   every config-derived `innerHTML` interpolation; used `CSS.escape` for the one
   config-id `querySelector`.
2. **postMessage without origin check (MEDIUM)** — `reskin-player.js` now validates
   `ev.origin` against a trusted-origins set on inbound messages (plus a
   `Number.isFinite` guard on seek time) and posts outbound events to a concrete
   per-iframe origin instead of `'*'`.
3. **Vercel bypass secret propagation (LOW)** — `withRuntimeAssetQuery` now forwards
   only an allowlisted query param (`x-vercel-protection-bypass`) onto asset URLs.
4. **Language-pack asset origin (LOW)** — `normalizeLanguagePack` drops audio and
   skips subtitle fetches whose resolved URL is not on a trusted origin.

A single `vpTrustedOrigins` set (same-origin + optional `window.__vpTrustedOrigins`)
backs both #2 and #4.

---

## Assessment vs Reality

| Metric     | Predicted      | Actual                    | Reasoning                                                                                                                                                                          |
| ---------- | -------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complexity | Low, surgical  | Low, surgical             | Matched — edits were localized string/predicate changes.                                                                                                                           |
| Confidence | High for #1/#2 | High                      | XSS sink inventory in the plan was complete; one grep confirmed no missed config interpolation (the only remaining `${...}` config reference was a `.map(` call, not a text sink). |
| Scope      | Code + tests   | Code only; tests deferred | The repo has **no test framework** and the IIFEs are not importable — matches the plan's Open Question #3, resolved as "manual harness + flag the decision".                       |

---

## Tasks Completed

| #   | Task                                                                                    | File                              | Status |
| --- | --------------------------------------------------------------------------------------- | --------------------------------- | ------ |
| 1   | Add `esc()` helper                                                                      | `public/runtime/demo-overlays.js` | ✅     |
| 2   | Escape all config interpolations (science/audio/meta/coaching/science-panel/meta-panel) | `public/runtime/demo-overlays.js` | ✅     |
| 3   | `CSS.escape` the `data-sci-card` selector                                               | `public/runtime/demo-overlays.js` | ✅     |
| 4   | Add `vpTrustedOrigins` + `FORWARDED_QUERY_PARAMS`                                       | `public/runtime/reskin-player.js` | ✅     |
| 5   | Origin check + finite-time guard on inbound `message`                                   | `public/runtime/reskin-player.js` | ✅     |
| 6   | Per-iframe target origin on outbound broadcast                                          | `public/runtime/reskin-player.js` | ✅     |
| 7   | Restrict forwarded query params                                                         | `public/runtime/reskin-player.js` | ✅     |
| 8   | Trusted-origin allowlist for language-pack assets                                       | `public/runtime/reskin-player.js` | ✅     |

---

## Validation Results

| Check                   | Result                 | Details                                                                                                                                                                           |
| ----------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Syntax (`node --check`) | ✅                     | All three runtime scripts parse.                                                                                                                                                  |
| Lint (`npm run lint`)   | ✅ (for changed files) | `public/runtime/*.js` not flagged. 17 pre-existing errors + 10 warnings live in `lib/hooks/*` and `prisma/seed.ts` — unchanged vs `main`, unrelated to this work.                 |
| Unit tests              | ⏭️                     | No framework in repo; see Open Decisions #3. Manual harness provided (see Tests).                                                                                                 |
| Build (`npm run build`) | ⚠️ unrelated failure   | Fails on missing `DATABASE_URL` / `BLOB_READ_WRITE_TOKEN` env at `env.ts:13`. Runtime scripts are static `public/` assets, not part of the compile graph — unaffected either way. |

---

## Files Changed

| File                              | Action | Lines                                 |
| --------------------------------- | ------ | ------------------------------------- |
| `public/runtime/demo-overlays.js` | UPDATE | +29 / −22 (16 sinks escaped + helper) |
| `public/runtime/reskin-player.js` | UPDATE | +40 / −5                              |

---

## Deviations from Plan

- **Tests**: plan offered (1) stand up Vitest+jsdom or (2) manual verification. Chose (2)
  — added a browser harness loading the real `demo-overlays.js`; did not add a test
  framework, since that is a project-level decision the repo has deliberately not made
  and the plan flagged it as an open question. See Open Decisions.
- **#3 hosting**: implemented the defensive code path (param allowlist) which is safe
  regardless of whether the runtime is later moved to public hosting. No operational
  change was made.

---

## Issues Encountered

- `bun` is referenced in `CLAUDE.md` but not installed in this environment; used `npm`
  (lockfiles for bun/npm/pnpm all present). No functional impact.

---

## Tests Written

| Test File                           | Coverage                                                                                                                                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<scratchpad>/verify-security.html` | #1 AC1 (no payload executes, no injected `<img>`, payload rendered as literal text), #1 AC2 (quoted-id science card still mounts). Loads the real script; open over http from repo root. |

Manual probes for #2/#4 documented in the plan's acceptance criteria (cross-origin
`postMessage` rejected; cross-origin manifest track dropped).

---

## Open Decisions (carried forward, do not block the code)

1. **Sidebar iframe origins (#2)** — confirm whether cross-origin sidebar iframes are
   used and from which origin(s); if so, set `window.__vpTrustedOrigins`. Default today
   = same-origin only.
2. **Hosting mode (#3)** — move runtime to public static hosting (removes the bypass
   secret from the page entirely) vs keep the secret + the param allowlist now in place.
3. **Test framework (#3 in plan)** — stand up Vitest+jsdom (requires making the pure
   helpers importable — a structural change) vs keep manual verification.

---

## Next Steps

- [ ] Answer the three Open Decisions.
- [ ] Run `verify-security.html` in a browser to confirm #1 ACs green.
- [ ] Changes are uncommitted — commit when ready (`/prp-commit` or manual).
