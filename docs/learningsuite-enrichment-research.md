# LearningSuite Video Enrichment — Research & POC

This document captures what we learned investigating the VANTISGO learning platform
(`vantisgo.learningsuite.io`, hosted by LearningSuite) and the resulting plan to
selectively enrich existing videos with our overlay/sidebar UX without replacing
LearningSuite's player or breaking its progress tracking.

## Goal

Layer custom overlays + sidebar onto specific videos in LearningSuite. Non-enriched
videos must keep their default behaviour. LearningSuite's progress/completion tracking
must continue to work untouched.

## How we investigated

The platform is a hosted SaaS with a global `<script>` slot we control on every page.
We used three complementary tools:

1. **Console snippets in DevTools** — fastest, ran in the user's real session with cookies.
2. **Claude in Chrome MCP** — paired but the extension didn't route tab access to our
   external session, so it was abandoned in favour of console snippets.
3. **Headless `agent-browser`** — for automated runs once we had login credentials and
   could verify behaviour end-to-end (screenshots in `scripts/poc-*.png`).

## What the LearningSuite player actually is

| Aspect | Finding |
|---|---|
| Custom element | `<hls-video>` from `@mux/media-elements` (web component) |
| API surface | The element forwards the full `HTMLMediaElement` API: `play()`, `pause()`, `currentTime`, `duration`, `paused`, `readyState` all work directly on `hlsEl` |
| DOM layout | Two shapes seen across lessons: (a) light-DOM slotted `<video>` inside `<slot name="media">`; (b) default shadow-DOM `<video>` with `src` on the host. The forwarded API works for both. |
| HLS engine | hls.js (`window.Hls` is defined globally). Blob URL on `<video>.src` because hls.js feeds MSE. |
| Manifest | `.m3u8` from Bunny CDN (`vz-*.b-cdn.net` or via `api.learningsuite.io/api/bunny/playlist/master/...`) |
| Auth | Manifest URLs are signed: `bcdn_token=…&expires=…` (path-scoped) |
| DRM | None. Plain HLS, plain segments. |
| Subtitles | German VTT tracks delivered as `<track kind="subtitles">` with blob URLs |
| Hosting page | Next.js / React + MUI on the LearningSuite side; Apollo for GraphQL |

## How LearningSuite tracks progress

Two findings drove the architecture decision:

1. **Standard media events fire on `<hls-video>`**. We added a fresh listener after our
   script ran and confirmed: 3 seeks → 3 `timeupdate`, 3 `seeking`, 3 `seeked`, 3
   `canplay`, plus `play`/`pause`/`ended` as expected. Existing host listeners
   (attached at app boot) keep receiving these events untouched as long as the element
   stays in the DOM.

2. **Progress is reported via GraphQL** to `api.learningsuite.io/graphql` and
   `api-p.learningsuite.io/graphql`. Network entries show ~30 calls during a short
   playback, but neither `fetch` nor `XMLHttpRequest` hooks captured the bodies — the
   transport is most likely `navigator.sendBeacon` or a Service Worker (we did not
   confirm which).

Strategic conclusion: we don't need to know which transport is used. As long as the
host's listeners on `<hls-video>` keep firing with the right times, whatever they
report keeps reporting. Any change that removes or replaces `<hls-video>` would break
this.

## Architecture decision

**Hybrid swap (re-skin).** Keep `<hls-video>` exactly where LearningSuite mounts it.
Hide its visible chrome via CSS. Mount our own controls and overlays as siblings/
overlays inside the same player container. Drive playback by calling the standard
`HTMLMediaElement` methods on `<hls-video>`.

This avoids:
- replacing the player engine (no DRM/auth concerns)
- reproducing GraphQL progress mutations (no token scraping, no schema work)
- maintaining a parallel player lifecycle that could break with LearningSuite's React
  re-renders

The runtime script must be tolerant of:
- React re-mounting the player (MutationObserver + idempotent `attach()`)
- SPA navigation (patch `history.pushState`/`replaceState` and listen to `popstate`)

