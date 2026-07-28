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
   could verify behaviour end-to-end (screenshots in `public/runtime/poc-*.png`).

## What the LearningSuite player actually is

| Aspect         | Finding                                                                                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Custom element | `<hls-video>` from `@mux/media-elements` (web component)                                                                                                                                 |
| API surface    | The element forwards the full `HTMLMediaElement` API: `play()`, `pause()`, `currentTime`, `duration`, `paused`, `readyState` all work directly on `hlsEl`                                |
| DOM layout     | Two shapes seen across lessons: (a) light-DOM slotted `<video>` inside `<slot name="media">`; (b) default shadow-DOM `<video>` with `src` on the host. The forwarded API works for both. |
| HLS engine     | hls.js (`window.Hls` is defined globally). Blob URL on `<video>.src` because hls.js feeds MSE.                                                                                           |
| Manifest       | `.m3u8` from Bunny CDN (`vz-*.b-cdn.net` or via `api.learningsuite.io/api/bunny/playlist/master/...`)                                                                                    |
| Auth           | Manifest URLs are signed: `bcdn_token=…&expires=…` (path-scoped)                                                                                                                         |
| DRM            | None. Plain HLS, plain segments.                                                                                                                                                         |
| Subtitles      | German VTT tracks delivered as `<track kind="subtitles">` with blob URLs                                                                                                                 |
| Hosting page   | Next.js / React + MUI on the LearningSuite side; Apollo for GraphQL                                                                                                                      |

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

### `public/runtime/reskin-player.js`

Generic, content-free re-skin:

- Injects CSS that hides Vidstack/Mux default UI in light DOM
- Watches for `<hls-video>` mounts and attaches a controls shell
- Exposes a tiny API on `window.player`:
  - `play()`, `pause()`, `seek(t)`, `current`, `duration`
  - `on('any', fn)` event bus emitting `time`, `play`, `pause`, `ended`,
    `overlay-show`, `overlay-hide`
  - `setOverlays([...])` — registry-style timestamp-driven overlay slots
- Sets up cross-frame `postMessage` so iframe sidebars can subscribe/dispatch

### `public/runtime/demo-overlays.js`

Demo content + UI styled to match the tony-video-player repo (Coaching/Science/Meta
Structure tabs, orange primary, MUI light card). Demonstrates the four overlay types
referenced in the codebase under `components/video-player/overlays/`:

| Overlay               | Position           | Source component        | Trigger                                                                                     |
| --------------------- | ------------------ | ----------------------- | ------------------------------------------------------------------------------------------- |
| Section Indicator     | top-left           | `section-indicator.tsx` | always visible during a phase; collapsed pill, hover to expand                              |
| Science Corner        | top-right          | `science-trigger.tsx`   | fires for 5s when video crosses any `timestampsSec` of a science item                       |
| Audio (Voice-Over)    | lower-third banner | `audio-overlay.tsx`     | one-shot when video crosses an audio's `t`; pauses video, plays audio, resumes video on end |
| 7 Master Steps fly-in | bottom-right       | `meta-step-overlay.tsx` | violet pill for 5s when crossing each step's `t`                                            |

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

| Check                                                                       | Result              |
| --------------------------------------------------------------------------- | ------------------- |
| Custom controls shell mounts                                                | ✅                  |
| Duration read from `<hls-video>`                                            | ✅ 150.6s           |
| Seek + timeline updates                                                     | ✅                  |
| External listeners on `<hls-video>` still fire on seek (proxy for progress) | ✅                  |
| Native Vidstack/Mux UI hidden                                               | ✅                  |
| Section Indicator (top-left)                                                | ✅                  |
| Science Corner (top-right, compact)                                         | ✅                  |
| Audio lower-third banner (wide)                                             | ✅                  |
| Meta-step fly-in (auto-width pill)                                          | ✅                  |
| Click on audio button does NOT bubble to video wrapper                      | ✅ 0 leaks          |
| Click on Science pill switches to Science tab                               | ✅                  |
| Click on meta pill switches to Meta Structure tab                           | ✅                  |
| Science overlay re-fires on second visit (regression fix)                   | ✅                  |
| Science tab card highlight matches active overlay                           | ✅                  |
| Audio activation pauses video, resumes on skip                              | ✅                  |
| SpeechSynthesis speaking on activation                                      | ✅ `speaking: true` |

Screenshots in `public/runtime/poc-*.png` document each state.

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

