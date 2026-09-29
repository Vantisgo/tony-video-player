# Reskin Player Resilience Analysis

How to keep the overlays working when LearningSuite changes the original
player's HTML — and how to guarantee we never break the underlying video
player when the change is too severe to adapt to.

## Context

The reskin runtime is a set of static scripts (`public/runtime/*.js`, built
from `runtime-src/`) **injected into a third-party LearningSuite page** whose
DOM we do not own. `reskin-player` builds a custom control shell + overlay
layers over the native `<hls-video>` player; `demo-overlays` mounts the
enrichment overlays and sidebar. Because the host DOM belongs to LearningSuite,
any of their updates can move, rename, or restructure the elements we depend
on. The runtime is already defensive in many places (capability checks for
tracks, `try/catch` around host API calls, a debounced `MutationObserver`,
idempotent teardown via `pushCleanup`/`resetCleanup`). This document builds on
those patterns rather than proposing a rewrite.

---

## Part 1 — Where we couple to the host DOM (the fragile seams)

| #   | Seam                                                                                                                                          | Location                                                              | Failure if host changes                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| S1  | `querySelectorAll("hls-video")` — the whole attach pivot                                                                                      | `reskin-player/index.ts:39,1034`; `demo-overlays/index.ts:61,108,346` | Player renamed (e.g. `<mux-player>`, `<video>`) → nothing attaches; overlays never mount                                          |
| S2  | `hlsEl.parentElement` used as the overlay host container                                                                                      | `reskin-player/index.ts:157`; `demo-overlays/index.ts:108`            | Extra wrapper divs or shadow DOM → overlays anchored to the wrong box or not positioned                                           |
| S3  | **CSS hides native controls unconditionally** (`display:none !important` on `hls-video media-*`, `[slot]`, `PlayerControlsAbsoluteContainer`) | `reskin-player/styles.ts:4-10`, injected at `index.ts:43-48`          | See the critical finding below — this is the one that can leave a **player with no controls at all**                              |
| S4  | Non-standard media surfaces: `mediaEl.api` (hls.js), `audioTracks`, `audioRenditions`, `textTracks`                                           | `common/tracks.ts:31`; `reskin-player/index.ts:298-333,504-524`       | Player swap → track menus go empty. **Already graceful** — menus disable, playback unaffected                                     |
| S5  | Global `window.Hls.Events` for track-change binding                                                                                           | `reskin-player/index.ts:820-830`                                      | Absent → **already guarded** (early return)                                                                                       |
| S6  | Sidepanel iframe contract: `__source:"sidepanel"`, iframe scan                                                                                | `reskin-player/index.ts:55-95`                                        | Origin-validated; wrong shape → messages ignored, no crash                                                                        |
| S7  | `[data-vp="playpause"]` capture-click reaches into reskin's own control                                                                       | `demo-overlays/index.ts:474`                                          | Coupled to _our_ shell, not the host — safe                                                                                       |
| S8  | Host-chrome sniffing: `header, nav, [class*="AppBar"]…` for sidebar top offset                                                                | `demo-overlays/index.ts:654-667`                                      | Heuristic; **already falls back** to a min top offset                                                                             |
| S9  | **`tryFlexSibling()` — invasive host layout surgery**: sets sibling `display:none`, forces parent to `flex`, reparents into `main`'s flex row | `demo-overlays/index.ts:718-758`                                      | Most invasive mutation we perform on the host; the main way we could visibly break the _host page_ layout (not just our overlays) |
| S10 | `applyFixedRightRail()` mutates `main`/`body` `padding-right`                                                                                 | `demo-overlays/index.ts:673-716`                                      | Restored via cleanup; low risk                                                                                                    |

### Critical finding (S3): the CSS/JS asymmetry

`RESKIN_CSS` is injected in `main()` **unconditionally and before any attach
succeeds** (`index.ts:43-48`). It hides the native controls with
`display:none !important`. The custom controls, however, are only built inside
`attach()`, which can silently fail or bail (S1, S2, or a mid-attach throw).

**The dangerous state:** CSS loads → native controls hidden → `attach()` fails →
**no working controls at all.** The video may still play, but the user cannot
pause, seek, or change tracks. This converts a "reskin didn't apply" degradation
(acceptable — native player still works) into a "player is broken" outcome
(unacceptable). Fixing this asymmetry is the highest-priority hardening item.

---

## Part 2 — Hardening so overlays keep working (adapt to change)

### H1. Centralize and generalize player discovery

Today the `hls-video` tag is hardcoded in ~6 places. Replace with one
`findPlayers()` helper in `common/dom.ts` that tries a **prioritized selector
list** and, crucially, falls back to **capability detection** rather than tag
name:

```
1. document.querySelectorAll("hls-video")                    // known today
2. known alternates: "mux-player", "media-controller video"  // likely futures
3. capability sweep: any element that is an HTMLMediaElement
   OR forwards it (typeof el.play === "function" && "currentTime" in el
   && "duration" in el), filtered to a visible box
```

