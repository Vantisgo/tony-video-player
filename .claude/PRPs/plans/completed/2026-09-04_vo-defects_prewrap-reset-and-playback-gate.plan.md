# Feature: Voice-over overlay — pre-wrap reset + playback-start gate

## Summary

Two independent defects in the injected LearningSuite runtime (`runtime-src/demo-overlays`), both root-caused with live measurements on `robbins.greator.com` and a deterministic vitest reproduction. **(1)** The host wraps its custom-code block in `white-space: pre-wrap`, which inherits into every node the runtime injects; the voice-over banner's two `display:block` wrappers therefore gain a preserved line box per newline of its indented template literal, rendering the card at **200px instead of 62px**. Fixed by a `white-space: normal` reset scoped to a new shared `.vp-slot` class on all five injected slots. **(2)** `recomputeActive(window.player.current ?? 0)` runs at mount with `t = 0`, and `maybeTriggerAudio` uses an ungated time-window test that `0` satisfies — so a cue authored at `t: 0` plays a 119-second voice-over over a paused, never-started video. Fixed by one sticky playback-start gate in front of the only two calls in `recomputeActive` that have playback-altering side effects.

## User Story

As a learner opening a coaching lesson
I want the page to stay silent until I press play, and the voice-over card to be the size it was designed to be
So that nothing talks at me without my consent and the overlay does not swallow a third of the player

## Problem Statement

Testable, both confirmed live on `robbins.greator.com/admin/editor/fBq5ZVTL/CV1Bklhy/yPClsb9h/pgWcT1Bk?view=preview`:

1. **Premature playback.** With `audios[0].t === 0`, opening the lesson yields `{videoPaused: true, videoTime: 0, audioState: "playing", audioTime: 35, cueT: 0}` — the voice-over is 35s into a 119s file while the video has never played. Reproduced in vitest: after mount with no `play()` and no `time` event, `__audioCtrl.state === "playing"`, `#vp-slot-lt[data-kind] === "audio"`, `video.paused === true`. A control cue at `t: 30` stays `idle`.
2. **Inflated banner.** The card measures 200px tall against a 62px design. Its `display:block` children measure 160px (avatar wrapper, holding one 40px circle) and 178px (title block, holding 18px + 15px of text); its `display:flex` children measure 13px and 31px, correct. Removing whitespace-only text nodes takes the card to exactly 62px.

## Solution Statement

**Defect 1** — add a `SLOT_CSS` export to `demo-overlays/styles.ts` carrying `.vp-slot, .vp-slot * { white-space: normal; }`, give every `makeSlot`-created element a `vp-slot` class, and inject the stylesheet at the earliest injection site (beside `ANIM_CSS`) so later stylesheets win specificity ties. Scoped to the slot roots rather than to the audio banner: the science and meta pills escape today only because they are `inline-flex`, and the quiz card only because `quiz.ts` builds DOM via `createElement`; any future `innerHTML` markup with a block wrapper would regress silently.

**Defect 2** — add a sticky `playbackStarted` latch read from the media element's `paused` property, and gate **only** `quizCtrl.onTime(t)` and `maybeTriggerAudio(t)` behind it. Reading the element rather than the bus `play` event is load-bearing twice over (see GOTCHAs). No separate play-handler edit is needed: the bus already routes `play` to `recomputeActive(e.time)`, `bus.emit` is synchronous from the native `play` listener, and the HTML spec sets `paused = false` before queuing that event — so the gate opens and the due `t: 0` cue fires inside the same call stack as the native play, which is what makes the pre-roll blip-free.

## Metadata

| Field            | Value                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| Type             | BUG_FIX                                                                                                     |
| Complexity       | LOW                                                                                                         |
| Systems Affected | `runtime-src/demo-overlays` (styles, index, tests), `public/runtime` (generated), `docs/feature-context.md` |
| Dependencies     | None added. Existing: vitest 4.1.10, happy-dom 20.11.1, typescript 5.9.3                                    |
| Estimated Tasks  | 9                                                                                                           |

---

## Lifecycle (append-only)

