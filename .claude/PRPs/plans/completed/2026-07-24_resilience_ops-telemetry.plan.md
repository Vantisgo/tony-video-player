# Resilience — ops & telemetry (kill-switch + failure reporting)

**Date:** 2026-07-24
**Source analysis:** `docs/reskin-player-resilience-analysis.md` (items F5, F6, Part 5 webhook)
**Scope:** new `runtime-src/common/{killswitch,beacon}.ts`; `runtime-src/reskin-player/index.ts`; `runtime-src/demo-overlays/index.ts`; new `app/api/runtime-telemetry/route.ts`; new `app/api/runtime-config/route.ts`; `env.ts`; `@vercel/edge-config` dependency + Edge Config store
**Goal:** (F5) turn the runtime off everywhere without a redeploy when a host change breaks it; (F6 + Part 5) log and webhook-alert on a failed attach so a LearningSuite breaking change is detected before users report it.

**Stack constraints:** runtime code is TS under `runtime-src/`, bundled to injected IIFEs — never hand-edit `public/runtime/*.js`. App routes follow the existing `app/api/*/route.ts` pattern; `env.ts` uses `@t3-oss/env-nextjs` (server vars auto-spread). Standards: no `any`, immutable, small pure functions, tests per AC.

**Depends on:** safety-net plan (F2 rollback, F4 self-verification) — those produce the failure signals this plan reports. Adaptability plan (H1) — "no player shape matched" is one reported/gated condition.

**Priority order:** F5 (P1) → F6/Part 5 (P3). F5 is the higher-value safety net; the webhook is detection.

> **Resolved decisions (were open questions):**
>
> - **Kill-switch backing:** Vercel **Edge Config** (redeploy-free flips).
> - **Sink:** `RUNTIME_ALERT_WEBHOOK_URL` is **software-agnostic** — the relay
>   sends a plain REST `POST` with a minimal JSON body (error type, video id, and
>   the config JSON the player read). No Slack/Discord-specific formatting.
> - **CSP:** **assume the webhook is not blocked** — we proceed on the assumption
>   that LearningSuite's `connect-src` permits our Vercel origin (F5's fail-open
>   behaviour is the safety net if that assumption is ever wrong).
> - **Rate-limit store:** **in-memory per-instance** counter (best-effort).
>
> Note the payload now carries the config JSON and video id (for debugging),
> which supersedes the earlier pathname-hash/no-PII shape — see F6, step 6.

---

## F5 — Remote kill-switch / version pin (P1)

### Risk

The scripts are injected into a third-party page and cannot be hot-patched per
embed. If a host change breaks the runtime in production, there is no way to
disable it fast except redeploying and waiting for every embed to pick it up.

### Change

1. `runtime-src/common/killswitch.ts` — `shouldRun(): Promise<boolean>` fetches a
   small JSON flag `{ enabled: boolean, minHostVersion: string | null }` from
   `app/api/runtime-config/route.ts`. That route reads the value from **Vercel
   Edge Config** (`@vercel/edge-config`), so the flag is flipped from the Vercel
   dashboard/API **without a redeploy**. The route sets a short `Cache-Control`
   (e.g. 60s — this caps propagation to already-open pages) and permissive CORS
   for the LearningSuite origin. Add the `@vercel/edge-config` dependency and the
   Edge Config connection (`EDGE_CONFIG` env, provided by the Vercel integration).
2. Guard both entrypoints: `main()` in `reskin-player` and `demo-overlays`
   await `shouldRun()` (fail-open on network error — a fetch failure must **not**
   disable a working runtime) before mutating the page. When disabled, no-op
   cleanly (no CSS injected, no attach).
3. **Unknown-shape suppression** (ties to adaptability H1): if `findPlayers()`
   returns `[]`, do **not** inject the control-hiding CSS at all — leaving the
   native player fully intact — and emit the F6 beacon.

### Acceptance criteria

- AC1: With the flag `enabled:false`, the next page load injects nothing and the
  native player is untouched (reskin + demo both no-op).
- AC2: A fetch failure / timeout on the flag **fails open** — the runtime still
  attaches (never disable on error).
- AC3: When no player shape matches, control-hiding CSS is not injected.
- AC4: Flipping the Edge Config value disables the runtime on the next load
  (within the `Cache-Control` TTL) with no redeploy.

---

## F6 + Part 5 — Failed-attach logging & webhook (P3)

### Risk

Failures today are silent early-returns or `console.warn`. A LearningSuite
breaking change goes unnoticed until users report a dead player.

### Architecture

`runtime (browser) → app/api/runtime-telemetry (Vercel, we own) →
env.RUNTIME_ALERT_WEBHOOK_URL (software-agnostic REST endpoint)`.

