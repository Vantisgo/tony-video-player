# Runtime augment scripts — TS module migration (build → classic IIFE)

**Date:** 2026-07-24
**Scope:** `public/runtime/{reskin-player,demo-overlays,admin-toggle}.js` and new `runtime-src/`, build tooling, tests, CI.
**Related:** builds on `completed/2026-07-24_security_runtime-augment-hardening.plan.md`; see `docs/feature-context.md` Standing Constraints.

## Summary

Decouple **source** from **injected artifact**. Author the three runtime scripts as
TypeScript modules under `runtime-src/`, with shared code in `runtime-src/common/`, and
**bundle each entry with esbuild into a single self-contained classic IIFE** emitted to
`public/runtime/<name>.js`. The distribution/loading model is unchanged (one classic
`<script src>` per entry, cross-origin-loadable, re-injectable, self-gating). This unlocks
shared code, types, and unit tests without changing what LearningSuite loads.

**This migration is behaviour-preserving.** No new runtime features. The security fixes
already in the hand-written files move into the TS source verbatim.

## Decisions (locked with the user)

- **Production-bound**, more features planned → invest in build + types + tests.
- **Build step is fine**, likely CI-automated.
- **Generated output is committed** to `public/runtime/`, and **CI rebuilds + fails on drift**
  (`git diff --exit-code -- public/runtime`).
- **Output is unminified + linked source map** (readability for debugging in a third-party
  page beats byte size).
- **Preact/JSX for the overlay UI (Option 4) is deferred** to a follow-up plan; this pass
  keeps the `innerHTML` + `esc()` approach, just modularized.

## Constraints (must hold)

- Each output stays a **single classic IIFE**, no `type="module"`, no external imports at
  runtime, no load-order dependency between the three files (common code is inlined into
  each bundle).
- Public surface unchanged: `window.player` API shape, `window.__vp*` globals, the
  `window.__vp*Cleanup` idempotency registries, the return strings, and every activation
  gate (`[data-vp-config]`, `/admin/editor/` + not `?view=preview`).
- No `any`, no unjustified type assertions (repo CLAUDE.md). Model the third-party surfaces
  (`hls-video` element, hls.js `api`, media element extras) with explicit minimal interfaces.

## Target architecture

```
runtime-src/
  common/
    escape.ts       esc(v): string           (moved from demo-overlays)
    format.ts       formatTime(s): string     (dedup of fmt in reskin+demo)
    origins.ts      getTrustedOrigins(): Set<string>; makeAssetOriginChecker(baseUrl)
    bus.ts          createBus()               (moved from reskin)
    cleanup.ts      runPreviousCleanup(key); pushCleanup(key, fn)  (the __vp*Cleanup pattern)
    dom.ts          listToArray(list)
    tracks.ts       trackLabel(); getBunnyVideoId(); getHlsApi(); getLanguageName()
    config.ts       VpConfigSchema (zod); parseVpConfig(); loadVpConfig()
    types.ts        VpConfig, Phase, Intervention, Science, Audio, MetaStep, LanguagePack,
                    TrackOption, HlsVideoElement, HlsApi …
  reskin-player/
    index.ts        entry: cleanup+style+bus+postMessage bridge+scan/observer+window.player+attach()
    styles.ts       the CSS string
    language-pack.ts VTT parse, normalize/load, transcript-cue + LS-transcript extraction
    audio.ts        external-audio state machine + drift + audio-menu options + setAudioTrack
    subtitles.ts    subtitle-menu options + setSubtitleTrack + renderActiveSubtitle
    track-menu.ts   renderMenu / toggle / close
    diagnostics.ts  getTrackDiagnostics
  demo-overlays/
    index.ts        entry: config-load/defer, applySetup orchestration, time-sync
    data.ts         DEFAULT_PHASES/SCIENCES/AUDIOS/META_STEPS
    styles.ts       animation + section stylesheets
    section.ts      renderSection (+ refs)
    science.ts      renderScience + science panel + highlight
    audio.ts        audioCtrl state machine + renderAudio + maybeTriggerAudio
    meta.ts         renderMetaStep + meta panel
    sidebar.ts      sidebar DOM + tabs + coaching panel
    layout.ts       tryFlexSibling / applyFixedRightRail / detectTopNavHeight
  admin-toggle/
    index.ts        entry: mode gating, scan/observer, banner attach
    prompt.ts       PROMPT_TEXT
    styles.ts       banner + dialog stylesheet
    dialog.ts       openDialog
    banner.ts       banner build + refreshStatus + hasVpConfigOnPage

scripts/build-runtime.mjs      esbuild driver (build + --watch)
tsconfig.runtime.json          DOM libs, no JSX, strict; type-checks runtime-src
vitest.config.ts               happy-dom environment
.prettierignore                excludes generated public/runtime/*.js
public/runtime/*.js            GENERATED (committed)
public/runtime/*.js.map        GENERATED (gitignored, external, unreferenced)
```

