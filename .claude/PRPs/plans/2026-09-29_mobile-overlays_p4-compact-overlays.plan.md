# Feature: Mobile overlays P4 — compact overlays keyed on the player box

## Summary

A `ResizeObserver` on the player host decides, through `isCompact(width, height)`, whether the
in-player overlays use their compact variants, and sets `data-vp-compact="1"` on every `.vp-slot`.
The variants are CSS keyed on that attribute:

- a one-row voice-over bar (~56px);
- the science pill as icon + "Öffnen";
- a section pill that reserves the top-right corner and opens the sheet on tap;
- a capped meta pill;
- buttons at least 40px.

Independently of compact mode, every `:hover` rule moves under `@media (hover:hover)`, and on
touch devices that aren't compact a tap pins the section pill (the unused `data-pinned` CSS).
`bottom:58px` stays, as measured. **`isCompact` is written by the user** (learning-mode
contribution).

## User Story

As a learner on a phone (or in a narrow desktop window)
I want the video overlays to fit the player without covering each other
So that I can read and tap them while watching

## Problem Statement

At 390×219 (spec M2–M5):

- the voice-over card (320×168) starts 7px above the player and is clipped, and it covers the
  section pill;
- the science pill (x 71–380) overlaps the section pill (x 14–175);
- "Öffnen" is 58×23;
- a tap opens the section pill through sticky `:hover` to 228×191, almost the whole video.

At 1024px desktop the player is 461×260 (M12), so the problem is not phone-only.

## Solution Statement

- `compact.ts`: `isCompact(w, h)` (user-authored) and `observeCompact(target, apply, onCleanup)`
  (ResizeObserver, guarded like `reskin-player/index.ts:606`; a zero box counts as not compact).
- `index.ts`:
  - applies the attribute to all slots;
  - switches `#vp-slot-lt` from `width:320px` to `left:14px; width:auto` when compact;
  - moves the science and meta pills' inline styles into classes (new `PILL_CSS`) so CSS can
    vary them;
  - extends the section-pill click handler.
- `styles.ts`: compact rules at (0,3,0)+ specificity; `(hover:hover)` guards.

## Metadata

| Field            | Value                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Type             | ENHANCEMENT                                                                                                                   |
| Complexity       | HIGH                                                                                                                          |
| Systems Affected | `runtime-src/demo-overlays/{compact,index,styles}.ts`, tests, `e2e/overlay-mobile.spec.ts`, `public/runtime/demo-overlays.js` |
| Dependencies     | none new (`ResizeObserver`, typed in TS 5.9 `lib.dom`)                                                                        |
| Estimated Tasks  | 11                                                                                                                            |

---

## Lifecycle (append-only)

- **Created:** 2026-09-29T12:40Z
- **Modified:** 2026-09-29T12:40Z · 2026-09-29T14:10Z (compact rule agreed) · 2026-09-29T15:00Z (rule corrected to 750)
- **Commits:**
- **Agent / Session:** claude-opus-5-5 (planning), session c9261ef3-2af4-4ce2-826b-0ee1520bc2a7
- **Back refs:** `docs/superpowers/specs/2026-09-29-mobile-overlays-sidebar-design.md` (P4) · `.claude/PRPs/prds/mobile-overlays.prd.md` (phase 4) · `.claude/PRPs/plans/2026-09-29_mobile-overlays_p3-mobile-sheet.plan.md` (`host.open`, `__vpSidebarTab`) · `completed/2026-09-29_mobile-overlays_p2-mobile-canary-harness.plan.md` (fixme flipped here)
- **Forward refs:** `.claude/PRPs/plans/2026-09-29_mobile-overlays_p5-quiz-on-mobile.plan.md` (keys quiz promotion on `observeCompact`)

> **Append-only:** `Created` is set once; every other field is a list you only ever add to — never overwrite or remove existing entries. Keep references bidirectional: when you add a back/forward ref here, add the reciprocal ref on the other plan.