- **Created:** 2026-09-04
- **Modified:** 2026-09-04 (initial build); 2026-09-04 (implemented via /prp-implement)
- **Commits:** _(uncommitted at time of report — 6 files staged for the branch's PR)_
- **Agent / Session:** Claude Opus 5 (1M context) — session 57919e36 (plan); Claude Opus 5 (1M context) — session 57919e36 (implementation)
- **Back refs:** `completed/2026-08-04_spike-parity_quiz-lifecycle-darktheme.plan.md` — established the quiz/voice-over/pills priority order in `recomputeActive` that this gate sits above; `completed/2026-09-01_audio-assets_*` (see feature-context 2026-09-01) — the `AudioController` file/TTS mode split this plan must not disturb
- **Forward refs:** `2026-09-04_vo-redesign_main-composition-dark-card.plan.md` — the card redesign, which depends on Task 1–3 of this plan landing first

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  DEFECT 2 — cue at t:0 fires before any user action                           ║
║                                                                               ║
║   ┌─────────────┐         ┌──────────────────┐        ┌──────────────────┐    ║
║   │ Lesson page │ ──────► │ runtime mounts   │ ─────► │ recomputeActive  │    ║
║   │   loads     │         │ (:1442)          │        │ (t = 0)          │    ║
║   └─────────────┘         └──────────────────┘        └────────┬─────────┘    ║
║                                                                │              ║
║                        learner has touched NOTHING             ▼              ║
║                                                    ┌──────────────────────┐   ║
║                                                    │ maybeTriggerAudio(0) │   ║
║                                                    │ 0 >= 0 && 0 < 1.0 ✓  │   ║
║                                                    └──────────┬───────────┘   ║
║                                                               ▼               ║
║                                                    ┌──────────────────────┐   ║
║                                                    │ activate(): 119s     │   ║
║                                                    │ voice-over PLAYS,    │   ║
║                                                    │ videoEl.pause()      │   ║
║                                                    └──────────────────────┘   ║
║                                                                               ║
║  Measured live: {videoPaused:true, videoTime:0, audioState:"playing",         ║
║                  audioTime:35, cueT:0}                                        ║
║                                                                               ║
║  DEFECT 1 — banner inflated by inherited white-space                          ║
║                                                                               ║
║   host <div style="white-space: pre-wrap">   (LearningSuite code block)        ║
║        └── #vp-slot-lt            inherits pre-wrap                           ║
║             └── card (flex)       200px  ◄── should be 62px                   ║
║                  ├── avatar wrap  (block) 160px  ◄── holds one 40px circle    ║
║                  ├── title block  (block) 178px  ◄── holds 18px + 15px text   ║
║                  ├── progress     (flex)   13px  ✓                            ║
║                  └── buttons      (flex)   31px  ✓                            ║
║                                                                               ║
║   ┌───────────────────────────────────────────────────────────┐               ║
║   │  (FH)  Voice-Over: Intro & Einordnung                     │               ║
║   │                              1:51 ▬▬▬  1:59  −10s ▶ +10s  │  200px tall   ║
║   │        von Coach-Stimme • SPIELT                          │  ~3x too big  ║
║   │   🎙  ◄── mic badge detached from avatar                  │               ║
║   └───────────────────────────────────────────────────────────┘               ║
║                                                                               ║
║   USER_FLOW: open lesson → a voice-over is already talking over a paused      ║
║              video, inside an overlay 3x its designed height                  ║
║   PAIN_POINT: audio with no consent; overlay eats the player                  ║
║   DATA_FLOW: mount → recomputeActive(0) → ungated window test → activate()    ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   ┌─────────────┐         ┌──────────────────┐        ┌──────────────────┐    ║
║   │ Lesson page │ ──────► │ runtime mounts   │ ─────► │ recomputeActive  │    ║
║   │   loads     │         │ (:1442)          │        │ (t = 0)          │    ║
║   └─────────────┘         └──────────────────┘        └────────┬─────────┘    ║
║                                                                │              ║
║                                                                ▼              ║
║                                                    ┌──────────────────────┐   ║
║                                                    │ hasStarted() = false │   ║
║                                                    │ ◄── NEW GATE         │   ║
║                                                    └──────────┬───────────┘   ║
║                                       pills still render      │               ║
║                                       cue + quiz SKIPPED  ◄───┘               ║
║                                                                               ║
║   ┌─────────────┐         ┌──────────────────┐        ┌──────────────────┐    ║
║   │  learner    │ ──────► │ bus "play"       │ ─────► │ hasStarted armed │    ║
║   │ presses ▶   │         │ handler          │        │ (sticky)         │    ║
║   └─────────────┘         └──────────────────┘        └────────┬─────────┘    ║
║                                                                ▼              ║
║                                                    ┌──────────────────────┐   ║
║                                                    │ t:0 cue fires HERE,  │   ║
║                                                    │ same task as play    │   ║
║                                                    │ → no video blip      │   ║
║                                                    └──────────┬───────────┘   ║
║                                                               ▼               ║
║                                      ┌────────────────────────────────────┐   ║
║                                      │ voice-over pre-rolls (119s)        │   ║
║                                      │ then end({resume:true}) →          │   ║
║                                      │ video plays — NO second press      │   ║
║                                      └────────────────────────────────────┘   ║
║                                                                               ║
║   ┌───────────────────────────────────────────────────────────┐               ║
║   │ (FH) Voice-Over: Intro & Ein…  0:22 ▬▬▬── 1:59 −10s ▶ +10s│  62px         ║
║   │  🎙  von Coach-Stimme • SPIELT                            │  as designed  ║
║   └───────────────────────────────────────────────────────────┘               ║
║                                                                               ║
║   USER_FLOW: open lesson → silence, video paused, overlay idle → press play   ║
║              → voice-over pre-rolls → video continues on its own              ║
║   VALUE_ADD: no audio without consent; the overlay is legible again;          ║
║              a t:0 cue becomes a usable intro instead of a bug                ║
║   DATA_FLOW: mount → recomputeActive(0) → GATE blocks triggers → play event   ║
║              → arm gate → fire due cue → pause video → resume on cue end      ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location                             | Before                                        | After                                                      | User_Action | Impact                          |
| ------------------------------------ | --------------------------------------------- | ---------------------------------------------------------- | ----------- | ------------------------------- |
| Lesson page load                     | t:0 voice-over auto-plays over a paused video | Silent; overlay idle                                       | Open lesson | No audio without consent        |
| `demo-overlays/index.ts` bus handler | `play` only resets quiz `videoEnded`          | `play` also arms the playback gate and fires a due t:0 cue | Press ▶     | t:0 becomes a working pre-roll  |
| Voice-over banner `#vp-slot-lt`      | 200px tall, mic badge detached, text sprawled | 62px, single row, as designed                              | Cue fires   | Overlay stops eating the player |
| Quiz break authored at `t: 0`        | Opens at mount, before play                   | Waits for first play                                       | Press ▶     | Same consent rule as voice-over |
| Seek back before a cue, still paused | Cue re-arms and can fire while paused         | Cue re-arms but cannot fire until playing                  | Scrub       | No surprise audio while paused  |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File                                                 | Lines        | Why Read This                                                                                       |
| -------- | ---------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------- |
| P0       | `runtime-src/demo-overlays/index.ts`                 | 1371-1442    | `recomputeActive` + the bus subscription + the mount-time call — the exact site of Defect 2         |
| P0       | `runtime-src/demo-overlays/index.ts`                 | 872-878      | `maybeTriggerAudio` — the ungated time-window test                                                  |
| P0       | `runtime-src/demo-overlays/index.ts`                 | 296-306      | `ANIM_CSS` inject-once idiom — the pattern to MIRROR for `SLOT_CSS`                                 |
| P0       | `runtime-src/demo-overlays/index.ts`                 | 338-356      | `makeSlot` — where the `vp-slot` class is added                                                     |
| P0       | `runtime-src/demo-overlays/index.ts`                 | 113-125      | `OWNED_NODE_IDS` — the new style id MUST be registered here                                         |
| P1       | `runtime-src/demo-overlays/styles.ts`                | 20-34        | `ANIM_CSS` / `SECTION_CSS` shape + the existing `.vp-section-pill *` white-space precedent          |
| P1       | `runtime-src/admin-toggle/styles.ts`                 | 21           | The identical `container, container *` reset in a sibling script — second precedent                 |
| P1       | `runtime-src/demo-overlays/index.ts`                 | 626-715      | `audioCtrl.activate` / `end({resume})` — the pre-roll pause and the resume path                     |
| P1       | `runtime-src/common/types.ts`                        | 142-151, 183 | `PlayerApi` has NO `paused`; `MediaEl` does — proves the gate must read the element                 |
| P2       | `runtime-src/tests/demo-overlays/audio.test.ts`      | 1-155        | `installPlayerStub` / `setupConfigDom` / `mountAndTrigger` — the harness every new cue test extends |
| P2       | `runtime-src/tests/reskin-player/styles.test.ts`     | 1-59         | The ONLY `getComputedStyle`-on-injected-`*_CSS` precedent in the repo — MIRROR for the reset test   |
| P2       | `runtime-src/tests/demo-overlays/safety-net.test.ts` | 134, 155-164 | Records happy-dom's zero-box `getBoundingClientRect` — why the reset test asserts style, not height |

**External Documentation:**

| Source                                                                                                     | Section                       | Why Needed                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [CSS Text 3](https://drafts.csswg.org/css-text-3/#white-space-processing)                                  | §4 White Space Processing     | The removal rule is scoped to **collapsible** white space — the qualifier that makes Defect 1 possible                                                                                                                                                                        |
| [CSS Text 3](https://drafts.csswg.org/css-text-3/#white-space-phase-1)                                     | §4.1.1 Phase I: Collapsing    | Under `pre`/`pre-wrap` a space run "is treated as a sequence of non-breaking spaces", i.e. **not** collapsible, so §4 never removes it                                                                                                                                        |
| [CSS Text 3](https://drafts.csswg.org/css-text-3/#valdef-white-space-pre)                                  | `white-space: pre`            | "Segment breaks such as line feeds are preserved as **forced line breaks**" — the line box per newline                                                                                                                                                                        |
| [CSS Text 3](https://drafts.csswg.org/css-text-3/#valdef-white-space-pre-wrap)                             | `white-space: pre-wrap`       | "Like `pre`, this value preserves white space" — inherits the above, and is what the host sets                                                                                                                                                                                |
| [CSS Flexbox 1](https://drafts.csswg.org/css-flexbox-1/#flex-items)                                        | §4 Flex Items                 | "if the entire text sequences contains only document white space characters it is instead **not rendered** (just as if its text nodes were `display:none`)" — why only the two `display:block` wrappers broke. Cite **Level 1**; the Level 2 draft does not restate this text |
| [HTML Standard](https://html.spec.whatwg.org/multipage/media.html#internal-play-steps)                     | §4.8.11.8 internal play steps | `paused` is set to `false` as a synchronous step **before** the `play` event task is queued — the guarantee the gate relies on                                                                                                                                                |
| [HTML Standard](https://html.spec.whatwg.org/multipage/media.html#notify-about-playing)                    | notify about playing          | `playing`, not `play`, is the "resumed after being blocked" signal — why gating on `play` is correct                                                                                                                                                                          |
| [Chromium `docs/media/autoplay.md`](https://github.com/chromium/chromium/blob/main/docs/media/autoplay.md) | User gesture lock             | Per-element boolean, unlocked by a gestured `play()`/`load()`, with no documented re-locking — why the post-pre-roll `videoEl.play()` needs no second press. Cite this, **not** the public dev blog, which omits the mechanism                                                |
| [WebKit Blog](https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/)                            | Auto-play policy changes      | "Auto-play restrictions are granted on a **per-element basis**" + "change the source of the media element instead of creating multiple media elements"                                                                                                                        |
| [happy-dom #1416](https://github.com/capricorn86/happy-dom/issues/1416)                                    | Maintainer reply              | "full rendering is **out of scope**" — `getBoundingClientRect`/`offsetHeight`/`clientHeight` are unconditionally 0 by design, while `getComputedStyle` resolves the cascade. The citation for why the height check lives in Level 5                                           |

---

## Patterns to Mirror

**STYLE_INJECTION (inject-once — the variant `SLOT_CSS` must use):**

```typescript
// SOURCE: runtime-src/demo-overlays/index.ts:300-306
// COPY THIS PATTERN:
// ─── Animation keyframes (inject once) ───
if (!document.getElementById("vp-anim-style")) {
  const s = document.createElement("style");
  s.id = "vp-anim-style";
  s.textContent = ANIM_CSS;
  document.head.appendChild(s);
}
```

Two other variants exist and are NOT to be used here — `SECTION_CSS` at `:377-384` (remove-then-append, no `onCleanup`) and `QUIZ_CSS` at `:1008-1015` (remove-then-append **with** `onCleanup`). Inject-once is correct for `SLOT_CSS` because the rule is static and, critically, because it keeps the stylesheet **earliest in `document.head`** — see the specificity GOTCHA.

**SCOPED_RESET_SELECTOR:**

```typescript
// SOURCE: runtime-src/demo-overlays/styles.ts:32
// COPY THIS PATTERN:
      .vp-section-pill, .vp-section-pill * { white-space:normal; }
```

```typescript
// SOURCE: runtime-src/admin-toggle/styles.ts:21
// COPY THIS PATTERN:
    .vp-admin-dialog, .vp-admin-dialog * { white-space:normal; box-sizing:border-box; }
```

**OWNED_NODE_IDS registration:**

```typescript
// SOURCE: runtime-src/demo-overlays/index.ts:113-125
// COPY THIS PATTERN:
// Ids of every node a mount can create, for the safety-net sweep.
const OWNED_NODE_IDS = [
  "vp-slot-tl",
  "vp-slot-tr",
  "vp-slot-br",
  "vp-slot-lt",
  "vp-slot-quiz",
  "vp-demo-sidebar",
  "vp-anim-style",
  "__vp-section-style",
  "__vp-quiz-style",
  AUDIO_EL_ID,
];
```

**STICKY_LATCH naming + rationale-comment style:**

```typescript
// SOURCE: runtime-src/demo-overlays/index.ts:100-110, 133
// COPY THIS PATTERN:
// One mounted overlay set. `cleanups` is MOUNT-scoped — distinct from the
// process-level CLEANUP_KEY registry, which owns the permanent watchers and must
// survive a remount (conflating the two makes a remount kill the observer that
// triggers remounts).
interface MountState {
  ...
  // False once the host has torn our DOM out from under us, or the player we
  // mounted against is gone — the signal to rebuild.
  checkAlive: () => boolean;
}
...
  let everMounted = false;
```

`everMounted` is the existing one-way-latch precedent: mount-scope `camelCase` `let`, with a rationale comment above it saying _why_, not _what_. There is no `armed`/`sticky` vocabulary anywhere in `runtime-src` — do not introduce it.

**PRIORITY_COMMENT at the gate site:**

```typescript
// SOURCE: runtime-src/demo-overlays/index.ts:1390-1396
// COPY THIS PATTERN:
// Priority: an open quiz outranks a voice-over cue, which outranks the
// passive pills. Asking the quiz first is what keeps a cue from starting
// underneath an open dialog.
quizCtrl?.onTime(t);
const quizOpen = quizCtrl?.isActive() === true;

if (!quizOpen) maybeTriggerAudio(t);
```

**TEST_STRUCTURE (computed style on an injected constant):**

```typescript
// SOURCE: runtime-src/tests/reskin-player/styles.test.ts:1-30, 48-59
// COPY THIS PATTERN:
import { afterEach, describe, expect, it } from "vitest";
import { RESKIN_CSS } from "../../reskin-player/styles";

function mountNativeChrome(): { host: HTMLElement; mediaControls: HTMLElement; slotUi: HTMLElement } {
  const style = document.createElement("style");
  style.textContent = RESKIN_CSS;
  document.head.appendChild(style);
  ...
}

afterEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});

describe("RESKIN_CSS native-chrome hiding (F1)", () => {
  it("AC1: native controls stay visible when the marker is absent", () => {
    const { mediaControls, slotUi } = mountNativeChrome();
    expect(getComputedStyle(mediaControls).display).not.toBe("none");
```

**TEST_STRUCTURE (full mount driving a real media element):**

```typescript
// SOURCE: runtime-src/tests/demo-overlays/audio.test.ts:99-117
// COPY THIS PATTERN:
async function mountAndTrigger(config: unknown): Promise<{...}> {
  installPlayerStub();
  const video = setupConfigDom(config);
  await import("../../demo-overlays/index");
  await nextFrames();
  // The learner was watching, so the video is playing when the cue fires.
  await video.play();
  emitTime(2);
  return { video, audio: document.querySelector("audio") as HTMLAudioElement, slot: ... };
}
```

---

## Files to Change

| File                                             | Action | Justification                                                                                  |
| ------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------- |
| `runtime-src/demo-overlays/styles.ts`            | UPDATE | Add the `SLOT_CSS` export                                                                      |
| `runtime-src/demo-overlays/index.ts`             | UPDATE | `vp-slot` class in `makeSlot`; inject `SLOT_CSS`; register the style id; add the playback gate |
| `runtime-src/tests/demo-overlays/render.test.ts` | UPDATE | Add the `SLOT_CSS` reset assertions (slot-level concern, belongs with the render tests)        |
| `runtime-src/tests/demo-overlays/audio.test.ts`  | UPDATE | Add the t:0 gate + pre-roll + resume tests                                                     |
| `runtime-src/tests/demo-overlays/quiz.test.ts`   | UPDATE | Add the "quiz at t:0 does not open at mount" test                                              |
| `public/runtime/demo-overlays.js`                | UPDATE | GENERATED by `bun run build:runtime` — committed, CI drift-checks it                           |
| `docs/feature-context.md`                        | UPDATE | Record the pre-wrap host constraint as a gotcha                                                |

---

## NOT Building (Scope Limits)

- **The card redesign.** Moving to main's 320px bottom-right composition is a separate, decided piece of work tracked in `2026-09-04_vo-redesign_main-composition-dark-card.plan.md`. This plan restores the _existing_ lower-third design to its intended 62px and nothing more.
- **Changing `quiz.ts`'s `previousTime = -0.01`.** `docs/feature-context.md:314` records that value as intentional (resume-at-position). The gate sits _above_ `onTime`, leaving the crossing model untouched.
- **Removing the automatic `videoEl.play()` in `end({resume:true})`.** The user's decision is explicitly that the video resumes after the pre-roll with no second press. All four `end({resume:true})` call sites keep their current behaviour.
- **A `playing`-event-based gate.** `play` is correct and sufficient; `playing` fires only after a blocked start resolves and would delay the pre-roll.
- **Any `data-testid` or new public runtime surface.** The e2e canary asserts only what the runtime already publishes (`feature-context.md` 2026-08-07); adding a hook would reach past that contract.
- **Touching `renderAudio`'s markup.** The reset fixes the height without editing the template. Re-indenting or flattening the markup is the redesign plan's business.

---

## Step-by-Step Tasks

Execute in order. Each task is atomic and independently verifiable.

**Status markers** — prefix EVERY task header with one; the build agent updates it inline as it works: `[ ]` idle · `[wip]` in progress · `[x]` complete · `[f]` failed. All tasks start `[ ]`. If a task cannot be made to pass, mark it `[f]`, record why in Agent Notes, and move on if the rest of the plan can still proceed.

### `[x]` Task 1: UPDATE `runtime-src/demo-overlays/styles.ts`

- **ACTION**: ADD a new exported `SLOT_CSS` constant
- **IMPLEMENT**: `export const SLOT_CSS` holding a single rule, `.vp-slot, .vp-slot * { white-space:normal; }`, with a comment explaining that the LearningSuite custom-code block wrapper sets `white-space: pre-wrap`, that it inherits into every injected node, and that a whitespace-only text node in a **block** container then generates a preserved line box per newline of an indented template literal. Note in the comment that flex containers are immune, which is why only the audio banner visibly broke.
- **MIRROR**: `runtime-src/demo-overlays/styles.ts:31-34` — the `SECTION_CSS` export shape and its `.vp-section-pill, .vp-section-pill *` comma-joined selector; and `runtime-src/admin-toggle/styles.ts:21` for the identical reset in a sibling script
- **PATTERN**: place the export **between** `ANIM_CSS` and `SECTION_CSS` so declaration order in the file matches injection order in `index.ts`
- **GOTCHA**: do NOT add `box-sizing:border-box` (the admin-toggle precedent carries it, this does not need it) and do NOT widen the rule to anything the runtime does not own — the selector must never match host DOM
- **VALIDATE**: `bun run typecheck:runtime`

### `[x]` Task 2: UPDATE `runtime-src/demo-overlays/index.ts` — tag the slots

- **ACTION**: ADD a `vp-slot` class to every `makeSlot`-created element
- **IMPLEMENT**: in `makeSlot`, set `el.className = "vp-slot"` immediately after `el.id = id`
- **MIRROR**: `runtime-src/demo-overlays/index.ts:338-341` — `makeSlot`'s existing `el.id` / `el.style.cssText` assignment block
- **GOTCHA**: a **class**, not five id selectors. `makeSlot` creates `vp-slot-tl/-tr/-br/-lt` and conditionally `vp-slot-quiz`; a class means a sixth slot added later is covered for free, and it matches both existing reset precedents, which are class-scoped. The e2e canary asserts `#vp-slot-*` **by id** (`feature-context.md` 2026-08-07) — adding a class does not disturb those selectors.
- **VALIDATE**: `bun run typecheck:runtime && bun run test runtime-src/tests/demo-overlays/`

### `[x]` Task 3: UPDATE `runtime-src/demo-overlays/index.ts` — inject `SLOT_CSS`

- **ACTION**: ADD the inject-once block and register the new style id
- **IMPLEMENT**: (a) import `SLOT_CSS` from `./styles`; (b) inject it with the inject-once idiom under a `// ─── Injected-slot white-space reset (inject once) ───` banner comment, placed **immediately before** the existing `ANIM_CSS` block at `:300`; (c) add `"vp-slot-style"` to `OWNED_NODE_IDS`
- **MIRROR**: `runtime-src/demo-overlays/index.ts:300-306` for the injection block; `:113-125` for the id list
- **IMPORTS**: extend the existing line to `import { ANIM_CSS, QUIZ_CSS, SECTION_CSS, SLOT_CSS, T } from "./styles";` (alphabetical, matching the current order)
- **GOTCHA — INJECTION ORDER IS LOAD-BEARING.** `.vp-slot *` has specificity `0,1,0`, exactly tying `.vp-quiz-summary-row-text { white-space:nowrap }` (`styles.ts:157`). Ties resolve by source order, so `SLOT_CSS` MUST be injected **before** `QUIZ_CSS` (`:1008`) or the quiz summary rows lose their ellipsis truncation. Injecting at the `ANIM_CSS` site guarantees this: `ANIM_CSS`/`SLOT_CSS` are inject-once and stay put, while `SECTION_CSS` and `QUIZ_CSS` are remove-then-append and therefore always move to the end of `document.head` on every mount. Unaffected by the tie: `.vp-section-pill .vp-sec-title` etc. (`styles.ts:34,52,54`) are `0,2,0` and win outright, and the four inline `white-space:nowrap` declarations (`index.ts:552,920,922,991`) always beat any stylesheet.
- **GOTCHA**: `vp-slot-style` uses the bare `vp-*` prefix (matching `vp-anim-style`), not the `__vp-*` prefix used by the two remove-then-append stylesheets. The prefix tracks the injection idiom, not the file.
- **VALIDATE**: `bun run typecheck:runtime && bun run test runtime-src/tests/demo-overlays/`

### `[x]` Task 4: UPDATE `runtime-src/demo-overlays/index.ts` — the playback-start gate

- **ACTION**: ADD a sticky latch and gate the two playback-altering calls in `recomputeActive`
- **IMPLEMENT**: under the existing `// ─── Time sync ───` banner, immediately above `recomputeActive` (`:1371`), add a mount-scoped `let playbackStarted = false;` plus a `hasPlaybackStarted()` helper that returns `true` once set, and otherwise sets and returns `true` when `videoEl && !videoEl.paused`. Then inside `recomputeActive`, replace the two trigger calls with a gated form: compute `const started = hasPlaybackStarted();` before the priority block, call `quizCtrl?.onTime(t)` only when `started`, keep `const quizOpen = quizCtrl?.isActive() === true;` unconditional, and call `maybeTriggerAudio(t)` only when `started && !quizOpen`. Extend the existing "Priority:" comment to state that neither trigger may fire before the learner has actually started playback.
- **MIRROR**: `runtime-src/demo-overlays/index.ts:1390-1396` for the block being edited and its comment style; `:133` (`let everMounted = false`) for the latch's naming and scope
- **PATTERN**: gate **only** the two trigger calls — never wrap or early-return the whole of `recomputeActive`
- **GOTCHA — DO NOT GATE ALL OF `recomputeActive`.** `renderSection()`, `renderMetaStep(t)` and `renderScience(t)` have **no call site anywhere outside `recomputeActive`** (`:1388`, `:1406`, `:1404/1407`). An early return before first play would leave the section pill (`slotTL`), meta pill (`slotBR`) and science pill (`slotTR`) unpopulated on a paused lesson — a visible regression. `renderCoaching()` and `renderMeta()` do have standalone mount-time calls (`:1290`, `:1368`), the other three do not.
- **GOTCHA — READ THE ELEMENT, NOT THE BUS EVENT.** Two independent reasons. **(a) The existing suite.** `audio.test.ts`'s `mountAndTrigger` (`:99-117`) does `await video.play()` then `emitTime(2)`; its `installPlayerStub` bus handlers only ever receive `type: "time"` and **never** `type: "play"`, so an event-armed latch fails every existing cue test. happy-dom tracks `paused` correctly (verified: `true` → `false` across `play()`). **(b) Remount correctness.** `playbackStarted` is a closure `let`, so `teardownMount()` → `mount()` resets it to `false` (mount-scoped state is discarded per `:249`; only `w.__vp*` globals survive). If a remount fires mid-playback the next bus event is a `time`, not a `play` — an event-armed latch would then stay closed and suppress every remaining cue for the rest of the lesson. Reading `videoEl.paused` re-arms immediately on that first `time`.
- **GOTCHA**: `window.player` is typed `PlayerApi` (`common/types.ts:142-151`) and has **no `paused` field**. Read `videoEl`, captured at `:566` as `findPlayers()[0] ?? null` and typed `MediaEl = HTMLMediaElement & {...}` (`common/types.ts:183`). Guard the null case.
- **GOTCHA**: the latch must be **one-way**. A later `pause` must not re-close it, or pausing mid-lesson would suppress every subsequent cue.
- **GOTCHA — THE GATE IMPROVES AUTOPLAY RELIABILITY; IT DOES NOT RISK IT.** Chrome's gesture lock is **per element** ([Chromium `docs/media/autoplay.md`](https://github.com/chromium/chromium/blob/main/docs/media/autoplay.md)), and `#vp-audio-el` is a different element from `videoEl` — a gesture on the video does not unlock the audio element. That sounds like a new risk introduced by moving the cue behind a gate; it is the opposite. Today the cue fires at mount with **no** user gesture anywhere, and it was still observed playing on the live tenant (`audioTime: 35`). After this change it fires inside the `play` handler, i.e. within the transient-activation window of the learner's click — strictly more likely to be permitted, not less. And a rejected `audioEl.play()` already degrades to TTS via `startFile`'s `p.catch(() => fallbackToTts(a))` (`index.ts:610-612`), which is the documented failure policy. Do not add autoplay-recovery code.
- **GOTCHA — NO SEPARATE PLAY-HANDLER EDIT IS NEEDED.** The bus subscription (`:1425-1440`) already routes `play` into `recomputeActive(e.time ?? …)`. `bus.emit` invokes handlers synchronously with no timer or microtask indirection (`common/bus.ts:24-31`), `reskin-player/index.ts:1105` binds `onPlay` to the native `play` DOM event and emits at `:1048-1052`, and `play()` sets `paused = false` **before** the `play` event is queued. So the gate opens and the due `t: 0` cue fires — pausing the video again — inside the same call stack as the native play event. Do NOT add a second trigger call in the `play` branch; that would double-fire.
- **VALIDATE**: `bun run typecheck:runtime && bun run test runtime-src/tests/demo-overlays/`

### `[x]` Task 5: UPDATE `runtime-src/tests/demo-overlays/render.test.ts`

- **ACTION**: ADD a describe block covering the `SLOT_CSS` reset
- **IMPLEMENT**: three cases. (1) Without the reset, a slot descendant nested under an ancestor carrying inline `white-space: pre-wrap` computes to `pre-wrap` — establishes the host condition. (2) With `SLOT_CSS` injected and the slot carrying `class="vp-slot"`, the same descendant computes to `normal`. (3) Guard the specificity contract: with `SLOT_CSS` injected **before** `QUIZ_CSS`, an element with `class="vp-quiz-summary-row-text"` inside a `.vp-slot` still computes `white-space: nowrap`.
- **MIRROR**: `runtime-src/tests/reskin-player/styles.test.ts:1-30, 48-59` — import the `*_CSS` constant directly, append a `<style>` to `document.head`, assert via `getComputedStyle`, and clear both `document.body.innerHTML` and `document.head.innerHTML` in `afterEach`
- **IMPORTS**: `import { QUIZ_CSS, SLOT_CSS } from "../../demo-overlays/styles";`
- **GOTCHA — ASSERT COMPUTED STYLE, NEVER GEOMETRY.** happy-dom returns `0` from `getBoundingClientRect()` even for an element with an explicit `height: 62px` (verified; the same limitation is recorded at `safety-net.test.ts:134` and worked around at `:155-164`). The real defect is a height, but the only assertable proxy here is the computed `white-space`. Verified working in happy-dom 20.11.1: inheritance through an ancestor's inline style, and override by a scoped stylesheet.
- **GOTCHA**: case 3 must append the two stylesheets in the same relative order the runtime does, or it asserts nothing.
- **VALIDATE**: `bun run test runtime-src/tests/demo-overlays/render.test.ts`

### `[x]` Task 6: UPDATE `runtime-src/tests/demo-overlays/audio.test.ts`

- **ACTION**: ADD a describe block for the playback-start gate
- **IMPLEMENT**: four cases, all with `audios: [{ id: "a1", t: 0, dur: 8, ... }]`. (1) After mount with **no** `play()` and **no** `emitTime`, `__audioCtrl.state === "idle"` and `#vp-slot-lt` has no `data-kind` — this is the reproduction of the live defect. (2) The passive pills still render in that paused state (assert the section pill in `#vp-slot-tl` is populated) — proves only the triggers were gated. (3) On the first `play` the cue fires: emit a bus `play` event after `await video.play()`, then assert `state === "playing"` and `video.paused === true` (the pre-roll paused it). (4) On cue end the video resumes with no second press: dispatch `ended` on the `<audio>` element by hand, then assert `video.paused === false` and `video.currentTime === 0`.
- **MIRROR**: `runtime-src/tests/demo-overlays/audio.test.ts:99-117` (`mountAndTrigger`) — but do NOT reuse it for case 1/2, since it calls `video.play()`; write a `mountOnly` sibling that stops after `nextFrames()`. Cases 3/4 follow the existing `beforeEach` cleanup discipline at `:119-149`.
- **GOTCHA**: happy-dom never fires `timeupdate`/`ended` on its own — dispatch them by hand (`feature-context.md` 2026-07-27). Case 4 depends on `onAudioEnded` (`index.ts:809-813`).
- **GOTCHA**: the existing `installPlayerStub` emits only `type: "time"`. Case 3 needs a `play` bus event, so extend the local helper with an `emitPlay()` rather than reaching for `emitTime`.
- **GOTCHA**: use the real `<video data-vp-player>` from `setupConfigDom` (`:36-47`), never `<hls-video>` — the latter is an unknown element in happy-dom with no media methods, so `.paused`/`.play()` do not work.
- **VALIDATE**: `bun run test runtime-src/tests/demo-overlays/audio.test.ts`

### `[x]` Task 7: UPDATE `runtime-src/tests/demo-overlays/quiz.test.ts`

- **ACTION**: ADD a case proving a quiz authored at `t: 0` does not open at mount
- **IMPLEMENT**: a full-mount case (not a bare `createQuizController` unit case) with a quiz whose `t === 0`; after mount with no `play()`, assert the quiz scrim is absent / `quizCtrl.isActive() === false`; then after a `play` event, assert it opens.
- **MIRROR**: the full-mount harness in `runtime-src/tests/demo-overlays/audio.test.ts:99-117`, not `quiz.test.ts`'s own `createQuizController` harness at `:53-90` — the defect is in `recomputeActive`, which a controller-only test never reaches
- **GOTCHA**: `previousTime = -0.01` means the **first** `onTime(0)` window spans `(-0.01, 0]` and legitimately catches a `t: 0` break — this is intentional resume-at-position behaviour (`feature-context.md:314`). The test asserts the **gate** prevents that first call from happening before play; it must NOT assert anything about the crossing model itself.
- **GOTCHA**: `quiz.test.ts`'s `document`-level capture listeners outlive a test file — dispose harnesses in `afterEach` or later tests fail on intercepted clicks (`feature-context.md` 2026-08-04).
- **VALIDATE**: `bun run test runtime-src/tests/demo-overlays/quiz.test.ts`

### `[x]` Task 8: UPDATE `public/runtime/demo-overlays.js` (generated)

- **ACTION**: REBUILD the committed runtime bundles
- **IMPLEMENT**: run `bun run build:runtime` and stage the regenerated `public/runtime/*.js`
- **PATTERN**: never hand-edit `public/runtime/*.js` — it is esbuild output (Standing Constraint, `feature-context.md:12-23`)
- **GOTCHA**: the `.js` are committed and CI drift-checks them with `git diff --exit-code -- public/runtime`. Skipping this task turns the plan green locally and red in CI.
- **GOTCHA**: `.prettierignore` excludes the generated `.js` so the pre-commit `pretty-quick` does not fight the drift check. If CRLF ever reappears, recover with `prettier --write` on the affected files then rebuild (`feature-context.md:74-84`).
- **VALIDATE**: `bun run build:runtime && git diff --exit-code -- public/runtime && echo "no drift"`

### `[x]` Task 9: UPDATE `docs/feature-context.md`

- **ACTION**: ADD an entry recording the host constraint and the gate decision
- **IMPLEMENT**: a new dated section (`## 2026-09-04 · vo-defects · …`) carrying: the `white-space: pre-wrap` inheritance gotcha with the block-vs-flex asymmetry and the measured 200px → 62px figure; the injection-order/specificity constraint from Task 3; the decision that the gate reads the element rather than the bus event, with both reasons; the decision that only the two trigger calls are gated and why; and the user's t:0 pre-roll decision. Promote the pre-wrap constraint to **Standing Constraints** — it applies to any future injected markup, not just this feature.
- **MIRROR**: `docs/feature-context.md:285-329` (the `spike-parity` entry) — Decision / Deviation / Gotcha / User feedback bullet vocabulary
- **PATTERN**: decisions and constraints only, never a changelog (`docs/feature-context.md:3-5`)
- **VALIDATE**: `grep -c "pre-wrap" docs/feature-context.md` returns ≥ 1

---

## Testing Strategy

### Unit Tests to Write

| Test File                                        | Test Cases                                                                                                                      | Validates                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `runtime-src/tests/demo-overlays/render.test.ts` | inherits `pre-wrap` without the reset; computes `normal` with it; quiz `nowrap` survives the specificity tie                    | `SLOT_CSS` + injection order     |
| `runtime-src/tests/demo-overlays/audio.test.ts`  | t:0 idle at mount; pills still render while paused; cue fires on first play and pauses the video; video resumes at 0 on cue end | the gate + the pre-roll contract |
| `runtime-src/tests/demo-overlays/quiz.test.ts`   | quiz at t:0 closed at mount, open after play                                                                                    | the gate covers both controllers |

### Edge Cases Checklist

- [ ] Cue at `t: 0` — idle at mount, fires on first play (the reported defect)
- [ ] Cue at `t: 30` — unchanged by the gate (existing suite is the control)
- [ ] Pause mid-lesson, then a cue comes due — latch is one-way, so the cue still fires
- [ ] Remount mid-playback (config edit / host DOM strip) — latch resets but re-arms on the first `time` event because `videoEl.paused === false`
- [ ] Remount while paused at `t: 0` — latch stays closed, cue does not fire
- [ ] Seek backwards past a cue while paused — cue re-arms (`maybeTriggerAudio`'s `t < a.t - 0.5` sweep) but cannot fire until playing
- [ ] `videoEl === null` (no player discovered) — `hasPlaybackStarted()` returns false, nothing fires, no throw
- [ ] Quiz at `t: 0` — same gate applies
- [ ] Quiz summary row with long text — still ellipsis-truncated after the reset
- [ ] Section pill / meta pill / science pill — all populated on a paused, never-played lesson

---

## Validation Commands

🔁 **Validation loop:** the plan is not complete until every command below passes (exit 0). On any failure, fix the cause and re-run — loop until all pass. If a check is genuinely impossible, mark it `[f]`, note why in Agent Notes, and move on.

### Level 1: STATIC_ANALYSIS

```bash
bun run typecheck:runtime
rm -rf .next/cache/eslint && bun run lint
```

**EXPECT**: `typecheck:runtime` exits 0. **`bun run lint` already exits 1 on this branch** — 7 pre-existing errors in `app/admin/`, `app/api/lessons/`, `components/video-player/` (`feature-context.md:320-324`). Compare a cache-free run against `HEAD` and require **no new** findings in `runtime-src/`; do not chase the pre-existing 7.

### Level 2: UNIT_TESTS

```bash
bun run test runtime-src/tests/demo-overlays/
```

**EXPECT**: all pass, including the 423 pre-existing lines of `audio.test.ts` unchanged in behaviour.

### Level 3: FULL_SUITE

```bash
bun run test
bun run build:runtime && git diff --exit-code -- public/runtime
```

**EXPECT**: full vitest suite green; no `public/runtime` drift after the rebuild. Note `bun run test`, **never** `bun test` — the latter is Bun's own runner with no happy-dom and collects 182 failures (`feature-context.md:349-351`).

### Level 4: DATABASE_VALIDATION

Not applicable — no schema change.

### Level 5: BROWSER_VALIDATION

Against the live platform, since the defect only reproduces on a host that sets `white-space: pre-wrap`:

- [ ] Start the debug Chrome (`~/.claude/skills/debugging-chrome-from-wsl/chrome-debug`), log into `robbins.greator.com`, open `.../editor/fBq5ZVTL/CV1Bklhy/yPClsb9h/pgWcT1Bk?view=preview`
- [ ] Point the tenant at the local runtime (`bun dev` + the local-first loader probe, `feature-context.md` 2026-09-01 `local-first-runtime`), or redeploy and bump the tenant tag
- [ ] On load: video paused at `0:00`, **no audio**, `__audioCtrl.state === "idle"`, `#vp-slot-lt` empty
- [ ] Section pill visible in `#vp-slot-tl` while still paused
- [ ] Press play: voice-over starts, video pauses, no audible blip of video audio first
- [ ] `#vp-slot-lt > *` measures **62px**, not 200px: `document.querySelector('#vp-slot-lt > *').getBoundingClientRect().height`
- [ ] Mic badge sits on the avatar's bottom-right corner, not detached
- [ ] Cue ends: video resumes from `0:00` **without** a second press
- [ ] `bun run e2e` still passes 4/4

### Level 6: MANUAL_VALIDATION

1. Author a config with `audios: [{ t: 0, ... }, { t: 45, ... }]` and a quiz at `t: 0`.
2. Load the lesson, wait 30s without touching anything — confirm total silence and no quiz dialog.
3. Press play once — confirm the voice-over pre-rolls, then the video runs on by itself.
4. Let the video reach `t: 45` — confirm the second cue behaves exactly as before this change.
5. Pause mid-lesson before `t: 45`, resume — confirm the cue still fires (one-way latch).

---

## Acceptance Criteria

- [ ] A cue authored at `t: 0` does not play until the learner presses play
- [ ] After that single press, the voice-over pre-rolls and the video then plays with no second press
- [ ] A quiz authored at `t: 0` obeys the same rule
- [ ] The voice-over banner measures 62px on the live platform
- [ ] The passive pills still render on a paused, never-played lesson
- [ ] `.vp-quiz-summary-row-text` still truncates with an ellipsis
- [ ] Level 1–3 validation pass (lint judged as no-new-findings, see Level 1)
- [ ] No regressions: all pre-existing `runtime-src/tests/` cases pass unchanged
- [ ] `public/runtime` shows no drift after `bun run build:runtime`
- [ ] `docs/feature-context.md` records the pre-wrap constraint under Standing Constraints

---

## Completion Checklist

- [ ] All 9 tasks completed in dependency order
- [ ] Each task validated immediately after completion
- [ ] Level 1: `typecheck:runtime` clean; no new lint findings in `runtime-src/`
- [ ] Level 2: `demo-overlays` tests pass
- [ ] Level 3: full suite + no `public/runtime` drift
- [ ] Level 5: browser validation on the live tenant complete
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk                                                                            | Likelihood | Impact | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A frame or moment of video audio plays before the pre-roll pause lands          | LOW        | LOW    | The pause runs in the same call stack as the native `play` event (synchronous `bus.emit`, `paused` already false). If a blip is observed in Level 5, add a capture-phase `play` listener on `videoEl` that pauses synchronously — do not restructure the gate.                                                                                                                                                                                                                                                                                                                               |
| The reset clobbers a `nowrap` somewhere not audited                             | LOW        | MED    | Full audit done: one stylesheet tie (`.vp-quiz-summary-row-text`, resolved by injection order and pinned by a test), three higher-specificity `.vp-section-pill` rules, four inline declarations that always win. Task 5 case 3 is the regression guard.                                                                                                                                                                                                                                                                                                                                     |
| A remount leaves the gate closed and suppresses cues for the rest of the lesson | LOW        | HIGH   | This is exactly why the latch reads `videoEl.paused` rather than the `play` event; covered by the remount edge cases.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Safari requires a fresh gesture for the post-pre-roll `videoEl.play()`          | LOW        | MED    | **Resolved by research.** Not a Chrome/Safari divergence: both scope the gesture unlock per **element**, and neither documents re-locking. WebKit's actual warning is "change the source of the media element instead of creating multiple media elements" — which this runtime already satisfies (one persistent `#vp-audio-el` per mount, `feature-context.md` 2026-07-27). `videoEl` is the element the learner gestured on, so its unlock holds. The residual gap is documentation quality, not behaviour: Chromium states the per-element lock mechanistically, WebKit only implies it. |
| The tenant tag still points at an immutable per-commit deployment               | HIGH       | MED    | Known standing issue (`feature-context.md` 2026-09-02): every runtime change needs a manual tenant edit. Use the local-first loader probe for Level 5 instead of redeploying.                                                                                                                                                                                                                                                                                                                                                                                                                |

---

## Questionables

<details>
<summary>Should the `vp-slot` class be added to `makeSlot`, or should the reset use five id selectors?</summary>

Took the class. `makeSlot` currently sets only `el.id`, so a class is a new (one-line) convention for these elements — but both existing precedents in the codebase (`.vp-section-pill`, `.vp-admin-dialog`) are class-scoped, a class covers any sixth slot added later for free, and it keeps the selector list to one rule instead of ten. The e2e canary's `#vp-slot-*` id assertions are unaffected. Reverting to id selectors is mechanical if the class turns out to collide with host CSS.

</details>

<details>
<summary>Is `render.test.ts` the right home for the `SLOT_CSS` cases?</summary>

Took `render.test.ts` because the reset is a slot-level rendering concern and that file already owns slot assertions. The alternative — a new `runtime-src/tests/demo-overlays/styles.test.ts` mirroring `tests/reskin-player/styles.test.ts` — is arguably cleaner and would match the sibling script's layout exactly. Either is defensible; a reviewer preferring the symmetry should move them.

</details>

<details>
<summary>Does the gate belong in `demo-overlays/index.ts`, or lower down in a shared module?</summary>

Took `index.ts`, because `recomputeActive` is the single point through which both controllers receive time and it is where the priority ordering already lives. A shared `common/` helper would be over-abstraction for one boolean read — and `feature-context.md` records a standing preference against pulling `lib/`-style shared code into the bundle.

</details>

---

## Agent Notes

**Branch decision (user, this session).** Everything lands on `feature/e2e-canary-playwright`, not a fresh `git flow bugfix` branch — the user wants these changes in the same PR as the canary work. This deviates from `.claude/CLAUDE.md`'s per-story branch guidance and from my own earlier recommendation to ship the bugfixes on their own branch. Consequence for review: the PR mixes canary work with two unrelated voice-over changes, so a reviewer cannot bisect a canary failure from a voice-over failure by branch. Worth calling out in the PR description.

**How the two defects were found.** Not from code reading. The layout defect was measured live in Chrome 152 on the tenant: the card's `display:block` children came back at 160px and 178px while its `display:flex` children were correct at 13px and 31px, and stripping whitespace-only text nodes with a walk over `childNodes` took the card from 200px to exactly 62px. The one-line reset was then applied on the live page and the card snapped to 62px before/after in the same session. The trigger defect was read off `window.__audioCtrl` on the live page — `{videoPaused: true, videoTime: 0, audioState: "playing", audioTime: 35, cueT: 0}` — then reduced to a vitest case that fails deterministically.

**Why the reset is scoped to the slots and not the banner.** The banner is the only _visible_ casualty, but it is not the only exposure. Measured on the live page: the science and meta pills are immune because they are `inline-flex`, and per the Flexbox spec a whitespace-only text run in a flex container generates no anonymous flex item. The quiz card is immune for an unrelated reason — `quiz.ts` builds its DOM through the `qzEl()` `createElement` helper and so never creates a stray text node at all. Both immunities are incidental. Any future `innerHTML` template with a `display:block` wrapper regresses silently and invisibly in local dev, which is the argument for fixing it at the slot roots once.

**Approach considered and rejected: re-indent the markup.** Flattening `renderAudio`'s template literal onto fewer lines, or stripping whitespace nodes after assignment, would also fix the height. Rejected — it fixes one renderer, makes the markup unreadable, and leaves the trap armed for the next author. The reset is one rule and covers everything the runtime owns.

**Approach considered and rejected: gate inside each controller.** Adding the check to `maybeTriggerAudio` and to `quiz.ts`'s `onTime` separately would work but duplicates the rule in two places and puts it below the priority ordering that `recomputeActive` owns. One gate above both call sites is the smaller change and keeps `quiz.ts` untouched.

**The pre-roll needs no code.** Worth restating because it looks too good: the `play` bus event already reaches `recomputeActive(e.time)`, `bus.emit` is synchronous with no timer indirection, `reskin-player` binds its emitter to the native `play` DOM event, and `play()` sets `paused = false` before that event is queued. So the moment the gate consults `videoEl.paused` inside the `play` branch it reads `false`, opens, and `maybeTriggerAudio(0)` fires the `t: 0` cue — which pauses the video again — all before the event loop yields. `videoResumeTime` is captured as the `t` passed in, i.e. `0`, so `end({resume:true})` seeks back to `0` and plays. That is precisely the behaviour the user asked for, out of the existing wiring.

**A spec footnote, so a later reader does not over-conclude.** The HTML Standard's ["allowed to play"](https://html.spec.whatwg.org/multipage/media.html#allowed-to-play) definition offers a _non-normative_ example that ties permission to **transient** activation — which expires — rather than sticky activation. Read literally, that example would imply the post-pre-roll resume needs a fresh-ish gesture. Both Chrome and Safari are in fact **more permissive** than the spec's own illustration: each documents a per-element unlock with no expiry. So the behaviour this plan relies on is a browser-implementation choice that the spec illustrates but does not mandate. It is well-established and unchanged by this plan, but it is not spec-guaranteed, and a future reader should not cite the spec as if it were.

**happy-dom capability boundary, measured this session.** Inheritance of `white-space` through an ancestor's inline style: works. Override by a scoped stylesheet: works. `getBoundingClientRect().height` on an element with an explicit `height: 62px`: returns `0`. So the height defect — the actual user-visible symptom — is **not** assertable in the unit suite at all; the computed `white-space` is the only available proxy, and the real height check lives in Level 5 against the live platform. This is a genuine coverage gap, not an oversight: worth stating plainly in the PR rather than implying the unit tests prove the fix.

**Test-harness asymmetry that shaped Task 4.** `installPlayerStub` differs per test file. `lifecycle.test.ts:12-14` and `safety-net.test.ts:6-8` hardcode `current: 0`, which is _why_ the mount-time `recomputeActive(window.player.current ?? 0)` defect reproduces so readily under those fixtures; `render.test.ts` and `audio.test.ts` track `currentTime` explicitly. There is no shared test-utils module for `demo-overlays` — each file defines its own helpers. Do not refactor that as part of this plan.

**Follow-up, out of scope.** `feature-context.md` 2026-07-24 records Preact/JSX for the `demo-overlays` UI as the intended follow-up, which would structurally remove both the innerHTML XSS class and this whitespace class at once. The reset is the right fix today and would become redundant then.

---

## Amendments

<details>
<summary>2026-09-04 — Implemented. Two plan-level errors corrected during the build.</summary>

All 9 tasks complete. 359 tests pass (demo-overlays 81 → 93), typecheck clean, no new lint
findings in `runtime-src/`, bundle rebuilt.

**Correction 1 — the style id collided with a reserved prefix.** Task 3 specified
`vp-slot-style`. `mountInner`'s defensive sweep removes every `OWNED_NODE_IDS` entry starting
with `vp-slot-` (intended for the slot _elements_), so the runtime deleted its own stylesheet
three lines after injecting it. Renamed `__vp-slot-style`. The plan reasoned about the
`vp-*`/`__vp-*` prefix convention but never noticed the prefix is a namespace. Found only by
running the real bundle in real Chrome — Task 5's tests append `SLOT_CSS` by hand, so they
proved the rule's content while never exercising its wiring. A mount-level test now pins it
(verified red with the collision reintroduced).

**Correction 2 — the specificity mitigation was untestable as designed.** Task 3's GOTCHA
relied on injection order to break the 0,1,0 tie with `.vp-quiz-summary-row-text`, and Task 5
case 3 was meant to guard it. happy-dom resolves specificity correctly but does **not** model
equal-specificity source-order tiebreaks: it reported the reset winning where Chrome 152
reports the later rule winning. Raised the quiz rule to `.vp-quiz-card
.vp-quiz-summary-row-text` (0,2,0) instead, which is order-independent and assertable in both
environments. Injection order is retained but is no longer load-bearing.

**Smaller deviations.** (a) The existing `falls back when play() is rejected by the autoplay
policy` test stubs `play()` on the prototype and never played the video, so under the gate its
cue correctly never fired — it now plays the video before installing the stub, assertions
unchanged. Task 4's claim that the element-state gate keeps the entire suite green was wrong
for that one test. (b) Task 7's quiz tests went into `audio.test.ts` beside the other gate
tests rather than `quiz.test.ts`, which has no mount harness.

**Level 5 caveat.** Browser validation ran against a local harness reproducing the host's
`pre-wrap` wrapper with the real built bundle, not the live tenant: the tenant loads
`demo-overlays.js` as a direct tag from an immutable deployment URL, and Chrome refused the
loopback override with a Local Network Access denial. Behaviour is fully verified (200px → 66px
single row; idle at mount; pre-roll on one press; automatic resume) but the LearningSuite
integration and exact font metrics are not — the harness measured 66px against a 62px target.

Full record: `.claude/PRPs/reports/2026-09-04_vo-defects_prewrap-reset-and-playback-gate-report.md`

</details>