## POC artefacts

Two scripts, designed to be loaded via the LearningSuite global `<script>` slot:

### `scripts/reskin-player.js`

Generic, content-free re-skin:

- Injects CSS that hides Vidstack/Mux default UI in light DOM
- Watches for `<hls-video>` mounts and attaches a controls shell
- Exposes a tiny API on `window.player`:
  - `play()`, `pause()`, `seek(t)`, `current`, `duration`
  - `on('any', fn)` event bus emitting `time`, `play`, `pause`, `ended`,
    `overlay-show`, `overlay-hide`
  - `setOverlays([...])` — registry-style timestamp-driven overlay slots
- Sets up cross-frame `postMessage` so iframe sidebars can subscribe/dispatch

### `scripts/demo-overlays.js`

Demo content + UI styled to match the tony-video-player repo (Coaching/Science/Meta
Structure tabs, orange primary, MUI light card). Demonstrates the four overlay types
referenced in the codebase under `components/video-player/overlays/`:

| Overlay | Position | Source component | Trigger |
|---|---|---|---|
| Section Indicator | top-left | `section-indicator.tsx` | always visible during a phase; collapsed pill, hover to expand |
| Science Corner | top-right | `science-trigger.tsx` | fires for 5s when video crosses any `timestampsSec` of a science item |
| Audio (Voice-Over) | lower-third banner | `audio-overlay.tsx` | one-shot when video crosses an audio's `t`; pauses video, plays audio, resumes video on end |
| 7 Master Steps fly-in | bottom-right | `meta-step-overlay.tsx` | violet pill for 5s when crossing each step's `t` |

Behaviours wired in the demo:

- **Click containment**: clicks on overlay surfaces don't bubble to the player wrapper
  and don't toggle play/pause. Bubble-phase `stopPropagation` at the slot level
  (capture-phase would prevent our own buttons from receiving the click).
- **Tab focus from overlay**: clicking the Science Corner pill focuses the Science
  tab and auto-scrolls/highlights the matching card. Clicking the meta-step pill
  focuses the Meta Structure tab.
- **Audio takeover**: while the audio overlay is active, the reskin's play/pause
  button and the spacebar route to audio control instead of video. Implemented with
  capture-phase document listeners so they pre-empt the reskin handlers.
- **Audio playback**: the POC speaks the voice-over text via `SpeechSynthesis` (German
  TTS) so you actually hear something. In production, swap for a real `<audio>`
  element bound to the `audioUrl` and use its native `timeupdate`/`ended` events —
  the rest of the state machine is already shaped for that.

### Sidebar replacement

The script removes LearningSuite's right-column section overview (`<main>`'s flex
sibling, the `Sektion / X LEKTIONEN` panel) and inserts our tabbed sidebar in its
place using the same flex parent. Layout is sticky-positioned to follow scroll.

## Verified test results (headless)

Captured during agent-browser runs against the live test account
(`test@cgoebel.net` on `vantisgo.learningsuite.io`, course
`/the-vantisgo-way-interne-akademie/mx2QDgyH/jGQYlTK8/Tvg4VhkP`):

| Check | Result |
|---|---|
| Custom controls shell mounts | ✅ |
| Duration read from `<hls-video>` | ✅ 150.6s |
| Seek + timeline updates | ✅ |
| External listeners on `<hls-video>` still fire on seek (proxy for progress) | ✅ |
| Native Vidstack/Mux UI hidden | ✅ |
| Section Indicator (top-left) | ✅ |
| Science Corner (top-right, compact) | ✅ |
| Audio lower-third banner (wide) | ✅ |
| Meta-step fly-in (auto-width pill) | ✅ |
| Click on audio button does NOT bubble to video wrapper | ✅ 0 leaks |
| Click on Science pill switches to Science tab | ✅ |
| Click on meta pill switches to Meta Structure tab | ✅ |
| Science overlay re-fires on second visit (regression fix) | ✅ |
| Science tab card highlight matches active overlay | ✅ |
| Audio activation pauses video, resumes on skip | ✅ |
| SpeechSynthesis speaking on activation | ✅ `speaking: true` |