> **Planned ahead of its dependencies.** Written before P1–P3 were implemented. Before Task 1,
> re-read `renderScience`/`renderMetaStep` (P1 added `canOpen`), the section-pill handler and the
> slot block in `index.ts`, and the P2/P3 state of `e2e/overlay-mobile.spec.ts`.

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                     BEFORE STATE (player 390×219, measured)                   ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║ y=308 ┌─ voice-over card 320×168 (7px clipped) ─────────────┐                 ║
║ y=315 ├──[Ankom…]──[🧪 Wissenschaft: Psychological Saf…][Öffnen]┤ ← overlap  ║
║       │  CS  Voice-Over: Warum Erwartungs…                  │                 ║
║       │  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬ 0:00 / 0:10                         │                 ║
║       │  [−10s] [❚❚] [+10s] [⏭ Überspringen]                │                 ║
║ y=476 └──────────────────────────────────────────────────────┘                ║
║       ▶ ──●──────── 0:45 / 1:38:57                    ⛶   (LearningSuite)     ║
║ y=534 ───────────────────────────────────────────────────────                 ║
║ PAIN_POINT: clipped, overlapping, 23px tap target; tap → sticky hover opens   ║
║             a 228×191 panel over the video                                    ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                     AFTER STATE (player 390×219, data-vp-compact=1)           ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║ y=315 ┌───────────────────────────────────────────────────────┐              ║
║       │ [Ankommen & Kontakt ›Check-in…]    x≤264   [🧪 Öffnen] │ x≥280       ║
║       │       tap → open("coaching")        40px   tap → open("science")      ║
║       │                                                       │              ║
║ y≈420 │ [CS Voice-Over: Warum Erwart… (❚❚)(⏭)]  ~56px, full width             ║
║       │ ▔▔▔▔▔▔▔ 3px progress                                   │              ║
║ y=476 │ ▶ ──●──────── 0:45                            ⛶  (LearningSuite)     ║
║ y=534 └───────────────────────────────────────────────────────┘              ║
║ DATA_FLOW: ResizeObserver(playerHost) → isCompact(w,h) → data-vp-compact on  ║
║            every .vp-slot (+ #vp-slot-lt left/width) → CSS variants          ║
║ VALUE_ADD: nothing clipped, nothing overlaps, every tap ≥ 40px and does      ║
║            what it shows; desktop ≥ 632px players unchanged                   ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location                    | Before                      | After (compact)                                         | User Impact               |
| --------------------------- | --------------------------- | ------------------------------------------------------- | ------------------------- |
| `#vp-slot-lt` voice-over    | 320×168 card, 4 buttons     | one row ~56px, play/pause + skip at 40×40, 3px progress | Video stays visible       |
| `#vp-slot-tr` science pill  | label + name + 58×23 button | 🧪 + 40px "Öffnen"                                      | Fits, easy tap            |
| `#vp-slot-tl` section pill  | expands on sticky hover     | never expands; tap → sheet/sidebar on Coaching          | No panel over the video   |
| `#vp-slot-br` meta pill     | unbounded width             | capped, ellipsis, no "Schritt n / N"                    | Never leaves the player   |
| Touch, not compact (tablet) | sticky hover                | tap toggles `data-pinned`                               | Intentional expand        |
| All `:hover` styles         | always active               | only under `(hover:hover)`                              | No sticky states on touch |

---

## Mandatory Reading

| Priority | File                                                | Lines              | Why Read This                                                                                           |
| -------- | --------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------- |
| P0       | `runtime-src/demo-overlays/index.ts`                | 427-488            | `makeSlot` and the slot definitions (inline `width:320px` on `#vp-slot-lt`)                             |
| P0       | `runtime-src/demo-overlays/index.ts`                | 500-552            | Section pill markup and click handler (rows only)                                                       |
| P0       | `runtime-src/demo-overlays/index.ts`                | 641-678, 1175-1202 | Science/meta pill inline markup (after P1's `canOpen`)                                                  |
| P0       | `runtime-src/demo-overlays/index.ts`                | 1043-1172          | `AUDIO_CSS` injection and card markup (`data-action=audio-back/-playpause/-fwd/-skip`)                  |
| P0       | `runtime-src/demo-overlays/styles.ts`               | 52-194             | `SECTION_CSS` hover and pinned rules, `AUDIO_CSS`, the two-class specificity rule vs `SLOT_CSS` (0,1,0) |
| P0       | `runtime-src/reskin-player/index.ts`                | 603-614            | ResizeObserver precedent (typeof guard, `disposed`, cleanup)                                            |
| P1       | `runtime-src/tests/reskin-player/discovery.test.ts` | 42-73              | `FakeResizeObserver` + `vi.stubGlobal`                                                                  |
| P1       | `runtime-src/tests/demo-overlays/render.test.ts`    | 186-257            | CSS-string assertions (happy-dom has no layout)                                                         |
| P2       | `docs/feature-context.md`                           | 103-118            | pre-wrap reset and specificity rules                                                                    |

**External Documentation:**

| Source                                                                                               | Section            | Why Needed                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [MDN ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver)                | observation errors | `observe()` fires an initial callback; do not change the observed box from the callback (the slots are absolutely positioned, so attribute writes do not resize the host) |
| [MDN @media hover](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/hover) | hover              | Tests the primary input; phones report `none`. Playwright needs `hasTouch` for `none` (verified). happy-dom derives it from `navigator.maxTouchPoints` (verified)         |

---

## Patterns to Mirror

**RESIZEOBSERVER GUARD:**

```typescript
// SOURCE: runtime-src/reskin-player/index.ts:606-614
if (typeof ResizeObserver !== "undefined") {
  const ro = new ResizeObserver(() => {
    if (disposed) return;
    if (getComputedStyle(host).position === "static")
      (host as HTMLElement).style.position = "relative";
  });
  ro.observe(mediaEl);
  pushCleanup(CLEANUP_KEY, () => ro.disconnect());
}
```

**FAKE RESIZEOBSERVER:**

```typescript
// SOURCE: runtime-src/tests/reskin-player/discovery.test.ts:42-60,72-73
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly observed: Element[] = [];
  disconnected = false;
  constructor(private readonly cb: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }
  observe(el: Element): void {
    this.observed.push(el);
  }
  unobserve(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
  fire(): void {
    this.cb([], this as unknown as ResizeObserver);
  }
}
FakeResizeObserver.instances.length = 0;
vi.stubGlobal("ResizeObserver", FakeResizeObserver);
```

**TWO-CLASS SPECIFICITY vs SLOT_CSS:**

```typescript
// SOURCE: runtime-src/demo-overlays/styles.ts:145-148
.vp-audio-card .vp-audio-title {
  font:700 14.5px/1.3 system-ui; color:${T.fg};
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
```

**STYLE INJECTION (mount-scoped):**

```typescript
// SOURCE: runtime-src/demo-overlays/index.ts:1048-1056
if (showAudio) {
  const audioStyleId = "__vp-audio-style";
  document.getElementById(audioStyleId)?.remove();
  const s = document.createElement("style");
  s.id = audioStyleId;
  s.textContent = AUDIO_CSS;
  document.head.appendChild(s);
  onCleanup(() => document.getElementById(audioStyleId)?.remove());
}
```

---

## Files to Change

| File                                                       | Action     | Justification                                                                                                                                      |
| ---------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runtime-src/demo-overlays/compact.ts`                     | CREATE     | `isCompact` (user) and `observeCompact`                                                                                                            |
| `runtime-src/tests/demo-overlays/compact.test.ts`          | CREATE     | Table for `isCompact`; observer behaviour                                                                                                          |
| `runtime-src/demo-overlays/styles.ts`                      | UPDATE     | New `PILL_CSS`; compact rules in `PILL_CSS`/`SECTION_CSS`/`AUDIO_CSS`; `(hover:hover)` guards (incl. `QUIZ_CSS`)                                   |
| `runtime-src/demo-overlays/index.ts`                       | UPDATE     | Observe; apply the attribute; `#vp-slot-lt` geometry; pill classes; section-pill tap; inject `__vp-pill-style`; `OWNED_NODE_IDS`; comment for 58px |
| `runtime-src/tests/demo-overlays/compact-overlays.test.ts` | CREATE     | Mount-level behaviour                                                                                                                              |
| `runtime-src/tests/demo-overlays/open-affordance.test.ts`  | UPDATE     | Cursor now via `data-can-open` class hook                                                                                                          |
| `e2e/overlay-mobile.spec.ts`                               | UPDATE     | Flip P2's fixme; add P4 assertions                                                                                                                 |
| `public/runtime/demo-overlays.js`                          | REGENERATE | Committed bundle                                                                                                                                   |

---

## NOT Building (Scope Limits)

- Changing the 58px bottom offset (measured correct).
- A compact variant for the quiz (P5 promotes it instead).
- Keyboard or ARIA semantics for the section pill as a button (existing gap; noted in Questionables).
- Container queries on LearningSuite's host (`container-type` on a node we do not own is rejected in
  the spec).

---

## Step-by-Step Tasks

### `[ ]` Task 1: CREATE `runtime-src/demo-overlays/compact.ts` (scaffold)

- **ACTION**: CREATE the module with `observeCompact` implemented and `isCompact` as a prepared
  signature for the user.
- **IMPLEMENT**:

  ```ts
  // Whether the in-player overlays use their compact variants. Keyed on the
  // PLAYER's box, not the viewport: at 1024px desktop the player is 461×260
  // (narrower than a tablet's 708×399), measured 2026-09-29, spec M12.
  //
  // Agreed rule (spec amendment (b) 2026-09-29): compact when width < 750 or
  // height < 280. 750: typical top pills need ~494px; the worst case
  // (max-length section title + science name) needs 753, accepted as a
  // 1–3px risk so 1920 desktops (752×424) keep the full overlays.
  // 280: the card under the science pill needs 10 + 35 + 8 + 168 + 58 = 279.
  // Measured players (fresh loads, spec M14 corrected):
  //   compact: 390×219 phone · 441×249 @1280 · 461×260 @1024 · 501×283 @1366
  //            553×312 @1440 · 632×356 tablet · 641×361 @1600 · 708×399 tablet
  //            732×413 phone landscape
  //   full:    752×424 @1920
  export function isCompact(width: number, height: number): boolean {
    // TODO(user): written by the user — see plan Task 2.
    void width;
    void height;
    return false;
  }

  // Watches `target` and calls `apply` with the compact state: once at start,
  // then only on change. An unsized box (not laid out yet, or happy-dom)
  // counts as NOT compact — same precondition as tryFlexSibling's "unsized
  // <main> means the layout isn't ready".
  export function observeCompact(
    target: HTMLElement,
    apply: (compact: boolean) => void,
    onCleanup: (fn: () => void) => void,
  ): () => boolean;
  ```

  - The body measures `getBoundingClientRect()`, returns `false` for a zero width or height, and otherwise returns `isCompact`.
  - It calls `apply` synchronously with the initial state and stores the state.
  - With `ResizeObserver`: a callback that re-measures and calls `apply` only when the state changes, `ro.observe(target)`, and `onCleanup(() => ro.disconnect())`.
  - Without it: a `window` `resize` listener with the same logic, registered with `onCleanup`.
  - It returns a getter for the current state.

- **MIRROR**: `reskin-player/index.ts:606-614`.
- **VALIDATE**: `bun run typecheck:runtime`

### `[ ]` Task 2: USER CONTRIBUTION — `isCompact(width, height)`

- **ACTION**: **STOP and hand this function to the user.** The rule was agreed with the user on
  2026-09-29 (and corrected the same day from 760 to 750): compact when
  `width < 750 || height < 280`, width and height both checked, no
  hysteresis. There is no feedback loop, because compact mode never changes the player's size, so
  the rule can only flip once per threshold crossing. The user writes the body: naming, constants,
  comments and the exact boundaries are theirs.

  Expected size: 2–10 lines. Do not write it for them. Resume once `compact.test.ts`'s
  `isCompact` table (Task 3) passes.

- **VALIDATE**: `bun run test runtime-src/tests/demo-overlays/compact.test.ts -t isCompact`

### `[ ]` Task 3: CREATE `runtime-src/tests/demo-overlays/compact.test.ts`

- **IMPLEMENT** (write this BEFORE Task 2 is resumed, so the table is the contract):
  - **`isCompact` table (spec amendment (b), M14 corrected):**
    - **Compact (true):** 390×219, 441×249, 461×260, 501×283, 553×312, 632×356, 641×361, 708×399,
      732×413.
    - **Full (false):** 752×424 (1920 desktop), 1200×675.
    - **Boundaries:** 749×421 true; 750×422 false; 800×279 true (too short); 800×280 false.
  - **`observeCompact`:** use `FakeResizeObserver` and stub `target.getBoundingClientRect`.
    - It applies the initial state once.
    - After a size change plus `fire()`, it applies the new state once.
    - A `fire()` with no change does not call `apply`.
    - A zero box gives `false`.
    - Cleanup disconnects.
    - With `vi.stubGlobal("ResizeObserver", undefined)`, a `resize` event re-evaluates.
- **MIRROR**: `discovery.test.ts:42-73,128-145`; table style `format.test.ts`.
- **VALIDATE**: `bun run test runtime-src/tests/demo-overlays/compact.test.ts`

### `[ ]` Task 4: UPDATE `runtime-src/demo-overlays/styles.ts` — `PILL_CSS`

- **ACTION**: ADD `export const PILL_CSS`, holding the science and meta pills' current inline declarations moved **1:1** into classes, plus the compact rules.
- **IMPLEMENT**:
  - Science pill classes: `.vp-slot .vp-sci-pill` (outer, including `pointer-events:auto`), `.vp-sci-pill[data-can-open="1"] { cursor:pointer }`, `.vp-slot .vp-sci-icon`, `.vp-slot .vp-sci-label`, `.vp-slot .vp-sci-name` (keeps `white-space:nowrap`, max-width 160, ellipsis), `.vp-slot .vp-sci-open`.
  - Meta pill classes: `.vp-slot .vp-meta-pill` (keeps `white-space:nowrap`; add `max-width:100%; box-sizing:border-box`), `.vp-meta-pill[data-can-open="1"] { cursor:pointer }`, `.vp-slot .vp-meta-num`, `.vp-slot .vp-meta-step`, `.vp-slot .vp-meta-divider`, `.vp-slot .vp-meta-title` (add `min-width:0; overflow:hidden; text-overflow:ellipsis`).
  - Compact rules, each under `.vp-slot[data-vp-compact="1"]`:
    - `.vp-sci-label` and `.vp-sci-name` hidden;
    - `.vp-sci-pill { padding:0 0 0 12px; min-height:40px; gap:8px }`;
    - `.vp-sci-open { min-height:40px; padding:0 14px; font-size:13px }`;
    - `.vp-meta-step` and `.vp-meta-divider` hidden.
- **GOTCHA**:
  - `white-space` rules need ≥ (0,2,0) to beat `.vp-slot *` (0,1,0). `.vp-slot .vp-sci-name` is (0,2,0). See `styles.ts:109-113`.
  - The full-size look must not change. Compare computed styles at V6 before and after, in Level 5.
- **VALIDATE**: `bun run typecheck:runtime`

### `[ ]` Task 5: UPDATE `runtime-src/demo-overlays/styles.ts` — section, audio, hover guards

- **IMPLEMENT**:
  - **`SECTION_CSS`:**
    - Move the three `:hover` selectors (`styles.ts:67-72`) and `.vp-sec-row[data-current="0"]:hover` (85) into `@media (hover:hover) { … }`.
    - Keep the `[data-pinned="1"]` twins unconditional.
    - Add compact rules: `.vp-slot[data-vp-compact="1"] .vp-section-pill { max-width:calc(100% - 112px) }`. That is 250px on the 362px-wide `#vp-slot-tl`, so the pill ends at x≤264 and the compact science pill starts at x≥280.
    - Add `.vp-slot[data-vp-compact="1"] .vp-section-pill .vp-sec-expanded { display:none }`, `… .vp-sec-collapsed { display:flex }` and `… .vp-sec-card { border-radius:12px; padding:8px 14px }`. These are (0,4,0) and beat the hover/pinned rules at (0,3,0).
  - **`AUDIO_CSS`:**
    - Wrap `.vp-audio-btn:hover` and `.vp-audio-btn-primary:hover` in `@media (hover:hover)`.
    - Add compact rules under `.vp-slot[data-vp-compact="1"]`:
      - card `display:flex; align-items:center; gap:10px; padding:8px 8px 8px 10px; position:relative; overflow:hidden; border-radius:14px`;
      - head `flex:1 1 auto; align-items:center; gap:10px`;
      - avatar, portrait and initials 32×32 (initials `font-size:12px`); badge hidden;
      - byline, state and times hidden;
      - progress `position:absolute; left:0; right:0; bottom:0; gap:0`; bar `height:3px; border-radius:0`;
      - `[data-action="audio-back"]` and `[data-action="audio-fwd"]` hidden;
      - `.vp-audio-btn { min-width:40px; min-height:40px; padding:0 10px }`;
      - `.vp-audio-btn-skip { flex:0 0 auto }`; `.vp-audio-skip-label` hidden;
      - controls `flex:0 0 auto; gap:6px`.
  - **`QUIZ_CSS`:** wrap `.vp-quiz-option:hover:not(:disabled)` in `@media (hover:hover)`.
- **GOTCHA**: The card height must come out ≤ 60px (8 + 40 + 8 + 2 border = 58). Verified in Level 5, not in happy-dom.
- **VALIDATE**: `bun run test runtime-src/tests/demo-overlays/render.test.ts`

### `[ ]` Task 6: UPDATE `runtime-src/demo-overlays/index.ts` — observe and apply

- **IMPLEMENT**:
  - After the slots are created (≈488), apply compact mode:
    ```ts
    const compactSlots = [
      slotTL,
      slotTR,
      slotBR,
      slotLowerThird,
      slotQuiz,
    ].filter((s): s is HTMLElement => !!s);
    const isCompactNow = observeCompact(
      playerHost,
      (compact) => {
        for (const s of compactSlots)
          if (compact) s.setAttribute("data-vp-compact", "1");
          else s.removeAttribute("data-vp-compact");
        // The voice-over slot's 320px is inline (makeSlot), so CSS cannot
        // widen it; the compact bar spans the player instead.
        slotLowerThird.style.left = compact ? "14px" : "";
        slotLowerThird.style.width = compact ? "auto" : "320px";
      },
      onCleanup,
    );
    ```
  - Add `max-width:calc(100% - 28px);` to `slotBR`'s posCss.
  - Add a comment at the slot block: `bottom:58px` is measured, not guessed. On a 390×219 phone player LearningSuite's progress line sits ~57px above the bottom while its controls show, and the controls leave the DOM during playback (2026-09-29).
  - Inject `PILL_CSS` as `__vp-pill-style`, remove-then-append with `onCleanup`. Add the id to `OWNED_NODE_IDS`.
- **IMPORTS**: `import { observeCompact } from "./compact"; import { …, PILL_CSS } from "./styles";`
- **VALIDATE**: `bun run typecheck:runtime`

### `[ ]` Task 7: UPDATE `runtime-src/demo-overlays/index.ts` — pill markup to classes

- **IMPLEMENT**:
  - Rewrite the science pill (663-669) as `<div data-overlay-action="science" class="vp-sci-pill vp-anim-right" data-can-open="${canOpen ? "1" : ""}">`, with inner `<span class="vp-sci-icon">🧪</span><span class="vp-sci-label">…</span><span class="vp-sci-name">…</span>`, then `${canOpen ? `<button class="vp-sci-open">…</button>` : ""}`.
  - Rewrite the meta pill (1188-1195) the same way: `vp-meta-pill`, `vp-meta-num`, `vp-meta-step`, `vp-meta-divider`, `vp-meta-title`.
  - Keep every `esc()` / `tr()`.
  - Remove the P1 inline `cursor:` declarations; `data-can-open` carries that now.
- **GOTCHA**: `no-bare-strings.test.ts` scans `index.ts`. The markup keeps its copy in `tr()`, and class names are not in its lists.
- **VALIDATE**: `bun run test runtime-src/tests/common/ runtime-src/tests/demo-overlays/`

### `[ ]` Task 8: UPDATE `runtime-src/demo-overlays/index.ts` — section-pill tap

- **IMPLEMENT**: extend the handler at 545-552:
  ```ts
  sectionPill.addEventListener("click", (e) => {
    const row = (e.target as HTMLElement).closest(
      "[data-seek]",
    ) as HTMLElement | null;
    e.stopPropagation();
    if (row && !isCompactNow()) {
      window.player.seek(Number(row.dataset.seek) + 0.1);
      return;
    }
    // Compact: the pill never expands inside the video — the sheet (or the
    // desktop sidebar) shows the same progress with room to read it.
    if (isCompactNow()) {
      w.__vpSidebarTab?.("coaching");
      return;
    }
    // Touch without hover: an explicit pin replaces the sticky :hover that
    // opened it by accident (spec M5).
    if (window.matchMedia("(hover: none)").matches)
      sectionPill.dataset.pinned =
        sectionPill.dataset.pinned === "1" ? "" : "1";
  });
  ```
  Set `sectionPill.style.cursor` to `"pointer"` when compact and `__vpSidebarTab` exists (from the `apply` callback).
- **GOTCHA**:
  - In compact mode the rows are hidden (`.vp-sec-expanded` is `display:none`), so a row tap cannot happen. The `!isCompactNow()` guard is defensive.
  - `isCompactNow` is declared before the pill handler runs, because the handler fires on user events after the mount.
- **VALIDATE**: `bun run typecheck:runtime && bun run lint`

### `[ ]` Task 9: CREATE `runtime-src/tests/demo-overlays/compact-overlays.test.ts`; UPDATE `open-affordance.test.ts`

- **IMPLEMENT**:
  - **Harness:** `render.test.ts` plus `FakeResizeObserver`. Stub the player host's `getBoundingClientRect` to 390×219 (compact) or 708×399 (full).
  - **Cases:**
    1. All `.vp-slot` get `data-vp-compact="1"`, and `#vp-slot-lt` has `left:14px; width:auto`. Re-stub to 708×399 and `fire()`: the attribute is removed and width is `320px`.
    2. The science pill markup uses `.vp-sci-pill`, `.vp-sci-open` and `data-can-open="1"` when a host exists.
    3. A compact section-pill tap opens Coaching (desktop host at the default viewport: `[data-panel="coaching"]` shown; at 390, the sheet is `data-open`).
    4. Not compact, `navigator.maxTouchPoints = 5` (happy-dom → `(hover:none)`): a tap sets `data-pinned="1"`, and a second tap clears it.
    5. Not compact with a mouse (`maxTouchPoints` 0): a tap leaves `data-pinned` unset.
    6. CSS contract: after stripping every `@media (hover:hover){…}` block (brace-counting helper), `SECTION_CSS`, `AUDIO_CSS`, `QUIZ_CSS` and `PILL_CSS` contain no `:hover`.
    7. `PILL_CSS`/`AUDIO_CSS`/`SECTION_CSS` contain the compact selectors listed in Tasks 4–5 (string contains).
  - **`open-affordance.test.ts`:** assert `data-can-open` instead of `style.cursor`.
  - Restore `navigator.maxTouchPoints` (`Object.defineProperty` with `configurable:true`) and `vi.unstubAllGlobals()` in `afterEach`.
- **MIRROR**: `render.test.ts:186-257` (CSS string tests), `discovery.test.ts:42-73`.
- **VALIDATE**: `bun run test runtime-src/tests/demo-overlays/`

### `[ ]` Task 10: UPDATE `e2e/overlay-mobile.spec.ts`

- **IMPLEMENT**:
  - Turn P2's `test.fixme("pills and the voice-over never overlap …")` into `test(…)`.
  - Add:
    - `"compact buttons are at least 40px"`: `.vp-sci-open` and visible `.vp-audio-btn` boxes have `h >= 40 && w >= 40`.
    - `"the compact voice-over bar is at most 60px tall"`.
    - `"tapping the section pill opens the sheet on Coaching"`.
    - `"the slots are marked compact on a phone"`: `#vp-slot-tl[data-vp-compact="1"]`.
- **VALIDATE**: `E2E_RUNTIME_BASE_URL=http://localhost:3000/runtime/loader.js bun run e2e`

### `[ ]` Task 11: REGENERATE the bundle; VERIFY in Chrome

- **VALIDATE**: `bun run build:runtime && git status --short public/runtime`, then Level 5.

---

## Testing Strategy

### Unit Tests to Write

| Test File                  | Test Cases                                                                                                                                              | Validates |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `compact.test.ts`          | `isCompact` table; initial apply; change-only apply; zero box; disconnect; resize fallback                                                              | AC1       |
| `compact-overlays.test.ts` | attribute on all slots + lt geometry; pill classes; compact tap → Coaching; touch pin toggle; mouse no pin; no bare `:hover`; compact selectors present | AC2–AC6   |

### Edge Cases Checklist

- [ ] Resize across the threshold during a live voice-over: the card keeps its DOM, only the classes' effect changes
- [ ] A remount while compact: the initial `apply` sets the attribute before the first `recomputeActive`
- [ ] A lesson with one phase (no section pill): nothing to reserve; the science pill alone
- [ ] RTL or long German titles: ellipsis in the section, meta and voice-over titles
- [ ] Desktop 1024 (compact overlays + desktop sidebar): the section-pill tap switches the sidebar to Coaching

---

## Validation Commands

🔁 **Validation loop:** the plan is not complete until every command below passes (exit 0). On any failure, fix the cause and re-run — loop until all pass. If a check is genuinely impossible, mark it `[f]`, note why in Agent Notes, and move on.

### Level 1: STATIC_ANALYSIS

```bash
bun run lint && bun run typecheck:runtime && bunx tsc --noEmit -p tsconfig.json
```

### Level 2: UNIT_TESTS

```bash
bun run test runtime-src/tests/demo-overlays/ runtime-src/tests/common/
```

### Level 3: FULL_SUITE

```bash
bun run test && bun run build:runtime && git status --short public/runtime
```

### Level 4: DATABASE_VALIDATION

Not applicable.

### Level 5: BROWSER_VALIDATION (Chrome, live lesson, local runtime)

**Setup:** stub `speechSynthesis.speak = () => {}` before tapping play. Play with a real click;
seek to 40 for the cue at 45; seek 13.5 for science and 5.5 for meta.

**Checks:**

- [ ] **V1 390×844 touch and V5 1024×768:**
  - Every visible overlay is inside the player rect.
  - Pairwise intersection of section pill, science pill, meta pill and voice-over is 0.
  - Every button is ≥ 40px.
  - The voice-over bar is ≤ 60px tall.
  - A section-pill tap opens the sheet (V1) or the sidebar's Coaching tab (V5).
- [ ] **V3 820×1180, V4 1180×820 and 1600×900:** compact under the agreed rule. Same checks as
      V1/V5.
- [ ] **Full variants, V6 at 1920×1080 on a fresh load** (player 752×424, full size):
  - The voice-over card is 320×168.
  - The science pill shows label and name.
  - `.vp-sci-pill`'s computed styles equal the pre-change inline values (spot-check background,
    padding, font).
  - Hover still expands the section pill.
