# Feature: Voice-over overlay — main's composition in the dark palette

## Summary

Port the `main` branch's React voice-over card composition — a compact ~320px card anchored bottom-right, photo avatar, title over byline over status, progress bar above the time row, and a four-button transport ending in a labelled Skip — into the injected runtime at `runtime-src/demo-overlays`, rendered in the dark teal `T` tokens rather than `main`'s orange-amber gradient. Replaces the current full-width lower-third banner. Two things do not port for free and are the real work: `main`'s lucide icon components become inline SVG, and `main`'s hardcoded `/frederik.webp` + `"by Dr. Frederik Hümmeke"` become a config-driven optional `avatar` asset with an initials fallback, because the runtime renders whatever `voice` the config carries (live tenant: `"Coach-Stimme"`).

## User Story

As a learner watching a coaching lesson
I want the voice-over card to sit compactly in the corner in the same visual language as the rest of the player
So that it reads as part of the product rather than a band across the video, and I can see who is speaking

## Problem Statement

The runtime's voice-over overlay and the reference player's have never matched. `main`'s `components/video-player/overlays/audio-overlay.tsx` renders a 320px (`w-80`) vertical card in the bottom-right; the runtime's `renderAudio` (`runtime-src/demo-overlays/index.ts:913-940`) renders a full-width horizontal band across `#vp-slot-lt` (`left:14px; right:14px; bottom:70px`). This was never a regression — the runtime banner has been a lower third since the pre-TypeScript `public/runtime/demo-overlays.js` (`git show 80dfb0d~1:public/runtime/demo-overlays.js`, whose own section comment reads `AUDIO OVERLAY (lower-third banner)`). The user compared the two and chose `main`'s composition, in the dark palette.

## Solution Statement

Reposition the existing dedicated slot rather than sharing `slotBR`: dropping `left` from `slotLowerThird`'s `posCss` and giving it a width turns it into a 320px bottom-right slot with no renderer sharing one `dataset.kind`. Rebuild `renderAudio`'s markup to `main`'s vertical composition using `T` tokens. Add an optional `avatar` reference to the `Audio` type resolved through the existing `resolveAssetUrl`, with initials derived from `voice` when absent. Replace the emoji transport glyphs with inline SVG, and convert the hot-path play/pause toggle from a `textContent` write to a `data-playing` attribute flip so both icons live in the DOM and CSS selects between them.

## Metadata

| Field            | Value                                                                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type             | ENHANCEMENT                                                                                                                                                                   |
| Complexity       | MEDIUM                                                                                                                                                                        |
| Systems Affected | `runtime-src/demo-overlays` (index, styles), `runtime-src/common/types.ts`, `runtime-src/common/i18n/demo.ts`, tests, `public/runtime` (generated), `docs/feature-context.md` |
| Dependencies     | None added. Reuses `common/assets.ts`, `common/runtime-url.ts`, `common/i18n`                                                                                                 |
| Estimated Tasks  | 11 (Task 0 is a dependency gate)                                                                                                                                              |

---

## Lifecycle (append-only)