Screenshots in `scripts/poc-*.png` document each state.

## Proposed integration model

```
LearningSuite page
  └─ global <script> loads runtime
       ├─ detects <hls-video>
       ├─ extracts a stable video ID (lesson URL or m3u8 path)
       ├─ asks Content API: "is this video enriched?"
       └─ if yes → re-skin + overlays + sidebar
                  if no → no-op, native player intact

Content service (extend the existing v0-learning-suite-embed-manager Vercel project,
or build a separate Next.js admin)
  ├─ public read endpoint  GET /api/enrichment/<videoId> → JSON or 404
  └─ admin UI               authoring of overlays + sidebar per video
```

### Stable video ID candidates
- Lesson URL pattern: `/student/course/<slug>/<module>/<lesson>/<topic>` — stable until re-uploaded
- m3u8 path UUID: `course/<uuid>/playlist.m3u8` — stable per source asset
- Or assign a manual slug at authoring time (most robust)

### Build phases (rough)

| Phase | Effort | Deliverable |
|---|---|---|
| 0. Hardening | ~3 days | Production-grade runtime script; gracefully no-ops if not enriched |
| 1. Content service v1 | ~1 week | DB schema + read endpoint + minimal admin (JSON forms) so a pilot can be authored by hand |
| 2. Authoring UX | ~2–3 weeks | Real editor: embedded video preview, timeline strip with draggable markers, sidebar block editor, publish toggle |
| 3. Polish | ~1–2 weeks | Quality switcher, captions picker, keyboard shortcuts, mobile, analytics |

Total: ~5–7 weeks to a polished production rollout for one team. Phase 1 unlocks a
pilot.

## Things still open

- **Stable video ID strategy** — pick one (URL vs UUID vs slug) before phase 1.
- **Sidebar placement** — replacing LearningSuite's right column (current POC) is
  visually clean but breaks if LearningSuite changes layout. An additive panel
  alongside is safer; the POC can switch.
- **Real audio assets** — POC uses TTS. Production needs hosted `audioUrl` per
  voice-over.
- **Versioning** — when a video is re-uploaded in LearningSuite, the URL/UUID
  changes. Decide whether overlays are tied to the source asset or to a manual slug.
- **Sidebar sync UX** — does scrolling the sidebar pause the video? Does jumping to a
  chapter via the sidebar seek the video? Already partially wired in the POC; needs
  product decision.
- **Auth** — admin needs proper auth (single-tenant for now, but think about course
  creators). Read endpoint can stay public if it returns no secrets.

## How videos are delivered via GraphQL — addendum

We later traced the full GraphQL surface that delivers the video URL using browser-level
network capture (page-side `fetch`/`XHR` hooks miss it because Apollo caches its fetch
reference at module init, and the platform uses **persisted queries** so only SHA hashes
go over the wire — not the GraphQL text). This matters for the backend that authors
enrichment content.

### Two queries deliver the playable video

**1. `QueryCourseInstanceStudent`** — the page tree.

Variables come straight from the URL path:
```jsonc
{
  "sid": "mx2QDgyH",                                     // course instance sid
  "entityIdsOrSidsToLoadStateFor": {
    "lessonSids": ["jGQYlTK8"], "pageSids": ["Tvg4VhkP"]
  },
  "pageIdsOrSidsToLoadContentFor": { "sids": ["Tvg4VhkP"] }
}
```

The response page content is a **rich-text block array** (Slate/Lexical-style). Video
blocks look like:
```jsonc
{
  "type":     "video",
  "title":    "Schön, dass du da bist.",
  "fileId":   "U3RlcEZpbGU6Y21jYWhiNzBsOGZ3czFzYW9rbmw3enRuaw==",
  "duration": 150.6,
  "meta":     { "fileId": { "uploaded": true, "uploadedBy": "VXNlcjo…" } }
}
```