- [ ] **Touch plus full size:** not reachable on the measured devices (tablets are compact). The
      tap-to-pin behaviour is covered by the unit test only.

### Level 6: MANUAL_VALIDATION

- [ ] On a real phone: no sticky expanded pill after tapping; the voice-over bar is readable in German ("Überspringen" becomes icon-only).

---

## Acceptance Criteria

- [ ] **AC1**: `data-vp-compact` follows `isCompact(player w, h)` and updates on resize; an unsized box counts as not compact.
- [ ] **AC2**: In compact mode no two overlays overlap and all stay inside the player (V1, V5).
- [ ] **AC3**: The compact voice-over is a single row ≤ 60px, with play/pause and skip ≥ 40px.
- [ ] **AC4**: A compact section-pill tap opens Coaching (sheet or sidebar); the pill never expands in the video.
- [ ] **AC5**: On touch devices that aren't compact, a tap toggles `data-pinned`; hover styles apply only under `(hover:hover)`.
- [ ] **AC6**: Full-size overlays (players ≥ 750×280) are visually unchanged (fresh load at 1920).
- [ ] **AC7**: `bottom:58px` is unchanged and documented with the measurement.
- [ ] Level 1–3 pass; Level 5 recorded; e2e mobile green (fixme flipped).

---

## Completion Checklist

