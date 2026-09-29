# Feature: Mobile overlays P5 — the quiz covers the whole screen on compact players

## Summary

On compact players (P4's `observeCompact`) and outside fullscreen, the existing `#vp-slot-quiz`
element moves from the player host to `document.body`. There it becomes `position:fixed` at
z-index 1150, so the scrim covers the viewport and the card can use nearly the full screen
height. Options switch to one column. It moves back into the player when compact mode ends or the
player goes fullscreen. The quiz controller is untouched: it addresses the slot by reference only.

## User Story

As a learner on a phone
I want the quiz question and all its answers visible at once
So that I can answer without scrolling a tiny box inside the video

## Problem Statement

At 390×844 the quiz card is 358×187 inside the 219px-tall player. Its content is 350px tall, so
only 185px is visible. The answers use two columns of 158×93, and three of four answers sit
below the visible area (spec M6, measured with a client-side injected quiz).

## Solution Statement

`placeQuizSlot(compact)` in `index.ts` is called from P4's `apply` callback and on
`fullscreenchange`.

- **Promote** (compact and not fullscreen): `document.body.appendChild(slotQuiz)`, set
  `data-vp-promoted="1"`, `style.position = "fixed"` and `style.zIndex = "1150"`.
- **Demote:** `playerHost.appendChild(slotQuiz)`, remove the attribute, restore `absolute` and
  `QUIZ_SLOT_Z`.

Focus is restored after a move when it was inside the slot. A single `QUIZ_CSS` rule forces one
column when promoted. The scrim stays `position:absolute; inset:0` inside the fixed slot. Keeping
the scrim non-fixed avoids depending on whether `container-type` on its ancestor captures fixed
descendants: it no longer does in Chrome 129+, but iOS 17/18 is unconfirmed.

## Metadata

| Field            | Value                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| Type             | ENHANCEMENT                                                                                                           |
| Complexity       | MEDIUM                                                                                                                |
| Systems Affected | `runtime-src/demo-overlays/{index,styles}.ts`, tests, `e2e/overlay-mobile.spec.ts`, `public/runtime/demo-overlays.js` |
| Dependencies     | none new                                                                                                              |
| Estimated Tasks  | 6                                                                                                                     |

---

## Lifecycle (append-only)

- **Created:** 2026-09-29T12:40Z
- **Modified:** 2026-09-29T12:40Z · 2026-09-29T14:10Z (compact rule agreed) · 2026-09-29T15:00Z (rule corrected to 750)
- **Commits:**
- **Agent / Session:** claude-opus-5-5 (planning), session c9261ef3-2af4-4ce2-826b-0ee1520bc2a7
- **Back refs:** `docs/superpowers/specs/2026-09-29-mobile-overlays-sidebar-design.md` (P5) · `.claude/PRPs/prds/mobile-overlays.prd.md` (phase 5) · `.claude/PRPs/plans/2026-09-29_mobile-overlays_p4-compact-overlays.plan.md` (`observeCompact`, `apply`, `isCompactNow`) · `completed/2026-09-29_mobile-overlays_p3-mobile-sheet.plan.md` (sheet z-index 1100)
- **Forward refs:**

> **Append-only:** `Created` is set once; every other field is a list you only ever add to — never overwrite or remove existing entries. Keep references bidirectional: when you add a back/forward ref here, add the reciprocal ref on the other plan.

> **Planned ahead of its dependencies.** Written before P4 was implemented. Before Task 1, re-read
> P4's `observeCompact(...)` call in `index.ts` and use its `apply` parameter. `isCompactNow` is
> not yet assigned when `apply` first runs synchronously.

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                     BEFORE STATE (390×844, measured M6)                       ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║ y=315 ┌────────── player 390×219 ──────────┐                                  ║
║       │ ┌─ card 358×187 (content 350) ──┐  │                                  ║
║       │ │ Kurzer Check  ◔ 30             │  │                                  ║
║       │ │ Welche Frage stellt der Coach… │  │                                  ║
║       │ │ [A …158×93] [B …158×93]  ↓     │  │ ← scroll inside 185px           ║
║ y=534 └─┴─[C …] [D …] (hidden)──────────┴──┘                                  ║
║       Anhänge …                  LearningSuite bottom bar (z 999)             ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                     AFTER STATE (390×844, compact, not fullscreen)            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║ y=0  ┌────────── #vp-slot-quiz (body, fixed, z 1150) ─────────┐              ║
║      │  scrim (absolute inset 0, dims the whole page)          │              ║
║      │   ┌──────── card ≤ 560 wide, ≤ 844−32 tall ─────────┐   │              ║
║      │   │ Kurzer Check                          ◔ 30      │   │              ║
║      │   │ Welche Frage stellt der Coach zu Beginn …?      │   │              ║
║      │   │ [A  Was soll am Ende dieser Stunde anders sein?]│   │              ║
║      │   │ [B  Wie lange haben wir heute Zeit?]            │   │ one column   ║
║      │   │ [C  Was hast du letzte Woche gemacht?]          │   │              ║
║      │   │ [D  Welche Methode möchtest du ausprobieren?]   │   │              ║
║      │   └─────────────────────────────────────────────────┘   │              ║
║ y=844└─────────────── covers LearningSuite's bar (999) and our sheet (1100) ─┘║
║ DATA_FLOW: observeCompact.apply(compact) / fullscreenchange → placeQuizSlot  ║
║            → body (fixed, 1150) | playerHost (absolute, 20)                  ║
║ VALUE_ADD: the whole question and every answer visible, no inner scrolling   ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location                           | Before                                | After                          | User Impact           |
| ---------------------------------- | ------------------------------------- | ------------------------------ | --------------------- |
| `#vp-slot-quiz` on compact players | inside the player, clipped to 219px   | in `body`, fixed full viewport | Full question visible |
| Answer grid on compact players     | two columns (container query ≥ 380px) | one column                     | Readable answers      |
| Fullscreen or full-size player     | inside the player                     | unchanged                      | None                  |

---

## Mandatory Reading

| Priority | File                                               | Lines                     | Why Read This                                                                                                             |
| -------- | -------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| P0       | `runtime-src/demo-overlays/index.ts`               | 40-59, 480-488            | `SLOT_Z`/`QUIZ_SLOT_Z` with the measured z-index comment; `slotQuiz` creation                                             |
| P0       | `runtime-src/demo-overlays/index.ts`               | 929-939                   | `createQuizController({ …, slot: slotQuiz, … })` — reference, not id                                                      |
| P0       | `runtime-src/demo-overlays/quiz.ts`                | 420-471, 492-533, 556-610 | `render()`/`clear()` write via the `slot` reference; focus into the card; `document` capture-phase keydown                |
| P0       | `runtime-src/demo-overlays/styles.ts`              | 199-228                   | `#vp-slot-quiz` container, `.vp-quiz-scrim`, `.vp-quiz-card`, the `@container` two-column rule                            |
| P1       | `runtime-src/tests/demo-overlays/stacking.test.ts` | 95-135                    | z-index assertions to extend                                                                                              |
| P1       | `runtime-src/tests/demo-overlays/quiz.test.ts`     | 52-118                    | Quiz config fixtures (shape)                                                                                              |
| P1       | `runtime-src/tests/demo-overlays/audio.test.ts`    | 24-50                     | Starting playback in happy-dom (`video.play()` then `emitTime`) — the quiz opens from `onTime` only after playback starts |

**External Documentation:**

| Source                                                                                                   | Section        | Why Needed                                                                                                                       |
| -------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [MDN containing block](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Display/Containing_block) | fixed          | The slot itself is fixed, under `body`; `body` must have no transform/filter/contain (the e2e scrim rect assertion proves it)    |
| [CSSWG #10544](https://github.com/w3c/csswg-drafts/issues/10544)                                         | container-type | Does not force layout containment (Chrome 129+). This is why the scrim stays `absolute` rather than `fixed` inside the container |
| [WHATWG Fullscreen — rendering](https://fullscreen.spec.whatwg.org/#rendering)                           | top layer      | A body-level fixed element is invisible while another element is fullscreen, hence demote in fullscreen                          |

---

## Patterns to Mirror

**Z-INDEX CONSTANTS WITH MEASUREMENT COMMENT:**

```typescript
// SOURCE: runtime-src/demo-overlays/index.ts:40-59 (comment block + constants)
const SLOT_Z = 15;
const QUIZ_SLOT_Z = 20;
```

**SLOT BY REFERENCE:**

```typescript
// SOURCE: runtime-src/demo-overlays/index.ts:929-939
quizCtrl = createQuizController({ quiz, mediaEl: player, playerHost, slot: slotQuiz, isAudioActive: …, onCleanup });
```

**STACKING TEST:**

```typescript
// SOURCE: runtime-src/tests/demo-overlays/stacking.test.ts:95-135 (shape)
const z = (id: string) => Number(document.getElementById(id)!.style.zIndex);
expect(z("vp-slot-quiz")).toBeGreaterThan(z("vp-slot-tl"));
```

---

## Files to Change

| File                                                     | Action     | Justification                                                                                  |
| -------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------- |
| `runtime-src/demo-overlays/index.ts`                     | UPDATE     | `PROMOTED_QUIZ_Z`; `placeQuizSlot`; call it from `apply` and `fullscreenchange`; focus restore |
| `runtime-src/demo-overlays/styles.ts`                    | UPDATE     | Promoted single-column rule in `QUIZ_CSS`                                                      |
| `runtime-src/tests/demo-overlays/quiz-placement.test.ts` | CREATE     | Placement, z-index, fullscreen, focus, teardown                                                |
| `e2e/overlay-mobile.spec.ts`                             | UPDATE     | Quiz geometry assertions at V1                                                                 |
| `public/runtime/demo-overlays.js`                        | REGENERATE | Committed bundle                                                                               |

---

## NOT Building (Scope Limits)

- Changing the quiz controller, its timing, modes or copy.
- Promoting the quiz inside fullscreen (the player already fills the screen there).
- Moving the slot back after every quiz: placement follows compact mode, not quiz activity. An
  empty promoted slot is `pointer-events:none` and paints nothing.

---

## Step-by-Step Tasks

### `[ ]` Task 1: UPDATE `runtime-src/demo-overlays/index.ts` — constant

- **IMPLEMENT**: Below `QUIZ_SLOT_Z`:
  ```ts
  // A promoted quiz (compact player, see placeQuizSlot) leaves the player and
  // stacks against the PAGE instead: above LearningSuite's fixed bottom bar
  // (999, measured 2026-09-29) and our own mobile sheet (1100), below
  // LearningSuite's full-viewport overlay layers (1200) so their menus win.
  const PROMOTED_QUIZ_Z = 1150;
  ```
- **VALIDATE**: `bun run typecheck:runtime`

### `[ ]` Task 2: UPDATE `runtime-src/demo-overlays/index.ts` — `placeQuizSlot`

- **IMPLEMENT**: after `slotQuiz` exists, and before the `observeCompact` call from P4:

  ```ts
  // On a compact player the 219px-tall player cannot hold a question and four
  // answers (spec M6: 350px of content in a 185px box). The SAME element moves
  // to <body> — the quiz controller, checkAlive and the event swallowing all
  // hold it by reference — and becomes viewport-fixed. Not in fullscreen:
  // body-level fixed elements are not rendered there.
  function placeQuizSlot(compact: boolean): void {
    if (!slotQuiz) return;
    const promote = compact && !document.fullscreenElement;
    const parent = promote ? document.body : playerHost!;
    if (slotQuiz.parentElement === parent) return;
    const hadFocus = slotQuiz.contains(document.activeElement);
    parent.appendChild(slotQuiz);
    slotQuiz.style.position = promote ? "fixed" : "absolute";
    slotQuiz.style.zIndex = String(promote ? PROMOTED_QUIZ_Z : QUIZ_SLOT_Z);
    if (promote) slotQuiz.setAttribute("data-vp-promoted", "1");
    else slotQuiz.removeAttribute("data-vp-promoted");
    // Re-inserting a node drops focus; keep the dialog operable by keyboard.
    if (hadFocus)
      slotQuiz
        .querySelector<HTMLElement>(".vp-quiz-card")
        ?.focus({ preventScroll: true });
  }
  ```

  - Call `placeQuizSlot(compact)` inside P4's `apply` callback.
  - Register a `fullscreenchange` (and `webkitfullscreenchange`) listener on `document` that calls `placeQuizSlot(isCompactNow())`, removed via `onCleanup`.

- **GOTCHA**:
  - `apply` runs synchronously inside `observeCompact` before `isCompactNow` is assigned. Use the `compact` argument there, never `isCompactNow()`.
  - `makeSlot` appended the slot to `playerHost`, and its cleanup `el.remove()` works from any parent, as do the `OWNED_NODE_IDS` sweeps (by id).
- **VALIDATE**: `bun run typecheck:runtime && bun run lint`

### `[ ]` Task 3: UPDATE `runtime-src/demo-overlays/styles.ts` — single column when promoted

- **IMPLEMENT**: in `QUIZ_CSS`, after the `@container` rule:
  ```css
  /* Promoted to the viewport on compact players: the slot is now as wide as the
     phone (≥ 380px), so the container query would pick two cramped columns. */
  #vp-slot-quiz[data-vp-promoted="1"] .vp-quiz-options[data-cols="2"] {
    grid-template-columns: 1fr;
  }
  ```
  Specificity (1,3,0) beats the container rule's (0,2,0).
- **VALIDATE**: `bun run test runtime-src/tests/demo-overlays/render.test.ts`

### `[ ]` Task 4: CREATE `runtime-src/tests/demo-overlays/quiz-placement.test.ts`

- **IMPLEMENT**:
  - **Harness:** mount with a quiz config (shape from `quiz.test.ts`), plus `FakeResizeObserver` and a stubbed player-host rect.
  - **Cases:**
    1. 390×219 → `#vp-slot-quiz` parent is `body`, `data-vp-promoted="1"`, `style.position === "fixed"`, `style.zIndex === "1150"`.
    2. Re-stub to 708×399 and `fire()` → parent is the player host, no attribute, `absolute`, `20`.
    3. With `document.fullscreenElement` defined (a wrapper containing the host) and `fullscreenchange` dispatched → demoted. Clearing it and dispatching again → promoted.
    4. Focus: open a quiz (start playback as in `audio.test.ts:24-50`, then `emitTime` at the break), focus `.vp-quiz-card`, and trigger demotion → `document.activeElement` is the card.
    5. Stacking: 1150 > the sheet's 1100 (import nothing from P3; assert the literal) > 999.
    6. The CSS contains the promoted single-column rule.
    7. Teardown (remove the config) removes the promoted slot from `body`.
  - The existing `stacking.test.ts` stays green: zero rects mean not compact, so `20`.
- **MIRROR**: `stacking.test.ts:95-135`, `discovery.test.ts:42-73`, `quiz.test.ts:52-118`.
- **VALIDATE**: `bun run test runtime-src/tests/demo-overlays/`

### `[ ]` Task 5: UPDATE `e2e/overlay-mobile.spec.ts`

- **IMPLEMENT**: `"a quiz covers the whole phone screen and needs no scrolling"`:
  1. `injectQuiz(QUIZ_FIXTURE)` (t 70), `seekTo(68)`, `tapHostPlay`, wait for `.vp-quiz-card`.
  2. The slot box equals `{0,0,390,844}` ±1.
  3. `elementFromPoint(195, 812)` is inside `#vp-slot-quiz` (over LearningSuite's bar).
  4. The card's `scrollHeight <= clientHeight + 1`.
  5. All four `.vp-quiz-option` share the same `x` (one column).
  6. Tap option A and expect a `data-state` of `correct` on it.
  7. After the feedback and auto-resume, `.vp-quiz-scrim` is gone and `elementFromPoint(195, 812)` is not inside `#vp-slot-quiz` (the empty slot passes taps through).
- Replace P2's weaker "an injected quiz break covers the player" test with this one on mobile.
- **VALIDATE**: `E2E_RUNTIME_BASE_URL=http://localhost:3000/runtime/loader.js bun run e2e`

### `[ ]` Task 6: REGENERATE the bundle; VERIFY in Chrome

- **VALIDATE**: `bun run build:runtime && git status --short public/runtime`, then Level 5.

---

## Testing Strategy

### Unit Tests to Write

| Test File                | Test Cases                                                                                                       | Validates |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- | --------- |
| `quiz-placement.test.ts` | promote; demote on resize; fullscreen demote and re-promote; focus kept; z ordering; single-column CSS; teardown | AC1–AC5   |

### Edge Cases Checklist

- [ ] Rotation mid-quiz (landscape phone 732×413 → full size): demoted into the player; focus kept
- [ ] Sheet open when the quiz fires: the quiz (1150) covers the sheet (1100); Escape goes to the quiz (capture phase)
- [ ] Summary screen (`showSummary`): `.vp-quiz-summary-rows` max-height 220 fits the promoted card
- [ ] Desktop at 1024 (461×260 player, compact): the quiz covers the desktop viewport. Accepted; see Questionables

---

## Validation Commands

🔁 **Validation loop:** the plan is not complete until every command below passes (exit 0). On any failure, fix the cause and re-run — loop until all pass. If a check is genuinely impossible, mark it `[f]`, note why in Agent Notes, and move on.

### Level 1: STATIC_ANALYSIS

```bash
bun run lint && bun run typecheck:runtime && bunx tsc --noEmit -p tsconfig.json
```

### Level 2: UNIT_TESTS

```bash
bun run test runtime-src/tests/demo-overlays/
```

### Level 3: FULL_SUITE

```bash
bun run test && bun run build:runtime && git status --short public/runtime
```

### Level 4: DATABASE_VALIDATION

Not applicable.

### Level 5: BROWSER_VALIDATION (Chrome, live lesson, local runtime)

**Setup:** inject the quiz client-side (spec recipe), seek to 68 and start playback with a real
click.

**Checks:**

- [ ] **V1 390×844:**
  - The slot rect is (0, 0, 390, 844).
  - `elementFromPoint(195, 812)` is the scrim.
  - The card has `scrollHeight === clientHeight`.
  - One column.
  - Answering works; the video resumes.
  - Afterwards `elementFromPoint(195, 812)` is LearningSuite's bar again.
- [ ] **V2 844×390 landscape:** the player is 732×413, compact under the agreed rule, so the quiz
      is promoted. The card needs `max-height` 390 − 32: record whether it scrolls.
- [ ] **V5 1024×768 and 1600×900:** compact (M14 corrected), so the quiz is promoted over the
      desktop page. Record a screenshot for the user (Questionable below).
- [ ] **V6 1920×1080, fresh load** (player 752×424, full size): the quiz is unchanged inside the
      player (slot parent is the player host, `absolute`, z 20).

### Level 6: MANUAL_VALIDATION

- [ ] On a real phone: VoiceOver/TalkBack lands in the dialog when it opens.

---

## Acceptance Criteria

- [ ] **AC1**: On compact players outside fullscreen, the quiz slot is a viewport-fixed child of `body` at z 1150.
- [ ] **AC2**: Otherwise (full-size player or fullscreen), it sits in the player as today.
- [ ] **AC3**: The promoted quiz shows the whole card without inner scrolling at 390×844, answers in one column.
- [ ] **AC4**: Moving the slot keeps keyboard focus in the dialog.
- [ ] **AC5**: After the quiz ends, nothing of ours blocks taps on the page.
- [ ] Level 1–3 pass; Level 5 recorded; e2e mobile green.

---

## Completion Checklist

- [ ] Tasks 1–6 done in order, each validated
- [ ] Spec amendment noted (see Questionables: the "back in the player" criterion)
- [ ] Commit `[FEATURE]` on `feature/mobile-overlays`
- [ ] PRD: all phases complete. Run the acceptance check (`molto-agents:acceptance-check`) over the PRD's phases

---

## Risks and Mitigations

| Risk                                                      | Likelihood | Impact | Mitigation                                                                                                 |
| --------------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| `body` or `html` on the tenant carries a transform/filter | LOW        | HIGH   | The e2e slot-rect-equals-viewport assertion fails loudly; fallback: portal into `document.documentElement` |
| Focus lost on move                                        | MED        | MED    | `hadFocus` restore (Task 2, tested)                                                                        |
| A LearningSuite modal over the quiz                       | LOW        | LOW    | Their overlays (1200) win by design                                                                        |

---

## Questionables

<details>
<summary>Spec P5 pass criterion "afterwards the slot is back in the player"</summary>

This plan ties placement to compact mode, not to quiz activity, so after a quiz the empty slot
stays in `body` (`pointer-events:none`, paints nothing). The user-visible criterion becomes "after
the quiz, nothing of ours blocks the page" (`elementFromPoint(195, 812)` is LearningSuite's bar).
Tying placement to activity would need a hook into the quiz controller's open/close for no visible
gain. Confirm, and amend the spec's P5 criterion when implementing.

</details>

<details>
<summary>Desktop promotes up to 1600px</summary>

Under the agreed rule (`width < 750 || height < 280`, spec amendment (b)), desktop players up to
1600 are compact (M14 corrected: 441–641px wide). So the quiz covers the whole browser window
there. At 1920 (752×424) it stays inside the player. That is consistent, since the in-player quiz
has the same space problem at those sizes, but it is a visible desktop change. Confirm with the
screenshot from Level 5.

</details>

---

## Agent Notes

- The researcher verified that happy-dom has no Fullscreen API. Define
  `document.fullscreenElement` with `Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => el })`
  and dispatch `new Event("fullscreenchange")` on `document`.

---

## Amendments

_Append-only history of changes made **after** this plan was first built (newest at the bottom)._

<details>
<summary>2026-09-29T14:10Z — compact rule agreed (760 × 280)</summary>

Every measured desktop and tablet player is now compact, so the quiz is promoted there too. The
Level 5 checks were re-scoped: V2, V5 and V6 expect promotion, and the "unchanged in the player"
check uses a no-sidebar config with a player ≥ 760×280. The desktop Questionable was updated.

</details>

<details>
<summary>2026-09-29T15:00Z — rule corrected to 750; 1920 stays in the player</summary>

With fresh-load measurements (spec amendment (b)), 1920 gives a 752×424 player, which is full size
under the corrected rule `width < 750 || height < 280`. Level 5 now expects promotion at V5 and
1600, and an unchanged in-player quiz on a fresh load at 1920. The desktop Questionable was
updated.

</details>
