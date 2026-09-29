# Runtime augment scripts — playback hot-path performance fixes

**Date:** 2026-07-24
**Scope:** `runtime-src/reskin-player/index.ts`, `runtime-src/demo-overlays/index.ts` (source only; regenerates `public/runtime/{reskin-player,demo-overlays}.js` via `npm run build:runtime`).
**Related:** builds on `completed/2026-07-24_refactor_runtime-ts-module-migration.plan.md`; see `docs/feature-context.md` Standing Constraints.

## Summary

Four independent, behaviour-preserving edits that remove wasted work from the per-`timeupdate`
hot path (~4×/s during playback) in the two injected runtime IIFEs. The scripts run on a live
LearningSuite (React + Apollo) page alongside the host `hls-video` player, so per-frame work on
the shared main thread is the core risk. Nothing here changes the public surface, activation
gates, or visible behaviour — only how often / how much work runs when the timeline advances.

Ordered by impact: **F1** (Apollo cache extraction per frame) and **F2** (full panel `innerHTML`
rebuild per frame) are the high-value fixes; **F3** (iframe broadcast) and **F4** (subtitle cue
churn) are medium/low.

## Constraints (must hold)

- Behaviour-preserving: `window.player` API shape, `window.__vp*` globals, `window.__vp*Cleanup`
  registries, return strings, and all activation gates unchanged. No new features.
- No `any`, no unjustified type assertions (repo CLAUDE.md); immutable-first, small pure helpers.
- Edit `runtime-src/` only, **never** `public/runtime/*.js` — those are esbuild output and CI
  drift-checks them. After each change: `npm run typecheck:runtime` → `npm test` →
  `npm run build:runtime` and commit the regenerated `.js`.
- No new runtime dependency added to the bundles (bundle size is injected verbatim; see
  Standing Constraints).

---

## F1 — Stop extracting the whole Apollo cache on every `timeupdate` (reskin-player) 🔴

**Problem.** `onTime` → `renderActiveSubtitle(t)` (`reskin-player/index.ts:893`) unconditionally
calls `getLearningSuiteTranscriptTracks(mediaEl)` in the non-external branch
(`index.ts:650-664`). That helper runs `apollo.cache.extract()` (`language-pack.ts:310`) — a deep
snapshot of the entire normalized Apollo store — then `Object.values(...)` iterates it. This runs
several times per second **even when `learningSuiteSubtitleIndex < 0`** (no LS subtitle selected —
the default), and the result is discarded (`track = null`).

**Fix.** Only extract when a LearningSuite subtitle is actually selected. In `renderActiveSubtitle`:

```ts
// before (index.ts:658-663)
const tracks = getLearningSuiteTranscriptTracks(mediaEl);
const track =
  learningSuiteSubtitleIndex >= 0 ? tracks[learningSuiteSubtitleIndex] : null;
renderSubtitleCue(track, time);

// after
const track =
  learningSuiteSubtitleIndex >= 0
    ? getLearningSuiteTranscriptTracks(mediaEl)[learningSuiteSubtitleIndex]
    : null;
renderSubtitleCue(track, time);
```

**Behaviour parity.** When `learningSuiteSubtitleIndex < 0` the old code already produced
`track = null`; the result is identical, minus the extraction. Menu building
(`getLearningSuiteSubtitleOptions`) still extracts on demand — unchanged.

---

## F2 — Guard full-panel `innerHTML` rebuilds against per-frame churn (demo-overlays) 🔴

**Problem.** `recomputeActive` calls `renderCoaching()` and `renderMeta()` unconditionally on
every bus `"time"` event (`demo-overlays/index.ts:955-956`). Each does a complete `innerHTML =`
teardown/rebuild of its whole panel plus `querySelectorAll(...).forEach` listener rebind
(`renderCoaching` 787/840/856; `renderMeta` 914/931). Their output only depends on active phase,
active intervention, expanded phase (coaching) and active meta (meta) — which change rarely — yet
they rebuild ~4×/s, causing layout/reparse churn and destroying scroll/`:hover`/focus state inside
the panels every frame.

