# Resilience — adaptability (keep overlays working across host changes)

**Date:** 2026-07-24
**Source analysis:** `docs/reskin-player-resilience-analysis.md` (items H1, H2, H3)
**Scope:** `runtime-src/common/` (new `player.ts`, `dom.ts`), `runtime-src/reskin-player/index.ts`, `runtime-src/demo-overlays/index.ts`
**Goal:** Survive the _common, adaptable_ LearningSuite HTML changes — a renamed player element, extra wrapper DOM, shadow DOM, resize — without losing the overlays.

**Stack constraints:** edit TS under `runtime-src/`; shared code in `runtime-src/common/`; never hand-edit `public/runtime/*.js`. Standards: no `any`, immutable, small pure functions, tests per AC. Verify with `npm run typecheck:runtime && npm test && npm run lint && npm run build:runtime`.

**Depends on:** safety-net plan (F1/F2) should land first — H1 widens what counts as "a player", so the F1 success-marker gating and F2 rollback must already protect the failure paths.

**Priority order:** H1 (P1) → H2 (P2) → H3 (P3).

---

## H1 — Centralized player discovery with capability fallback (P1)

### Risk (seam S1)

The `hls-video` tag is hardcoded across the runtime:
`reskin-player/index.ts:39,1034`; `demo-overlays/index.ts:61,108,346`
(and `admin-toggle/index.ts:22,174,181` — see Out of scope). If LearningSuite
renames the element (`<mux-player>`, `<media-controller>`, plain `<video>`),
**nothing attaches** and all overlays vanish.

### Change

Add `runtime-src/common/player.ts` exporting a pure-ish `findPlayers(root?):
MediaEl[]` that tries, in order, and returns the first non-empty result:

1. Explicit contract selector `[data-vp-player]` (see H3).
2. Known tags: `hls-video`, then likely alternates `mux-player`,
   `media-controller video`.