The relay POSTs a plain JSON body to whatever URL `RUNTIME_ALERT_WEBHOOK_URL`
points at — a generic REST receiver, not a vendor-specific webhook. No
Slack/Discord Block Kit shaping; the receiver decides what to do with the
payload.

**Never** post directly from the runtime to the sink: the URL would be public in
an injected script, and an arbitrary receiver almost certainly lacks the CORS
headers a cross-origin browser POST needs. The relay owns the secret
(`RUNTIME_ALERT_WEBHOOK_URL` is server-only), CORS, and rate limiting.

### Change

1. **Beacon helper** `runtime-src/common/beacon.ts` — `report(payload):void`
   using `navigator.sendBeacon` (fire-and-forget, survives unload) with a
   `fetch(url, { method:"POST", keepalive:true, … })` fallback. URL is the
   relay, resolved from the runtime asset base (same origin the scripts load
   from). Never throws.
2. **Relay route** `app/api/runtime-telemetry/route.ts`:
   - `POST`: validate the body with **Zod** (trust boundary — the payload is
     attacker-influenceable), then forward it as a REST `POST`
     (`content-type: application/json`) to `env.RUNTIME_ALERT_WEBHOOK_URL` and
     return `204`. Apply an **in-memory per-instance** rate limit (see step 5;
     best-effort backstop against a client bug or abuse — a fixed cheap `204`
     response keeps flooding low-cost to absorb).
   - `OPTIONS`: return `Access-Control-Allow-Origin` for the LearningSuite
     origin(s) + allowed method/headers (CORS preflight).
3. **`env.ts`** — add server var `RUNTIME_ALERT_WEBHOOK_URL: z.string().url()`
   (auto-spread to `runtimeEnv`) — a software-agnostic REST URL. Add `EDGE_CONFIG`
   (Edge Config connection string, from the Vercel integration; used by F5).
   Optional `RUNTIME_TELEMETRY_ALLOWED_ORIGINS` for the CORS allowlist.
4. **Instrument the failure points** (emit exactly one beacon per kind):
   - reskin `attach()` bail + the F2 catch (`index.ts:150-158` + rollback).
   - **No player after a deadline** — the key signal. Discovery waits
     indefinitely via `MutationObserver`. Report only when `[data-vp-config]` is
     present (advanced mode on ⇒ a player _should_ attach) yet none has within a
     deadline (~10s). This distinguishes "not rendered yet" from "will never
     render".
   - reskin F4 self-verification failure.
   - demo `applySetup()` catch + the config/player-never-appeared watcher
     (`demo-overlays/index.ts:65-83`) exceeding the deadline.
5. **Noise suppression:** dedup each failure _kind_ once per page session (a
   `Set`, mirroring the existing `activeOverlays` pattern); enforce the deadline
   before declaring failure; client throttle **plus** the server rate limit.
6. **Payload (minimal, per decision):** three fields —
   ```
   {
     errorType: string,   // the failure kind (see step 4)
     videoId:   string,   // Bunny video UUID via getBunnyVideoId(mediaEl.src)
                          //   (common/tracks.ts:36); "" if no player was found
     config:    unknown,  // the JSON config the player read (loadVpConfig().data),
                          //   or null if the config never appeared
   }
   ```
   The video id identifies _which_ video broke; the config is the exact input the
   runtime saw, which is what a debugger needs to reproduce. **Privacy note:** the
   `config` is course-author content (not end-user data) and the video id is a
   Bunny UUID — neither is end-user PII. We deliberately do **not** send
   `location.href`, query strings, cookies, or auth tokens. Cap the serialized
   `config` size (e.g. drop/truncate if > ~32 KB) so a large config can't bloat
   the beacon. The relay's Zod schema mirrors this exact shape.

### Acceptance criteria

- AC1: A simulated failed attach (fault injected per safety-net F2) emits exactly
  **one** beacon with the correct `kind`; repeated scans do not re-emit it.
- AC2: A successful attach emits **no** failure beacon.
- AC3: "No player after deadline" fires only when `[data-vp-config]` is present
  and the deadline elapses — never for a slow-but-eventually-rendered player.
- AC4: The relay rejects a malformed body (Zod) with `400` and forwards a valid
  `{ errorType, videoId, config }` body as a REST `POST` to
  `RUNTIME_ALERT_WEBHOOK_URL`; `OPTIONS` returns the CORS headers for an
  allowlisted origin.
- AC5: The relay's in-memory per-instance counter rate-limits a flood from one
  origin.
- AC6: The payload carries only `errorType`, `videoId`, and `config` — never
  `location.href`, query string, cookies, or auth tokens; an oversized `config`
  is truncated/dropped rather than sent whole.

---

## Testing strategy

