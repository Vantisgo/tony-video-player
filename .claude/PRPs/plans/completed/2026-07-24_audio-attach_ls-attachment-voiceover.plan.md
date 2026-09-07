# Feature: Voice-Over Audio from LearningSuite Attachments

## Summary

Today the injected `demo-overlays` runtime "plays" a voice-over by synthesizing the
`script` text with the browser's `SpeechSynthesis` API — a placeholder. This feature
lets a lesson author attach real `.mp3` voice-overs to the LearningSuite lesson (as
"Anhänge" file attachments) and have the overlay play the actual audio. The author
adds the attachment's **filename** to the enrichment config; at runtime, when an audio
overlay triggers, the runtime finds the matching attachment anchor in the lesson DOM
(`a[href*="/courses/steps/"]` whose visible text is that filename), reads its live
signed Google-Cloud-Storage `href`, and binds it to a real `<audio>` element. If no
matching attachment is found, it falls back to the existing TTS behaviour so nothing
regresses. No audio is hosted on Vercel and no LearningSuite auth token is handled —
the page already renders a currently-valid signed URL on each load.

## User Story

As a **course author enriching a LearningSuite lesson**
I want to **use a real recorded voice-over file I attached to the lesson**
So that **learners hear the actual narration instead of robotic text-to-speech, without hosting audio on our own infrastructure.**

## Problem Statement

The production audio overlay never plays a real file — `AudioController._speak()`
(`runtime-src/demo-overlays/index.ts:477-492`) calls `SpeechSynthesisUtterance`. The
`Audio` config type (`runtime-src/common/types.ts:28-35`) has no field that references
an audio asset, and the LLM authoring prompt (`runtime-src/admin-toggle/prompt.ts`)
never asks for one. The 12 real `.mp3` voice-overs currently sit in
`public/uploads/audio/` (Vercel-hosted) and are unused by the runtime. We need the
overlay to play author-supplied audio that lives **in LearningSuite** (behind auth),
without hosting it ourselves and without scraping LearningSuite auth tokens.

Testable outcome: given a config `audios[]` entry with `audioFile: "X.mp3"` and a DOM
attachment anchor whose text is `X.mp3`, when the video crosses the audio's trigger `t`,
a real `<audio>` element plays the anchor's `href`; given no matching anchor, the TTS
path runs exactly as today.

## Solution Statement

Three surgical changes plus a new pure helper:

1. **Type**: add optional `audioFile?: string` to `Audio` (back-compatible; existing
   configs and `DEFAULT_AUDIOS` keep working via the TTS fallback).
2. **Prompt**: add `audioFile` to the schema block + example in `PROMPT_TEXT`, with a
   note that the **author** fills the exact attachment filename (the LLM cannot know it).
3. **Resolver**: new `runtime-src/common/attachments.ts` — a pure,
   DOM-reading, bundle-cheap function `resolveAttachmentUrl(filename, doc)` that scans
   `a[href*="/courses/steps/"]`, trims each anchor's `textContent`, matches the filename
   (exact, then case-insensitive), validates the href is `https:`, and returns it or `""`.
   Mirrors the existing pure-URL-extractor style of `common/tracks.ts:36` (`getBunnyVideoId`).
4. **Playback**: make `AudioController` in `demo-overlays/index.ts` **mode-aware**. On
   `activate()`, resolve `audioFile` → URL. If a URL is found → **file mode**: play a
   persistent hidden `<audio>` element, drive the progress clock from its real
   `timeupdate`, end/resume on `ended`. If not (or on load/play error) → **tts mode**:
   the current `_speak()` + simulated `_scheduleTick()` behaviour, unchanged.

## Metadata

| Field            | Value                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type             | ENHANCEMENT                                                                                                                                                |
| Complexity       | MEDIUM                                                                                                                                                     |
| Systems Affected | `runtime-src/common` (types + new resolver), `runtime-src/demo-overlays`, `runtime-src/admin-toggle` (prompt), generated `public/runtime/demo-overlays.js` |
| Dependencies     | None new. esbuild bundle (existing), vitest + happy-dom (existing). No runtime libs.                                                                       |
| Estimated Tasks  | 9                                                                                                                                                          |

---

## Lifecycle (append-only)

- **Created:** 2026-07-24T14:15:11Z
- **Modified:** 2026-07-24T14:15:11Z, 2026-07-27T09:55:00Z
- **Commits:** _(none yet)_
- **Agent / Session:** claude-opus-4-8 · session da38053b, claude-opus-5 · session a0bb6827
- **Back refs:**
  - `docs/learningsuite-enrichment-research.md` — LS enrichment spike; DOM/attachment/auth findings
  - `.claude/PRPs/plans/completed/2026-07-24_security_runtime-augment-hardening.plan.md` — runtime hardening (esc/untrusted-config constraints this plan respects)
- **Forward refs:** _(none yet)_

> **Append-only:** `Created` is set once; every other field is a list you only ever add to.

---

## UX Design

### Before State