| Phase                 | Effort     | Deliverable                                                                                                      |
| --------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| 0. Hardening          | ~3 days    | Production-grade runtime script; gracefully no-ops if not enriched                                               |
| 1. Content service v1 | ~1 week    | DB schema + read endpoint + minimal admin (JSON forms) so a pilot can be authored by hand                        |
| 2. Authoring UX       | ~2–3 weeks | Real editor: embedded video preview, timeline strip with draggable markers, sidebar block editor, publish toggle |
| 3. Polish             | ~1–2 weeks | Quality switcher, captions picker, keyboard shortcuts, mobile, analytics                                         |

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
  "sid": "mx2QDgyH", // course instance sid
  "entityIdsOrSidsToLoadStateFor": {
    "lessonSids": ["jGQYlTK8"],
    "pageSids": ["Tvg4VhkP"],
  },
  "pageIdsOrSidsToLoadContentFor": { "sids": ["Tvg4VhkP"] },
}
```

The response page content is a **rich-text block array** (Slate/Lexical-style). Video
blocks look like:

```jsonc
{
  "type": "video",
  "title": "Schön, dass du da bist.",
  "fileId": "U3RlcEZpbGU6Y21jYWhiNzBsOGZ3czFzYW9rbmw3enRuaw==",
  "duration": 150.6,
  "meta": { "fileId": { "uploaded": true, "uploadedBy": "VXNlcjo…" } },
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
      "id": "cmcahb70l8fws1saoknl7ztnk", // CUID — stable per upload
      "url": "https://vz-12f1059a-6c7.b-cdn.net/…/fd4f7856-40d2-4d25-bb53-8bf102a34d96/playlist.m3u8?…",
      "metadata": {
        "__typename": "VideoMetadata",
        "duration": 150,
        "width": 1920,
        "height": 1080,
        "spriteUrls": [
          /* 3 sprite sheets for scrub previews */
        ],
        "timePerThumbnail": 2,
        "status": "finished",
      },
    },
  },
}
```

Also seen on the same lesson load: `StepFileTranscriptQuery(id)` for subtitles, and
`MutateSubmitEvents` for progress tracking (`type: "visit_step"`). The progress
mutation is a **regular GraphQL POST**, not `sendBeacon` as we previously suspected
— the page-side hooks just missed it because Apollo's cached fetch bypassed them.

### Embedding enrichment config inside LearningSuite

While the production architecture stores enrichment in our own service (see
"Proposed integration model" above), an interim path uses LearningSuite's
"Code einbetten" block on the lesson page itself. This is useful for early
piloting without standing up a backend.

What works and what doesn't, found by saving payloads in the block and
reading the rendered output via the Editor's "Vorschau" tab (the preview
that mirrors student rendering exactly):

| Payload                                                         | Survives?                                   |
| --------------------------------------------------------------- | ------------------------------------------- |
| `<script type="application/json" data-vp-config>{...}</script>` | ❌ stripped — entire embed block disappears |
| `<div data-vp-config style="display:none">{...}</div>`          | ❌ stripped                                 |
| `<!--VP_CONFIG {...} VP_CONFIG-->`                              | ❌ stripped                                 |
| `<pre data-vp-config style="display:none">{...}</pre>`          | ✅ rendered, textContent intact             |
| `<p>Hello</p>`                                                  | ✅ rendered (visible)                       |

Diagnosis: LearningSuite's embed-block sanitiser allows standard HTML tags
with their `data-*` attributes, but strips `<script>`, hidden-div containers
with unrecognised attribute combinations, and HTML comments. Crucially, when
sanitising leaves the block empty the renderer hides it entirely — so a
broken payload looks identical to "no embed block at all", which made
debugging slow.

**Working pattern** (used by `public/runtime/demo-overlays.js → loadVpConfig`):

```html
<pre data-vp-config style="display:none">
{
  "phases":   [...],
  "sciences": [...],
  "audios":   [...],
  "metaSteps":[...]
}
</pre>
```

The runtime selector is `[data-vp-config]:not(script)` so the same loader
also picks up `<div>` / `<span>` variants when they're embedded outside
LearningSuite (e.g. our own preview pages).

Caveats:

- "Vorschau" tab in the Editor reflects student render; trust it over the
  Editor's own block-preview (which shows the raw saved string).
- The "In Seite anzeigen" toggle on the block must stay selected. The
  "In Pop-Up anzeigen" alternative renders behind a button — content survives
  there too but is only mounted when the popup opens, so the runtime won't
  see it on first paint.

### Three stable identifiers (all derivable at runtime)

| ID                          | Example                                | Where                                      | Best for                                                                      |
| --------------------------- | -------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------- |
| `Downloadable.id` (CUID)    | `cmcahb70l8fws1saoknl7ztnk`            | `StepFileQuery` response                   | Primary key in our DB                                                         |
| StepFile global ID (base64) | `U3RlcEZpbGU6…enRuaw==`                | Page content `fileId` + `StepFileQuery.id` | API key when re-querying LearningSuite                                        |
| Bunny CDN UUID              | `fd4f7856-40d2-4d25-bb53-8bf102a34d96` | URL path of the m3u8                       | Cheapest runtime lookup — regex out of `hlsEl.src`, no GraphQL hooking needed |

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
  "sub": "cmewi5wdu0j4u1zgsvjcbn8q6", // user id
  "roleId": "trainer",
  "rights": ["ADMINZONE_ACCESS"],
  "exp": 1777997767 // ~5 minute window
}
```