**Closure-state note (reskin):** `attach()` currently closes over ~15 locals (mediaEl, shell
refs, external-audio indices, timers). To split it across modules without a global, introduce
one `AttachContext` object created in `index.ts` and threaded into `audio.ts` / `subtitles.ts` /
`track-menu.ts` factory functions. Do **not** over-split — 4–5 modules per entry is the target,
not one-function-per-file.

## Tooling specifics

**esbuild** (`scripts/build-runtime.mjs`):

```js
import * as esbuild from "esbuild";
const opts = {
  entryPoints: {
    "reskin-player": "runtime-src/reskin-player/index.ts",
    "demo-overlays": "runtime-src/demo-overlays/index.ts",
    "admin-toggle": "runtime-src/admin-toggle/index.ts",
  },
  outdir: "public/runtime",
  bundle: true,
  format: "iife",
  target: ["es2019"],
  sourcemap: "external",
  minify: false,
  charset: "utf8",
  legalComments: "none",
  logLevel: "info",
};
if (process.argv.includes("--watch")) {
  (await esbuild.context(opts)).watch();
} else {
  await esbuild.build(opts);
}
```

Output filenames come from the entryPoints keys → `public/runtime/reskin-player.js` etc.
`sourcemap: 'external'` emits `.js.map` files **without** injecting a `//# sourceMappingURL=`
comment (no auto-download by browsers, no dangling-reference 404). The `.js.map` files are
**gitignored, not committed** — load them manually in DevTools from a local build when needed.

**package.json scripts:**

```
"build:runtime": "node scripts/build-runtime.mjs",
"watch:runtime": "node scripts/build-runtime.mjs --watch",
"typecheck:runtime": "tsc -p tsconfig.runtime.json --noEmit",
"prebuild": "npm run build:runtime",
"predev": "npm run build:runtime"
```

(Developers iterating run `watch:runtime` in a second terminal; `predev` guarantees fresh
files for a plain `next dev`.)

**Prettier / pre-commit:** the `.simple-git-hooks.json` pre-commit runs `pretty-quick --staged`,
which would reformat the esbuild output and break drift-check. Add `.prettierignore`:

```
public/runtime/*.js
```

**gitignore:** the external source maps are generated but not committed. Add to `.gitignore`:

```
public/runtime/*.js.map
```

**CI drift-check** — **GitHub Actions** (`.github/workflows/runtime.yml`), triggered on PRs and
pushes touching `runtime-src/**`, `public/runtime/**`, or the build tooling:

```
npm ci
npm run build:runtime
git diff --exit-code -- public/runtime || (echo "runtime bundle drift — run npm run build:runtime and commit"; exit 1)
npm run typecheck:runtime
npm test
```

**Tests** (Vitest + happy-dom): unit-test the pure/near-pure common modules and at least one
DOM-rendering module.

## Step-by-step tasks