```
╔══════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                 ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  LearningSuite lesson page (authenticated)                               ║
║  ┌────────────────────┐     video time crosses audio.t                   ║
║  │  <hls-video> plays  │ ─────────────────────────────┐                   ║
║  └────────────────────┘                               ▼                   ║
║                                            ┌────────────────────────┐     ║
║                                            │ AudioController.activate│     ║
║                                            │  pause video            │     ║
║                                            │  _speak(a) → TTS  ◄──────┼──┐  ║
║                                            └────────────────────────┘  │  ║
║                                                       │                │  ║
║                                            SpeechSynthesisUtterance     │  ║
║                                            (a.script, robotic de-DE) ───┘  ║
║                                                                          ║
║  Real .mp3 voice-overs sit UNUSED in public/uploads/audio/ (Vercel).     ║
║                                                                          ║
║  PAIN: no real narration; audio would have to be Vercel-hosted;          ║
║        Audio config has no field to reference an asset.                  ║
╚══════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔══════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                 ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  LearningSuite lesson page (authenticated)                               ║
║   "Anhänge:"  <a href="https://storage.googleapis.com/.../courses/       ║
║                 steps/<cuid>?X-Goog-…">  2025-12-22 … Intro.mp3 </a>      ║
║  ┌────────────────────┐     video time crosses audio.t                   ║
║  │  <hls-video> plays  │ ─────────────────────────────┐                   ║
║  └────────────────────┘                               ▼                   ║
║                                     ┌──────────────────────────────────┐  ║
║                                     │ AudioController.activate          │  ║
║                                     │  resolveAttachmentUrl(audioFile)  │  ║
║                                     └──────────────────────────────────┘  ║
║                                        │ found URL          │ not found    ║
║                                        ▼                    ▼              ║
║                            ┌───────────────────┐   ┌──────────────────┐   ║
║                            │ FILE MODE          │   │ TTS MODE (fallback│  ║
║                            │ <audio src=href>   │   │  = today's path) │   ║
║                            │ .play()            │   │  _speak() + tick │   ║
║                            │ timeupdate→progress│   └──────────────────┘   ║
║                            │ ended→resume video │                          ║
║                            └───────────────────┘                          ║
║                                                                          ║
║  VALUE: real recorded narration; audio stays in LearningSuite behind     ║
║         its own auth; nothing hosted on Vercel; TTS still covers gaps.    ║
╚══════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location                                           | Before                          | After                                                                  | User Impact                                            |
| -------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------ |
| `runtime-src/common/types.ts` `Audio`              | `{id,t,dur,title,voice,script}` | `+ audioFile?: string`                                                 | Author can point an audio cue at an attachment.        |
| `runtime-src/admin-toggle/prompt.ts` `PROMPT_TEXT` | `audios[]` has no file field    | schema + example include `audioFile`, with author-fills-it note        | LLM emits the field; author pastes the exact filename. |
| Audio overlay at trigger `t`                       | Always robotic TTS              | Real `<audio>` when attachment resolves; TTS otherwise                 | Learner hears the actual recorded voice-over.          |
| Overlay progress bar / play-pause / ±10s           | Drives a **simulated** clock    | Drives the **real** `<audio>` in file mode; simulated only in TTS mode | Controls seek/scrub the real audio.                    |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these before starting any task.**

| Priority | File                                             | Lines                | Why Read This                                                                          |
| -------- | ------------------------------------------------ | -------------------- | -------------------------------------------------------------------------------------- |
| P0       | `runtime-src/demo-overlays/index.ts`             | 36-52, 394-518       | The `AudioController` interface + object literal to modify (mode-awareness).           |
| P0       | `runtime-src/demo-overlays/index.ts`             | 552-560              | `maybeTriggerAudio` — the trigger loop calling `activate()`.                           |
| P0       | `runtime-src/demo-overlays/index.ts`             | 562-653              | `renderAudio` — banner DOM, `esc()` usage, `data-action` handler wiring.               |
| P0       | `runtime-src/common/tracks.ts`                   | 36-42                | `getBunnyVideoId` — the pure-URL-extractor pattern to MIRROR for the resolver.         |
| P1       | `runtime-src/common/types.ts`                    | 28-35                | `Audio` interface to extend.                                                           |
| P1       | `runtime-src/common/escape.ts`                   | 1-13                 | `esc()` — reuse; never interpolate config into innerHTML unescaped.                    |
| P1       | `runtime-src/admin-toggle/prompt.ts`             | 34-63                | `PROMPT_TEXT` schema block + `audios[]` example to update.                             |
| P1       | `runtime-src/common/cleanup.ts`                  | all                  | `resetCleanup` / `pushCleanup` registry — how to register the `<audio>` teardown.      |
| P2       | `runtime-src/tests/demo-overlays/render.test.ts` | 1-115, 156-183       | Test harness: player stub, `setupConfigDom`, `emitTime`, `nextFrames`, cleanup drain.  |
| P2       | `runtime-src/tests/common/config.test.ts`        | 56-81                | Pure-function DOM test pattern (build element, assert, `afterEach` reset).             |
| P2       | `docs/audio/source.html`                         | (attachment anchors) | Real DOM shape of the "Anhänge" anchors this feature matches against.                  |
| P2       | `docs/feature-context.md`                        | Standing Constraints | Runtime bundle/edit rules; untrusted-config; edit `runtime-src/` not `public/runtime`. |

**External Documentation:**

| Source                                                                                                                 | Section                 | Why Needed                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [MDN: HTMLMediaElement.play()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play)                 | Return value / autoplay | `play()` returns a Promise that can reject (autoplay policy); must `.catch()` → TTS fallback. In happy-dom it may return `undefined` — guard with `p?.catch`.                          |
| [MDN: `<audio>` crossorigin](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/audio#crossorigin)              | crossorigin absent      | Do **not** set `crossorigin`; a bare media element plays cross-origin in no-cors mode (no CORS headers needed). `currentTime`/`duration`/`play`/`pause`/`ended` all work cross-origin. |
| [MDN: HTMLMediaElement timeupdate](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/timeupdate_event) | event cadence           | Drive the progress clock from `timeupdate` in file mode (replaces the 100ms simulated tick).                                                                                           |

---

## Patterns to Mirror

**PURE_URL_EXTRACTOR (mirror for the resolver):**

```typescript
// SOURCE: runtime-src/common/tracks.ts:36-42
export function getBunnyVideoId(url: string | null | undefined): string {
  if (!url) return "";
  const m = String(url).match(
    /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/playlist\.m3u8/i,
  );
  return m?.[1] || "";
}
```

**HTML_ESCAPE (already used in renderAudio; keep using):**

```typescript
// SOURCE: runtime-src/common/escape.ts:12-13
export const esc = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ENTITIES[c] ?? c);
```

**CLEANUP_REGISTRATION (register the <audio> teardown like existing listeners):**

```typescript
// SOURCE: runtime-src/demo-overlays/index.ts:547-550 (capture-listener teardown)
document.addEventListener("click", onCaptureClick, true);
document.addEventListener("keydown", onCaptureKeydown, true);
pushCleanup(CLEANUP_KEY, () => {
  document.removeEventListener("click", onCaptureClick, true);
  document.removeEventListener("keydown", onCaptureKeydown, true);
});
```

**TTS + SIMULATED CLOCK (the fallback path — preserve verbatim):**

```typescript
// SOURCE: runtime-src/demo-overlays/index.ts:477-513
_speak(a) {
  try {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(a.script || a.title);
    u.lang = "de-DE"; u.rate = 1.0; u.pitch = 1.0;
    u.onend = () => { if (audioCtrl.state !== "idle") audioCtrl.end({ resume: true }); };
    speechSynthesis.speak(u);
  } catch { /* ignore */ }
},
_scheduleTick() {
  if (audioCtrl._tickHandle) clearTimeout(audioCtrl._tickHandle);
  if (audioCtrl.state !== "playing") return;
  audioCtrl._tickHandle = setTimeout(() => { /* advance audioTime by 0.1, end at dur */ }, 100);
},
```

**TEST HARNESS (mirror for the new audio test):**

```typescript
// SOURCE: runtime-src/tests/demo-overlays/render.test.ts:36-49
function setupConfigDom(config: unknown): void {
  const pre = document.createElement("pre");
  pre.setAttribute("data-vp-config", "");
  pre.textContent = JSON.stringify(config);
  document.body.appendChild(pre);
  const host = document.createElement("div");
  host.appendChild(document.createElement("hls-video"));
  document.body.appendChild(host);
}
const nextFrames = (): Promise<void> =>
  new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