If we build a server-side LearningSuite client (authoring flow A), it needs a
service-account login or a refresh-token flow.

## Authoring workflow — admin toggle + LLM prompt

The runtime now ships with a third script, `public/runtime/admin-toggle.js`, that
lights up only inside the LearningSuite editor in **edit** view (not
preview). It watches every `<hls-video>` and inserts an orange banner
directly above its container with a status pill ("✓ Konfig vorhanden" /
"noch nicht aktiviert") and an "Aktivieren / Bearbeiten" button. Clicking
the button opens a modal dialog with two steps:

1. **Add a "Code einbetten" block** below the video.
2. **Copy the prompt** out of the dialog's read-only textarea, paste it
   into any LLM (ChatGPT / Claude / …) together with the lesson
   transcript or script. The LLM returns a finished
   `<pre data-vp-config>{…}</pre>` block which the admin pastes into the
   embed block. Save → click _Vorschau_ → overlays appear.

The prompt is the single source of truth for the JSON schema. It lives
inline in `admin-toggle.js` as the `PROMPT_TEXT` constant — edit it
there to update the wording shown in the dialog.

## Loader + three-script architecture and activation gates

One loader is injected; it decides which of the three augment scripts a page
actually needs. Each augment script additionally self-gates, so it is also safe
to inject on its own:

| Script                            | Active when                                          | Job                                                                                              |
| --------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `public/runtime/loader.js`        | Always — this is the only tag the tenant carries     | Resolves our origin, asks the kill-switch once, injects the scripts below when their gate passes |
| `public/runtime/reskin-player.js` | A `[data-vp-config]` element exists on the page      | Hides native Vidstack/Mux UI, mounts custom controls, exposes `window.player` API                |
| `public/runtime/demo-overlays.js` | A `[data-vp-config]` element exists on the page      | Reads the JSON, mounts overlays + sidebar, drives time-sync                                      |
| `public/runtime/admin-toggle.js`  | URL contains `/admin/editor/` AND no `?view=preview` | Mounts the authoring banner + dialog above each `<hls-video>`                                    |

A page that has none of these triggers stays untouched: the loader injects
nothing (so nothing beyond ~8KB is downloaded), and even when a script is
injected anyway, `reskin-player.js` short-circuits inside `attach()` and
`demo-overlays.js` returns early. Loading everything globally is therefore still
safe — the loader only makes it cheaper.

What the loader adds on top of the individual gates:

- **One kill-switch request per page** instead of two. The loader calls
  `/api/runtime-config` and publishes the verdict on `window.__vpRuntimeGate`;
  `common/killswitch.ts` honours that flag instead of re-fetching. A `false`
  verdict now also stops `admin-toggle.js`, which previously ran ungated.
- **Explicit ordering.** `demo-overlays.js` dereferences `window.player`, which
  `reskin-player.js` publishes — the loader injects demo only after reskin has
  loaded and that global exists (3s backstop, then it injects anyway and warns).
- **Lazy gates.** LearningSuite renders the embed block via React _after_ head
  scripts run, so the loader re-evaluates its gates on a debounced
  MutationObserver plus a URL poll — a config (or an editor navigation) that
  appears later still activates the right scripts.
- **Diagnostics:** `window.__vpLoaderStatus` (`"loader armed"` /
  `"loader: disabled by kill-switch"`) and `window.__vpLoaded` (the entries it
  injected, in order).