`fileId` is base64-encoded — decodes to `StepFile:cmcahb70l8fws1saoknl7ztnk`.

**2. `StepFileQuery(id: fileId)`** — the actual URL + metadata.

```jsonc
{
  "stepFileLink": {
    "__typename": "StepFile",
    "id": "U3RlcEZpbGU6Y21jYWhiNzBsOGZ3czFzYW9rbmw3enRuaw==",
    "downloadable": {
      "id": "cmcahb70l8fws1saoknl7ztnk",                  // CUID — stable per upload
      "url": "https://vz-12f1059a-6c7.b-cdn.net/…/fd4f7856-40d2-4d25-bb53-8bf102a34d96/playlist.m3u8?…",
      "metadata": {
        "__typename": "VideoMetadata",
        "duration": 150,
        "width": 1920, "height": 1080,
        "spriteUrls": [/* 3 sprite sheets for scrub previews */],
        "timePerThumbnail": 2,
        "status": "finished"
      }
    }
  }
}
```

Also seen on the same lesson load: `StepFileTranscriptQuery(id)` for subtitles, and
`MutateSubmitEvents` for progress tracking (`type: "visit_step"`). The progress
mutation is a **regular GraphQL POST**, not `sendBeacon` as we previously suspected
— the page-side hooks just missed it because Apollo's cached fetch bypassed them.

### Three stable identifiers (all derivable at runtime)

| ID | Example | Where | Best for |
|---|---|---|---|
| `Downloadable.id` (CUID) | `cmcahb70l8fws1saoknl7ztnk` | `StepFileQuery` response | Primary key in our DB |
| StepFile global ID (base64) | `U3RlcEZpbGU6…enRuaw==` | Page content `fileId` + `StepFileQuery.id` | API key when re-querying LearningSuite |
| Bunny CDN UUID | `fd4f7856-40d2-4d25-bb53-8bf102a34d96` | URL path of the m3u8 | Cheapest runtime lookup — regex out of `hlsEl.src`, no GraphQL hooking needed |

These three are 1:1: one StepFile = one Downloadable = one Bunny upload.

### Implications for the enrichment backend

- **Recommended primary key**: `Downloadable.id` — short, stable per upload, copy-pastable.
- **Runtime "is this video enriched?" check**: read `hlsEl.src` after mount, regex the
  Bunny UUID out of the path, lookup against the content service. No GraphQL hooking
  needed for the simple case.
- **Authoring flow A** (operator-driven): admin pastes a LearningSuite lesson URL →
  server-side `QueryCourseInstanceStudent(sid)` with a service-account JWT → list
  video blocks with their `fileId` → operator picks one → server fetches
  `StepFileQuery` to capture `Downloadable.id`.
- **Authoring flow B** (in-page): runtime injects an "Enrich this video" button into the
  player; clicking it captures the current Bunny UUID and posts it to our admin to
  create/open an enrichment record.

### Auth caveat

Every GraphQL request carries `Authorization: Bearer <JWT>`. The JWT decodes to roughly:
```json
{
  "tenantId": "cm5lic5gj51jtatmmhbdrugh1",
  "sub":      "cmewi5wdu0j4u1zgsvjcbn8q6",   // user id
  "roleId":   "trainer",
  "rights":   ["ADMINZONE_ACCESS"],
  "exp":      1777997767                      // ~5 minute window
}
```

If we build a server-side LearningSuite client (authoring flow A), it needs a
service-account login or a refresh-token flow.

## Files in this branch

- `docs/learningsuite-enrichment-research.md` — this document
- `scripts/reskin-player.js` — generic re-skin runtime
- `scripts/demo-overlays.js` — demo content + UI matching the repo's design
- `scripts/poc-*.png` — screenshots of each verified state

The two `.js` files are not yet wired into the Next.js app — they exist as
self-contained POC scripts that can be pasted into the LearningSuite global
`<script>` slot, or adapted into the production runtime.
