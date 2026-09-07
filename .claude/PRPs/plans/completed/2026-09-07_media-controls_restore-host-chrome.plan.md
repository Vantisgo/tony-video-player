# Feature: Restore LearningSuite's player chrome, augment it

## Summary

The injected runtime replaces LearningSuite's player chrome with a control bar of its own. Two of that bar's controls do not work on the live tenant (mute, subtitles), it does not look like the host's player, and it re-implements four subtitle sources and two menu systems the host already provides. This plan deletes our bar, stops hiding the host's, and keeps exactly one capability the host lacks — the language pack (external dubbed audio + external VTT subtitles) — in a single self-contained control anchored to the player host. The video is silenced for a dub through a Web Audio gain node the host cannot see, rather than through `mediaEl.muted`, which the host reverts.

## User Story

As a learner on a LearningSuite lesson
I want the player's controls to be LearningSuite's own working controls
So that mute, subtitles, speed and fullscreen behave exactly as they do everywhere else on the platform

## Problem Statement

Measured on the live tenant, 2026-09-07, with this working tree's bundles:

1. **Mute is dead.** `el.muted = true` → immediately `true` → after 600 ms `false`. Setting the inner `<video>` directly is reverted the same way. LearningSuite's own mute button works and sticks.
2. **Subtitles never render.** Our menu populates (`Aus / Original (en) / en`) but `.vp-subtitle-layer` stays `hidden` with empty text while the video plays. The host's own player renders subtitles correctly.
3. **The bar does not match.** Seven text labels (`Start`, `Audio`, `CC`, `Ton`, `Voll`) against the host's icon bar with scrubber, speed, captions, settings and fullscreen.