`attach()` already does a partial capability check (`index.ts:151`); promote it
to be the _primary_ discovery mechanism so a renamed custom element that still
forwards the media API keeps working. Log which strategy matched (`console.info`

- `_diag`) so a silent fallback is observable.

### H2. Resolve the overlay host by geometry, not by `parentElement`

Instead of assuming `hlsEl.parentElement` is the positioning context (S2),
resolve the container defensively:

- walk up to the nearest ancestor with a non-zero box and, if none is
  positioned, set `position:relative` on the chosen one (as done today at
  `index.ts:160`);
- pierce shadow DOM: if `querySelectorAll` misses, also scan
  `el.shadowRoot` of candidate hosts.

Anchor overlays to the resolved container and add a `ResizeObserver` on the
media element so overlays reposition when wrappers change size — this survives
added/removed wrapper divs.

### H3. Prefer explicit contracts over structure

The config gate already keys off our own marker `[data-vp-config]`
(`index.ts:150`) and `[data-vp-reskinned]` — this is the _right_ pattern because
those attributes are stable across host restructures. Extend it: request that
the LearningSuite embed block carry a stable `data-vp-player` (or similar)
attribute on/near the player element, and prefer that selector first in H1.
Structure-independent hooks are the most durable defense.

### H4. Keep the async-tolerant machinery (already good)

The debounced `MutationObserver` (`index.ts:1041-1055`), the "wait for both
config + video" watcher (`demo-overlays/index.ts:65-83`), and the `popstate`
re-scan already handle late/async React rendering and SPA navigation. Keep them;
they are a large part of why the runtime tolerates host churn today.

---

## Part 3 — Fail-safe: never break the underlying player (degrade gracefully)

The guiding invariant: **if we cannot fully and correctly augment the player,
we must leave the native player exactly as we found it and fully functional.**

### F1. Fix the CSS/JS asymmetry (highest priority — addresses S3)

Make native-control hiding **conditional on a successful attach**, not a
side effect of script load. Options, simplest first:

- Scope every "hide native chrome" rule under the marker we only set on
  success — i.e. require `[data-vp-reskinned="true"]` as an ancestor
  (`host.dataset.vpReskinned` is already set at `index.ts:159`). Rules 4-9 in
  `styles.ts` currently target bare `hls-video`; re-scope them to
  `[data-vp-reskinned="true"] hls-video …`. Then a failed/absent attach leaves
  native controls visible and working.
- On teardown/rollback, the marker is removed (`index.ts:1025`), so native
  controls automatically return.

### F2. Wrap the whole augmentation in try/catch with auto-rollback

`attach()` sets `__vpAttached = true` (`index.ts:152`) and appends the shell
(`:185`) before wiring handlers; a throw after that leaves partial state and a
dangling `__vpAttached`. Wrap the `attach()` body (and `applySetup()` in
demo-overlays) in `try/catch`; on catch, run the element's cleanup (we already
register comprehensive cleanup via `pushCleanup`, `index.ts:993`) so the shell
is removed, the marker cleared, and `__vpAttached` deleted — returning the
native player to its original state. A broken augment then self-heals to "native
player only."

### F3. Precondition checks before any host mutation

Before appending the shell or (especially) before `tryFlexSibling()`'s layout
surgery (S9), assert the preconditions: player found, host container has a
non-zero box, required nodes resolved. If any fail, bail **before** mutating.
`tryFlexSibling()` already restores on failure and prefers the less invasive
`applyFixedRightRail()` — keep that, and additionally guard it so it never runs
when the host layout doesn't match expectations, rather than mutating then
reverting.

### F4. Post-attach self-verification

After building the shell, verify it actually rendered correctly: overlay layer
has a non-zero box and sits over the video. If not, auto-teardown (F2 path) and
leave the native player. This catches "attached but visually broken" cases that
a try/catch won't, because they don't throw.

### F5. Remote kill-switch / version pin (operational safety net)

Because the scripts are injected and can't be hot-patched per embed, add a
lightweight remote gate: on startup, fetch a small flag from our own origin
(`{ enabled, minHostVersion }`) and no-op if disabled. If a LearningSuite update
breaks the runtime in production, we flip the flag and every embed falls back to
the native player **without a redeploy**. Pair with H1's shape detection: if no
known player shape matches, refuse to inject the control-hiding CSS at all.

### F6. Attach telemetry

`_diag()` already exists (`index.ts:125`). Emit a one-shot beacon on attach
success/failure (which discovery strategy matched, whether tracks were found).
This surfaces a LearningSuite breaking change from monitoring **before** users
report a dead player.

---

## Part 4 — Prioritized recommendations