- **Created:** 2026-09-04
- **Modified:** 2026-09-04 (initial build); 2026-09-04 (implemented via /prp-implement)
- **Commits:** _(uncommitted at time of report — staged for the branch's PR)_
- **Agent / Session:** Claude Opus 5 (1M context) — session 57919e36 (plan); Claude Opus 5 (1M context) — session 57919e36 (implementation)
- **Back refs:** `completed/2026-09-04_vo-defects_prewrap-reset-and-playback-gate.plan.md` — **hard dependency**, its Tasks 1–3 (the `.vp-slot` white-space reset) must land first or this card inherits the same inflation; `completed/2026-09-01_audio-assets_*` (feature-context 2026-09-01) — the `asset` two-shape resolution this plan reuses for `avatar`; `completed/2026-08-04_runtime-i18n_locale-aware-overlay-strings.plan.md` — every visible string must come from the catalogue
- **Forward refs:** _(none)_

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   #vp-slot-lt  =  left:14px; right:14px; bottom:70px   (full player width)    ║
║                                                                               ║
║   ┌─────────────────────────────────────────────────────────────────────┐     ║
║   │ (FH) Voice-Over: Intro & Ein…  0:22 ▬▬▬▬───── 1:59  −10s ▶ +10s ⏭ │     ║
║   │  🎙  von Coach-Stimme • SPIELT                                      │     ║
║   └─────────────────────────────────────────────────────────────────────┘     ║
║        ▲ initials, no photo        ▲ single row: title | times | buttons      ║
║                                                                               ║
║   #vp-slot-br  =  bottom:70px; right:14px   (meta pill — cleared during cue)  ║
║                                                                               ║
║   USER_FLOW: cue fires → a band spans the video, bottom third                  ║
║   PAIN_POINT: does not match the reference player; the band covers picture     ║
║               across the full width; speaker is two letters, not a face        ║
║   DATA_FLOW: renderAudio() → slotLowerThird.innerHTML (one flex row)          ║
║              hot path: [data-fill].style.width, [data-elapsed].textContent,   ║
║                        playpause.textContent = "⏸" | "▶"                      ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   #vp-slot-lt  =  right:14px; bottom:70px; width:320px   (corner card)        ║
║                                                                               ║
║                                       ┌──────────────────────────────┐        ║
║                                       │ ┌────┐  Voice-Over: Intro    │        ║
║                                       │ │photo│ & Einordnung         │        ║
║                                       │ └──🎙─┘ von Coach-Stimme     │        ║
║                                       │         ● SPIELT             │        ║
║                                       │                              │        ║
║                                       │ ▬▬▬▬▬▬▬───────────────────── │        ║
║                                       │ 0:22                    1:59 │        ║
║                                       │                              │        ║
║                                       │ ┌────┐┌──┐┌────┐┌──────────┐ │        ║
║                                       │ │−10s││ ▶││+10s││ ⏭ Skip   │ │        ║
║                                       │ └────┘└──┘└────┘└──────────┘ │        ║
║                                       └──────────────────────────────┘        ║
║                                          ▲ 320px, dark teal T tokens         ║
║                                                                               ║
║   USER_FLOW: cue fires → a compact card appears in the corner, picture clear   ║
║   VALUE_ADD: matches the reference player's composition; the speaker has a     ║
║              face; Skip is a labelled action, not an unlabelled glyph;         ║
║              the video stays visible                                          ║
║   DATA_FLOW: renderAudio() → slotLowerThird.innerHTML (vertical stack)        ║
║              avatar: resolveAssetUrl(a.avatar, assets) → <img>, else initials ║
║              hot path: [data-fill].style.width, [data-elapsed].textContent,   ║
║                        card.dataset.playing = "1" | "0"   ◄── attribute, not  ║
║                                                               textContent     ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location            | Before                             | After                                                           | User_Action  | Impact                                                      |
| ------------------- | ---------------------------------- | --------------------------------------------------------------- | ------------ | ----------------------------------------------------------- |
| `#vp-slot-lt`       | Band across the full player width  | 320px card, bottom-right corner                                 | Cue fires    | Video stays visible                                         |
| Speaker identity    | `FH` initials, hardcoded in markup | Photo from `audios[].avatar`, initials from `voice` as fallback | Cue fires    | The speaker is recognisable; works for any configured voice |
| Skip control        | `⏭` glyph, label only in `title`  | `⏭` + visible label from `demo.audio.skip`                     | Hover / read | The destructive-ish action is legible without hovering      |
| Transport glyphs    | Emoji `▶ ⏸ ⏭` (font-dependent)    | Inline SVG                                                      | —            | Consistent rendering across platforms                       |
| Progress row        | `0:22 ▬▬▬ 1:59` on one line        | Bar on its own line, `0:22 … 1:59` beneath                      | —            | Matches the reference player                                |
| Play/pause hot path | `textContent` write ~4×/s          | `dataset.playing` flip ~4×/s                                    | Playback     | Cheaper write on the per-`timeupdate` path                  |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File                                                 | Lines        | Why Read This                                                          |
| -------- | ---------------------------------------------------- | ------------ | ---------------------------------------------------------------------- |
| P0       | `components/video-player/overlays/audio-overlay.tsx` | 154-235      | The composition being ported — the JSX to translate, NOT the palette   |
| P0       | `runtime-src/demo-overlays/index.ts`                 | 880-975      | `renderAudio` — the fast path, the markup, and the four button wirings |
| P0       | `runtime-src/demo-overlays/index.ts`                 | 358-374      | The `makeSlot` calls — `slotLowerThird`'s `posCss` is what moves       |
| P0       | `runtime-src/demo-overlays/styles.ts`                | 6-18         | The `T` token table — the ONLY source of colour                        |
| P1       | `runtime-src/common/assets.ts`                       | 77-110       | `resolveAssetUrl` — reused verbatim for `avatar`                       |
| P1       | `runtime-src/common/types.ts`                        | 32-46        | The `Audio` interface and the `asset` field's doc comment to mirror    |
| P1       | `runtime-src/common/i18n/demo.ts`                    | 29-35, 72-78 | The existing `demo.audio.*` keys, both locales                         |
| P1       | `runtime-src/demo-overlays/quiz.ts`                  | 130-155      | `createElementNS` SVG construction — the repo's SVG precedent          |
| P2       | `runtime-src/common/runtime-url.ts`                  | 20-30        | `getRuntimeBaseUrl` — returns a trailing-slash URL, or `""`            |
| P2       | `runtime-src/tests/demo-overlays/audio.test.ts`      | 1-155        | The harness every render assertion extends                             |
| P2       | `runtime-src/tests/common/no-bare-strings.test.ts`   | all          | The test that fails if any visible string bypasses the catalogue       |

**External Documentation:**

| Source                                                                          | Section                  | Why Needed                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [happy-dom #1416](https://github.com/capricorn86/happy-dom/issues/1416)         | Maintainer reply         | `getBoundingClientRect`/`offsetHeight`/`clientHeight` are unconditionally 0 by design ("full rendering is out of scope"); `getComputedStyle` resolves the cascade but not layout. This plan is mostly visual, so it is the citation for why Level 5 is the real gate and Task 8 forbids geometry assertions |
| [CSS Flexbox 1](https://drafts.csswg.org/css-flexbox-1/#flex-items)             | §4 Flex Items            | A whitespace-only text run in a flex container is "not rendered"; block wrappers are not. The new composition adds block wrappers, which is why Task 0 gates on the dependency plan's reset                                                                                                                 |
| [CSS Text 3](https://drafts.csswg.org/css-text-3/#valdef-white-space-pre-wrap)  | `white-space: pre-wrap`  | The inherited host value the reset counteracts                                                                                                                                                                                                                                                              |
| [WebKit Blog](https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/) | Auto-play policy changes | "change the source of the media element instead of creating multiple media elements" — the constraint behind the existing one-persistent-`#vp-audio-el` rule this plan must not break                                                                                                                       |
| _Inline SVG in `innerHTML`_                                                     | —                        | No external doc needed: SVG in an HTML fragment is foreign content handled by the HTML parser, and these icons carry no config data. Listed so the Questionable is read as a style call, not an unresearched risk                                                                                           |

---

## Patterns to Mirror

**THE COMPOSITION BEING PORTED (translate the structure, discard the palette):**

```tsx
// SOURCE: components/video-player/overlays/audio-overlay.tsx:156-176
// COPY THIS STRUCTURE:
<div className="flex items-start gap-3">
  <div className="relative">
    <img
      src="/frederik.webp"
      alt="Voice-Over"
      className="h-13 w-13 rounded-full border-3 border-orange-400 shadow-lg"
    />
    <div className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-orange-500 to-amber-500">
      <Mic2 className="h-3 w-3 text-white" />
    </div>
  </div>
  <div className="flex-1">
    <h3 className="text-base font-bold text-white">{title}</h3>
    <p className="text-xs text-orange-100/70">by Dr. Frederik Hümmeke</p>
    <div className="mt-1 flex items-center gap-1.5">
      <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
      <span className="text-xs text-orange-100/50">
        {displayIsPlaying ? "Playing" : "Paused"}
      </span>
    </div>
  </div>
</div>
```

```tsx
// SOURCE: components/video-player/overlays/audio-overlay.tsx:180-191
// COPY THIS STRUCTURE (bar ABOVE the time row — this is the ordering change):
<div className="space-y-2">
  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
    <div
      className="h-full rounded-full bg-gradient-to-r ..."
      style={{ width: `${progress}%` }}
    />
  </div>
  <div className="flex justify-between text-xs font-medium text-orange-100/60">
    <span>{formatTime(displayCurrentTime)}</span>
    <span>{formatTime(displayDuration)}</span>
  </div>
</div>
```

**THE MARKUP IDIOM TO KEEP (esc() on every interpolation, T tokens for colour):**

```typescript
// SOURCE: runtime-src/demo-overlays/index.ts:913-940
// COPY THIS PATTERN:
      slotLowerThird.innerHTML = `
      <div class="vp-anim-bottom" style="... background:linear-gradient(135deg, rgba(50,51,51,.94), rgba(22,79,73,.92)); border:1px solid rgba(0,225,165,.38); ...">
        ...
          <div style="font:700 13.5px system-ui;color:#f4f7f6; overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(active.title)}</div>
          <span style="...">${esc(tr("demo.audio.by", { voice: active.voice }))}</span>
```

**OPTIONAL_ASSET_FIELD (the doc-comment shape to mirror for `avatar`):**

```typescript
// SOURCE: runtime-src/common/types.ts:39-45
// COPY THIS PATTERN:
  // Reference to the voice-over uploaded as an asset of the LearningSuite
  // custom-code block. Either the `{{asset:…}}` placeholder the code editor
  // hands out (the platform expands it to a signed URL at render time) or a key
  // into the config's top-level `assets` table. Optional: without it — or when
  // it cannot be resolved — the overlay falls back to speaking `script` via
  // SpeechSynthesis. See ./assets.
  asset?: string;
```

**SVG_CONSTRUCTION:**

```typescript
// SOURCE: runtime-src/demo-overlays/quiz.ts:132-150
// COPY THIS PATTERN:
const svgNS = "http://www.w3.org/2000/svg";
const svg = document.createElementNS(svgNS, "svg");
svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
svg.setAttribute("class", "vp-quiz-ring");
svg.setAttribute("aria-hidden", "true");
```

**DIRTY-CHECKED HOT PATH (the fast branch that must survive the rewrite):**

```typescript
// SOURCE: runtime-src/demo-overlays/index.ts:896-910
// COPY THIS PATTERN:
if (slotLowerThird.dataset.activeAudio === active.id) {
  const fill = slotLowerThird.querySelector(
    "[data-fill]",
  ) as HTMLElement | null;
  const tEl = slotLowerThird.querySelector(
    "[data-elapsed]",
  ) as HTMLElement | null;
  const pp = slotLowerThird.querySelector(
    '[data-action="audio-playpause"]',
  ) as HTMLElement | null;
  if (fill) fill.style.width = pct + "%";
  if (tEl) tEl.textContent = fmt(elapsed);
  if (pp) pp.textContent = isPlaying ? "⏸" : "▶";
  return true;
}
```

---

## Files to Change

| File                                              | Action | Justification                                                                                |
| ------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| `runtime-src/common/types.ts`                     | UPDATE | Add optional `avatar?: string` to `Audio`                                                    |
| `runtime-src/common/i18n/demo.ts`                 | UPDATE | Add an avatar `alt` key; keep `demo.audio.skip` (now visible)                                |
| `runtime-src/demo-overlays/styles.ts`             | UPDATE | Add `AUDIO_CSS` for the card, the icon toggle and the SVG sizing                             |
| `runtime-src/demo-overlays/index.ts`              | UPDATE | Reposition `slotLowerThird`; rewrite `renderAudio`; resolve the avatar; convert the hot path |
| `runtime-src/tests/demo-overlays/audio.test.ts`   | UPDATE | Avatar resolution, initials fallback, icon toggle, Skip label                                |
| `runtime-src/tests/common/locale-surface.test.ts` | UPDATE | Register the new catalogue key if the test enumerates keys                                   |
| `public/runtime/demo-overlays.js`                 | UPDATE | GENERATED — committed, CI drift-checks it                                                    |
| `docs/feature-context.md`                         | UPDATE | Record the composition decision and the avatar-field design                                  |

---

## NOT Building (Scope Limits)

- **`main`'s orange-amber palette.** Explicitly rejected by the user in favour of the dark tokens, consistent with `docs/feature-context.md:305` (2026-08-04: dark palette → "port to current standard"). Colour comes from `T` only; no second token set.
- **Porting `main`'s uncontrolled/controlled dual mode.** `audio-overlay.tsx` supports a local-state mode with its own `<audio>` element and an `autoPlay` prop. The runtime has one `AudioController` and one persistent `#vp-audio-el`; that architecture stays.
- **A `Skip` that dismisses without resuming.** `main`'s `onDismiss` is optional and the button only renders when supplied. The runtime's `skip()` calls `end({resume:true})`; unchanged.
- **Bundling a default avatar image.** If `avatar` is absent, the fallback is initials — not a shipped photo. Adding `public/frederik.webp` to the bundle path is a separate call (see Questionables).
- **Changing `dur` semantics.** `dur` sizes the progress bar; real playback time wins in file mode (`feature-context.md` 2026-07-27). Unchanged.
- **The playback gate and the white-space reset.** Those are the dependency plan's work.
- **Moving the meta pill.** It keeps `slotBR`; `clearMetaPill()` already runs while a cue is active, so the shared corner is not a conflict.

---

## Step-by-Step Tasks

Execute in order. Each task is atomic and independently verifiable.

**Status markers** — prefix EVERY task header with one; the build agent updates it inline as it works: `[ ]` idle · `[wip]` in progress · `[x]` complete · `[f]` failed. All tasks start `[ ]`. If a task cannot be made to pass, mark it `[f]`, record why in Agent Notes, and move on if the rest of the plan can still proceed.

### `[x]` Task 0: VERIFY the dependency plan has landed

- **ACTION**: CONFIRM the `.vp-slot` white-space reset is in place
- **IMPLEMENT**: check that `SLOT_CSS` exists in `demo-overlays/styles.ts`, that `makeSlot` sets `className = "vp-slot"`, and that `"vp-slot-style"` is in `OWNED_NODE_IDS`
- **GOTCHA**: without the reset, this card's block wrappers inherit the host's `white-space: pre-wrap` and inflate exactly as the banner did — measured 200px against a 62px design. `main`'s composition has MORE block wrappers than the current banner (the `space-y-4` stack, the `flex-1` title column, the `space-y-2` progress group), so it is strictly more exposed. Do not start this plan first.
- **VALIDATE**: `grep -q "SLOT_CSS" runtime-src/demo-overlays/styles.ts && grep -q 'vp-slot"' runtime-src/demo-overlays/index.ts && echo "dependency present"`

### `[x]` Task 1: UPDATE `runtime-src/common/types.ts`

- **ACTION**: ADD an optional `avatar` field to the `Audio` interface
- **IMPLEMENT**: `avatar?: string;` accepting the same two shapes as `asset` (an expanded absolute `https://` URL, or a key into the top-level `assets` table), with a doc comment stating that an absent or unresolvable value falls back to initials derived from `voice`
- **MIRROR**: `runtime-src/common/types.ts:39-45` — the `asset` field's doc-comment shape and its "Optional: without it — or when it cannot be resolved — …" phrasing
- **GOTCHA**: do NOT add a validation library. `parseVpConfig` is deliberately lenient and zod is banned from the runtime bundle (Standing Constraint, `feature-context.md:21-23`).
- **GOTCHA**: config is untrusted input — the resolved URL must reach `innerHTML` through `esc()` like every other interpolation (Standing Constraint, `feature-context.md:24-26`).
- **VALIDATE**: `bun run typecheck:runtime`

### `[x]` Task 2: UPDATE `runtime-src/common/i18n/demo.ts`

- **ACTION**: ADD the avatar `alt` string in both locales
- **IMPLEMENT**: a `demo.audio.avatarAlt` key — `en`: `"Voice-over speaker"`, `de`: `"Stimme des Voice-Overs"` (match the house vocabulary, `feature-context.md:593-598`)
- **MIRROR**: `runtime-src/common/i18n/demo.ts:29-35` (en) and `:72-78` (de) — the existing `demo.audio.*` block in both locales
- **GOTCHA**: `en` is the completeness reference — the key union is `keyof typeof EN` and `de` is annotated `Record<Key, string>`, so a missing `de` translation is a `typecheck:runtime` error. Never build a locale with `{ ...EN, ...overrides }` (`feature-context.md:555-560`).
- **GOTCHA**: the key must NOT end in `Html` — only `admin.*` keys carry markup and skip `esc()`. A non-`Html` key containing `<`, `>` or `&` fails `tests/common/i18n.test.ts` (`feature-context.md:579-584`).
- **GOTCHA**: import the lookup as `tr`, never `t` — `t` is the playback-time variable throughout `runtime-src` (`feature-context.md:576-578`).
- **VALIDATE**: `bun run typecheck:runtime && bun run test runtime-src/tests/common/i18n.test.ts runtime-src/tests/common/locale-surface.test.ts`

### `[x]` Task 3: UPDATE `runtime-src/demo-overlays/styles.ts`

- **ACTION**: ADD an `AUDIO_CSS` export for the card
- **IMPLEMENT**: class-based rules for the card shell, the avatar and its mic badge, the progress group, the transport row, and — critically — the icon toggle: `.vp-audio-card[data-playing="1"] .vp-audio-icon-play { display:none }` and the mirrored rule for `data-playing="0"` hiding the pause icon. Size the inline SVGs here rather than per-element.
- **MIRROR**: `runtime-src/demo-overlays/styles.ts:80-158` (`QUIZ_CSS`) — the `.vp-*` class-naming and the `[data-*]` state-selector idiom (`.vp-quiz-option[data-state="correct"]`, `.vp-quiz-card[data-vp-quiz-mode="feedback"]`)
- **PATTERN**: colour ONLY from the `T` tokens (`styles.ts:6-18`); every literal must trace to a `// --var` comment there
- **GOTCHA**: inject `AUDIO_CSS` with the remove-then-append **plus `onCleanup`** idiom (`index.ts:1008-1015`, the `QUIZ_CSS` variant), not the inject-once one — it is mount-scoped like the quiz stylesheet. Register its id in `OWNED_NODE_IDS` (`index.ts:113-125`).
- **GOTCHA**: `.vp-slot *` from the dependency plan has specificity `0,1,0`. Any `white-space` this file sets on a card descendant must exceed that or come later in `document.head`; `AUDIO_CSS` is injected after `SLOT_CSS`, so a two-class selector is safest for the title/byline truncation.
- **VALIDATE**: `bun run typecheck:runtime`

### `[x]` Task 4: UPDATE `runtime-src/demo-overlays/index.ts` — reposition the slot

- **ACTION**: CHANGE `slotLowerThird`'s positioning to a 320px bottom-right box
- **IMPLEMENT**: replace `"left:14px; right:14px; bottom:70px;"` with `"right:14px; bottom:70px; width:320px;"`
- **MIRROR**: `runtime-src/demo-overlays/index.ts:362` — `slotBR`'s `"bottom:70px; right:14px;"`, the corner anchoring to match
- **GOTCHA**: keep the id `vp-slot-lt`. The e2e canary asserts `#vp-slot-*` by id and `checkAlive` asserts `slotLowerThird.isConnected` (`index.ts:1455`); renaming breaks both. The id becoming a slight misnomer is acceptable — note it in the code comment.
- **GOTCHA**: this now overlaps `slotBR` (same corner, both `z-index:8`). Safe because `recomputeActive`'s `else if (showAudio && audioCtrl.isActive())` branch calls `clearMetaPill()` (`index.ts:1403`) — but that invariant is now load-bearing for layout, not just tidiness. Do not remove that call.
- **GOTCHA**: a fixed `width:320px` can exceed a narrow player. Add a `max-width` clamp against the host box; `SECTION_CSS:33` has the precedent (`max-width:min(384px, calc(100% - 28px))`).
- **VALIDATE**: `bun run test runtime-src/tests/demo-overlays/`

### `[x]` Task 5: UPDATE `runtime-src/demo-overlays/index.ts` — resolve the avatar

- **ACTION**: ADD avatar resolution beside the existing audio-asset resolution
- **IMPLEMENT**: a helper that runs `resolveAssetUrl(a.avatar, assets)` and returns either a URL or `""`, plus an initials helper deriving up to two uppercase letters from `voice` (`"Coach-Stimme"` → `"CS"`, `"Dr. Frederik Hümmeke"` → `"DF"`). Render an `<img>` when a URL resolved, the initials circle otherwise.
- **MIRROR**: `runtime-src/demo-overlays/index.ts:588-600` (`resolveAudioUrl`) — the same `resolveAssetUrl` call shape; and `:915-917` for the existing initials-circle markup to keep as the fallback
- **IMPORTS**: `resolveAssetUrl` is already imported for the audio path — reuse it
- **GOTCHA — DO NOT REPORT AVATAR FAILURES AS AUDIO FAILURES.** `resolveAudioUrl` fires `reportFailure(errorType)` with one of the three `audio-asset-*` beacon types (`index.ts:42-63`). A missing avatar is cosmetic: fall back to initials **silently**, with at most a `console.warn`. Sending an `audio-asset-missing` beacon for a missing picture would corrupt the operator signal whose whole point is "no cue on this page will find its audio" (`feature-context.md` 2026-09-01).
- **GOTCHA**: initials must be derived defensively — `voice` is untrusted config and may be empty, a single word, or punctuation. Render the initials via `esc()` like any other config value.
- **GOTCHA**: an `<img>` from our own origin needs no `crossorigin`; do not copy the audio element's deliberate no-`crossorigin` comment as if it were about images.
- **VALIDATE**: `bun run typecheck:runtime && bun run test runtime-src/tests/demo-overlays/audio.test.ts`

### `[x]` Task 6: UPDATE `runtime-src/demo-overlays/index.ts` — rewrite the markup

- **ACTION**: REPLACE `renderAudio`'s full-render markup with the vertical composition
- **IMPLEMENT**: the stack from the After-State diagram — header row (avatar + mic badge / title / byline / pulsing status dot), progress group (bar above, `elapsed … duration` beneath), transport row (`−10s`, play/pause, `+10s`, `⏭ Skip` with a visible label). Both play and pause SVGs present in the DOM at once, selected by `data-playing` on the card. Keep every `data-*` hook the wiring and the fast path depend on: `[data-fill]`, `[data-elapsed]`, `[data-action="audio-back"|"audio-playpause"|"audio-fwd"|"audio-skip"]`.
- **MIRROR**: `components/video-player/overlays/audio-overlay.tsx:154-235` for the composition; `runtime-src/demo-overlays/index.ts:913-940` for the escaping and token idiom
- **GOTCHA — EVERY VISIBLE STRING THROUGH `tr()`.** `tests/common/no-bare-strings.test.ts` and `tests/common/locale-surface.test.ts` both fail on a hardcoded UI string (`feature-context.md:85-91`). The newly visible Skip label uses the existing `demo.audio.skip`.
- **GOTCHA — GERMAN LABEL LENGTH IS A LAYOUT CONSTRAINT.** `demo.audio.skip` is `"Skip"` in `en` but `"Überspringen"` in `de` — 12 characters in a 320px card alongside three other buttons. `main`'s design gives Skip `flex-1`. Verify the `de` locale at 320px specifically; if it breaks, prefer truncation with the full string in `title` over shortening the catalogue entry. `feature-context.md:596-598` records the same class of problem for the player controls, where the fix was short visible labels plus the precise term in the aria label.
- **GOTCHA**: keep `esc()` on every `${...}` — the upstream spike file had no escaping at all, so copying its lines verbatim reintroduces the XSS the hardening pass closed (`feature-context.md:115-117`, and the `esc()` count note in commit `51b1c77`).
- **GOTCHA**: `main` hardcodes `by Dr. Frederik Hümmeke`. The runtime must keep `tr("demo.audio.by", { voice: active.voice })` — the live tenant's config says `"Coach-Stimme"`.
- **VALIDATE**: `bun run typecheck:runtime && bun run test runtime-src/tests/demo-overlays/`

### `[x]` Task 7: UPDATE `runtime-src/demo-overlays/index.ts` — convert the hot path

- **ACTION**: CHANGE the fast-update branch's play/pause write from `textContent` to an attribute flip
- **IMPLEMENT**: replace `pp.textContent = isPlaying ? "⏸" : "▶"` with a `data-playing` write on the card element (`"1"` / `"0"`), read back by the `AUDIO_CSS` rules from Task 3. Keep the `[data-fill]` width and `[data-elapsed]` text writes as they are.
- **MIRROR**: `runtime-src/demo-overlays/index.ts:896-910` — the existing fast branch, including its `?? null` guards and early `return true`
- **GOTCHA — THIS IS THE PERFORMANCE-CRITICAL SURFACE.** The branch runs on every `timeupdate` (~4×/s). `feature-context.md:97-102` names this path explicitly and `renderSection` is cited as the reference for dirty-checked rendering. A `textContent` write cannot swap an SVG, and re-rendering the whole card per tick would be a serious regression — the attribute flip is both correct and cheaper than what is there now.
- **GOTCHA**: the full-render path must set `data-playing` too, not just the fast path, or the first frame after a cue change shows the wrong icon.
- **GOTCHA**: `aria`/`title` on the play/pause button must still reflect state — keep using `demo.audio.playPause` and do not let the CSS-only icon swap leave assistive tech reading a stale label.
- **VALIDATE**: `bun run test runtime-src/tests/demo-overlays/audio.test.ts`

### `[x]` Task 8: UPDATE `runtime-src/tests/demo-overlays/audio.test.ts`

- **ACTION**: ADD cases for the new composition
- **IMPLEMENT**: (1) with `avatar` set to an expanded `https://` URL, the card renders an `<img>` with that `src`; (2) with `avatar` absent, it renders initials derived from `voice`; (3) with `avatar` set to an unresolvable value, it falls back to initials and fires **no** `audio-asset-*` beacon; (4) `data-playing` flips `"1"` → `"0"` across `togglePlay()` and the fast path does not rebuild the card (assert the same node identity via a marker property or `dataset.activeAudio` continuity); (5) the Skip button carries the visible `demo.audio.skip` label; (6) all four `data-action` hooks still respond.
- **MIRROR**: `runtime-src/tests/demo-overlays/audio.test.ts:99-117` (`mountAndTrigger`) and the existing asset-failure cases around `:276-360` for the beacon-assertion style
- **GOTCHA**: case 3 must assert the **absence** of a beacon. An absence assertion on a spy that was never armed passes vacuously — arm the spy and assert call count zero (the paired-assertion discipline from `feature-context.md:345-348`).
- **GOTCHA**: happy-dom never fires `timeupdate`/`ended` — dispatch them by hand for case 4.
- **GOTCHA**: do not assert geometry. `getBoundingClientRect()` returns `0` in happy-dom even for explicit heights; the 320px card width is a Level 5 check, not a unit check.
- **VALIDATE**: `bun run test runtime-src/tests/demo-overlays/audio.test.ts`

### `[x]` Task 9: UPDATE `public/runtime/demo-overlays.js` (generated)

- **ACTION**: REBUILD the committed runtime bundles
- **IMPLEMENT**: run `bun run build:runtime` and stage the regenerated `public/runtime/*.js`
- **PATTERN**: never hand-edit — esbuild output (Standing Constraint, `feature-context.md:12-23`)
- **GOTCHA**: CI drift-checks with `git diff --exit-code -- public/runtime`.
- **VALIDATE**: `bun run build:runtime && git diff --exit-code -- public/runtime && echo "no drift"`

### `[x]` Task 10: UPDATE `docs/feature-context.md`

- **ACTION**: ADD an entry recording the composition and avatar decisions
- **IMPLEMENT**: a dated section carrying: the user's choice of `main`'s composition in the dark palette (and that the orange was explicitly rejected, reinforcing 2026-08-04); that `slotLowerThird` was repositioned rather than sharing `slotBR`, and that `clearMetaPill()` is now load-bearing for layout; the `avatar` field design and the decision that avatar failures are silent while audio failures beacon; and the `data-playing` hot-path conversion with its rationale.
- **MIRROR**: `docs/feature-context.md:384-433` (the `audio-assets` entry) — the Decision / Gotcha vocabulary and its level of detail
- **VALIDATE**: `grep -q "data-playing" docs/feature-context.md && echo ok`

---

## Testing Strategy

### Unit Tests to Write

| Test File                                          | Test Cases                                                                                                                                              | Validates                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `runtime-src/tests/demo-overlays/audio.test.ts`    | avatar from URL; initials fallback; unresolvable avatar is silent; `data-playing` toggle without rebuild; visible Skip label; four transport hooks live | the new composition and the avatar contract |
| `runtime-src/tests/common/i18n.test.ts`            | the new key exists in both locales and carries no markup                                                                                                | catalogue completeness                      |
| `runtime-src/tests/common/no-bare-strings.test.ts` | passes unchanged                                                                                                                                        | no hardcoded UI string slipped in           |

### Edge Cases Checklist

- [ ] `avatar` absent → initials from `voice`
- [ ] `avatar` present but unexpanded `{{asset:…}}` → initials, no beacon
- [ ] `avatar` an `http:` or `javascript:` value → rejected by `resolveAssetUrl`, initials, no beacon
- [ ] `voice` empty string → initials helper does not throw, renders something sane
- [ ] `voice` a single word → one initial
- [ ] `voice` containing markup → escaped, not parsed
- [ ] `de` locale at exactly 320px → Skip label fits or truncates cleanly
- [ ] Narrow player (< 360px) → the `max-width` clamp keeps the card inside the host box
- [ ] Cue change mid-lesson → full re-render sets `data-playing` correctly on the first frame
- [ ] Meta pill and the card never visible simultaneously (shared corner)
- [ ] Long title → truncates with an ellipsis, does not wrap the card taller
- [ ] TTS-mode cue (no `asset`) → the card renders identically; only the clock source differs

---

## Validation Commands

🔁 **Validation loop:** the plan is not complete until every command below passes (exit 0). On any failure, fix the cause and re-run — loop until all pass. If a check is genuinely impossible, mark it `[f]`, note why in Agent Notes, and move on.

### Level 1: STATIC_ANALYSIS

```bash
bun run typecheck:runtime
rm -rf .next/cache/eslint && bun run lint
```

**EXPECT**: `typecheck:runtime` exits 0. `bun run lint` already exits 1 on this branch (7 pre-existing errors, `feature-context.md:320-324`) — require **no new** findings in `runtime-src/`.

### Level 2: UNIT_TESTS

```bash
bun run test runtime-src/tests/demo-overlays/ runtime-src/tests/common/
```

**EXPECT**: all pass, including `no-bare-strings` and `locale-surface`.

### Level 3: FULL_SUITE

```bash
bun run test
bun run build:runtime && git diff --exit-code -- public/runtime
```

**EXPECT**: full suite green, no `public/runtime` drift. `bun run test`, never `bun test` (`feature-context.md:349-351`).

### Level 4: DATABASE_VALIDATION

Not applicable.

### Level 5: BROWSER_VALIDATION

This plan is mostly visual, so Level 5 is the real gate — happy-dom cannot assert layout at all.

- [ ] Start the debug Chrome, log into `robbins.greator.com`, open the preview lesson, point it at the local runtime (`bun dev` + local-first loader probe)
- [ ] Card renders bottom-right at 320px: `document.querySelector('#vp-slot-lt > *').getBoundingClientRect()`
- [ ] Card height is the design height, NOT inflated — confirms the dependency plan's reset covers the new block wrappers
- [ ] Avatar photo renders when `avatar` is configured; initials when it is not
- [ ] Mic badge sits on the avatar's bottom-right corner
- [ ] Play/pause icon swaps on click and during playback, with no card rebuild flicker
- [ ] Skip shows its label; check the `de` locale explicitly (`window.__vpLocale = "de"`, reload)
- [ ] Meta pill never overlaps the card
- [ ] Resize the player narrow → the card clamps inside the host box
- [ ] `bun run e2e` still passes 4/4 (canary asserts `#vp-slot-*` by id)

### Level 6: MANUAL_VALIDATION

1. Side-by-side the result against `docs/voice-over-main.png` — composition should match; colour should not.
2. Configure two cues, one with `avatar`, one without — confirm both render correctly in sequence.
3. Watch a full cue through to its end — confirm the progress bar tracks and the card disappears cleanly.
4. Switch to `de` and repeat step 3, watching the transport row specifically.

---

## Acceptance Criteria

- [ ] The card matches `main`'s composition: 320px bottom-right, photo avatar with mic badge, title/byline/status stack, bar above the time row, four-button transport with a labelled Skip
- [ ] Colour comes exclusively from the `T` tokens — no orange anywhere
- [ ] `avatar` resolves through `resolveAssetUrl` and falls back to initials from `voice`
- [ ] An unresolvable avatar fires no `audio-asset-*` beacon
- [ ] The play/pause hot path is an attribute flip, not a `textContent` write, and does not rebuild the card
- [ ] Every visible string comes from `runtime-src/common/i18n/demo.ts`
- [ ] The `de` locale renders correctly at 320px
- [ ] Level 1–3 pass; Level 5 visually confirmed on the live tenant
- [ ] No regressions in `runtime-src/tests/`
- [ ] No `public/runtime` drift

---

## Completion Checklist

- [ ] Task 0 confirmed the dependency plan landed
- [ ] All 10 implementation tasks completed in dependency order
- [ ] Level 1: typecheck clean, no new lint findings in `runtime-src/`
- [ ] Level 2: `demo-overlays` + `common` tests pass
- [ ] Level 3: full suite + no drift
- [ ] Level 5: browser validation complete in BOTH locales
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk                                                                                  | Likelihood | Impact | Mitigation                                                                                                                                                              |
| ------------------------------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Started before the dependency plan; the new card inflates under the host's `pre-wrap` | MED        | HIGH   | Task 0 is a hard gate. The new composition has more block wrappers than the current banner, so it is strictly more exposed.                                             |
| `"Überspringen"` breaks the 320px transport row                                       | MED        | MED    | Explicit `de` check in Level 5. Prefer truncation with the full string in `title` over editing the catalogue.                                                           |
| Hot-path conversion regresses playback smoothness                                     | LOW        | MED    | Attribute flip is cheaper than the current text write; Task 8 case 4 pins "no rebuild".                                                                                 |
| Avatar failure pollutes the audio-asset beacon signal                                 | MED        | MED    | Called out as a GOTCHA in Task 5 with a dedicated silent-fallback test in Task 8 case 3.                                                                                |
| 320px card overlaps the meta pill in the shared corner                                | LOW        | LOW    | `clearMetaPill()` already runs while a cue is active; now load-bearing and recorded in `feature-context.md`.                                                            |
| Config authors have no way to discover the new `avatar` field                         | HIGH       | MED    | Out of scope here, but `admin-toggle/prompt.ts` carries the schema for the LLM authoring flow (`feature-context.md` 2026-09-01). Left as an open thread in Agent Notes. |

---

## Questionables

<details>
<summary>Should a default avatar image ship with the bundle?</summary>

Took "no" — absent `avatar` means initials. `main` hardcodes `/frederik.webp`, but that only worked because `main` was a single-speaker demo; the runtime renders whatever `voice` the config names, and the live tenant says `"Coach-Stimme"`, so a bundled Frederik photo would be actively wrong there. `runtimeBaseUrl` is in scope at `index.ts:29` if a default is wanted later — note it returns a trailing-slash URL, or `""` when the script URL is unknown, so the caller must guard.

</details>

<details>
<summary>Inline SVG in an `innerHTML` template, or `createElementNS`?</summary>

Assumed inline SVG inside the existing template literal, because `renderAudio` is one `innerHTML` assignment and splitting half of it into imperative construction would make it harder to read, not safer — the icons carry no config data, so there is no escaping concern. The repo's only SVG precedent (`quiz.ts:132-150`) uses `createElementNS`, but that file is imperative throughout by design. Flagged because it is a style call a reviewer may want the other way.

</details>

<details>
<summary>Is `#vp-slot-lt` the right id for a corner card?</summary>

Kept it. "lt" reads as "lower third", which the element stops being. Renaming would break the e2e canary's id assertions and `checkAlive`, for a cosmetic gain — so the id stays and a code comment explains the misnomer. Worth revisiting only if the slots are ever renamed wholesale.

</details>

<details>
<summary>How does a config author learn that `avatar` exists?</summary>

Unresolved and deliberately out of scope. The authoring surface is `admin-toggle/prompt.ts`, which carries the JSON schema handed to the LLM; `avatar` will not appear in authored configs until that prompt mentions it. Everything degrades to initials until then, so this is a discoverability gap, not a defect. Raised so it is a decision rather than an oversight.

</details>

---

## Agent Notes

**Branch decision (user, this session).** Lands on `feature/e2e-canary-playwright` alongside the canary work and the defects plan, per the user's instruction to keep everything in one PR. Noted here because it means this redesign cannot be reverted independently of the two bugfixes — if the composition turns out wrong, the revert also backs out the pre-wrap reset and the playback gate. Sequencing the defects plan first at least keeps the two concerns in separate commits.

**This is not a regression, and the plan should not be read as restoring anything.** Worth stating because the framing that started this work was "the design changed from main to the spike branch". It did not. `main`'s `audio-overlay.tsx` and the runtime's `renderAudio` are two separate implementations that never matched: the runtime banner has been a full-width lower third since the hand-written `public/runtime/demo-overlays.js`, whose own section comment says so (`git show 80dfb0d~1:public/runtime/demo-overlays.js`, line ~538). The only thing that ever changed was the palette, in `51b1c77`, which was itself the recorded response to user feedback. What made the spike screenshot look broken was the `white-space` defect — a bug, fixed by the dependency plan — not the composition. This plan is a deliberate new design decision, taken with that clarified.

**Why the palette is not part of the port.** The user chose `main`'s composition and explicitly rejected its orange. That is consistent rather than arbitrary: `docs/feature-context.md:305` records the 2026-08-04 instruction to "port to current standard", and the section pill, science pill, meta pill, quiz card and sidebar are all dark teal. An orange voice-over card would be the only warm surface in the player.

**The hot path is the sharpest constraint in this plan.** `renderAudio`'s fast branch (`index.ts:896-910`) runs on every `timeupdate`, roughly four times a second, and `feature-context.md:97-102` names that path as the performance-critical surface for the whole injected runtime, with `renderSection` cited as the dirty-checking reference. The existing branch writes `pp.textContent`, which cannot swap an inline SVG. The naive fixes are both bad: re-rendering the card per tick throws away the dirty check, and swapping `innerHTML` on the button per tick is barely better. Putting both icons in the DOM and flipping one attribute is the only option that is simultaneously correct for SVG and cheaper than the code it replaces. This is the one place in the plan where a "simpler" implementation is measurably worse.

**Avatar failures must not share the audio beacon.** The three `audio-asset-*` errorTypes exist specifically because they have different operator fixes, and `unexpanded` is described in `feature-context.md` as the highest-signal one — it means the whole block is misconfigured and no cue on the page will find its audio. Routing a missing _picture_ through that machinery would make the loudest operator alarm in the system fire for a cosmetic problem. Hence silent fallback, and hence a test that asserts the beacon is _not_ sent.

**What `main` has that is deliberately not being ported.** `audio-overlay.tsx` is a dual-mode component: controlled via `onPlayPause`/`currentTime`/`duration` props, or uncontrolled with its own `<audio>`, local state and an `autoPlay` effect whose catch block logs `"Autoplay blocked - user interaction required"`. The runtime has exactly one `AudioController` and one persistent `#vp-audio-el` created per mount with its listeners wired once (`feature-context.md` 2026-07-27 — creating them inside `activate()` stacks an element per cue). None of that dual-mode machinery crosses over; only the visual structure does.

**Open thread: authoring discoverability.** `avatar` is inert until `admin-toggle/prompt.ts` teaches the LLM authoring flow about it, and that file is deliberately untranslated model-instruction text, not UI. Adding the field there is a small, separate change — worth doing, but it belongs with whoever next touches the prompt schema rather than bolted onto a visual redesign.

**Reference material.** `docs/voice-over-main.png` and `docs/voice-over-spike.png` are the user's own screenshots of the two designs and are the visual acceptance reference for Level 6 step 1. Both are currently untracked in git.

---

## Amendments

<details>
<summary>2026-09-04 — Implemented. One planned test could not be written as specified.</summary>

All 11 tasks complete. 371 tests pass (demo-overlays 93 → 105), typecheck clean, no new lint
findings in `runtime-src/`, e2e canary still 4/4, bundle rebuilt.

**Both flagged risks came out fine.** The German Skip label fits at 320px with the controls
row measuring `scrollWidth 290 === clientWidth 290` — no overflow, no truncation needed. The
hot-path conversion works: `[data-playing]` drives the icon swap, the card is not rebuilt on a
state flip, and the fast branch now also writes the status label.

**Correction — Task 8 case 3 was unwritable as specified.** It asked for an armed `sendBeacon`
spy asserting zero calls. That test passes even when `reportFailure` IS added to the avatar
path: `report()` early-returns when the runtime origin is unknown, which it always is under
test, so the spy never sees anything. Setting `__vpRuntimeBaseUrl` to make it live arms the
kill-switch fetch, which delays `main()` past `nextFrames()` so nothing mounts at all. Replaced
with an assertion on the two distinguishable `console.warn` messages plus a control case for
the audio path, and verified non-vacuous by making `resolveAvatarUrl` delegate to
`resolveAudioUrl` (test goes red). The plan's own GOTCHA warned about vacuous absence
assertions; the warning was right and the prescribed remedy was still wrong.

**Also:** `vi.stubGlobal` is not undone by `vi.restoreAllMocks()`, so the abandoned beacon
stub leaked a fake `navigator` into the next two tests and broke locale resolution. And the
stale status label — pre-existing, out of scope for the defects plan — was fixed here in one
line since this plan rewrites that markup and adds the hook anyway.

**Level 5 gap.** The `<img>` portrait branch is unit-tested but not browser-verified:
`resolveAssetUrl` requires https, so an `http://localhost` avatar is correctly rejected and the
local harness always shows initials. Worth checking on the tenant with a real `{{asset:…}}`
portrait.

Full record: `.claude/PRPs/reports/2026-09-04_vo-redesign_main-composition-dark-card-report.md`

</details>