// ... await import("../../demo-overlays/index"); await nextFrames(); emitTime(t);
```

---

## Files to Change

| File                                            | Action             | Justification                                                                                            |
| ----------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------- |
| `runtime-src/common/types.ts`                   | UPDATE             | Add optional `audioFile?: string` to `Audio`.                                                            |
| `runtime-src/common/attachments.ts`             | CREATE             | Pure `resolveAttachmentUrl(filename, doc)` — filename→signed href from the LS DOM.                       |
| `runtime-src/admin-toggle/prompt.ts`            | UPDATE             | Add `audioFile` to schema, example, and requirements in `PROMPT_TEXT`.                                   |
| `runtime-src/demo-overlays/index.ts`            | UPDATE             | Make `AudioController` mode-aware: file `<audio>` playback + TTS fallback; persistent element + cleanup. |
| `runtime-src/tests/common/attachments.test.ts`  | CREATE             | Unit-test the resolver (match, case-insensitive, no-match, non-https, whitespace).                       |
| `runtime-src/tests/demo-overlays/audio.test.ts` | CREATE             | File-mode playback + TTS-fallback behaviour of the controller.                                           |
| `public/runtime/demo-overlays.js`               | UPDATE (generated) | Rebuild via `npm run build:runtime`; committed + CI drift-checked.                                       |

`runtime-src/demo-overlays/data.ts` (`DEFAULT_AUDIOS`) is intentionally **left unchanged** —
the demo defaults have no real attachment, so they exercise (and document) the TTS fallback.

---

## NOT Building (Scope Limits)

- **No GraphQL / Apollo-cache hooking, no LearningSuite token handling.** The signed
  GCS URL is read straight from the rendered DOM anchor; the page re-mints a valid one
  each load. Resolving via `StepFileQuery`/persisted queries is explicitly out of scope.
- **No Vercel/off-platform audio hosting** and no change to `app/api/upload/route.ts` or
  `public/uploads/audio/`. Those assets become dead; deleting them is a separate cleanup.
- **No admin-toggle capture UX** (a button that auto-extracts the attachment filename/CUID).
  The author pastes the filename manually. Capture-on-click is a possible follow-up.
- **No CUID-based matching.** We match by human-readable filename (what the author knows).
  Renaming/re-uploading the attachment is an author responsibility.
- **No telemetry event for unresolved audio.** Fallback-to-TTS is the graceful degrade;
  wiring a `beacon` signal is deferred.
- **No new schema/validation library in the runtime bundle** (standing constraint).
  `parseVpConfig` stays lenient and carries the new field with no change.
- **No `reskin-player.js` or `admin-toggle.js` behaviour change** beyond the prompt text.

---

## Step-by-Step Tasks

Execute in order. Each task is atomic and independently verifiable.

**Status markers** — prefix EVERY task header with one: `[ ]` idle · `[wip]` in progress · `[x]` complete · `[f]` failed.

### `[x]` Task 1: UPDATE `runtime-src/common/types.ts` — add `audioFile` to `Audio`

- **ACTION**: Add one optional field to the `Audio` interface.
- **IMPLEMENT**: Inside `interface Audio` (lines 28-35), add `audioFile?: string;` after `script`.
- **MIRROR**: existing optional-field style in the file.
- **GOTCHA**: Keep it **optional** — existing configs and `DEFAULT_AUDIOS` omit it and must still type-check and run (TTS fallback).
- **VALIDATE**: `npm run typecheck:runtime`

### `[x]` Task 2: CREATE `runtime-src/common/attachments.ts` — the resolver

- **ACTION**: Create a new pure module exporting `resolveAttachmentUrl`.
- **IMPLEMENT**:
  - Signature: `export function resolveAttachmentUrl(filename: string | undefined, doc: Document = document): string`
  - Return `""` early if `!filename`.
  - `const anchors = Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href*="/courses/steps/"]'));`
  - Normalize: `const want = filename.trim(); const wantLc = want.toLowerCase();`
  - Match precedence over anchors, each using `(a.textContent || "").trim()`:
    1. exact `text === want`
    2. else case-insensitive `text.toLowerCase() === wantLc`
  - For the matched anchor, read `href = a.href` (or `getAttribute("href")`), and return it **only if** it parses to an `https:` URL (`new URL(href).protocol === "https:"`); otherwise continue / return `""`.
  - Wrap `new URL(...)` in try/catch → treat parse failure as no-match.