| Priority | Item                                                                    | Addresses           | Effort             |
| -------- | ----------------------------------------------------------------------- | ------------------- | ------------------ |
| **P0**   | F1 — scope native-control-hiding CSS under `[data-vp-reskinned]`        | S3 critical         | Low (CSS only)     |
| **P0**   | F2 — try/catch + auto-rollback around `attach()`/`applySetup()`         | mid-attach breakage | Low                |
| P1       | H1 — centralized `findPlayers()` with capability fallback               | S1                  | Medium             |
| P1       | F5 — remote kill-switch / version pin                                   | severe host change  | Medium             |
| P2       | H2 — geometry-based host resolution + `ResizeObserver`; shadow-DOM scan | S2                  | Medium             |
| P2       | F3/F4 — preconditions + post-attach self-verification                   | S9, partial mounts  | Medium             |
| P3       | H3 — stable `data-vp-player` contract in the embed block                | S1, S2              | Low (coordination) |
| P3       | F6 — attach telemetry beacon                                            | detection           | Low                |

**The two P0 items are the core answer.** F1 guarantees that a failed reskin
degrades to a _working native player_ rather than a controlless one; F2
guarantees a mid-attach error self-heals instead of leaving the host DOM
half-mutated. Together they satisfy "never break the video player." H1 + H2 +
H3 are how the overlays keep _working_ across the more common, survivable host
changes; F5 is the escape hatch for the changes that are too severe to adapt to.

---

## Part 5 — Reporting a failed attach (logging + webhook)

Expands F6. A failed attach **can** be logged and can fire a webhook. The
runtime runs in the browser on the LearningSuite page, so a "webhook" here is a
`fetch`/`sendBeacon` POST. The firm rule: **post to a relay endpoint we own,
never directly to Slack/Discord.**

### Why a relay, not a direct webhook

- **The URL would be public.** The runtime is a static script served to a
  third-party page — a Slack/Discord webhook URL embedded in it is visible to
  anyone and spammable.
- **CORS blocks it anyway.** Slack/Discord webhooks don't return
  `Access-Control-Allow-Origin`, so a cross-origin browser `fetch` is rejected.
  An endpoint we own can allow the LearningSuite origin.
- A relay is also the one place for **rate limiting, dedup, and secret storage**.

Flow: `runtime (browser) → app/api/runtime-telemetry (Vercel, we own) →
Slack/Discord/log sink`.

The app is already set up for this: `app/api/*/route.ts` handlers exist and
`env.ts` uses the t3 pattern — so the sink URL is a **server** var
(`RUNTIME_ALERT_WEBHOOK_URL`), never exposed to the client.

### Implementation shape

1. **Relay route** (`app/api/runtime-telemetry/route.ts`): `POST` validates the
   body (Zod — trust boundary), forwards to `env.RUNTIME_ALERT_WEBHOOK_URL`;
   `OPTIONS` returns `Access-Control-Allow-Origin` for the LearningSuite
   origin(s); rate-limit per origin/IP.
2. **Beacon helper** in `runtime-src/common/`: `navigator.sendBeacon`
   (fire-and-forget, survives unload) with a `fetch(..., { keepalive: true })`
   fallback. Payload reuses `_diag()` (`reskin-player/index.ts:125`).
3. **Instrument the real failure points** (today silent early-returns /
   `console.warn`):
   - `attach()` early bails + mid-attach throw — `reskin-player/index.ts:150-158`
     (the F2 try/catch site).
   - **No player found after a deadline** — the key one. Discovery waits
     indefinitely via `MutationObserver`; a _failure_ means "we should have
     attached but didn't." The signal we should have: `[data-vp-config]` present
     (advanced mode on) yet no attach within ~10s. Distinguishing "not rendered
     yet" from "will never render" is the crux.
   - Post-attach self-verification failure (F4 — overlay layer has a zero box).
   - demo-overlays: config/player never appeared (`demo-overlays/index.ts:65-83`).
4. **Suppress noise** — the scan runs on every mutation (~4×/s). Needed:
   **dedup** each failure _kind_ once per page session (a `Set`, like the
   existing `activeOverlays` pattern), a **deadline** before declaring failure,
   and a client throttle **+** server rate limit as backstop.

### What's needed (checklist)

| #   | Item                                                                         | Notes                                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | A sink (Slack/Discord incoming webhook or logging service)                   | URL as `env.RUNTIME_ALERT_WEBHOOK_URL`, server-only                                                                                                                            |
| 2   | Relay route + CORS/OPTIONS + rate limit                                      | Small file; follows existing `app/api` pattern                                                                                                                                 |
| 3   | Beacon helper + failure instrumentation in the runtime                       | Pairs with the F2 try/catch and F4 self-check                                                                                                                                  |
| 4   | **Confirm LearningSuite CSP `connect-src`** allows POST to our Vercel origin | ⚠️ The real blocker — restrictive CSP silently drops the beacon. `script-src` allowing our scripts does **not** imply `connect-src` does. Verify on a live embed               |
| 5   | Failure-deadline threshold; which kinds alert vs. just log                   | Avoids alert fatigue                                                                                                                                                           |
| 6   | **Privacy call**: payload contents                                           | `location.href` may carry lesson/user identifiers — prefer pathname or a hash, plus host fingerprint (which player tags exist), `userAgent`, `runtimeBuild`, timestamp. No PII |

The two genuine risks: **#4 (CSP)** can defeat this regardless of code quality,
and **#6 (privacy)** since we emit from a third-party context. Both are
verifiable before building.