- [ ] Task 2 authored by the user (record it in Agent Notes)
- [ ] All other tasks done in order, each validated
- [ ] Commit `[FEATURE]` on `feature/mobile-overlays`

---

## Risks and Mitigations

| Risk                                                     | Likelihood        | Impact | Mitigation                                                                                           |
| -------------------------------------------------------- | ----------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| Moving pill styles to classes changes the full-size look | MED               | MED    | 1:1 declaration move; V6 computed-style spot-check                                                   |
| happy-dom zero rects make every test mount compact       | HIGH if unguarded | HIGH   | Zero box → not compact (Task 1); tests stub rects explicitly                                         |
| ResizeObserver loop error                                | LOW               | LOW    | The callback only writes attributes and styles on absolutely positioned slots, never the host's size |
| Specificity fights with inline styles                    | MED               | MED    | Inline styles removed from the pills; `#vp-slot-lt` geometry set via JS                              |

---

## Questionables

<details>
<summary>Section pill semantics</summary>

The pill is a `div` with a click handler. On compact it now acts as a button, but it has no
`role="button"`/`tabindex`. That is an existing accessibility gap and is left out of scope to avoid
changing the desktop surface. Worth a follow-up.

</details>

<details>
<summary>Reserve the corner even when no science pill is showing</summary>