- **MIRROR**: `runtime-src/common/tracks.ts:36-42` (pure, defensive, `""`-on-miss, no throw).
- **GOTCHA**: Anchor `textContent` may include an inner `<svg>` icon; `.trim()` handles the whitespace (the SVG contributes no text). Do NOT use `innerHTML`. The `filename` is untrusted config but is only used as a match key (never injected into the DOM); the `href` comes from the page DOM and is assigned to `.src` later, not `innerHTML` — the `https:` check is defense-in-depth against a planted `javascript:`/`data:` anchor.
- **VALIDATE**: `npm run typecheck:runtime`

### `[x]` Task 3: CREATE `runtime-src/tests/common/attachments.test.ts`

- **ACTION**: Unit-test the resolver against a happy-dom DOM.
- **IMPLEMENT** (`describe("resolveAttachmentUrl")`), each building anchors then asserting:
  - resolves exact filename → returns the `https` href.
  - case-insensitive match when case differs.
  - ignores an anchor with a non-`/courses/steps/` href even if text matches.
  - returns `""` when no anchor text matches.
  - returns `""` (skips) when the matching anchor's href is not `https:` (e.g. `javascript:...`).
  - matches despite surrounding whitespace / an inner `<svg>` in the anchor.
  - returns `""` for `undefined`/empty filename.
- **MIRROR**: `runtime-src/tests/common/config.test.ts:56-81` — build elements, assert, `afterEach(() => { document.body.innerHTML = ""; })`.
- **IMPORTS**: `import { describe, it, expect, afterEach } from "vitest";` and `import { resolveAttachmentUrl } from "../../common/attachments";`
- **GOTCHA**: happy-dom resolves `a.href` to absolute — assert with `toContain("/courses/steps/")` / `toBe(fullUrl)` as appropriate; set a full absolute `href` in the test anchors.
- **VALIDATE**: `npx vitest run runtime-src/tests/common/attachments.test.ts`

### `[x]` Task 4: UPDATE `runtime-src/admin-toggle/prompt.ts` — add `audioFile` to the prompt