Important: a `<pre data-vp-config>` alone does **not** activate the editor
— the runtime has to be loaded too. During development it was injected by
hand via `agent-browser eval -b`. For production this means hosting the
files somewhere reachable (Vercel/static-CDN) and adding **one**
`<script src=…/runtime/loader.js>` tag to a global script slot. Without
that, an admin who pastes the JSON into the embed block sees a perfectly
valid `<pre>` in the rendered DOM but no overlays — the symptom that
triggered the diagnosis here.

## Player discovery — how the runtime finds the player element

The reskin/overlay runtimes no longer hardcode the `hls-video` tag. Discovery
lives in `runtime-src/common/player.ts` (`scanPlayers`) and degrades through
four strategies, first hit wins:

1. **`[data-vp-player]` contract** — an explicit marker on (or wrapping) the
   player element. Wins regardless of tag name or wrapper nesting.
2. **Known tags** — `hls-video`, then `mux-player`, then `media-controller video`.
3. **Capability sweep** — any element forwarding the media API
   (`play()` + `currentTime` + `duration`), including inside **open** shadow
   roots (closed roots are unreachable).
4. Otherwise **none** — nothing is reskinned and the native player is left
   untouched (`_diag().discovery` reports which strategy matched).

**Authoring recommendation:** if a future LearningSuite update renames or
restructures the player element and the tag/capability fallbacks prove
insufficient, add `data-vp-player` to the player element (or its wrapper) in the
embed block. It is the durable, structure-independent hook — the same pattern
that already makes `[data-vp-config]` robust. The light DOM is searched first;
the shadow-DOM traversal and capability sweep run only when the light DOM holds
no player, so the common path stays cheap.

## Hosting the runtime scripts on Vercel

The scripts live under `public/runtime/` so Next.js serves them as static
assets. After any push to the spike branch, the Vercel preview makes them
available at:

```
https://tony-video-player-git-spike-learningsuite-e-f1e7ad-vantisgo-web.vercel.app/runtime/reskin-player.js
…/runtime/demo-overlays.js
…/runtime/admin-toggle.js
```

The branch alias hostname above always points at the latest preview build
of the branch — handy while iterating. Production preview URLs point at
the same files under `https://tony-video-player.vercel.app/runtime/<name>.js`
once main is updated.

### Vercel deployment protection bypass

Our Vercel team has SAML / deployment protection on by default, so a raw
`<script src="https://….vercel.app/runtime/reskin-player.js">` from the
LearningSuite tenant returns 401. Two ways out:

1. **Protection Bypass for Automation** (recommended for the spike).
   Project Settings → _Deployment Protection_ → enable _Protection
   Bypass for Automation_ → copy the generated secret. Append it as a
   query string to every script URL:

   ```html
   <script
     src="https://….vercel.app/runtime/reskin-player.js?x-vercel-protection-bypass=SECRET"
     defer
   ></script>
   ```

   The secret is a static, project-scoped token; rotate it from the same
   settings page when needed.

   **Don't add `&x-vercel-set-bypass-cookie=true`.** It triggers a
   Set-Cookie redirect — Vercel sets the bypass as a `SameSite=Lax`
   cookie on the `.vercel.app` host, but cross-origin subresource
   requests don't carry that cookie back, so the redirect target 401s
   and the script tag fires `onerror`. Stick with the query parameter
   on every request — it's evaluated independently of cookies.

2. **Public preview** — disable protection on the project entirely or
   add a public alias. Simpler, but anyone with the URL can read the
   files. Acceptable here since the runtime carries no secrets.

### LearningSuite global-script-slot

Once the bypass is in place, paste this **one** line into the global
`<script>` slot of the LearningSuite tenant (or, if the tenant has no
such slot, into a "Code einbetten" block on every lesson):

```html
<script
  src="https://tony-video-player-git-spike-learningsuite-e-f1e7ad-vantisgo-web.vercel.app/runtime/loader.js?x-vercel-protection-bypass=SECRET"
  defer
></script>
```

The loader copies **its own query string** onto every child URL, so the
bypass secret is pasted once and still reaches `reskin-player.js`,
`demo-overlays.js` and `admin-toggle.js`. Put the secret on the loader URL
and nowhere else.

**Direct injection (debugging / e2e).** The three bundles remain
individually loadable and individually self-gating, so the old three-tag
snippet still works, and `agent-browser eval -b` / Playwright can inject a
single bundle. In that mode each bundle asks the kill-switch itself
(`window.__vpRuntimeGate` is only set by the loader) and the bypass secret
has to be on each URL by hand.

## Self-cleanup pattern for re-injectable runtime scripts