Assumed yes (`calc(100% - 112px)` always in compact mode), so the section pill never jumps when a
science moment starts. The cost is ~110px of title width at all times on phones.

</details>

---

## Agent Notes

- The researcher found that happy-dom's `(hover:hover)` is true unless
  `navigator.maxTouchPoints > 0`. Tests for touch behaviour must set it.

---

## Amendments

_Append-only history of changes made **after** this plan was first built (newest at the bottom)._

<details>
<summary>2026-09-29T14:10Z — compact rule agreed with the user</summary>

- **Rule:** `width < 760 || height < 280` (spec amendment 2026-09-29). It replaces the original
  table, which had 632×356 and 708×399 as full: those only held for typical titles, while the
  worst-case top pills need 753px.
- **New measurements (M14):** with our sidebar installed the player is 317–553px wide at every
  desktop width from 1024 to 1920, so compact is the normal desktop look.
- **Changes in this plan:**
  - Task 1 comment table, Task 2 (rule fixed; no hysteresis, since there is no feedback loop), and
    the Task 3 test table;
  - the Level 5 full-variant check now uses a no-sidebar config;
  - touch plus full size is unit-test-only;
  - AC6 is re-scoped.
- **Not changed:** the tap-to-pin behaviour stays, although it is now only reachable on large touch
  screens.

</details>

<details>
<summary>2026-09-29T15:00Z — rule corrected to 750; measurements corrected</summary>

The 14:10Z amendment relied on desktop values for 1600 and 1920 that were measured after resizing
an already-loaded page. Fresh loads give 641×361 at 1600 and 752×424 at 1920 (spec amendment
(b)). With the correct numbers the user lowered the threshold to 750, so 1920 desktops keep the
full overlays.

Updated here:

- the Task 1 comment table;
- Task 2 (rule);
- the Task 3 test table (752×424 full; boundaries 749/750);
- the Level 5 full-variant check, now a fresh load at 1920 with the real config (the no-sidebar
  workaround is gone);
- AC6.

</details>