3. **Capability sweep:** elements where
   `typeof el.play === "function" && "currentTime" in el && "duration" in el`,
   filtered to a visible box (defer the box filter to H2's helper).

Return which strategy matched so callers can log it. Replace every hardcoded
`querySelectorAll("hls-video")` / `querySelector("hls-video")` call site with
`findPlayers()` / `findPlayers()[0]`. `attach()` already does a partial
capability check (`index.ts:151`) — promote that check into `findPlayers` as the
primary mechanism.

Observability: `console.info` the matched strategy once per session, and add it
to `_diag()` (`index.ts:125`) as `discovery: "tag:hls-video" | "capability" | …`.

**CSS limitation to note:** `RESKIN_CSS` and the F1 marker rules use the concrete
`hls-video` tag; a capability-discovered element of another tag won't get native
chrome hidden by CSS. For non-`hls-video` matches, hide native chrome via a JS
fallback (add a `data-vp-native-hidden` attribute + a tag-agnostic rule, applied
only after a verified attach). Keep this minimal — it's the bridge until H3's
contract attribute is adopted.

### Acceptance criteria

- AC1: A host exposing the player as a renamed custom element that forwards the
  media API (has `play`/`currentTime`/`duration`) is discovered and reskinned.
- AC2: `_diag().discovery` reports the strategy that matched.
- AC3: On today's `hls-video` host, discovery returns the same element(s) as the
  current code (parity; strategy = `tag:hls-video`).
- AC4: When no element matches any strategy, `findPlayers()` returns `[]` and no
  native chrome is hidden (ties to safety-net F1 + ops F5).

---

## H2 — Geometry-based host resolution, ResizeObserver, shadow-DOM scan (P2)

### Risk (seam S2)

Overlays anchor to `hlsEl.parentElement` (`reskin-player/index.ts:157`,
`demo-overlays/index.ts:108`). Extra wrapper divs, a repositioned ancestor, or a
player inside shadow DOM break positioning or discovery.

### Change

1. `resolveHost(mediaEl): HTMLElement` in `common/player.ts`: walk up from the
   media element to the nearest ancestor with a non-zero box; ensure it is a
   positioning context (`position:relative` if computed `static`, as done today
   at `index.ts:160`). Replace the raw `parentElement` reads with this.
2. **ResizeObserver** on the media element: reposition/re-measure the overlay
   layer and slots when the player box changes, so added/removed wrappers don't
   leave overlays misaligned. Register teardown via `pushCleanup`.
3. **Shadow DOM:** in `findPlayers()` (H1), also scan `open` shadow roots of
   candidate hosts (`el.shadowRoot?.querySelectorAll(...)`). Closed roots are
   unreachable — document that limitation.

### Acceptance criteria

- AC1: With the player wrapped in two extra positioned `<div>`s, overlays anchor
  to a correctly-sized container and render over the video.
- AC2: A player inside an **open** shadow root is discovered and reskinned.
- AC3: Resizing the player box repositions the overlay layer (ResizeObserver
  fires; no stale offsets).
- AC4: On today's host, `resolveHost` returns the same node as
  `hlsEl.parentElement` (parity).

---

## H3 — Stable `data-vp-player` contract in the embed block (P3)

### Risk

Tag- and structure-based discovery (H1/H2) are best-effort. The durable defense
is an explicit, structure-independent hook — the same pattern that already makes
`[data-vp-config]` robust.

### Change

- Prefer `[data-vp-player]` as the first strategy in `findPlayers()` (already
  listed in H1 step 1) — code side is a one-line priority entry.
- **Coordination:** document, in `docs/learningsuite-enrichment-research.md` (or
  a short embed-authoring note), that the LearningSuite embed block should place
  `data-vp-player` on or adjacent to the player element. When present, it wins
  regardless of tag name or wrapper nesting.
- If the attribute is on a wrapper rather than the media element itself, resolve
  the media element within it via the H1 capability sweep scoped to that subtree.

### Acceptance criteria

- AC1: When `[data-vp-player]` marks the player element, it is used regardless of
  tag name.
- AC2: When it marks a wrapper, the media element within is resolved and
  reskinned.
- AC3: Absent the attribute, discovery falls back to H1/H2 with no regression.

---

## Testing strategy

Vitest + jsdom. jsdom has no layout engine and no `ResizeObserver`, so:

- **H1** — build hosts with varied tags (custom element stubs forwarding the
  media API, plain `<video>`) and assert `findPlayers()` finds them and reports
  the strategy. Extend the existing `setupReskinDom()` helper pattern.
- **H2** — stub `getBoundingClientRect` to model wrapper boxes and assert
  `resolveHost` picks the right ancestor; polyfill/stub `ResizeObserver` and
  assert reposition is invoked and torn down. Attach an open `shadowRoot` in the
  test and assert discovery.
- **H3** — assert priority: with `[data-vp-player]` present, it wins over a
  competing `hls-video`; wrapper case resolves the inner media element.

One test per acceptance criterion.

## Open questions

1. **Non-`hls-video` chrome hiding (H1)** — confirm the JS-fallback hiding
   approach (attribute + tag-agnostic rule) vs. generating per-shape CSS. The JS
   fallback is proposed for simplicity; revisit if a concrete alternate player is
   adopted.
2. **`admin-toggle` scope** — `admin-toggle/index.ts` also hardcodes `hls-video`
   (L22/174/181). Include it in the `findPlayers()` migration, or leave it (it's
   an editor-only concern)? Proposed: migrate for consistency, separate commit.
3. **ResizeObserver churn** — throttle/debounce reposition like the existing
   `scheduleScan` (250ms) to avoid layout thrash? Proposed: yes, reuse the
   pattern.

## Out of scope

- The kill-switch and unknown-shape CSS-suppression policy (ops-telemetry plan,
  F5) — H1 reports "no match"; F5 decides the global response.
- Failure telemetry for discovery misses (ops-telemetry plan, F6).