While iterating, repeated injection via `agent-browser eval -b` pinned the
Chrome renderer at 100 % CPU within a few cycles. Two root causes,
mirrored across all three scripts now:

1. **MutationObservers stack.** Each IIFE run added a fresh
   `new MutationObserver(scan).observe(document.body, { subtree: true, childList: true })`,
   so after N injects the same scan ran N times for every DOM mutation.
   On a React app like LearningSuite that's hundreds of mutations per
   second.
2. **`history.pushState` / `replaceState` patches nest.** Each IIFE
   wrapped the existing function. After N injects, every SPA
   navigation invoked the original N times and scheduled N timeouts.

The fix in all three scripts:

```js
// First thing inside the IIFE:
if (Array.isArray(window.__vpXxxCleanup)) {
  for (const fn of window.__vpXxxCleanup) {
    try {
      fn();
    } catch {}
  }
}
window.__vpXxxCleanup = [];

// Each setup pushes its own teardown:
const mo = new MutationObserver(scheduleScan); // scheduleScan is debounced (250ms)
mo.observe(document.body, { subtree: true, childList: true });
window.__vpXxxCleanup.push(() => mo.disconnect());
```

`history.pushState`/`replaceState` patches were removed entirely — the
debounced MutationObserver plus a `popstate` listener (also tracked in
the cleanup registry) catches everything we care about without the
stacking risk.

A separate trap was the status-refresh observer in `admin-toggle.js`,
originally `attributeFilter: ['value']` on `document.body+subtree`.
LearningSuite's React inputs constantly mutate their own `value`
attributes, so the observer fired roughly continuously and triggered DOM
writes that triggered itself. Replaced with a passive `setInterval`
poll (2 s, no-op if state unchanged).

## Sidebar mount: two strategies, picked at runtime

The original sidebar mount assumed the LearningSuite student page layout:
a flex container with `<main>` plus a 300 px right column we hide and
slot ourselves into. The editor "Vorschau" preview has a different DOM
shape — no `<main>`, the player is nested ten levels deep inside MUI
components, no row-flex parent ready to host a right column.

`public/runtime/demo-overlays.js` now picks the strategy at runtime:

- **Strategy A — flex sibling of `<main>`.** Try the original approach.
  After insertion, _verify_ that `sidebar.left ≥ main.right` AND
  `sidebar.right ≤ window.innerWidth`. If not, **roll back** the layout
  edits (sibling `display` values, parent `display:flex`, `gap`,
  `flex` on `<main>`) and try B.
- **Strategy B — fixed right rail.** `position: fixed; top:24; right:24;
bottom:24; width:380; z-index:50` mounted on `<body>`. Always reaches
  the viewport edge regardless of host layout.

The post-install verification + rollback is the key — without it, A
silently mangled the editor layout (hid every sibling of `<main>`,
turned its parent into flex, but the sidebar ended up below or in the
wrong axis).

## The section indicator's hidden whitespace bug

Worth noting because it cost real time and the lesson generalises:
LearningSuite's stylesheet inherits `white-space: pre-wrap` onto custom
DOM, which makes the newlines in template-literal `innerHTML` visible
as blank lines. The section pill ballooned to ~156 px tall when only
~33 px of content was visible. Fix in `demo-overlays.js`:

```css
.vp-section-pill,
.vp-section-pill * {
  white-space: normal;
}
.vp-section-pill .vp-sec-title {
  white-space: nowrap;
}
```

A second related bug: the original section pill rebuilt its full
`innerHTML` on every `time` event (~4×/s). Hover state lives on the
parent element via `:hover`, so DOM thrash mid-hover swallowed the
hover and the expanded card snapped shut. Fix: build collapsed +
expanded views once, toggle visibility via CSS, and only update text
content / class attributes per tick.

## Files in this branch

- `docs/learningsuite-enrichment-research.md` — this document
- `public/runtime/loader.js` — the only injected tag; gates + injects the three below
- `public/runtime/reskin-player.js` — re-skin runtime (gated by `[data-vp-config]`)
- `public/runtime/demo-overlays.js` — overlays + sidebar runtime (gated, dual mount strategy)
- `public/runtime/admin-toggle.js` — admin-only banner + dialog with the LLM prompt
- `public/runtime/poc-*.png` — screenshots of each verified state

The three `.js` files are not yet wired into the Next.js app — they
exist as self-contained scripts that can be pasted into the
LearningSuite global `<script>` slot, hosted as static assets, or
adapted into the production runtime. Each one is self-gating and safely
re-injectable.