- **ACTION**: Extend the `audios[]` schema description, the output example, and the requirements in `PROMPT_TEXT`.
- **IMPLEMENT**:
  - In the field detail (currently line ~35: `audios[]: id, t (Trigger), dur ..., voice ..., script ...`), append `audioFile` with a German note, e.g.:
    `audioFile — (optional) exakter Dateiname des als "Anhang" hochgeladenen Voice-Over-.mp3 (z.B. "Intro.mp3"). VOM ADMIN einzutragen — das LLM kennt den Dateinamen nicht; leer lassen, wenn kein Anhang vorhanden ist (dann Vorlesen per TTS).`
  - In the output example `audios` entry (line ~57), add `"audioFile":"DATEINAME.mp3"` (or leave as a clearly-placeholder token) so the shape is visible.
  - Add a bullet under Anforderungen: `audioFile nur setzen, wenn eine gleichnamige Datei als Anhang der Lektion existiert (sonst weglassen).`
- **MIRROR**: the existing German wording/format in the same file.
- **GOTCHA**: `PROMPT_TEXT` is the single source of truth shown in the admin dialog — wording must stay German and self-contained. Do not add a URL field (authors supply filenames, not signed URLs).
- **VALIDATE**: `npm run typecheck:runtime` (string constant; also visually confirm the `<pre>` example still parses as JSON if copied).

### `[x]` Task 5: UPDATE `runtime-src/demo-overlays/index.ts` — make `AudioController` mode-aware

- **ACTION**: Add file-based playback with TTS fallback, without regressing the TTS path.
- **IMPLEMENT**:
  1. Import the resolver at top with the other `../common/*` imports:
     `import { resolveAttachmentUrl } from "../common/attachments";`
  2. Extend the `AudioController` interface (lines 36-52) with:
     `mode: "tts" | "file";` and `audioEl: HTMLAudioElement | null;`
  3. In `applySetupInner`, **create one persistent hidden `<audio>` once** (before/at the controller definition), append to `document.body` (or a slot), and register teardown via `pushCleanup(CLEANUP_KEY, ...)` that pauses it, strips listeners, clears `src`, and removes it. Wire listeners once:
     - `timeupdate` → if `state !== "idle" && mode === "file"`, set `audioTime = Math.min(active.dur, audioEl.currentTime)` and `_render()`.
     - `ended` → if `state !== "idle"`, `end({ resume: true })`.
     - `error` → if in file mode and active, fall back: `mode="tts"; _speak(active); _scheduleTick();` (log via `console.warn("[vp] audio load failed", ...)`).
  4. In `activate(a, videoT)` (lines 404-418), after the existing state/`videoResumeTime`/`triggered` setup and `videoEl?.pause()`:
     - `const url = resolveAttachmentUrl(a.audioFile);`
     - if `url`: `audioCtrl.mode = "file";` set `audioEl.src = url; audioEl.currentTime = 0;` then `const p = audioEl.play(); if (p && typeof p.catch === "function") p.catch(() => { audioCtrl.mode = "tts"; audioCtrl._speak(a); audioCtrl._scheduleTick(); });` Do **not** call `_scheduleTick()` in file mode (timeupdate drives it), but still call `_render()` for the initial paint.
     - else: `audioCtrl.mode = "tts"; audioCtrl._speak(a); audioCtrl._scheduleTick();` (unchanged behaviour).
  5. `togglePlay()` (419-438): branch on `mode`. file → `audioEl.pause()` / `audioEl.play()` (guard the promise); tts → existing `speechSynthesis.pause()/resume()`. Keep the `state` transitions and final `_render()`.
  6. `seekRel(delta)` (469-476): file → `audioEl.currentTime = clamp(0, active.dur, audioEl.currentTime + delta)` (then timeupdate re-renders); tts → existing simulated `audioTime` clamp + `_render()`.
  7. `end({resume})` (439-465): before the resume block, also stop file audio: `try { audioEl.pause(); audioEl.removeAttribute("src"); audioEl.load(); } catch {}` in addition to the existing `speechSynthesis.cancel()`. Reset `mode` to `"tts"` on end. Keep the `videoResumeTime`→`videoEl.currentTime` + `videoEl.play()` resume logic intact.
  8. `_scheduleTick()` (496-513): guard so it is a no-op in file mode (early return if `audioCtrl.mode === "file"`), keeping the simulated clock exclusively for TTS.
  9. Initialize `mode: "tts", audioEl: <the created element>` in the controller object literal.
- **MIRROR**: cleanup registration pattern at `index.ts:547-550`; `esc()`/`data-action` render untouched in `renderAudio` (562-653) — it already reads `audioTime`/`active.dur`, which now reflect real audio in file mode.
- **GOTCHA**:
  - `_speak` already guards missing `speechSynthesis`; keep that so tests (happy-dom has no `speechSynthesis`) don't throw.
  - `audioEl.play()` may return `undefined` in happy-dom — always guard `p?.catch`.
  - No `crossorigin` attribute on the `<audio>` (no-cors playback).
  - Rewind re-arm in `maybeTriggerAudio` (552-560) is unchanged; file mode reuses `triggered`.
  - The persistent element + single listener set avoids the listener-stacking failure mode called out in the research doc for re-injected scripts — never add listeners inside `activate()`.
