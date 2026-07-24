# Runtime Ops Setup — Kill-Switch (Edge Config) & Telemetry Webhook

Operational setup for the two runtime resilience features shipped in
`.claude/PRPs/reports/2026-07-24_resilience_ops-telemetry-report.md`:

- **Kill-switch** — disable the injected runtime on every embed with no redeploy,
  backed by **Vercel Edge Config** (read by `app/api/runtime-config`).
- **Telemetry webhook** — failed-attach alerts, relayed by
  `app/api/runtime-telemetry` to a software-agnostic REST endpoint.

Both **fail open / degrade quietly** when unconfigured: until the steps below are
done, the runtime always runs and telemetry is accepted but not forwarded. So
nothing breaks if this is deferred — you just don't get the kill-switch or the
alerts yet.

---

## Part 1 — Vercel Edge Config (kill-switch) setup

Backs `GET /api/runtime-config`, which returns
`{ "enabled": boolean, "minHostVersion": string | null }`. The runtime only
disables on an explicit `enabled: false`; anything else → enabled (fail-open).

### To-do

- [ ] **Create an Edge Config store** — Vercel Dashboard → _Storage_ → _Create_ →
      _Edge Config_. Name it e.g. `tony-video-runtime`.
- [ ] **Connect it to the project** — in the store's _Projects_ tab, link
      `tony-video-player`. This auto-adds the **`EDGE_CONFIG`** connection-string
      env var to the project (Production + Preview + Development).
- [ ] **Pull the env var locally** (for local dev) — `vercel env pull` (or copy
      `EDGE_CONFIG` into `.env.local`). It's already declared (optional) in
      `env.ts`.
- [ ] **Seed the flag** — add an item to the store with **key `runtimeConfig`**
      and value `{ "enabled": true, "minHostVersion": null }` (via the Dashboard
      _Items_ editor, `npx vercel edge-config`, or the Edge Config API). The key
      name `runtimeConfig` is required — it's what the route reads.
- [ ] **Redeploy once** so the connected env var is present in the running
      deployment. (This is the only redeploy needed — future flips are instant.)
- [ ] **Verify enabled** —
      `curl https://<our-domain>/api/runtime-config` → `{"enabled":true,...}`
      with `Cache-Control: public, max-age=60` and `Access-Control-Allow-Origin: *`.
- [ ] **Test the kill-switch** — set `runtimeConfig.enabled` to `false` in the
      dashboard, wait for the 60s cache TTL, reload a lesson with the runtime:
      the overlays/reskin should not mount and the native player is untouched
      (`window.__vpReskinStatus === "reskin disabled by kill-switch"`). Set it
      back to `true` when done.

### Operating the kill-switch

- **Disable everywhere:** set `runtimeConfig.enabled = false`. Propagates within
  the `Cache-Control` TTL (~60s) to already-open pages; instantly to new loads.
- **Re-enable:** set it back to `true`.
- `minHostVersion` is carried through but **not yet enforced** (reserved for a
  future version-pin); leave it `null`.
- **Fail-open guarantees:** if Edge Config is unreachable, `EDGE_CONFIG` is
  unset, or the fetch is blocked/times out (3s), the runtime runs normally. The
  switch can only ever _disable_ via an explicit `false`.

---

## Part 2 — Telemetry webhook endpoint

The injected runtime beacons failures to our own relay; the relay forwards them
to a sink you configure. The sink is **software-agnostic** — any REST endpoint
that accepts a JSON `POST`.

### Environment variables (all optional; set in Vercel project settings)

| Var                                 | Purpose                                                                                                                                              | Unset behaviour                                                                                                                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RUNTIME_ALERT_WEBHOOK_URL`         | The REST sink the relay forwards alerts to (must be a valid URL).                                                                                    | Relay validates + returns `204` but forwards nothing.                                                                                                                              |
| `RUNTIME_TELEMETRY_ALLOWED_ORIGINS` | Comma-separated origin allowlist for CORS (the LearningSuite embed origin(s)), e.g. `https://app.learningsuite.io,https://members.learningsuite.io`. | No `Access-Control-Allow-Origin` header is emitted (cross-origin browsers can't read the response; `sendBeacon` still delivers since it's a fire-and-forget `text/plain` request). |

### To-do

- [ ] **Stand up (or choose) a REST receiver.** Anything that accepts
      `POST application/json`: a Slack/Discord webhook proxy, a logging service
      ingest URL, a small serverless function, etc. It owns formatting/routing.