**Fix.** Mirror the dirty-check pattern already used by `renderSection` (`index.ts:220`,
`renderedPhaseId`). Add a signature per renderer and early-return when unchanged:

- `renderCoaching`: signature = `\`${w.__vpActivePhase}|${w.**vpActiveIntervention}|${w.**vpExpandedPhase}\``.
Store in a closure var (e.g. `let coachingSig: string | null`); return early if equal; update
  after a successful render.
- `renderMeta`: signature = `w.__vpActiveMeta ?? ""`.

Manual callers that intentionally re-render on state toggle must still force a rebuild:

- Coaching phase toggle (`index.ts:852-853`) sets `w.__vpExpandedPhase` then calls
  `renderCoaching()` — the signature changes, so it rebuilds naturally. ✅
- The initial `renderCoaching()` (`864`) / `renderMeta()` (`936`) run with `sig === null`, so they
  always render once. ✅

No signature is needed for `renderSciencePanel`/`renderScienceHighlight` (already event-gated via
`slotTR.dataset.activeSci`) or `renderSection`/`renderScience`/`renderMetaStep` (already guarded).

**Behaviour parity.** Output is byte-identical whenever the signature differs; when it matches, the
DOM would have been rebuilt to the same markup, so skipping is invisible (and additionally
_preserves_ scroll/focus that the old code discarded — a strict improvement, no visible regression).

---

## F3 — Avoid re-scanning the DOM for iframes on every bus emit (reskin-player) 🟠

**Problem.** The cross-frame bridge `bus.on("any", …)` (`reskin-player/index.ts:68-86`) runs
`document.querySelectorAll("iframe")` and constructs `new URL(f.src, …)` per iframe on **every**
emit — including every `"time"` (~4×/s) — even when there are no trusted cross-frame peers.

**Recommended fix (cache, behaviour-preserving).** Maintain a cached target list of
`{ win: Window, origin: string }` for trusted iframes, rebuilt only when the DOM changes rather
than per emit:

- Compute `refreshIframeTargets()` = query iframes once, resolve each origin, keep those in
  `vpTrustedOrigins`.
- Call it at setup, and piggyback on the existing debounced `scan()` (`index.ts:1018-1022`) which
  already fires from the `MutationObserver` on childList changes (iframe add/remove) and on
  `popstate`. The `bus.on("any")` handler then just iterates the cached list and posts.
- Edge case: an iframe whose `src` mutates without a childList change won't refresh. Address by
  adding `attributes: true, attributeFilter: ["src"]` to the existing `mo.observe(...)` options
  (`index.ts:1034`) so `scheduleScan` also fires on src changes. Low added cost (still debounced).

This keeps the exact broadcast semantics (every event still posts to every trusted iframe,
including same-origin peers) while removing the per-emit DOM query + `URL` allocations.