- **VALIDATE**: `npm run typecheck:runtime`

### `[x]` Task 6: CREATE `runtime-src/tests/demo-overlays/audio.test.ts`

- **ACTION**: Behaviour tests for file mode and TTS fallback, mirroring the render-test harness.
- **IMPLEMENT** (copy `installPlayerStub`, `emitTime`, `setupConfigDom`, `nextFrames`, and the `__vp*` cleanup drain from `render.test.ts:1-115`; extend `setupConfigDom` or add a helper to also append an `<a href="https://storage.googleapis.com/.../courses/steps/xyz?X-Goog-...">FILENAME.mp3</a>` when the test wants a resolvable attachment):
  - **file mode**: config `audios:[{id,t:2,dur:5,title,voice,script,audioFile:"Intro.mp3"}]` + a matching anchor. Import module, `await nextFrames()`, `emitTime(2)`. Assert: an `<audio>` exists with `src` containing `/courses/steps/`; the player stub's `pause` was called (video paused). Then dispatch an `ended` event on the audio element and assert the controller returned to idle and the video resumed (stub `play`/`seek` called).
  - **TTS fallback**: same config but **no** matching anchor. `emitTime(2)`. Assert **no** `<audio>` gets a `/courses/steps/` `src` (mode stayed tts) and the overlay banner still renders (`slotLowerThird` `dataset.kind === "audio"`). (happy-dom has no `speechSynthesis`, so `_speak` no-ops — assert on the banner/mode, not on speech.)
  - **case-insensitive / whitespace** resolution can be covered in the resolver unit test (Task 3); keep this file about controller wiring.
- **MIRROR**: `runtime-src/tests/demo-overlays/render.test.ts:84-183`.
- **GOTCHA**: spy on the player stub methods (`vi.fn()`) to assert pause/play/seek; use `document.querySelector("audio")` for the element. Fire `ended`/`error` via `el.dispatchEvent(new Event("ended"))`.
- **VALIDATE**: `npx vitest run runtime-src/tests/demo-overlays/audio.test.ts`

### `[x]` Task 7: Rebuild the generated runtime bundle

- **ACTION**: Regenerate `public/runtime/demo-overlays.js` (and any other affected `.js`) from the edited TS.
- **IMPLEMENT**: `npm run build:runtime`
- **MIRROR**: standing constraint — the `.js` are generated, committed, and CI drift-checks them (`git diff --exit-code -- public/runtime`).
- **GOTCHA**: Never hand-edit `public/runtime/*.js`. Commit the regenerated file(s) so the drift-check passes.
- **VALIDATE**: `npm run build:runtime && git diff --stat -- public/runtime` (expect `demo-overlays.js` changed and no uncommitted drift after commit).

### `[x]` Task 8: Full static + test validation

- **ACTION**: Run the full validation loop.
- **IMPLEMENT**: `npm run typecheck:runtime && npm run lint && npm test`
- **VALIDATE**: all exit 0.

### `[x]` Task 9: Manual smoke against the real DOM dump (optional but recommended)

- **ACTION**: Sanity-check the resolver against the captured LearningSuite DOM.
- **IMPLEMENT**: a throwaway node/vitest snippet (or a temporary test) that loads `docs/audio/source.html` into happy-dom and calls `resolveAttachmentUrl("2025-12-22 at 00.22.27 Intro.mp3")` and `resolveAttachmentUrl("2025-12-22 at 00.50.40 Voiceover Phase 1.mp3")`.
- **VALIDATE**: both return an `https://storage.googleapis.com/.../courses/steps/...` URL; a nonexistent filename returns `""`. Remove the throwaway afterwards (do not commit it).

---

## Testing Strategy

### Unit Tests to Write

| Test File                                       | Test Cases                                                                                               | Validates                        |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `runtime-src/tests/common/attachments.test.ts`  | exact, case-insensitive, non-steps anchor ignored, no-match, non-https skip, whitespace/svg, empty input | `resolveAttachmentUrl`           |
| `runtime-src/tests/demo-overlays/audio.test.ts` | file mode plays + pauses video + resumes on `ended`; TTS fallback when unresolved                        | `AudioController` mode-awareness |

### Edge Cases Checklist

- [x] `audioFile` absent → TTS mode (back-compat with existing configs / `DEFAULT_AUDIOS`).
- [x] `audioFile` set but no matching anchor → TTS fallback, banner still shows.
- [x] Matching anchor but non-`https:` href → skipped (`""` → TTS).
- [x] Anchor text has surrounding whitespace / inner `<svg>` icon → still matches.
- [x] Two audios with distinct filenames → each resolves to its own href.
- [x] `audioEl.play()` returns `undefined` (happy-dom) → no crash.
- [x] `audioEl.play()` rejects (autoplay policy) → falls back to TTS.
- [x] Rewind past `t-0.5` re-arms the cue (unchanged trigger logic).
- [x] Re-injection of the script → single `<audio>` + single listener set (no stacking).