- [ ] **Set `RUNTIME_ALERT_WEBHOOK_URL`** to that URL in Vercel (Production +
      Preview as desired).
- [ ] **Set `RUNTIME_TELEMETRY_ALLOWED_ORIGINS`** to the LearningSuite origin(s).
- [ ] **Redeploy** to pick up the env vars.
- [ ] **Confirm LearningSuite CSP** allows `connect-src` to our origin (assumed;
      the beacon is a `text/plain` `sendBeacon`, so no preflight is needed, but a
      restrictive `connect-src` would still block it). If blocked, alerts are
      silently dropped — the runtime is unaffected.
- [ ] **Smoke-test** the relay (see below).

### Relay endpoint contract — `POST /api/runtime-telemetry`

The runtime calls this; you normally don't. Documented for testing/debugging.

**Request** (from the runtime beacon):

- Method `POST`, body `Content-Type: text/plain` containing JSON (kept simple so
  `sendBeacon` needs no CORS preflight):

  ```json
  {
    "errorType": "reskin-attach-error",
    "videoId": "<bunny-uuid|>",
    "config": {}
  }
  ```

  - `errorType` — string (1–200 chars), the failure kind (see table below).
  - `videoId` — Bunny video UUID the failure occurred on, or `""` if no player.
  - `config` — the exact `[data-vp-config]` JSON the runtime read, or `null`, or
    a truncation marker `{ "__truncated": true, "bytes": <n> }` when the
    serialized config exceeds ~32 KB.

**Responses:**

| Status                  | When                                                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `204 No Content`        | Accepted (and forwarded to the sink if `RUNTIME_ALERT_WEBHOOK_URL` is set).                                                         |
| `400 Bad Request`       | Body isn't JSON or fails the schema.                                                                                                |
| `429 Too Many Requests` | Rate limit exceeded (30 requests / 60s per client, keyed by `x-forwarded-for` then `origin`; in-memory per instance — best-effort). |

`OPTIONS /api/runtime-telemetry` → `204` with CORS headers (`Allow-Methods: POST, OPTIONS`,
`Allow-Headers: content-type`); `Access-Control-Allow-Origin` is reflected only
for an allowlisted origin.

**Forwarded to the sink** (`POST` to `RUNTIME_ALERT_WEBHOOK_URL`,
`Content-Type: application/json`) — the validated payload verbatim:

```json
{ "errorType": "...", "videoId": "...", "config": ... }
```

### Error types the runtime emits

Each fires **at most once per (errorType, videoId) per page session**.

| `errorType`                          | Meaning                                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `reskin-attach-error`                | The reskin threw while attaching; it rolled back (native player intact).                                                       |
| `reskin-overlay-verification-failed` | Reskin mounted but the overlay layer had a zero box over a visible player; torn down.                                          |
| `reskin-no-player-after-deadline`    | `[data-vp-config]` present but no player was discovered within ~10s (LearningSuite likely renamed/removed the player element). |
| `demo-setup-error`                   | The overlay/sidebar setup threw; the host DOM was restored.                                                                    |
| `demo-context-timeout`               | Config present but the player/context never became ready within ~10s.                                                          |

### Smoke test

```bash
# Valid → 204 (and forwarded if the sink env var is set)
curl -i -X POST https://<our-domain>/api/runtime-telemetry \
  -H 'content-type: text/plain' \
  --data '{"errorType":"reskin-attach-error","videoId":"","config":null}'

# Invalid body → 400
curl -i -X POST https://<our-domain>/api/runtime-telemetry \
  -H 'content-type: text/plain' --data 'not json'

# Preflight → 204 with CORS headers (Origin must be allowlisted to be reflected)
curl -i -X OPTIONS https://<our-domain>/api/runtime-telemetry \
  -H 'Origin: https://app.learningsuite.io'
```

### Notes & future work

- Rate limiting is **in-memory per serverless instance** — a best-effort backstop
  (effective ceiling ≈ 30 × live instances, resets on cold start), paired with
  the runtime's own per-session dedup. Move to a shared store (Vercel KV / Neon)
  only if volume/cost warrants — no runtime change required.
- The relay forwards the payload **unshaped**; per-tool formatting (Slack Block
  Kit, etc.) belongs in the receiver so the sink stays swappable via one env var.