**Alternative (simpler, tiny behaviour change) — needs user OK.** Throttle only `"time"`
broadcasts to ~2Hz (sidepanels don't need 4Hz timeline precision); `play`/`pause`/`seek`/overlay
events still post immediately. Less code, but changes the time-message cadence. **Decision point:**
default to the cache approach unless the user prefers throttling.

---

## F4 — Don't rebuild the subtitle cue when it hasn't changed (reskin-player) 🟠

**Problem.** `renderSubtitleCue` (`reskin-player/index.ts:627-648`) calls
`subtitleLayer.replaceChildren()` and creates a fresh `<span>` on every `timeupdate` while a
subtitle track is active, even when the same cue (or no cue) is already displayed.

**Fix.** Track the currently rendered cue text in a closure var and short-circuit:

- Compute `nextText = cue?.text ?? ""`.
- If `nextText === renderedCueText`, return without touching the DOM.
- Otherwise update (`replaceChildren` + new span for non-empty, or hide for empty), then store
  `renderedCueText = nextText`.

**Behaviour parity.** Identical rendered DOM for any given cue; only redundant writes are skipped.
Reset `renderedCueText` to `""` wherever the layer is force-cleared on track change (the existing
`renderActiveSubtitle` call sites in `setSubtitleTrack`) so a re-selected identical cue still
paints. Simplest: reset it inside the empty-cue branch and on the off/track-switch paths.

---

## Testing (vitest + happy-dom)

happy-dom has no real playback, so tests drive the bus/handlers directly. New `*.test.ts` covering
each acceptance criterion (per CLAUDE.md — tests required per story):

- **F1** (`reskin-player/*.test.ts`, new): install a fake `window.__APOLLO_CLIENT__` whose
  `cache.extract` is a counting spy; attach the player to an `hls-video`; dispatch several
  `timeupdate` events with **no** LS subtitle selected → assert `extract` call count is `0`. Then
  select a LS subtitle and dispatch `timeupdate` → assert it is now called. (Requires the reskin
  entry to be importable under test; if the IIFE isn't cleanly importable, test the extracted
  `renderActiveSubtitle` seam — extract it as a small pure-ish helper only if needed, otherwise
  driving via the DOM is preferred.)
- **F2** (extend `demo-overlays/render.test.ts`): after setup, capture the first child node of the
  coaching panel; fire two `"time"` bus events at times within the **same** phase/intervention →
  assert the captured node identity is unchanged (no rebuild). Fire a `"time"` that crosses into a
  new phase → assert the panel rebuilt (node identity changed / new content). Same pattern for the
  meta panel via `w.__vpActiveMeta`.
- **F3** (`reskin-player/*.test.ts`): add a same-origin iframe with a `postMessage` spy on its
  `contentWindow`; fire multiple `"time"` events → assert the iframe still receives every message
  (parity) and that `document.querySelectorAll` is not called per emit (spy on the cached-list
  refresh instead — assert it runs on mutation, not per emit).
- **F4** (`reskin-player/*.test.ts`): with an active subtitle track, fire two `timeupdate` events
  whose times fall in the same cue → assert the cue `<span>` node identity is preserved; fire one
  in the next cue → assert it updated.

Existing tests (`config`, `format`, `escape`, `origins`, `render`) must stay green.

## Acceptance criteria

- **AC1** No `apollo.cache.extract()` call occurs on `timeupdate` while `learningSuiteSubtitleIndex < 0`; extraction still happens when a LS subtitle is selected and when building the subtitle menu.
- **AC2** `renderCoaching`/`renderMeta` do not rebuild panel DOM when their signature is unchanged, and do rebuild on the first render and whenever active phase / intervention / expanded phase / active meta changes. Phase-toggle interaction still works.
- **AC3** The iframe bridge posts the same messages to the same trusted iframes as before, without a per-emit `querySelectorAll("iframe")`; the cached list refreshes on iframe add/remove and `src` change.
- **AC4** The subtitle layer DOM is not rewritten while the displayed cue is unchanged, and updates correctly on cue change and track change.
- **AC5** `npm run typecheck:runtime`, `npm test`, and `npm run build:runtime` all pass; `git diff --exit-code -- public/runtime` is clean after committing the regenerated bundles.

## Validation / rollout

1. Implement F1 → F4 in `runtime-src/`.
2. `npm run typecheck:runtime` → `npm test` (add new tests) → `npm run build:runtime`.
3. Commit regenerated `public/runtime/*.js` together with source (CI drift-check).
4. Suggested commits (repo prefixes): one `[TASK]` per finding, or a single
   `[TASK] Trim runtime playback hot-path work (Apollo extract, panel rebuilds, iframe scan, cue churn)`.

## Open decision

- **F3 approach:** cache-and-refresh (recommended, behaviour-preserving) vs throttle `"time"`
  broadcasts (simpler, small cadence change). Defaulting to cache unless told otherwise.