- [ ] **T1 — Tooling scaffold.** Add devDeps (`esbuild`, `vitest`, `happy-dom`), `scripts/build-runtime.mjs`, `tsconfig.runtime.json` (extends root, `lib: ["dom","dom.iterable","es2020"]`, no jsx, `noEmit`), `vitest.config.ts` (env happy-dom), `.prettierignore`, and the npm scripts. Verify `npm run build:runtime` runs against an empty stub entry.
- [ ] **T2 — common/ modules + types + config schema.** Port `esc`, `fmt`→`formatTime`, bus, cleanup registry, `listToArray`, track helpers. Author `types.ts` and the zod `VpConfigSchema` + `parseVpConfig`/`loadVpConfig`. Unit tests: `escape`, `format`, `origins`, `config`.
- [ ] **T3 — Migrate `reskin-player`.** Port entry + `styles/language-pack/audio/subtitles/track-menu/diagnostics` using an `AttachContext`. Keep the security behaviour (trusted origins, finite-time guard, forwarded-param allowlist, asset-origin allowlist). `npm run build:runtime && npm run typecheck:runtime` clean. Behaviour-parity check vs current file (see Validation).
- [ ] **T4 — Migrate `demo-overlays`.** Port entry + `data/styles/section/science/audio/meta/sidebar/layout`. All config values still go through `esc()`; ids through `CSS.escape`. Config now validated via the zod schema from common (invalid config → fall back to defaults, logged). Build + typecheck clean; run `verify-security.html` (from the security plan) → all PASS.
- [ ] **T5 — Migrate `admin-toggle`.** Port entry + `prompt/styles/dialog/banner`. Gating (`/admin/editor/`, not preview) unchanged. Build + typecheck clean.
- [ ] **T6 — Wire build into lifecycle + CI.** Confirm committed `public/runtime/*.js` are the esbuild output; add `.prettierignore`; add the CI drift-check + typecheck + test job. Confirm `git diff --exit-code -- public/runtime` is clean immediately after a fresh build.
- [ ] **T7 — Behaviour-parity sign-off.** Run the parity checklist (below) against the live LearningSuite lesson used in the research doc; capture updated `poc-*.png` if anything shifted. Record any intentional deltas.

## Validation commands

```
npm run build:runtime        # bundles to public/runtime/*.js
npm run typecheck:runtime    # tsc --noEmit over runtime-src
npm test                     # vitest (common modules + one DOM render test)
git diff --exit-code -- public/runtime   # drift-check: clean after build
# manual: open scratch verify-security.html over http → #1 ACs PASS
```

(Full `next build` remains gated on `DATABASE_URL`/`BLOB_READ_WRITE_TOKEN`; not required for
this work — runtime scripts are static assets outside the compile graph.)

## Acceptance criteria

- AC1: Each `public/runtime/<name>.js` is a single classic IIFE produced by esbuild, loads via
  `<script src>` cross-origin, and re-running it tears down the prior instance (cleanup registry
  intact).
- AC2: `window.player` API, `window.__vp*` globals, return strings, and all activation gates are
  behaviourally identical to the pre-migration files.
- AC3: `npm run typecheck:runtime` passes with zero `any`/unjustified assertions.
- AC4: `npm test` passes; coverage includes `esc` (XSS payloads neutralized), origin allowlists,
  `formatTime`, and config-schema accept/reject, plus one DOM test asserting a renderer escapes a
  malicious config value.
- AC5: `git diff --exit-code -- public/runtime` is clean immediately after `npm run build:runtime`
  (no drift; prettier does not touch generated files).
- AC6: Parity checklist green against the live lesson (controls mount, seek/timeline, external
  listeners still fire, native UI hidden, all four overlays, sidebar both mount strategies,
  audio takeover, science re-fire, track menus).

## Risks / gotchas

- **Output not byte-identical to today's files** → parity is _behavioural_, verified via the
  harness + checklist, not `diff`. Expect one large "migration" commit where the files change shape.
- **pretty-quick pre-commit** reformats generated files → `.prettierignore` is mandatory (T6),
  else every commit drifts the bundle and CI fails.
- **happy-dom gaps** — `SpeechSynthesis`, some media APIs, possibly `CSS.escape` are absent; guard
  in source (already guarded) and polyfill/skip in tests as needed.
- **`~/` alias** is Next-app-scoped; `runtime-src` uses **relative imports only** to keep the
  bundler config trivial.
- **hls.js / hls-video typing** — model as explicit optional interfaces in `common/types.ts`; never
  `any`. `mediaEl.api`, `audioRenditions`, `audioTracks` are non-standard → declare them.
- **Committed artifacts drift** if someone hand-edits `public/runtime/*.js` → CI drift-check is the
  guard; add a header banner comment in the bundle (esbuild `banner`) reading "GENERATED — edit
  runtime-src/, run npm run build:runtime".

## Open questions

1. ~~CI system~~ — **Resolved: GitHub Actions** (`github.com/Vantisgo/tony-video-player`). T6 authors
   `.github/workflows/runtime.yml`.
2. ~~es target~~ — **Resolved: `es2019`.**
3. ~~Source-map exposure~~ — **Resolved: `external` + gitignored** (unreferenced `.js.map`, not
   committed; load manually from a local build).

## Out of scope (future plans)

- Replacing `demo-overlays` `innerHTML` rendering with Preact/JSX components (Option 4) — separate
  plan once the module structure lands; that step also structurally removes the XSS class.
- New overlay features / the enrichment content service.