---

## Validation Commands

🔁 **Validation loop:** not complete until every command exits 0. On failure, fix and re-run.

### Level 1: STATIC_ANALYSIS

```bash
npm run typecheck:runtime && npm run lint
```

**EXPECT**: Exit 0, no errors.

### Level 2: UNIT_TESTS

```bash
npx vitest run runtime-src/tests/common/attachments.test.ts runtime-src/tests/demo-overlays/audio.test.ts
```

**EXPECT**: All new tests pass.

### Level 3: FULL_SUITE + BUNDLE

```bash
npm test && npm run build:runtime && git diff --exit-code -- public/runtime
```

**EXPECT**: All tests pass; bundle regenerated; **after committing the regenerated `.js`**, the drift-check exits 0.

### Level 4: DATABASE_VALIDATION

N/A — no schema/DB changes.

### Level 5: BROWSER_VALIDATION (manual, real page)

- [ ] Load the three runtime scripts on a LearningSuite lesson that has an audio attachment whose filename matches a config `audioFile`.
- [ ] At the cue's `t`, the video pauses and the real voice-over plays; progress bar tracks real audio; ±10s and play/pause control the audio; on end the video resumes at `videoResumeTime`.
- [ ] Remove/rename the attachment → cue falls back to TTS, banner still appears.

### Level 6: MANUAL_VALIDATION

- [x] Task 9 resolver smoke against `docs/audio/source.html` returns the expected `steps/...` URLs.

---

## Acceptance Criteria

- [x] `Audio` type has optional `audioFile`; existing configs/`DEFAULT_AUDIOS` still type-check and run.
- [x] `resolveAttachmentUrl` returns the anchor href for a matching filename (exact + case-insensitive), `""` otherwise, and never throws.
- [x] `PROMPT_TEXT` documents `audioFile` (schema + example + requirement), in German, marked as author-filled.
- [x] When `audioFile` resolves, the overlay plays a real `<audio>` (no `crossorigin`), pauses the video on start, resumes it on `ended`, and drives the progress bar from real playback.
- [x] When it does not resolve (or `play()` rejects / `error` fires), the controller falls back to the current TTS behaviour with the banner still shown.
- [x] Levels 1-3 pass (exit 0), including the `public/runtime` drift-check after committing the rebuilt bundle.
- [x] No regression in existing `runtime-src/tests` (esp. `demo-overlays/render.test.ts`, `safety-net.test.ts`).

## Completion Checklist

- [x] All 9 tasks completed in order.
- [x] Each task validated immediately after completion.
- [x] Level 1: typecheck + lint pass.
- [x] Level 2: new unit tests pass.
- [x] Level 3: full suite + rebuilt bundle committed, drift-check clean.
- [x] Level 5/6: resolver smoke done against `docs/audio/source.html`; Level 5 browser pass on a real LearningSuite lesson DEFERRED to the author (needs an authenticated lesson with a real attachment).
- [x] All acceptance criteria met.

---

## Risks and Mitigations

| Risk                                                                                      | Likelihood | Impact | Mitigation                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LearningSuite changes the attachment markup (anchor class / "Anhänge" layout / URL path). | MED        | MED    | Match only on the stable `/courses/steps/` href substring + visible filename, not on MUI classes. If the path segment changes, the resolver returns `""` → TTS fallback (no break). `_diag`-style logging optional. |
| Signed GCS URL expired / attachment not yet rendered at cue time.                         | LOW        | LOW    | Resolve **lazily at `activate()`** (not at mount), so late-rendered anchors are picked up; page re-mints a 6-7 day URL each load. Unresolved → TTS.                                                                 |
| Autoplay policy blocks `audioEl.play()`.                                                  | LOW        | LOW    | Video was already playing (user gesture context); on `play()` rejection, fall back to TTS.                                                                                                                          |
| happy-dom media API gaps (`play()` returns `undefined`, no `speechSynthesis`).            | MED        | LOW    | Guard `p?.catch`; `_speak` already guards missing `speechSynthesis`; tests assert on DOM/mode, not on actual audio output.                                                                                          |
| Listener/element stacking on re-injection.                                                | LOW        | MED    | One persistent `<audio>` + one listener set, both registered in the cleanup registry; nothing added inside `activate()`.                                                                                            |
| Planted malicious anchor (`javascript:`/`data:` href) matching the filename.              | LOW        | LOW    | Resolver returns only `https:` URLs; href is assigned to `.src`, never `innerHTML`.                                                                                                                                 |
| Progress bar vs real-audio drift (config `dur` ≠ file length).                            | LOW        | LOW    | In file mode `audioTime` comes from real `currentTime`; `ended` ends regardless of `dur`. Author should set `dur` ≈ file length for an accurate bar.                                                                |

---

## Questionables

<details>
<summary>Filename vs CUID as the config key.</summary>