- **Runtime (Vitest + jsdom):** stub `navigator.sendBeacon`/`fetch` and assert
  `report()` is called once per failure kind (dedup), not on success, and only
  after the deadline for the no-player case. Use fake timers for the deadline.
  Assert `shouldRun()` fails open on a rejected fetch. Assert the payload is
  exactly `{ errorType, videoId, config }` (no href/query/cookies) and that an
  oversized `config` is truncated/dropped.
- **Relay route (Vitest, node env):** import the route handlers; assert Zod
  rejection → 400, valid → forward as a REST `POST` (mock the outbound `fetch` to
  `RUNTIME_ALERT_WEBHOOK_URL`) → 204, `OPTIONS` → correct CORS headers, and the
  in-memory rate-limit behaviour.

One test per acceptance criterion.

## Design decisions (resolved)

All five prior open questions are resolved. Rationale retained below for context.

### 1. Kill-switch sourcing — RESOLVED: Vercel Edge Config

**Decision:** `shouldRun()` (F5, step 1) reads `{ enabled, minHostVersion }` via
`app/api/runtime-config/route.ts`, which reads from **Vercel Edge Config**
(`@vercel/edge-config`). Flags flip from the Vercel dashboard/API with **no
redeploy** — the requirement F5 exists to satisfy.

**Why (vs. alternatives considered):** a static `runtime-config.json` would need
a redeploy to flip; an env var _also_ triggers a Vercel redeploy on change; a
DB/KV row adds a query on a hot, third-party-triggered path. Edge Config is
purpose-built for low-latency, hot-updatable read-mostly flags. Residual note:
the route's `Cache-Control` TTL (e.g. 60s) caps how fast a flip reaches
already-open pages. **Follow-up:** enable the Edge Config integration on this
Vercel project and provision the `EDGE_CONFIG` connection string.

### 2. Sink type — RESOLVED: software-agnostic REST endpoint

**Decision:** `RUNTIME_ALERT_WEBHOOK_URL` is a plain REST URL. The relay POSTs a
JSON body (`{ errorType, videoId, config }`, see F6 step 6) with
`content-type: application/json` and does **no** vendor-specific shaping — no
Slack/Discord Block Kit, no per-sink formatting branch. The receiver decides what
to do with the payload.

**Why:** keeps the relay decoupled from whatever tool consumes alerts; the sink
can be swapped by changing one env var, and a receiver can fan out to chat or a
log store on its own side. **Follow-up:** stand up (or point at) a REST receiver
and set `RUNTIME_ALERT_WEBHOOK_URL`; confirm who owns triage.

### 3. Success ping — RESOLVED: failures only

Decided: emit beacons on **failure only**, not on successful attach. Rationale:
a success ping on every page load turns a low-volume alerting channel into a
high-volume telemetry stream (needs sampling, a real ingest pipeline, and raises
the privacy surface for no immediate operational gain). Coverage/uptime
signalling can be revisited later as a separate, sampled stream if we adopt a
logging sink (Q2). No action needed for this plan beyond _not_ wiring a
success path.

### 4. CSP outcome — RESOLVED: assume the webhook is not blocked

**Decision:** proceed on the assumption that LearningSuite's
`Content-Security-Policy: connect-src` permits our Vercel origin, so F5's flag
fetch and F6's `sendBeacon`/`fetch` work as planned. We do **not** build a
CSP-fallback transport up front.

**Why / safety net:** F5 already **fails open** (AC2) — if the assumption is ever
wrong, a blocked flag fetch leaves the runtime attaching normally rather than
disabled, and a blocked beacon simply means no alert is sent (no user-visible
breakage). If telemetry silence later suggests `connect-src` is blocking us,
revisit with an `img-src` GET-beacon fallback or a `connect-src` allowlist
request to LearningSuite — tracked as a contingency, not built now.

### 5. Rate-limit store — RESOLVED: in-memory per-instance counter

**Decision:** the relay uses an **in-memory per-instance** counter (F6, step 2) —
zero dependencies, no shared store.

**Why / known limitation:** Vercel serverless is multi-instance and cold-starts
often, so the limit is per-lambda and leaky (effective ceiling ≈ limit × live
instances, resets on cold start). Accepted as a best-effort backstop, not a hard
global guarantee. It is paired with strict Zod validation, a cheap fixed `204`
response, and the client-side dedup/throttle (F6, step 5) so well-behaved clients
never approach it. **Follow-up:** if observed volume/cost warrants a true global
limit, move to a shared store (Vercel KV / Upstash / Neon) later — no runtime
change required.

## Out of scope

- The rollback/self-verification mechanics themselves (safety-net plan) — this
  plan only _reports_ on them.
- Generalized player discovery (adaptability plan) — this plan _consumes_
  `findPlayers()`'s "no match" result.