Not a regression: `feature/mm-refactoring` (the user's own branch) is an ancestor of HEAD, and the player diff since its tip is the i18n commit plus one unrelated import removal.

## Solution Statement

Stop replacing the host's chrome; augment it.

- Delete `.vp-controls` and every control, both track menus, and the native/HLS/LearningSuite subtitle and audio option builders. The host owns those again.
- Delete every chrome-hiding rule in `RESKIN_CSS`, including the `media-*` rules, which match nothing on this tenant.
- Keep `attach()` discovery, the bus, `PlayerApi` and `_diag()` — they bind to the media element, not to the chrome.
- Add one language-pack control, rendered only when a pack exists for the video, anchored to the player host rather than injected into the host's markup.
- Silence the video for a dub with a Web Audio `GainNode` at 0. The host watches `.muted`/`.volume`; it has no reference to our `AudioContext`, so there is nothing for it to revert.
- Mirror the host's `volumechange` onto the external audio element, so the host's own mute and volume controls drive the dub.

## Metadata

| Field            | Value                                                                                                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type             | REFACTOR (with one NEW_CAPABILITY: the language-pack control)                                                                                                                           |
| Complexity       | HIGH                                                                                                                                                                                    |
| Systems Affected | `runtime-src/reskin-player/`, `runtime-src/demo-overlays/`, `runtime-src/common/types.ts`, `runtime-src/common/i18n/player.ts`, `runtime-src/tests/`, `e2e/support/`, `public/runtime/` |
| Dependencies     | None added. The runtime bundle carries zero third-party libraries by policy. Test/tooling: vitest 4.1.10, happy-dom 20.11.1, @playwright/test 1.62.1, typescript 5.9.3                  |
| Estimated Tasks  | 16                                                                                                                                                                                      |

---

## Lifecycle (append-only)

- **Created:** 2026-09-07
- **Modified:** 2026-09-07, 2026-09-07 (implemented)
- **Commits:** see the implementation commit on `feature/e2e-canary-playwright`
- **Agent / Session:** Claude Opus 5 (1M context) — planning session 2026-09-07
- **Back refs:** `docs/superpowers/specs/2026-09-07-media-controls-hijack-design.md` — approved design this plan implements
- **Forward refs:** _(none yet)_

> **Append-only:** `Created` is set once; every other field is a list you only ever add to — never overwrite or remove existing entries. Keep references bidirectional: when you add a back/forward ref here, add the reciprocal ref on the other plan.

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐            ║
║   │  Lesson     │ ──────► │  Our bar    │ ──────► │  Mute: dead │            ║
║   │  page       │         │ Start Audio │         │  CC:   dead │            ║
║   │             │         │ CC Ton Voll │         │  0:00/0:00  │            ║
║   └─────────────┘         └─────────────┘         └─────────────┘            ║
║          │                                                                    ║
║          ▼  RESKIN_CSS display:none                                           ║
║   ┌──────────────────────────────┐                                            ║
║   │ LearningSuite's own chrome   │  ◄── present in the DOM, hidden            ║
║   │ scrubber · pause · volume    │      (working, incl. its subtitles)        ║
║   │ 0:51/1:38:57 · 1x · CC · ⛶  │                                            ║
║   └──────────────────────────────┘                                            ║
║                                                                               ║
║   USER_FLOW: learner presses our Start → video plays → presses Ton → nothing  ║
║     happens; opens CC → picks "English" → no subtitles ever appear.           ║
║   PAIN_POINT: two controls silently do nothing; the bar looks nothing like    ║
║     the platform; ~600 lines re-implement what the host already does.         ║
║   DATA_FLOW: mediaEl.muted = true → host React reverts to false in ~600ms.    ║
║     Subtitle menu reads 4 sources; .vp-subtitle-layer renders only 2 of them. ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   ┌─────────────┐         ┌──────────────────┐      ┌─────────────┐          ║
║   │  Lesson     │ ──────► │ LearningSuite's  │ ───► │ Mute: works │          ║
║   │  page       │         │ own chrome       │      │ CC:   works │          ║
║   │             │         │ (no longer hidden)│     │ 0:51/1:38:57│          ║
║   └─────────────┘         └──────────────────┘      └─────────────┘          ║
║                                   │                                           ║
║                                   ▼                                           ║
║                    ┌───────────────────────────┐                              ║
║                    │ LANGUAGE-PACK CONTROL     │ ◄── new; ONLY when the       ║
║                    │  Audio:  Deutsch/English  │     video has a pack         ║
║                    │  Untertitel: Aus/DE/EN    │                              ║
║                    └───────────────────────────┘                              ║
║                                   │ non-native track chosen                   ║
║                                   ▼                                           ║
║                    ┌───────────────────────────┐                              ║
║                    │ GainNode(0) on the video  │ ◄── host cannot see or       ║
║                    │ + external <audio> dub    │     revert this              ║
║                    └───────────────────────────┘                              ║
║                                                                               ║
║   USER_FLOW: learner uses the platform's own controls, which all work. On a   ║
║     lesson with a language pack, one extra control offers dub + subtitles.    ║
║     On a lesson without one, the runtime adds no controls at all.             ║
║   VALUE_ADD: mute and subtitles work; the player is visually the platform's;  ║
║     ~600 lines of rotting re-implementation are gone.                         ║
║   DATA_FLOW: host owns muted/volume → we mirror volumechange onto the dub     ║
║     element → the video's own audio is zeroed in our private audio graph.     ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location                                | Before                                                            | After                                                     | User Impact                                                     |
| --------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------- |
| Player chrome                           | Our 7-label bar; host's hidden                                    | Host's own bar; ours gone                                 | Mute, CC, speed, fullscreen all work; looks like the platform   |
| Mute button                             | Ours; write reverted in 600ms                                     | Host's; writes its own React state                        | Muting actually mutes                                           |
| Subtitles                               | Our menu + our layer; never rendered                              | Host's CC for host tracks; our layer for pack tracks only | Subtitles appear                                                |
| `demo-overlays` play/pause interception | Capture click on `[data-vp="playpause"]` → toggles the voice-over | Removed; `enforceCuePause` re-parks the video             | Play during a cue leaves the video parked (approved 2026-09-07) |
| Space key                               | Toggles the voice-over                                            | Unchanged                                                 | No change — document-level keydown, no DOM dependency           |
| `quiz.ts` control-bar guard             | Swallows click/pointerdown on `.vp-controls`                      | Removed; `.vp-quiz-scrim` already covers the host bar     | No change — measured, the scrim wins `elementFromPoint`         |
| Language pack                           | Audio/CC menus in our bar                                         | One dedicated control, only when a pack exists            | Same capability, no bar required                                |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File                                                                | Lines                                                                     | Why Read This                                                                                       |
| -------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| P0       | `docs/superpowers/specs/2026-09-07-media-controls-hijack-design.md` | all                                                                       | The approved design and its measured evidence                                                       |
| P0       | `runtime-src/reskin-player/index.ts`                                | 219-330, 348-389, 425-437, 463-590, 620-740, 766-889, 960-1090, 1116-1163 | Everything being deleted, kept or re-wired                                                          |
| P0       | `runtime-src/demo-overlays/quiz.ts`                                 | 1-42, 54-74                                                               | `createElement`/`qzEl` pattern the new control MUST follow — never `innerHTML`, never `esc()` there |
| P1       | `runtime-src/common/types.ts`                                       | 149-158, 197-233                                                          | `PlayerApi` (lose `setOverlays`), `LanguagePack`, `TrackOption`                                     |
| P1       | `runtime-src/reskin-player/language-pack.ts`                        | 191-260, 295-379                                                          | `loadLanguagePackForMedia`, `useNative`, `getTrackDiagnostics`                                      |
| P1       | `runtime-src/demo-overlays/index.ts`                                | 389-437, 1542-1580                                                        | `makeSlot` anchoring pattern; `enforceCuePause` capped-re-assertion pattern                         |
| P2       | `runtime-src/tests/demo-overlays/quiz.test.ts`                      | 1-80                                                                      | Controller-harness test pattern for an extracted module                                             |
| P2       | `runtime-src/tests/reskin-player/styles.test.ts`                    | 33-67                                                                     | The chrome-hiding assertions that invert                                                            |
| P2       | `runtime-src/tests/common/locale-surface.test.ts`                   | 379-419                                                                   | Asserts exactly 5 aria-labels and 5 buttons on the shell                                            |
| P2       | `e2e/support/assertions.ts`                                         | 23, 194-281                                                               | `HOST`, `expectReskinMounted`, `expectNativeChromeHidden`                                           |

**External Documentation:**

| Source                                                                                                                                                                                                          | Section                              | Why Needed                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [HTML Standard — media elements](https://html.spec.whatwg.org/multipage/media.html#effective-media-volume)                                                                                                      | effective media volume               | `muted` is checked _before_ `volume`; they are independent state, both firing `volumechange`                                                           |
| [HTML Standard — media resource fetch](https://html.spec.whatwg.org/multipage/media.html#concept-media-load-resource)                                                                                           | "mode is local"                      | An MSE/`blob:` source is a media provider object and is **unconditionally CORS-same-origin** — this is why Web Audio will not silence the hls.js video |
| [Web Audio API — §1.22.4 cross-origin security](https://webaudio.github.io/web-audio-api/#MediaElementAudioSourceOptions-security)                                                                              | MediaElementAudioSourceNode security | A CORS-cross-origin element outputs silence; matters for the dub element, which deliberately has no `crossorigin`                                      |
| [Web Audio API — §1.22](https://webaudio.github.io/web-audio-api/#MediaElementAudioSourceNode)                                                                                                                  | MediaElementAudioSourceNode          | Creating the node alone stops direct output; playback/seek/volume still behave normally                                                                |
| [Apple — iOS-specific considerations](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/Using_HTML5_Audio_Video/Device-SpecificConsiderations/Device-SpecificConsiderations.html) | volume property                      | `volume` is a permanent no-op on iOS; disqualifies `volume = 0` as the sole mechanism                                                                  |
| [Web Audio API — allowed to start](https://webaudio.github.io/web-audio-api/#allowed-to-start)                                                                                                                  | sticky activation                    | `AudioContext.resume()` needs sticky activation, which persists for the document's lifetime once any gesture occurs                                    |

---

## Patterns to Mirror

**SELF_CONTAINED_CONTROL_MODULE** — the shape the new language-pack control must take:

```typescript
// SOURCE: runtime-src/demo-overlays/quiz.ts:23-41
// COPY THIS PATTERN:
export interface QuizControllerDeps {
  quiz: QuizConfig;
  mediaEl: MediaEl;
  playerHost: HTMLElement;
  slot: HTMLElement;
  isAudioActive: () => boolean;
  onCleanup: (fn: () => void) => void;
}
```

**XSS_SAFE_ELEMENT_BUILDER** — no `innerHTML`, and deliberately no `esc()` (it would double-escape):

```typescript
// SOURCE: runtime-src/demo-overlays/quiz.ts:50-53 (qzEl)
// COPY THIS PATTERN:
// Minimal safe element builder: attributes go through setAttribute/className
// (never innerHTML), string children become text nodes — config-authored strings
// are never parsed as HTML. Do NOT add esc() here; it would double-escape.
```

**MENU_RENDERING** — already `createElement`-based, reuse for the Audio/Untertitel groups:

```typescript
// SOURCE: runtime-src/reskin-player/index.ts:348-389 (renderMenu)
// COPY THIS PATTERN:
const btn = document.createElement("button");
btn.type = "button";
btn.className = "vp-menu-option";
btn.setAttribute("role", "menuitemradio");
btn.setAttribute("aria-checked", option.selected ? "true" : "false");
btn.dataset.value = String(option.value);
```

**CAPPED_RE_ASSERTION** — the last-resort fallback if Web Audio is unavailable:

```typescript
// SOURCE: runtime-src/demo-overlays/index.ts:1542-1580 (enforceCuePause)
// COPY THIS PATTERN:
if (repauses >= MAX_CUE_REPAUSES) return;
repauses += 1;
try {
  videoEl.pause();
} catch {
  /* ignore */
}
```

**ANCHORED_SLOT** — positioning and cleanup registration:

```typescript
// SOURCE: runtime-src/demo-overlays/index.ts:389-412 (makeSlot)
// COPY THIS PATTERN:
el.style.cssText = `position:absolute; ${posCss}; pointer-events:none; z-index:8;`;
onCleanup(() => {
  /* remove listeners */ el.remove();
});
```

**ROLLBACK** — every host mutation pushes its inverse:

```typescript
// SOURCE: runtime-src/reskin-player/index.ts:196-217
// COPY THIS PATTERN:
const undo: (() => void)[] = [];
const rollback = (): void => {
  while (undo.length) {
    const fn = undo.pop();
    try {
      fn?.();
    } catch {
      /* ignore */
    }
  }
};
```

**TEST_STRUCTURE** — controller harness with fakes and frame flushing:

```typescript
// SOURCE: runtime-src/tests/demo-overlays/quiz.test.ts:1-80
// COPY THIS PATTERN: a Harness interface exposing ctrl, fake media/slot/host,
// play/pause spies, setPaused/setAudioActive setters, flushFrames().
```

---

## Files to Change

| File                                                            | Action | Justification                                                                                                                                     |
| --------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runtime-src/reskin-player/styles.ts`                           | UPDATE | Delete every chrome-hiding rule and all `.vp-controls`/`.vp-menu` CSS; re-tune the three bottom offsets                                           |
| `runtime-src/reskin-player/index.ts`                            | UPDATE | Delete the bar, both menus, the native/HLS/LS option builders, `setOverlays` and `.vp-overlay-layer`; mount the new control; use the new silencer |
| `runtime-src/reskin-player/language-pack-control.ts`            | CREATE | The one new control — audio + subtitle selection from the pack                                                                                    |
| `runtime-src/reskin-player/silence.ts`                          | CREATE | Web Audio gain-node silencer, per-element, with a capped-re-assertion fallback                                                                    |
| `runtime-src/reskin-player/language-pack.ts`                    | UPDATE | Drop `getLearningSuiteTranscriptTracks` and shrink `getTrackDiagnostics`                                                                          |
| `runtime-src/common/types.ts`                                   | UPDATE | Remove `setOverlays` from `PlayerApi`; remove `OverlaySlot` if it has no other consumer                                                           |
| `runtime-src/common/i18n/player.ts`                             | UPDATE | Delete dead `player.*` keys; add the control's keys in `en` and `de`                                                                              |
| `runtime-src/demo-overlays/index.ts`                            | UPDATE | Drop the `setOverlays([])` call and the `[data-vp="playpause"]` interception; re-tune slot offsets                                                |
| `runtime-src/demo-overlays/quiz.ts`                             | UPDATE | Delete the `.vp-controls` click/pointerdown guard                                                                                                 |
| `runtime-src/tests/reskin-player/styles.test.ts`                | UPDATE | Invert: assert the host's chrome is NOT hidden                                                                                                    |
| `runtime-src/tests/reskin-player/safety-net.test.ts`            | UPDATE | Re-anchor F3/F4 off `[data-vp="playpause"]` and `.vp-overlay-layer`                                                                               |
| `runtime-src/tests/reskin-player/index.test.ts`                 | UPDATE | Drop perf guards for deleted code                                                                                                                 |
| `runtime-src/tests/common/locale-surface.test.ts`               | UPDATE | The 5-aria-label / 5-button assertions no longer describe the surface                                                                             |
| `runtime-src/tests/common/no-bare-strings.test.ts`              | UPDATE | `COPY`/`CONTEXTUAL` lists follow the catalogue changes                                                                                            |
| `runtime-src/tests/demo-overlays/safety-net.test.ts`            | UPDATE | `setOverlays` was the mount-rollback fault-injection point; pick a new one                                                                        |
| `runtime-src/tests/reskin-player/language-pack-control.test.ts` | CREATE | Pack present → control rendered; no pack → nothing added                                                                                          |
| `runtime-src/tests/reskin-player/silence.test.ts`               | CREATE | Silencer logic against injected fake Web Audio globals                                                                                            |
| `e2e/support/assertions.ts`                                     | UPDATE | Invert `expectNativeChromeHidden`; drop `.vp-controls` from `expectReskinMounted`; add a host-mute assertion                                      |
| `e2e/overlay-canary.spec.ts`                                    | UPDATE | Wire the renamed/added assertions                                                                                                                 |
| `public/runtime/*.js`                                           | UPDATE | Regenerated by `bun run build:runtime`; CI drift-checks it                                                                                        |
| `docs/feature-context.md`                                       | UPDATE | Record the decisions and the measured host behaviour                                                                                              |

---

## NOT Building (Scope Limits)

- **Renaming `reskin-player` or `data-vp-reskinned`.** The marker is a DOM contract read by the canary (`e2e/support/assertions.ts:23`), the CSS and the tests. Renaming is a churn cascade that buys nothing here. It stays a deliberate misnomer.
- **Cue anchoring versus the host's resume-position feature.** Deferred by the user on 2026-09-07; recorded as an open gotcha in `docs/feature-context.md`.
- **Any redesign of the voice-over card, quiz or pills** beyond re-anchoring if they collide with the host's bar.
- **Restoring `hideAudioAttachments`** or any other superseded subsystem.
- **Fixing the LearningSuite-transcript subtitle path.** It is being deleted, not repaired — the host renders its own subtitles.

---

## Step-by-Step Tasks

Execute in order. Each task is atomic and independently verifiable.

**Status markers** — prefix EVERY task header with one; the build agent updates it inline as it works: `[ ]` idle · `[wip]` in progress · `[x]` complete · `[f]` failed. All tasks start `[ ]`. If a task cannot be made to pass, mark it `[f]`, record why in Agent Notes, and move on if the rest of the plan can still proceed.

### `[x]` Task 1: MEASURE on the live tenant (throwaway probe)

- **ACTION**: Write a temporary `e2e/_probe.spec.ts`, run it, record the numbers in Agent Notes, then DELETE the file.
- **IMPLEMENT**: Route `/runtime/*.js` to the working tree's bundles (URL predicate, never a glob — the tenant's tags carry `?x-vercel-protection-bypass=…`). Then measure, after pressing play and revealing the host chrome (`document.getElementById("__custom-player-style")?.remove()`):
  1. `videoEl.src.startsWith("blob:")` — confirms the hls.js/MSE path, which is what makes the video CORS-same-origin for Web Audio. **If this is false, Task 9's premise is wrong — stop and escalate.**
  2. The **visible control row's** height and its offset from the host's bottom edge.
  3. `getComputedStyle` z-index/position of `[class*="PlayerControlsAbsoluteContainer"]`.
- **GOTCHA**: `[class*="PlayerControlsAbsoluteContainer"]` is **full-bleed, not a bottom strip** — measured 258px tall inside a 260px player. Measuring _that_ element for the bar height gives a nonsense number. Measure the innermost row that contains the time text instead.
- **GOTCHA**: already measured, do not re-derive — a `z-index:20; inset:0` overlay on the host DOES win `elementFromPoint` over the host bar (its `z-index` is `auto`). That is what makes Task 7 a deletion.
- **VALIDATE**: `bunx playwright test e2e/_probe.spec.ts --project=canary` passes and the three values are written into Agent Notes; `git status --short` is clean afterwards.

### `[x]` Task 2: UPDATE `runtime-src/reskin-player/styles.ts`

- **ACTION**: DELETE the chrome-hiding rules and the control-bar CSS; re-tune the remaining offsets.
- **IMPLEMENT**: Remove all four `[data-vp-reskinned="true"] …` hiding rules (lines 4-10), including the `media-*` ones — measured: **no `media-*` elements exist under the player on this tenant**, so those rules match nothing. Remove `.vp-controls`, `.vp-seek`, `.vp-time`, `.vp-menu-wrap`, `.vp-menu*` blocks. Keep `.vp-shell`, `.vp-subtitle-layer`, `.vp-sync-badge`. Re-tune `.vp-overlay-layer`'s `inset: 0 0 60px 0` (line 13), `.vp-subtitle-layer`'s `bottom: 58px` (line 15) and `.vp-sync-badge`'s `bottom: 56px` (line 18) to clear the host's real bar, using Task 1's measurement.
- **MIRROR**: `runtime-src/reskin-player/styles.ts:11-19` — keep the surviving blocks' formatting exactly.
- **GOTCHA**: `.vp-overlay-layer` is deleted entirely in Task 5; if Task 5 lands first, drop its rule instead of re-tuning it.
- **VALIDATE**: `bun run typecheck:runtime && bun run test runtime-src/tests/reskin-player/styles.test.ts` (expected RED until Task 11 inverts that test — record it, do not "fix" it here).

### `[x]` Task 3: UPDATE `runtime-src/reskin-player/index.ts` — delete the control bar

- **ACTION**: DELETE the `.vp-controls` markup and every control's wiring.
- **IMPLEMENT**: From the shell template (lines 258-272) remove the whole `<div class="vp-controls">` block, keeping `.vp-overlay-layer` (until Task 5), `.vp-subtitle-layer` and `.vp-sync-badge`. Remove the `q()` lookups and the `playPauseBtn` / `seekInput` / `timeLabel` / `audioBtn` / `captionsBtn` / `muteBtn` / `fsBtn` consts (277-286) and every handler that writes them: `playPauseBtn.onclick` (981-985), `seekInput.oninput` (986-990), `audioBtn.onclick`, `captionsBtn.onclick`, `muteBtn.onclick` (1001-1013), `fsBtn.onclick`, and every `…Btn.textContent = tr(...)` write in `onPlay`/`onPause`/`onVolumeChange`/`stopExternalAudio`/`syncExternalAudio`.
- **PATTERN**: The bus emits stay — `onPlay`/`onPause`/`onTime` must keep calling `bus.emit`, since `demo-overlays` is the only real consumer and drives everything from it.
- **GOTCHA**: `index.ts:304-305` bails the whole attach when `[data-vp="playpause"]` is missing (the "missing required shell node" precondition). Delete that precondition or re-point it at a node that still exists, or **every attach will now throw and roll back**.
- **GOTCHA**: `mediaEl.controls = false` (line 238) and its `undo` entry are NOT part of the bar — they handle the plain-`<video>` case. Keep both.
- **VALIDATE**: `bun run typecheck:runtime` — exit 0, no unused-variable errors.

### `[x]` Task 4: UPDATE `runtime-src/reskin-player/index.ts` — delete the track menus and host-owned sources

- **ACTION**: DELETE the menu machinery and the option builders the host now owns.
- **IMPLEMENT**: Remove `renderMenu` (348-389), `toggleTrackMenu`, `closeTrackMenus`, `updateTrackMenus`, `audioMenu`/`captionsMenu` lookups, `onDocumentClick` (the menu-closing document listener) and its registration/removal. Remove `getNativeSubtitleOptions` (626-649), `getHlsSubtitleOptions` (651-675), `getLearningSuiteSubtitleOptions` (677-697), the native/HLS/rendition audio builders, `getSubtitleMenuState` (722-738), and the `"native"`/`"hls"` branches of `setSubtitleTrack` (783-889). **Keep** `getExternalAudioOptions` (425) and `getExternalSubtitleOptions` (699) — the pack's own sources.
- **IMPLEMENT**: `renderActiveSubtitle` (766-781) keeps only its external branch; `learningSuiteSubtitleIndex` and the LS-transcript branch go.
- **MIRROR**: `runtime-src/reskin-player/index.ts:699-720` — `getExternalSubtitleOptions` is the shape the surviving path keeps.
- **GOTCHA**: `addListListener(mediaEl.textTracks, …)` bindings (1094-1096) exist only to refresh the deleted menus. Remove them and their cleanup, or they leak listeners against a menu that no longer exists.
- **GOTCHA**: this is what removes the last caller of `getLearningSuiteTranscriptTracks`, which does `apollo.cache.extract()` — a full store snapshot. `runtime-src/tests/reskin-player/index.test.ts` has a perf guard asserting it is NOT called on `timeupdate`; that guard becomes vacuous and is handled in Task 11.
- **VALIDATE**: `bun run typecheck:runtime` — exit 0.

### `[x]` Task 5: UPDATE `runtime-src/common/types.ts` and the overlay layer

- **ACTION**: DELETE `setOverlays` from `PlayerApi`, and the `.vp-overlay-layer` machinery it feeds.
- **IMPLEMENT**: Remove `setOverlays` from `PlayerApi` (`common/types.ts:149-158`) and `OverlaySlot` (142-147) if nothing else references it. In `index.ts` remove the `api.setOverlays` implementation (160-163), the `overlays` array (127-128), the `.vp-overlay-layer` div from the shell template, its lookup, and the overlay add/remove block inside `onTime` (1029-1045) including its `overlay-show`/`overlay-hide` bus emits. Remove `activeOverlays` from `_diag()`.
- **GOTCHA**: `demo-overlays/index.ts:1650` subscribes to bus events including `overlay-show`/`overlay-hide` in `recomputeActive`'s dispatch list. With no producer they are dead branches — remove them from that condition too.
- **GOTCHA**: every `PlayerApi` test stub implements `setOverlays` (`locale-surface.test.ts:29`, `demo-overlays/{audio,render,lifecycle,safety-net}.test.ts`). They all stop type-checking. `safety-net.test.ts:14-17` additionally **uses it as its fault-injection point** — Task 12 must give it a new one.
- **VALIDATE**: `bun run typecheck:runtime` — exit 0 (test files included in `tsconfig.runtime.json`).

### `[x]` Task 6: UPDATE `runtime-src/demo-overlays/index.ts`

- **ACTION**: DELETE the play/pause interception and the `setOverlays` call; re-tune the slot offsets.
- **IMPLEMENT**: Remove `onCaptureClick` (931-940) and its registration/cleanup — the button it targets no longer exists. **Keep `onCaptureKeydown`**: it is a bare document listener with a form-field guard and has no dependency on the bar, which is what lets Space keep driving the voice-over. Remove `window.player.setOverlays([])` (1649). Re-tune `vp-slot-br`'s and `vp-slot-lt`'s `bottom:70px` (419, 428) against Task 1's measurement of the host bar.
- **GOTCHA**: `slotBR` and `slotLowerThird` share the bottom-right corner, and `recomputeActive`'s `clearMetaPill()` call is load-bearing for that layout — not housekeeping. Do not remove it while re-anchoring.
- **VALIDATE**: `bun run test runtime-src/tests/demo-overlays/` — all pass.

### `[x]` Task 7: UPDATE `runtime-src/demo-overlays/quiz.ts`

- **ACTION**: DELETE the control-bar interaction guard.
- **IMPLEMENT**: Remove `inControls` (603-606), `onGlobalClick` (608-612), `onGlobalPointerDown` (616-621) and their `addEventListener`/`onCleanup` pairs (623-624, 628-630). **Keep `onGlobalKeydown`** — it guards keyboard shortcuts, not the bar.
- **PATTERN**: This is a deletion, not a re-pointing at the host's markup. Measured: `.vp-quiz-scrim` (`position:absolute; inset:0; pointer-events:auto`, inside `#vp-slot-quiz` at `z-index:20`) already wins `elementFromPoint` over the host's bar, whose computed `z-index` is `auto`.
- **GOTCHA**: re-verify this in Task 16's browser pass with a quiz actually open. If the scrim does NOT block the host's bar, restore an equivalent guard keyed on `[class*="PlayerControlsAbsoluteContainer"]` and record the fragility in `docs/feature-context.md`.
- **VALIDATE**: `bun run test runtime-src/tests/demo-overlays/quiz.test.ts` — all pass.

### `[x]` Task 8: CREATE `runtime-src/reskin-player/silence.ts`

- **ACTION**: CREATE the video silencer.
- **IMPLEMENT**: `createSilencer(mediaEl)` returning `{ silence(): void, restore(): void, mode: "webaudio" | "reassert" | "none" }`. Primary path: one `AudioContext` per element, `createMediaElementSource(mediaEl)` → `GainNode` → `destination`; `silence()` sets `gain.value = 0`, `restore()` sets it to 1. Fallback when `AudioContext` or `createMediaElementSource` is unavailable or throws: the capped re-assertion of `mediaEl.muted = true` on `volumechange`.
- **MIRROR**: `runtime-src/demo-overlays/index.ts:1542-1580` (`enforceCuePause`) for the capped fallback — cap, key it, give up rather than fight forever.
- **TYPES**: Take the Web Audio constructors through an injectable seam (e.g. an optional second argument defaulting to `window`), because happy-dom has **no** `AudioContext`, `GainNode` or `MediaElementAudioSourceNode` at all — without a seam the module is untestable.
- **GOTCHA**: `createMediaElementSource()` throws `InvalidStateError` if called twice for the same element **instance**. Cache the graph in a `WeakMap<HTMLMediaElement, …>` and rebuild only when the element identity changes. Never call it "defensively".
- **GOTCHA**: an `AudioContext` constructed before any user gesture starts `suspended`; call `resume()`. Sticky activation persists for the document's lifetime once any gesture has happened, and playback already requires one, so no dedicated gesture handler is needed.
- **GOTCHA**: do NOT route the external dub `<audio>` through Web Audio. It deliberately carries no `crossorigin`, so a cross-origin GCS response is opaque → CORS-cross-origin → the node would output **silence**.
- **VALIDATE**: `bun run test runtime-src/tests/reskin-player/silence.test.ts`

### `[x]` Task 9: UPDATE `runtime-src/reskin-player/index.ts` — silence the video through the silencer, mirror the host's volume

- **ACTION**: REPLACE the `mediaEl.muted` writes with the silencer, and mirror the host's volume onto the dub.
- **IMPLEMENT**: At the three sites that force the video silent for a dub — `syncExternalAudio` (`index.ts:550`), `muteBtn.onclick` (1005, deleted in Task 3) and `onVolumeChange` (1075) — call `silencer.silence()` instead of `mediaEl.muted = true`. `stopExternalAudio` (520) calls `silencer.restore()`. In `onVolumeChange`, mirror the host's state onto the dub: `externalAudio.muted = mediaEl.muted; externalAudio.volume = mediaEl.volume`. That is what makes the host's own mute and volume controls drive the dubbed track.
- **PATTERN**: Do **not** write `mediaEl.muted` at all (user decision, 2026-09-07). The research's general advice is to set it alongside the gain node so the platform-visible mute state stays honest for the Media Session API, Picture-in-Picture and screen readers — but that advice assumes the write sticks, and on this host it is reverted in ~600ms. The benefit lasts 600ms and then evaporates, while the write costs a `volumechange` round-trip (ours, then the host's revert) every time. The accessible path is the host's own mute button, which still reaches the dub through the mirror below.
- **GOTCHA**: `onVolumeChange` today re-asserts `mediaEl.muted = true` **uncapped** whenever `externalAudioIndex >= 0` (line 1075). That is an existing, unbounded fight with the host — replace it, do not keep it alongside the silencer.
- **GOTCHA**: `audibleMuted` (315, 1003, 1078) tracked the learner's intent through _our_ button. With the host owning mute, `mediaEl.muted` is the source of truth; remove the shadow variable rather than letting the two disagree.
- **VALIDATE**: `bun run typecheck:runtime && bun run test runtime-src/tests/reskin-player/`

### `[x]` Task 10: CREATE `runtime-src/reskin-player/language-pack-control.ts`

- **ACTION**: CREATE the one new control.
- **IMPLEMENT**: `createLanguagePackControl({ pack, playerHost, onSelectAudio, onSelectSubtitle, onCleanup })`. A button opening a menu with two groups — **Audio** from `pack.audioTracks`, **Untertitel** from `pack.subtitleTracks` plus an Off entry. Built entirely with `createElement`/`textContent`.
- **MIRROR**: `runtime-src/demo-overlays/quiz.ts:50-53` for the element builder; `runtime-src/reskin-player/index.ts:348-389` for option rendering; `runtime-src/demo-overlays/index.ts:389-412` for anchoring and cleanup registration.
- **TYPES**: Reuse `TrackOption` (`common/types.ts:228-233`) for menu options and `LanguagePack` (197-226) for the input.
- **PATTERN**: **Render nothing at all when there is no pack.** On a lesson without one, the runtime must add zero controls, so the player is entirely LearningSuite's.
- **PATTERN**: anchor it **bottom-left**, on the same baseline as the host's bar (user decision, 2026-09-07). Every other edge is taken or unstable: `vp-slot-tl` is `top:14px; left:14px; right:14px` and therefore spans the **full width** despite its pill painting narrow; `vp-slot-tr` (science pill) and `vp-slot-br`/`vp-slot-lt` (meta pill, voice-over card) all appear and disappear with playback position, so anything stacked under them would jump mid-lesson. Bottom-left is the only region where nothing else of ours ever renders.
- **GOTCHA**: it still has to clear the host's bar vertically — use Task 1's measurement of the visible control row, not the full-bleed container.
- **GOTCHA**: any id beginning `vp-slot-` is swept as a stray slot element on remount. If this control injects a stylesheet, give it a `__vp-`-prefixed id (see `__vp-slot-style`).
- **GOTCHA**: never `innerHTML` here, and never add `esc()` to the builder — it would double-escape. Pack labels are third-party strings.
- **VALIDATE**: `bun run test runtime-src/tests/reskin-player/language-pack-control.test.ts`

### `[x]` Task 11: UPDATE `runtime-src/reskin-player/index.ts` — mount the control

- **ACTION**: WIRE the control into the attach path.
- **IMPLEMENT**: In the existing `loadLanguagePackForMedia(mediaEl).then((pack) => {…})` block (971-979), when a pack resolves, create the control and push its removal onto the `undo` list and the teardown path.
- **MIRROR**: `runtime-src/reskin-player/index.ts:196-217` — every host mutation pushes its inverse onto `undo`.
- **GOTCHA**: the pack resolves **asynchronously**, after `attachInner` has returned, so its `undo` entry is registered late. Make sure a teardown that has already run does not leave an orphan control — check the mount is still alive before appending.
- **VALIDATE**: `bun run typecheck:runtime && bun run test runtime-src/tests/reskin-player/`

### `[x]` Task 12: UPDATE `runtime-src/common/i18n/player.ts`

- **ACTION**: DELETE dead keys, ADD the control's keys.
- **IMPLEMENT**: Delete keys with no remaining call site — `player.aria.playPause`, `player.aria.mute`, `player.aria.fullscreen`, `player.label.play`, `player.label.pause`, `player.label.sound`, `player.label.muted`, `player.label.fullscreen`, `player.label.audio`, `player.label.captions`, `player.title.*`. **Keep** `player.tracks.audio`, `player.tracks.subtitles`, `player.label.off`, `player.label.current`, `player.track.audio`, `player.track.subtitle` and `player.drift.*` — the new control and the drift badge still use them. Add any new keys in **both** `en` and `de`.
- **GOTCHA**: `en` is the completeness reference — the key union is `keyof typeof EN` and `de` is `Record<Key, string>`, so a missing German string is a **typecheck error**, not a runtime hole. Never build a locale with `{ ...EN, ...overrides }`.
- **GOTCHA**: German copy has one source of truth — `admin-toggle/prompt.ts`'s house vocabulary. Match it rather than translating afresh.
- **VALIDATE**: `bun run typecheck:runtime && bun run test runtime-src/tests/common/i18n.test.ts`

### `[x]` Task 13: UPDATE the runtime unit tests

- **ACTION**: UPDATE the suites that assert the deleted surface.
- **IMPLEMENT**:
  - `tests/reskin-player/styles.test.ts` — invert AC1-AC3 (33-67): the host's chrome must now be visible with the marker set. The structural guard that every `hls-video` rule is marker-scoped becomes vacuous once the rules are gone; delete it rather than leave it passing on an empty set.
  - `tests/reskin-player/safety-net.test.ts` — F3 (126) mocks `querySelector` to return `null` for `[data-vp="playpause"]`; F4 (145, 177) keys on `.vp-overlay-layer`. Re-anchor both onto nodes that still exist.
  - `tests/reskin-player/index.test.ts` — remove perf guards for deleted code (the Apollo-extract guard, the subtitle-cue dirty-check).
  - `tests/common/locale-surface.test.ts` — `mountReskin` asserts exactly 5 aria-labels and 5 buttons (417-418) and the specific de/en labels (379-409). Rewrite for the new surface.
  - `tests/common/no-bare-strings.test.ts` — update `COPY`/`CONTEXTUAL` for the catalogue changes.
  - `tests/demo-overlays/safety-net.test.ts` — `setOverlays` was the mount-rollback fault-injection point (14-17), chosen because it ran last in `mountInner`. Pick a new last-call seam and document why.
- **GOTCHA**: `no-bare-strings.test.ts` is a **two-way** guard — a literal must be absent from the entry files AND present in a catalogue. Deleting a key without updating it fails from the other direction.
- **VALIDATE**: `bun run test` — full suite green.

### `[x]` Task 14: UPDATE `e2e/support/assertions.ts` and the canary spec

- **ACTION**: INVERT the chrome assertions and add a host-mute test.
- **IMPLEMENT**: Replace `expectNativeChromeHidden` with `expectHostChromePresent`, asserting `[class*="PlayerControlsAbsoluteContainer"]` is present **and visible** inside `HOST`. Drop `NATIVE_CHROME_IN_PLAYER` (its `media-*` selectors match nothing on this tenant). In `expectReskinMounted`, drop the `.vp-shell .vp-controls`, `[data-vp="playpause"]` and `[data-vp="time"]` assertions (201-209) and assert the `PlayerApi`, `_diag()` and the overlay slots instead. `expectPlaybackAdvances` (279-281) clicks `[data-vp="playpause"]` — re-point it at **the host's own play button** (user decision, 2026-09-07, choosing a real gesture over `window.player.play()`). Add a test that the host's own mute works while our runtime is mounted.
- **PATTERN**: An absence assertion on third-party markup passes vacuously. Every such check must be paired with a positive assertion that something of ours is present — otherwise a page where the runtime never ran reports green.
- **PATTERN**: locating the host's play button. It carries no `aria-label`, `data-testid` or `title` — only hashed MUI classes. Measured DOM order of the interactive children inside `[class*="PlayerControlsAbsoluteContainer"]` is: `input` (scrubber), **`button` (play/pause)**, `button` (volume), `input` (volume slider), `button` ("1x"), `button` (CC), `button` (settings), `button` (fullscreen). Take the **first `button`** inside that container — the most durable of the available heuristics.
- **PATTERN**: make the rot LOUD. This is a deliberate, user-approved dependency on third-party markup, so it must fail diagnosably rather than silently: after clicking, assert `paused` actually flipped, and on failure emit a message naming the cause — "LearningSuite's control bar changed shape; the canary's play-button locator needs updating" — plus a dump of the buttons that were found. A silent rot here reads as "our runtime broke" when it means "they restyled".
- **GOTCHA**: this knowingly departs from the canary's founding rule (`docs/feature-context.md`, 2026-08-07): _"the canary asserts only surfaces the runtime already publishes… if an assertion seems to need a new hook, it is reaching past what the runtime promises."_ The trade was made deliberately — proving a real user gesture reaches the player was judged worth the coupling. Record it in `feature-context.md` in Task 16 so the next person does not "fix" it back.
- **GOTCHA**: assert only surfaces the runtime already publishes, otherwise. Do not add a `data-testid` to the host's markup.
- **VALIDATE**: `bun run e2e` — 4/4 (plus the new test) green.

### `[x]` Task 15: REBUILD the bundles

- **ACTION**: REGENERATE `public/runtime/*.js`.
- **IMPLEMENT**: `bun run build:runtime`.
- **GOTCHA**: the generated `.js` are committed and CI drift-checks them with `git diff --exit-code -- public/runtime`. A change that forgets this fails CI for a reason the diff does not explain.
- **VALIDATE**: `bun run build:runtime && git diff --exit-code -- public/runtime` after committing — exit 0.

### `[f]` Task 16: VERIFY in a real browser, then UPDATE `docs/feature-context.md`

- **ACTION**: VALIDATE on the tenant and record the durable decisions.
- **IMPLEMENT**: On the live lesson, confirm: the host's bar is visible and its mute, CC, speed and fullscreen work; our overlays (pills, voice-over card) do not collide with it; a quiz break still blocks interaction with the host's bar; and — with a pack injected via `window.__vpLanguagePacks` — the dub plays, the video is silent, and the host's volume/mute drive the dub. Then add a `docs/feature-context.md` entry.
- **GOTCHA**: the canary's video has **no** language pack (`externalAudioTracks: 0`), so the dub path can only be exercised through the `window.__vpLanguagePacks` override hook.
- **GOTCHA**: external subtitle rendering has never been verified on the tenant either — the LS-transcript path was measured **not** rendering, and the external path shares `renderSubtitleCue`. Treat "external subtitles render" as unproven until seen.
- **VALIDATE**: `bun run test && bun run typecheck:runtime && bun run e2e` all green, and the browser checks above pass.

---

## Testing Strategy

### Unit Tests to Write

| Test File                                           | Test Cases                                                                                                                                                                                      | Validates                                         |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `tests/reskin-player/silence.test.ts`               | gain set to 0 / restored to 1; graph built once per element instance; falls back when `AudioContext` is absent; fallback is capped                                                              | The silencer, via injected fake Web Audio globals |
| `tests/reskin-player/language-pack-control.test.ts` | pack present → control in the DOM with both groups; **no pack → zero nodes added**; selecting a track invokes the callback; cleanup removes it; a hostile label is rendered as text, not markup | The new control                                   |
| `tests/reskin-player/styles.test.ts` (rewrite)      | host chrome visible with the marker set                                                                                                                                                         | The inversion                                     |
| `tests/common/locale-surface.test.ts` (rewrite)     | the control's labels resolve in `de` and `en`                                                                                                                                                   | Locale surface after the bar is gone              |

### Edge Cases Checklist

- [ ] Lesson with no language pack — the runtime adds no controls at all
- [ ] Pack with only a `useNative: true` audio track — no external element, no silencing
- [ ] Pack whose subtitle VTT fails to load — control still usable, no throw
- [ ] Host reverts `mediaEl.muted` while a dub plays — audio stays silent (gain node)
- [ ] `AudioContext` unavailable — capped fallback engages and gives up rather than looping
- [ ] Host destroys and recreates the `<video>` — a new graph is built, no `InvalidStateError`
- [ ] Attach throws after the pack resolved — the control is rolled back, not orphaned
- [ ] Quiz open — the host's bar cannot be operated
- [ ] Teardown / re-injection — no duplicate control, no orphan nodes

---

## Validation Commands

🔁 **Validation loop:** the plan is not complete until every command below passes (exit 0). On any failure, fix the cause and re-run — loop until all pass. If a check is genuinely impossible, mark it `[f]`, note why in Agent Notes, and move on.

### Level 1: STATIC_ANALYSIS

```bash
bun run typecheck:runtime
```

**EXPECT**: Exit 0. Note: `bun run lint` already exits 1 on this branch with 7 pre-existing errors in `app/admin/`, `app/api/lessons/`, `components/video-player/`. Compare a cache-free run (`rm -rf .next/cache/eslint`) against HEAD before believing a count; do not attempt to fix pre-existing failures here.

### Level 2: UNIT_TESTS

```bash
bun run test runtime-src/tests/reskin-player/ runtime-src/tests/demo-overlays/ runtime-src/tests/common/
```

**EXPECT**: All pass. **`bun run test`, never `bun test`** — the latter is Bun's own runner, has no happy-dom, and fails ~182 tests.

### Level 3: FULL_SUITE

```bash
bun run test && bun run typecheck:runtime && bun run build:runtime && git diff --exit-code -- public/runtime
```

**EXPECT**: All pass; the bundle drift check is clean after committing the regenerated files.

### Level 4: DATABASE_VALIDATION

Not applicable — no schema changes.

### Level 5: BROWSER_VALIDATION

```bash
bun run e2e
```

**EXPECT**: green. Plus, on the live lesson:

- [ ] LearningSuite's own control bar is visible and styled as the platform's
- [ ] Its mute works and **stays** muted
- [ ] Its CC renders subtitles
- [ ] Speed and fullscreen work
- [ ] Our pills and voice-over card do not collide with the bar
- [ ] A quiz break blocks interaction with the bar
- [ ] With `window.__vpLanguagePacks` injected: dub plays, video is silent, host volume/mute drive the dub

### Level 6: MANUAL_VALIDATION

1. Open a lesson with **no** language pack; confirm the player is indistinguishable from an un-augmented LearningSuite player apart from our overlays.
2. Open a lesson **with** a pack; switch audio to the dubbed track and confirm only one voice is audible.
3. Press the host's mute during a dub; confirm it silences the dub.

---

## Acceptance Criteria

- [ ] LearningSuite's own chrome is visible and functional while the runtime is mounted
- [ ] Mute works and persists; subtitles render
- [ ] Our control bar, both track menus and the native/HLS/LS subtitle sources are gone
- [ ] The language-pack control appears only when the video has a pack
- [ ] A dubbed track plays with the video silent, and survives the host reverting `muted`
- [ ] Level 1-3 validation passes with exit 0; `bun run e2e` green
- [ ] No regressions in existing tests
- [ ] UX matches the "After State" diagram

---

## Completion Checklist

- [ ] All tasks completed in dependency order
- [ ] Each task validated immediately after completion
- [ ] Level 1: `typecheck:runtime` passes
- [ ] Level 2: unit tests pass
- [ ] Level 3: full suite + build + bundle drift check pass
- [ ] Level 5: browser validation passes
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk                                                                                                                 | Likelihood | Impact | Mitigation                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<hls-video>` does not use MSE, so the video is CORS-cross-origin and Web Audio outputs silence for the wrong reason | LOW        | HIGH   | Task 1 gates on `videoEl.src.startsWith("blob:")` and stops the plan if false. Note silence is still the desired end state — the risk is losing the ability to _restore_ audio |
| The host also reverts something we have not measured (e.g. `playbackRate`)                                           | MED        | MED    | The silencer pattern generalises; record any new instance in `feature-context.md`                                                                                              |
| Removing `.vp-controls` breaks the quiz's interaction guard                                                          | LOW        | MED    | Measured: the scrim already covers the host bar. Task 7's GOTCHA carries the fallback                                                                                          |
| Deleting `setOverlays` breaks four test stubs and a fault-injection point                                            | HIGH       | LOW    | Enumerated in Task 5 and Task 13; type-checker catches all of them                                                                                                             |
| The host's bar auto-hides, leaving no visible controls at some moments                                               | MED        | LOW    | Their behaviour, not ours — and it is what every other lesson on the platform does                                                                                             |
| External subtitle rendering was never verified and may be broken too                                                 | MED        | MED    | Task 16 treats it as unproven; the LS-transcript path was measured not rendering                                                                                               |
| Web Audio is untestable in happy-dom                                                                                 | HIGH       | LOW    | Task 8 mandates an injectable seam; real verification in Task 16                                                                                                               |
| The canary's host play-button locator rots on a LearningSuite restyle                                                | MED        | LOW    | Accepted deliberately (user decision). Task 14 requires a named diagnostic on failure so it reads as "they restyled", not "we broke"                                           |

---

## Questionables

_All four open questions were resolved with the user on 2026-09-07. Kept as a record of what was decided and why._

<details>
<summary>RESOLVED — Where the language-pack control sits → bottom-left</summary>

The plan first assumed top-left. That was wrong: `vp-slot-tl` spans the full width (`left:14px; right:14px`), and the science and meta pills come and go with playback position, so anything stacked under them shifts mid-lesson. Bottom-left is the only region where nothing else of ours ever renders. See Task 10.

</details>

<details>
<summary>RESOLVED — `mediaEl.muted` is NOT written alongside the gain node</summary>

The research advised writing it for platform-visible mute state (Media Session, PiP, screen readers). That advice assumes the write sticks; measured on this host it is reverted in ~600ms, so the benefit evaporates while the cost — a `volumechange` round-trip per write, on a hot path — remains. The host's own mute button is the accessible path and reaches the dub through the `volumechange` mirror. See Task 9.

</details>

<details>
<summary>RESOLVED — Host CC and pack subtitles may both be on; accepted</summary>

They are independent sources and either can be switched off, so two simultaneous lines require a learner to deliberately enable both. The alternative considered — injecting pack VTTs as native `<track>` elements so the host's own CC renders them — is more elegant and would delete `.vp-subtitle-layer`, `renderSubtitleCue` and `parseVtt` outright, but it needs `crossorigin` on the media element, which can force a media reload and risk HLS playback itself. Recorded as a follow-up spike in Agent Notes rather than taken here.

</details>

<details>
<summary>RESOLVED — The canary clicks the host's own play button</summary>

Chosen over `window.player.play()` **against the planning recommendation**, deliberately: driving the API would stop the canary proving that a real user gesture reaches the player. The cost is a dependency on MUI markup carrying no stable hook, which departs from the canary's founding rule. Mitigated in Task 14 by locating the first `button` in the controls container and failing with an explicit "they restyled" diagnostic rather than silently. See Task 14.

</details>

---

## Agent Notes

**Task 1 measurements (2026-09-07, gate PASSED):**

| Measurement                | Value                                                               | Consequence                                                             |
| -------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `hls-video` own `src`      | `https://vz-12f1059a-6c7.b-cdn.net/…`                               | NOT a blob — the custom element is not the MSE holder                   |
| **inner `<video>` `src`**  | **`blob:https://robbins.greator.com/…`**                            | **Gate passes.** hls.js attaches the MediaSource to the _inner_ element |
| Visible control row        | **36px tall**, needs **47px** clearance from the host's bottom edge | Overlay offsets tuned to 58px (47 + 11px margin)                        |
| Full-bleed container       | 258px in a 260px player                                             | Confirms: never measure the container for bar height                    |
| First button in the bar    | `<svg data-icon="play">` (FontAwesome)                              | A semantic locator for Task 14, better than DOM order                   |
| Bar `z-index` / `position` | `auto` / `absolute`                                                 | The quiz scrim at `z-index:20` covers it                                |

**Refinement forced by the gate:** the Web Audio graph must be built on the **inner `<video>`**, not on `<hls-video>`. The custom element is not an `HTMLMediaElement` (measured: `isHTMLMediaElement: false`), so `createMediaElementSource()` could not accept it, and it is the inner element that holds the MSE blob which makes the media CORS-same-origin. Task 8 resolves the inner element and falls back to the outer one only for the capped-re-assertion path.

**Refinement available for Task 14:** the host's play button is locatable as `button:has(svg[data-icon="play"])` / `[data-icon="pause"]` inside the controls container — FontAwesome's `data-icon` is far more durable than "first button in DOM order". Use it, keep the DOM-order note as the fallback.

**Earlier measurements on the live tenant, 2026-09-07:**

| Observation                                        | Value                                                                                                    |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `el.muted = true` → after 600ms                    | `false` (host reverts)                                                                                   |
| Host's own mute button                             | `false → true`, sticks                                                                                   |
| Our subtitle layer after selecting a track         | `hidden: true`, empty, while playing at 49.64s                                                           |
| `media-*` elements under the player                | **none** — those hiding rules match nothing                                                              |
| `PlayerControlsAbsoluteContainer`                  | present, `position:absolute`, `z-index:auto`, **258px tall in a 260px player** (full-bleed, not a strip) |
| `z-index:20; inset:0` overlay over the bar         | wins `elementFromPoint` — the quiz scrim already covers it                                               |
| Host chrome after removing `__custom-player-style` | full working bar **plus live subtitles**                                                                 |

**Why Web Audio and not a capped mute loop.** The research is unambiguous. `volume = 0` is a documented permanent no-op on iOS (Apple's own docs; MDN BCD flags `partial_implementation` for `volume` on `safari_ios` and not for `muted`). A capped `volumechange` re-assertion is a fight with code measured winning in 600ms, is async by spec (the event is a queued task, with no ordering guarantee against the host's effect), and by definition surrenders once capped — degrading into periodic audible glitches rather than a stable mute. The gain node is not a fight at all: the host watches `.muted`/`.volume`, and it has no reference to our `AudioContext`.

**The MSE detail that makes it work.** Per the HTML spec's media resource fetch algorithm, a `blob:` URL backed by a `MediaSource` is a _media provider object_, so mode is `local`, and such media data is **unconditionally CORS-same-origin** — regardless of Bunny's CORS headers, whose segment fetches hls.js performs itself and which this algorithm never sees. That is why `createMediaElementSource` on the hls.js-backed video will not be silenced by the Web Audio cross-origin rule. On a native-HLS fallback (Safari) the normal fetch algorithm applies and the node _would_ be silenced — harmless here, since silence is the goal, but it means the graph cannot be relied on for anything else on that path.

**Approaches rejected.** Restyling our bar to match the host's: keeps every broken line and leaves mute close to unfixable, since holding it needs a re-assertion war per control. Injecting the language-pack control into the host's bar: looks native, but their buttons carry no `aria-label`, `data-testid` or `title` — only hashed MUI classes (`css-1gauxy4`) — so anything keyed on them rots at their next restyle.

**Implementation outcome (2026-09-07).** Tasks 1-15 complete; Task 16 partial — see
the report. Three findings changed the plan as written:

1. **The gate passed on the inner element, not the outer one.** `<hls-video>`'s own
   `src` is the CDN `.m3u8`; the inner `<video>` holds `blob:…`. The Web Audio graph
   is therefore built on the inner element, which is also the only one
   `createMediaElementSource()` would accept (the custom element is not an
   `HTMLMediaElement`).
2. **The host's mute sets `volume = 0`, never `muted`.** Measured: icon goes
   `volume-high` → `volume-xmark`, both outer and inner `volume` 1 → 0, `muted`
   stays false throughout. That is the real reason our old mute button lost — it
   wrote a property their state machine normalises back — and it retroactively
   validates choosing a gain node over `volume = 0`, which would have fought them
   head-on.
3. **Tasks 3-5 were executed as one pass.** Their symbols are mutually dependent;
   removing the bar without the menus (or vice versa) leaves the file
   untypecheckable, so there was no intermediate state worth committing.

**Follow-up spike (not in scope here).** Inject the pack's VTTs as native `<track>` elements so the host's own CC control lists and renders them. That would collapse two subtitle UIs into one and delete `.vp-subtitle-layer`, `renderSubtitleCue` and `parseVtt` entirely. `next.config.ts` already sends `Access-Control-Allow-Origin: *` on `/runtime/:path*`, so the CORS side is plausible. Unknowns: setting `crossorigin` on the media element can force a media reload (risking HLS playback on a live tenant), and whether their React CC menu enumerates a `<track>` we add is untested.

**Spec gap found during planning.** `quiz.ts:603-630` guards `.vp-controls` against clicks and pointerdowns while a quiz is open — a second dependency on the control bar that the approved design did not mention. Measurement turned it into a deletion rather than a re-pointing.

---

## Amendments

_Append-only history of changes made **after** this plan was first built (newest at the bottom)._

<details>
<summary>2026-09-07 — Four open questions resolved with the user</summary>

Language-pack control anchored bottom-left (Task 10). `mediaEl.muted` no longer written alongside the gain node (Task 9). Host CC and pack subtitles may both be active; accepted, with native-`<track>` injection recorded as a follow-up spike. The canary clicks the host's own play button rather than driving `window.player.play()` — chosen against the planning recommendation, with a required "they restyled" diagnostic as mitigation (Task 14).

</details>