Assumption taken: match by **filename** (`audioFile`), not the opaque step CUID.
Rationale: the author already knows the filename (they uploaded it) and the LLM can echo
it from the transcript; the CUID must be dug out of the DOM. Trade-off: renaming/re-uploading
the attachment breaks the link (so does a CUID re-upload). Confirm this is acceptable, or we
add optional CUID matching as a secondary key.

</details>

<details>
<summary>Where the resolver lives (`common/attachments.ts` vs `common/tracks.ts`).</summary>

Assumption: a new `common/attachments.ts` module, since it's DOM-reading and conceptually
distinct from HLS track helpers. Alternative: fold `resolveAttachmentUrl` into `common/tracks.ts`
next to `getBunnyVideoId`. A new file keeps concerns separate and mirrors the one-purpose-per-module
layout of `common/`.

</details>

<details>
<summary>Case-insensitive fallback matching.</summary>

Assumption: exact match first, then case-insensitive. Rationale: forgiving to author typos in
casing without risking cross-file collisions (filenames here are unique and differ by more than case).
If strictness is preferred, drop the case-insensitive tier.

</details>

<details>
<summary>Behaviour when `dur` disagrees with the real file length.</summary>

Assumption: real playback wins — `ended` ends the cue; `dur` only sizes the progress-bar max.
If a fixed-length banner is desired regardless of the file, we'd cap playback at `dur` instead.

</details>

---

## Agent Notes

**Why DOM-resolution beats the alternatives (from the conversation + `docs/learningsuite-enrichment-research.md`):**

- The attachment URL is a **Google Cloud Storage** signed URL (`storage.googleapis.com/.../courses/steps/<cuid>?X-Goog-...`), _not_ Bunny like the video. Only `host` is signed (`X-Goog-SignedHeaders=host`), so a plain GET plays it; expiry is long (`X-Goog-Expires` 6-7 days) and the page re-mints it each load (dates rounded to midnight). So reading the current DOM anchor is durable — we never persist a URL.
- Real DOM confirmed in `docs/audio/source.html`: each attachment is `<a ... href="...signed GCS...">` under an `<h4>Anhänge:</h4>` block, visible text = exact filename (verified: `2025-12-22 at 00.22.27 Intro.mp3` → `steps/cmrz0mmse1i4xbu01ps23bygk`, `... Voiceover Phase 1.mp3` → `steps/cmrz0mtk01i73bu010ubjcr5a`).
- Media elements load cross-origin in no-cors mode; `.currentTime`/`.duration`/`play`/`pause`/`ended` are all readable/usable cross-origin (no-cors only blocks Web-Audio/canvas analysis), so we can drive the overlay from real audio events — exactly what the research doc anticipated ("swap TTS for a real `<audio>` bound to the audioUrl").

**Rejected approaches:**

- _GraphQL/Apollo resolution_ (like `StepFileQuery`): rejected — needs persisted-query hashes and token handling; the URL is already in the DOM.
- _Vercel/off-platform hosting with a full URL in config_: rejected — contradicts "keep audio in LearningSuite" and the URL would rot; also re-introduces the hosting we're removing.
- _Storing the CUID_: rejected as the primary key for authoring ergonomics (filename is what the author has). Kept as a possible secondary key (Questionables).

**Standing constraints honored:** edit `runtime-src/` only, rebuild the committed IIFE; no schema lib added to the bundle; config values stay `esc()`-escaped at `innerHTML` sites; the `<audio>` teardown joins the cleanup registry; native-chrome-hiding gate and kill-switch/telemetry paths are untouched.

**Dead assets to clean up later (out of scope):** `public/uploads/audio/*.mp3` and the audio branches of `app/api/upload/route.ts` become unused once real audio lives in LearningSuite.

---

## Amendments

_Append-only history of changes made after this plan was first built (newest at the bottom)._

### 2026-07-27 — implemented (claude-opus-5, session a0bb6827)

All 9 tasks executed as planned. Implementation notes / small deviations:

- `resolveAttachmentUrl` takes `string | null | undefined` (not just `string | undefined`)
  and trims-then-empty-checks, matching the defensive signature of `getBunnyVideoId`.
- `startFile()` / `fallbackToTts()` were extracted as two local helpers next to the
  persistent `<audio>` rather than inlining the file/TTS branch in four controller methods
  (`activate`, `togglePlay`, the `play()` rejection, the `error` listener all need it).
- `end()` strips the `<audio>` `src` when the element **has** one, instead of when
  `mode === "file"` — a cue that started in file mode and fell back to TTS would otherwise
  leave a stale `src` on the persistent element.
- The `ended` listener additionally requires `mode === "file"`, so a stale media event can
  never cut a TTS utterance short.
- `togglePlay`'s file-mode resume logs a `console.warn` on a rejected `play()` instead of
  swallowing it silently.
- The `<audio>` id (`vp-audio-el`) was added to the `applySetup` safety-net rollback list.
- Level 5 (browser validation on a real authenticated LearningSuite lesson) is deferred to
  the author; Level 6 resolver smoke against `docs/audio/source.html` was run and passed
  (both real filenames resolved to their `storage.googleapis.com/.../courses/steps/<cuid>`
  URLs; an unknown filename returned `""`).
