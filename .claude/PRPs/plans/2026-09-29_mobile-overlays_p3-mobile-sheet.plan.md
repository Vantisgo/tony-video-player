# Feature: Mobile overlays P3 — sheet host (tab bar + docked sheet)

## Summary

Give the sidebar a second host. At ≥ 1024px nothing changes: the existing flex-sibling/fixed-rail
code moves unchanged into `sidebar-host.ts`. Below 1024px the same `<aside>` becomes a sheet
docked under the video (`mobile-sheet.ts`), opened from a tab bar inserted directly after the
player, and from the science and meta pills. Opening scrolls the page as far as it can toward the
player and sets the sheet's top to where the player's bottom will be. The top is computed by a
pure `sheetTop()` (`sheet-geometry.ts`) rather than measured after the scroll. The video stays
visible and keeps playing.

## User Story

As a learner watching a lesson on my phone
I want to open the coaching, Science Corner and Master-Schritte content right under the video
So that I can read what the coach does while the lesson keeps playing

## Problem Statement

Below 1024px the `<aside>` is built but never attached (`index.ts:1376-1379`, `showSidebar` false),
so its content is unreachable on phones (PRD evidence; spec M1). P1 made the pills honest about
that; this phase makes the content reachable.

## Solution Statement

- `chooseHostMode(viewportFits, hasContent)` → `"desktop" | "sheet" | "none"` replaces
  `showSidebar`.
- `installSidebarHost()` returns `{ mode, open(tab), isConnected() }`.
- `window.__vpSidebarTab` points at `host.open`. P1's guard now reads "a host is installed".
- Sheet mode:
  - a `<nav id="vp-mobile-tabs">` goes after the player host;
  - the `<aside>` is restyled as a fixed bottom sheet (z-index 1100) under `body`, or under
    `document.fullscreenElement` when that contains the player;
  - it is `inert` and off-screen while closed; a ✕ button and Escape close it;
  - while open, its top follows the player's bottom on scroll and resize.
- The existing 1024px `matchMedia` and the remount on crossing it stay as they are.

## Metadata

| Field            | Value                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type             | NEW_CAPABILITY                                                                                                                                                                                    |
| Complexity       | HIGH                                                                                                                                                                                              |
| Systems Affected | `runtime-src/demo-overlays/{index,styles,sidebar-host,mobile-sheet,sheet-geometry}.ts`, `runtime-src/common/i18n/demo.ts`, tests, `e2e/overlay-mobile.spec.ts`, `public/runtime/demo-overlays.js` |
| Dependencies     | none new (DOM: `inert`, Fullscreen API, `Element.after`; TS 5.9 `lib.dom` types all three)                                                                                                        |
| Estimated Tasks  | 12                                                                                                                                                                                                |

---

## Lifecycle (append-only)

- **Created:** 2026-09-29T12:40Z
- **Modified:** 2026-09-29T12:40Z
- **Commits:**
- **Agent / Session:** claude-opus-5-5 (planning), session c9261ef3-2af4-4ce2-826b-0ee1520bc2a7
- **Back refs:** `docs/superpowers/specs/2026-09-29-mobile-overlays-sidebar-design.md` (P3) · `.claude/PRPs/prds/mobile-overlays.prd.md` (phase 3) · `.claude/PRPs/plans/2026-09-29_mobile-overlays_p1-dead-affordances.plan.md` (the guard this replaces) · `.claude/PRPs/plans/2026-09-29_mobile-overlays_p2-mobile-canary-harness.plan.md` (helpers used here)
- **Forward refs:** `.claude/PRPs/plans/2026-09-29_mobile-overlays_p4-compact-overlays.plan.md` (section-pill tap calls `open("coaching")`) · `…_p5-quiz-on-mobile.plan.md` (quiz stacks above the sheet)

> **Append-only:** `Created` is set once; every other field is a list you only ever add to — never overwrite or remove existing entries. Keep references bidirectional: when you add a back/forward ref here, add the reciprocal ref on the other plan.

> **Planned ahead of its dependencies.** P1 and P2 were not implemented when this plan was
> written. Before Task 1, re-read `index.ts:1374-1410` and `e2e/overlay-mobile.spec.ts` and adjust
> line references. The contracts relied on are `if (showSidebar) { w.__vpSidebarTab = … }` (P1) and
> `readBox`/`playerBox`/`tapHostPlay`/`seekTo` in `e2e/support/mobile.ts` (P2).

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE (390×844, after P1)                 ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║   ┌──────────────────────────┐                                                ║
║   │   VIDEO + pills (info)    │   <aside> built, never attached               ║
║   └──────────────────────────┘   Coaching / Science / Meta: unreachable       ║
║     Anhänge …                                                                 ║
║   PAIN_POINT: the lesson's differentiating content does not exist on phones   ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE (390×844)                           ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║   ┌──────────────────────────┐  y=315 (scrolls to 209 on open, max 106px)     ║
║   │ [Section]    [🧪 Öffnen] │─tap──┐                                        ║
║   │          VIDEO           │      │                                        ║
║   └──────────────────────────┘ y=534│→428                                    ║
║   ┌────────┬────────┬───────┐       │   nav#vp-mobile-tabs (44px buttons)    ║
║   │Coaching│Science │Master │─tap───┤                                        ║
║   └────────┴────────┴───────┘       ▼                                        ║
║                              host.open(tab) → setTab(tab)                    ║
║                              sheetTop({rect, scrollY, maxScroll, vw, vh})    ║
║                              → scrollTo(106, smooth) · aside.style.top=428   ║
║   ╔══════════════════════════╗ ← aside#vp-demo-sidebar, fixed, z 1100        ║
║   ║ Coaching│Science│Master ✕║   role=dialog, inert=false while open         ║
║   ║ 1 Ankommen & Kontakt  ●  ║   top follows player bottom on scroll/resize  ║
║   ║ …  (panels scroll)       ║   ✕ / Escape → inert, off-screen             ║
║   ╚══════════════════════════╝ ← covers LearningSuite's bottom bar (z 999)    ║
║   VALUE_ADD: all three tabs reachable; the video stays visible and playing   ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location                          | Before                  | After                                          | User Impact          |
| --------------------------------- | ----------------------- | ---------------------------------------------- | -------------------- |
| Below the player (< 1024px)       | nothing                 | tab bar with one 44px button per tab           | Always-visible entry |
| `#vp-demo-sidebar` (< 1024px)     | detached                | fixed sheet under `body`, `inert` while closed | Content reachable    |
| Science/meta pill (< 1024px)      | information only (P1)   | "Öffnen" / tap opens the sheet on its tab      | Pills work again     |
| Fullscreen (Android/desktop/iPad) | n/a                     | sheet re-parented into the fullscreen element  | Pills still open it  |
| ≥ 1024px                          | sidebar beside `<main>` | unchanged (code moved, not changed)            | None                 |

---

## Mandatory Reading

| Priority | File                                                                      | Lines                                | Why Read This                                                                                                                                              |
| -------- | ------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | `runtime-src/demo-overlays/index.ts`                                      | 1215-1406                            | `<aside>` markup, `tabDefs`, `detectTopNavHeight`, `applyFixedRightRail`, `tryFlexSibling`, the install block, `setTab` — the code being moved and wrapped |
| P0       | `runtime-src/demo-overlays/index.ts`                                      | 1532-1540                            | `renderScienceHighlight` → `scrollIntoView` (must be skipped while the sheet is closed)                                                                    |
| P0       | `runtime-src/demo-overlays/index.ts`                                      | 156-179, 336-338, 413-415, 1755-1767 | `MountState`, `OWNED_NODE_IDS`, `onCleanup`, defensive sweep (id rules), `checkAlive`                                                                      |
| P0       | `runtime-src/demo-overlays/quiz.ts`                                       | 23-35, 49-70, 84-85                  | Deps-injected factory pattern (`QuizControllerDeps`) and `qzEl` createElement builder to mirror                                                            |
| P1       | `runtime-src/common/i18n/demo.ts`                                         | all                                  | EN `as const` + `DE: Record<DemoKey,string>`; key grouping comments                                                                                        |
| P1       | `runtime-src/tests/common/i18n.test.ts`                                   | 283-360                              | Catalogue rules: same keys, non-empty, no `<>&`, same placeholders, disjoint namespaces                                                                    |
| P1       | `runtime-src/tests/demo-overlays/lifecycle.test.ts`                       | 1-100, 256-282                       | Harness + the mobile test this phase rewrites                                                                                                              |
| P1       | `runtime-src/tests/demo-overlays/safety-net.test.ts`                      | 39-53, 96-129, 170-211               | `rect()` stub helper, rollback test, the 390px test this phase rewrites                                                                                    |
| P1       | `runtime-src/tests/demo-overlays/stacking.test.ts`                        | 95-135                               | `z(id)` assertion pattern                                                                                                                                  |
| P2       | `runtime-src/common/format.ts`, `runtime-src/tests/common/format.test.ts` | all                                  | Pure-function + table-test style for `sheetTop`                                                                                                            |
| P2       | `docs/feature-context.md`                                                 | 55-66, 96-118                        | Cleanup scopes; "anything a mount adds must register its removal"; pre-wrap                                                                                |

**External Documentation:**

| Source                                                                                                   | Section           | Why Needed                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [MDN `inert`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/inert)                        | behaviour         | Blocks focus/click/AT; baseline since 2023 (iOS 15.5+). happy-dom reflects the attribute and blocks `focus()` but not dispatched clicks, so assert the attribute                                                              |
| [WHATWG Fullscreen — rendering](https://fullscreen.spec.whatwg.org/#rendering)                           | top layer         | Fixed elements outside the fullscreen element are not rendered; children appended into it are (verified, Chrome 154). iPhone has no element fullscreen (iPad only since 16.4), so overlays cannot show over the native player |
| [MDN containing block](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Display/Containing_block) | fixed positioning | `transform`/`filter`/`backdrop-filter`/`contain` ancestors capture `position:fixed`; `body` has none on the tenant (P3 e2e asserts it)                                                                                        |
| [Chrome: URL bar resizing](https://developer.chrome.com/blog/url-bar-resizing)                           | ICB vs viewport   | `innerHeight` stays "URL bar shown" on Android; bottom-anchoring (`bottom:0`) tracks toolbar changes without JS                                                                                                               |
| [MDN `scrollend`](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollend_event)              | support           | iOS only from 26.2, so the top is computed from the target, never measured after the scroll                                                                                                                                   |
| [MDN `overscroll-behavior`](https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior)        | contain           | Partial on iOS 16+: no effect without scrollable overflow; `#vp-panels` is `overflow:auto`                                                                                                                                    |

---

## Patterns to Mirror

**DEPS-INJECTED FACTORY:**

```typescript
// SOURCE: runtime-src/demo-overlays/quiz.ts:23-35,84-85
export interface QuizControllerDeps {
  quiz: QuizConfig; mediaEl: MediaEl; playerHost: HTMLElement; slot: HTMLElement;
  isAudioActive: () => boolean;
  onCleanup: (fn: () => void) => void;
}
export function createQuizController(deps: QuizControllerDeps): QuizController {
  const { quiz, mediaEl, playerHost, slot, isAudioActive, onCleanup } = deps;
```

**CODE BEING MOVED (verbatim into `sidebar-host.ts`):**

```typescript
// SOURCE: runtime-src/demo-overlays/index.ts:1374-1379
// Installing the sidebar hides LearningSuite's own right column, so with
// nothing to show we must not touch the host layout at all.
if (showSidebar) {
  if (!tryFlexSibling()) applyFixedRightRail();
  onCleanup(() => sidebar.remove());
}
```

**PURE FUNCTION + HEADER COMMENT:**

```typescript
// SOURCE: runtime-src/common/format.ts (shape): a small exported function whose header comment
// states the rule and its edge cases; tests are tables of input → expected.
```

**I18N KEYS:**

```typescript
// SOURCE: runtime-src/common/i18n/demo.ts (shape)
const EN = { /* // Sidebar tabs */ "demo.tab.coaching": "Coaching", … } as const;
export type DemoKey = keyof typeof EN;
const DE: Record<DemoKey, string> = { "demo.tab.coaching": "Coaching", … };
```

**FAKE LAYOUT IN TESTS:**

```typescript
// SOURCE: runtime-src/tests/demo-overlays/safety-net.test.ts:39-53,184-193
function rect(width: number, height: number): DOMRect {
  return { width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
}
vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) { … });
```

---

## Files to Change

| File                                                      | Action     | Justification                                                                                      |
| --------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------- |
| `runtime-src/demo-overlays/sheet-geometry.ts`             | CREATE     | Pure `sheetTop()` and `sheetMaxTop()`; importable by e2e (no DOM, no i18n)                         |
| `runtime-src/demo-overlays/mobile-sheet.ts`               | CREATE     | Tab bar, sheet restyle, open/close/follow, fullscreen re-parenting                                 |
| `runtime-src/demo-overlays/sidebar-host.ts`               | CREATE     | `chooseHostMode`, `installSidebarHost`, desktop placement moved verbatim                           |
| `runtime-src/demo-overlays/index.ts`                      | UPDATE     | Use the host; `__vpSidebarTab = host.open`; `checkAlive`; `OWNED_NODE_IDS`; `scrollIntoView` guard |
| `runtime-src/demo-overlays/styles.ts`                     | UPDATE     | Extend `SLOT_CSS` with `.vp-sheet-ui, .vp-sheet-ui *`                                              |
| `runtime-src/common/i18n/demo.ts`                         | UPDATE     | `demo.sheet.label`, `demo.sheet.close`, `demo.sheet.tabs` (EN + DE)                                |
| `runtime-src/tests/demo-overlays/sheet-geometry.test.ts`  | CREATE     | Table tests (M9, M10, edges)                                                                       |
| `runtime-src/tests/demo-overlays/sidebar-host.test.ts`    | CREATE     | `chooseHostMode` truth table                                                                       |
| `runtime-src/tests/demo-overlays/mobile-sheet.test.ts`    | CREATE     | DOM behaviour at 390px                                                                             |
| `runtime-src/tests/demo-overlays/lifecycle.test.ts`       | UPDATE     | Mobile test now expects the sheet host                                                             |
| `runtime-src/tests/demo-overlays/safety-net.test.ts`      | UPDATE     | 390px test and rollback cover `#vp-mobile-tabs`                                                    |
| `runtime-src/tests/demo-overlays/open-affordance.test.ts` | UPDATE     | P1 case 1 now tests the guard by removing the function, since a host exists at 390                 |
| `e2e/overlay-mobile.spec.ts`                              | UPDATE     | P3 assertions                                                                                      |
| `public/runtime/demo-overlays.js`                         | REGENERATE | Committed bundle                                                                                   |

---

## NOT Building (Scope Limits)

- Scroll lock, drag-to-resize, swipe-to-close (spec out of scope).
- Pausing the video on open (decided: keeps playing).
- Changing the desktop sidebar's look, width or breakpoint.
- Compact overlays (P4), the quiz on mobile (P5).

---

## Step-by-Step Tasks

### `[ ]` Task 1: CREATE `runtime-src/demo-overlays/sheet-geometry.ts`

- **ACTION**: CREATE pure geometry.
- **IMPLEMENT**:
  ```ts
  // Where the mobile sheet's top edge goes. Pure on purpose: happy-dom has no
  // layout, and e2e/overlay-mobile.spec.ts imports this to compute the expected
  // position on the real page. Rule (spec P3): scroll the page as far as it can
  // toward the player's top, dock the sheet at the player's bottom as it will be
  // after that scroll, and never let the sheet shrink below 45% of the viewport
  // in portrait or 60% in landscape (measured: iPhone 390×844 → top 428).
  export function sheetMaxTop(vw: number, vh: number): number {
    return Math.round(vh * (vh >= vw ? 0.55 : 0.4));
  }
  export interface SheetTopInput {
    playerTop: number;
    playerBottom: number;
    scrollY: number;
    maxScroll: number;
    vw: number;
    vh: number;
  }
  export function sheetTop(i: SheetTopInput): {
    top: number;
    targetScroll: number;
  } {
    const targetScroll = Math.min(
      Math.max(i.scrollY + i.playerTop, 0),
      Math.max(i.maxScroll, 0),
    );
    const bottomAfter = i.playerBottom - (targetScroll - i.scrollY);
    const top = Math.min(Math.max(bottomAfter, 0), sheetMaxTop(i.vw, i.vh));
    return { top: Math.round(top), targetScroll: Math.round(targetScroll) };
  }
  ```
- **MIRROR**: `runtime-src/common/format.ts` (small pure export, rule in the header comment).
- **VALIDATE**: `bun run typecheck:runtime`

### `[ ]` Task 2: CREATE `runtime-src/tests/demo-overlays/sheet-geometry.test.ts`

- **IMPLEMENT**: A table using the measured numbers:
  - **M9 iPhone:** `{playerTop:315, playerBottom:534, scrollY:0, maxScroll:106, vw:390, vh:844}` → `{top:428, targetScroll:106}`.
  - **M10 landscape:** `{405, 818, 0, 400, 844, 390}` → `targetScroll 400`, `top 156` (60% clamp).
  - **Player already scrolled past:** `playerTop:-300, playerBottom:-81, scrollY:500, maxScroll:1000` → `targetScroll 200`, `top 219`.
  - **`maxScroll` 0 or negative:** → `targetScroll 0`.
  - `sheetMaxTop(390,844)` is 464 and `sheetMaxTop(844,390)` is 156.
- **MIRROR**: `runtime-src/tests/common/format.test.ts`.
- **VALIDATE**: `bun run test runtime-src/tests/demo-overlays/sheet-geometry.test.ts`

### `[ ]` Task 3: UPDATE `runtime-src/common/i18n/demo.ts`

- **ACTION**: ADD under a `// Mobile sheet` comment:
  - `demo.sheet.label`: EN "Lesson details", DE "Lektionsdetails"
  - `demo.sheet.close`: EN "Close", DE "Schließen"
  - `demo.sheet.tabs`: EN "Lesson sections", DE "Lektionsbereiche"
- **GOTCHA**: no `<`, `>` or `&` in messages (`i18n.test.ts` catalogue rules); keys stay in `demo.*`.
- **VALIDATE**: `bun run typecheck:runtime && bun run test runtime-src/tests/common/i18n.test.ts`

### `[ ]` Task 4: UPDATE `runtime-src/demo-overlays/styles.ts` — pre-wrap reset for sheet UI

- **ACTION**: `SLOT_CSS` becomes `.vp-slot, .vp-slot *, .vp-sheet-ui, .vp-sheet-ui * { white-space:normal; }`, with one comment line: the tab bar is a sibling of the player inside LearningSuite's pre-wrap block, and the sheet leaves the slots.
- **MIRROR**: `styles.ts:20-39` (keep the existing comment; append the reason).
- **VALIDATE**: `bun run test runtime-src/tests/demo-overlays/render.test.ts`

### `[ ]` Task 5: CREATE `runtime-src/demo-overlays/mobile-sheet.ts`

- **ACTION**: CREATE `createMobileSheet(deps: MobileSheetDeps): MobileSheet`.
- **TYPES**:
  ```ts
  export const TAB_BAR_ID = "vp-mobile-tabs"; // not vp-slot-*, not *sidebar (index.ts sweep 413-415)
  export interface MobileSheetDeps {
    sidebar: HTMLElement;
    playerHost: HTMLElement;
    tabs: ReadonlyArray<{ key: string; label: string }>;
    setTab: (key: string) => void;
    onCleanup: (fn: () => void) => void;
  }
  export interface MobileSheet {
    open(tab: string): void;
    close(): void;
    isOpen(): boolean;
    isConnected(): boolean;
  }
  ```
- **IMPLEMENT**:
  - **Tab bar:**
    - Build with `document.createElement` (no template literal; pre-wrap).
    - `nav#vp-mobile-tabs.vp-sheet-ui` gets `aria-label = tr("demo.sheet.tabs")`, inline `display:flex; gap:6px; padding:8px 0; box-sizing:border-box; font:600 13px system-ui`.
    - One `button[type=button][data-sheet-tab=key][aria-controls=vp-demo-sidebar][aria-expanded=false]` per tab, `textContent = label`, inline `flex:1; min-height:44px; border:0; border-radius:10px; background:${T.muted}; color:${T.fg}; cursor:pointer`.
    - `playerHost.after(nav)`. `onclick = () => open(key)`.
  - **Sheet restyle:**
    - `sidebar.classList.add("vp-sheet-ui")`; `role="dialog"`, `aria-modal="false"`, `aria-label = tr("demo.sheet.label")`.
    - Overwrite `sidebar.style.cssText` with the desktop visual tokens (`background:${T.card}; color:${T.fg}; color-scheme:dark; font:14px/1.45 …; border:1px solid ${T.border}`) plus `position:fixed; left:0; right:0; bottom:0; top:<n>px; width:auto; max-height:none; z-index:1100; border-radius:14px 14px 0 0; border-bottom:0; box-shadow:0 -8px 24px rgba(0,0,0,.35); display:flex; flex-direction:column; overflow:hidden`.
    - Closed state: `transform:translateY(100%); visibility:hidden` and `sidebar.inert = true`.
    - Set every `.vp-tab` button's `style.minHeight = "44px"`, and `#vp-panels` `style.overscrollBehavior = "contain"`.
  - **Close button:**
    - `button.vp-sheet-close[type=button]` with `aria-label = tr("demo.sheet.close")`, `textContent = "✕"`, inline `flex:0 0 44px; height:44px; border:0; border-radius:8px; background:transparent; color:${T.mutedFg}; font:600 16px system-ui; cursor:pointer`.
    - Append it to the tab row (`sidebar.querySelector(".vp-tab")?.parentElement`). `onclick = close`.
  - **Parent:**
    - `const parentFor = () => { const fs = document.fullscreenElement; return fs && fs.contains(playerHost) ? fs : document.body; }`; append at creation.
    - Listen for `fullscreenchange` and `webkitfullscreenchange` on `document` and re-append if the parent differs.
  - **`open(tab)`:**
    1. `setTab(tab)`.
    2. `const r = playerHost.getBoundingClientRect(); const se = document.scrollingElement ?? document.documentElement;`
    3. In fullscreen, `top = sheetMaxTop(innerWidth, innerHeight)` and no scroll. Otherwise `({ top, targetScroll } = sheetTop({ playerTop: r.top, playerBottom: r.bottom, scrollY: window.scrollY, maxScroll: se.scrollHeight - innerHeight, vw: innerWidth, vh: innerHeight }))`, and if `Math.abs(targetScroll - window.scrollY) >= 1`, call `window.scrollTo({ top: targetScroll, behavior: "smooth" })`.
    4. Set `style.top`, `transform:none`, `visibility:visible`, `inert = false`, `dataset.open = "1"`, and `aria-expanded` on the tab-bar buttons (true on the active tab).
    5. Remember `document.activeElement` and focus the close button with `{ preventScroll: true }`.
  - **Follow while open:** `scroll` (passive) and `resize` listeners on `window`, throttled with rAF, set `style.top = Math.round(Math.min(Math.max(playerHost.getBoundingClientRect().bottom, 0), sheetMaxTop(innerWidth, innerHeight))) + "px"`. The fullscreen branch uses `sheetMaxTop`.
  - **`close()`:** set inert and the closed styles, `delete dataset.open`, `aria-expanded=false`, and restore focus to the remembered element if it is still connected.
  - **Escape:** a `keydown` listener on `document` (bubble phase) closes the sheet when `isOpen()`. The quiz's capture-phase handler stops propagation while a quiz is open, so a quiz wins.
  - **Cleanup:** `onCleanup` removes the nav, removes the sidebar, removes every listener and cancels the pending rAF.
  - `isConnected = () => nav.isConnected && sidebar.isConnected`.
- **MIRROR**: `quiz.ts:23-35,84-85` (deps factory), `quiz.ts:49-70` (`qzEl` createElement builder: `setAttribute`, `textContent`, never `innerHTML`).
- **IMPORTS**: `import { t as tr } from "../common/i18n/demo"; import { sheetMaxTop, sheetTop } from "./sheet-geometry"; import { T } from "./styles";`
- **GOTCHA**:
  - Do not use `scrollend`: iOS < 26.2 never fires it. Following the player on `scroll` already tracks the smooth scroll.
  - `document.fullscreenElement` may be retargeted to a shadow host. `contains(playerHost)` still holds, because the player host is light DOM (`.fullscreen-container`).
  - happy-dom has no `fullscreenElement`: read it defensively (`document.fullscreenElement ?? null`).
- **VALIDATE**: `bun run typecheck:runtime && bun run lint`

### `[ ]` Task 6: CREATE `runtime-src/demo-overlays/sidebar-host.ts`

- **ACTION**: CREATE the host module and MOVE the desktop placement.
- **IMPLEMENT**:
  ```ts
  export type HostMode = "desktop" | "sheet" | "none";
  // The 1024px query decides the page layout (room beside <main>), content decides
  // whether anything is installed at all (feature-context: an empty sidebar must
  // not touch the host layout).
  export function chooseHostMode(
    viewportFits: boolean,
    hasContent: boolean,
  ): HostMode {
    if (!hasContent) return "none";
    return viewportFits ? "desktop" : "sheet";
  }
  export interface SidebarHostDeps {
    mode: "desktop" | "sheet";
    sidebar: HTMLElement;
    playerHost: HTMLElement;
    tabs: ReadonlyArray<{ key: string; label: string }>;
    setTab: (key: string) => void;
    onCleanup: (fn: () => void) => void;
  }
  export interface SidebarHost {
    readonly mode: "desktop" | "sheet";
    open(tab: string): void;
    isConnected(): boolean;
  }
  export function installSidebarHost(deps: SidebarHostDeps): SidebarHost;
  ```

  - **desktop:** move `detectTopNavHeight`, `SIDEBAR_W`, `SIDEBAR_GAP`, `SIDEBAR_MIN_TOP`, `applyFixedRightRail`, `tryFlexSibling` from `index.ts:1256-1372` **verbatim**, including their comments, into an internal `installDesktop(sidebar, onCleanup)`, then `if (!tryFlexSibling()) applyFixedRightRail(); onCleanup(() => sidebar.remove());`. `open = setTab`; `isConnected = () => sidebar.isConnected`.
  - **sheet:** `const sheet = createMobileSheet(deps)`; `open = sheet.open`; `isConnected = sheet.isConnected`.
- **MIRROR**: the moved code itself; `quiz.ts` deps factory.
- **GOTCHA**: The moved functions reference `sidebar` and `onCleanup` as closure variables. Pass both in and keep the bodies byte-identical otherwise (review with `git diff --color-moved`).
- **VALIDATE**: `bun run typecheck:runtime`

### `[ ]` Task 7: UPDATE `runtime-src/demo-overlays/index.ts` — use the host

- **IMPLEMENT**:
  - **Imports:** `chooseHostMode`, `installSidebarHost`, `type SidebarHost` from `./sidebar-host`; `TAB_BAR_ID` from `./mobile-sheet`.
  - **Mode (356-358):**
    - `const hostMode = chooseHostMode(sidebarFits, showCoachingTab || showScienceTab || showMetaTab);`.
    - Remove `showSidebar`, and replace its remaining uses with `host`.
    - Keep `sidebarFits`; `checkAlive` still compares it.
  - **Remove the moved code** (1256-1379). In its place:
    ```ts
    // Installing the desktop sidebar hides LearningSuite's own right column; the
    // sheet touches no host layout. With nothing to show, neither runs.
    const host: SidebarHost | null =
      hostMode === "none"
        ? null
        : installSidebarHost({
            mode: hostMode,
            sidebar,
            playerHost,
            tabs: tabDefs,
            setTab,
            onCleanup,
          });
    ```
    `setTab` is a function declaration, so it is hoisted.
  - **P1 block:** `if (host) { w.__vpSidebarTab = host.open; onCleanup(() => { delete w.__vpSidebarTab; }); }`.
  - **`checkAlive` (1764):** `if (host && !host.isConnected()) return false;`.
  - **`OWNED_NODE_IDS`:** add `TAB_BAR_ID`.
  - **`renderScienceHighlight` (1539):** `if (card && !sidebar.inert) card.scrollIntoView(…)`. Comment: a closed sheet is off-screen, and scrolling a card inside it into view would scroll the learner's page.
- **GOTCHA**:
  - `tabDefs` elements carry `show`. Pass them as they are; the type only needs `key` and `label`.
  - `sidebar.inert` is `false` on desktop, so desktop behaviour is unchanged.
- **VALIDATE**: `bun run typecheck:runtime && bun run lint`

### `[ ]` Task 8: CREATE `runtime-src/tests/demo-overlays/sidebar-host.test.ts` and `mobile-sheet.test.ts`

- **IMPLEMENT**:
  - **`sidebar-host.test.ts`:** the `chooseHostMode` truth table (4 rows).
  - **`mobile-sheet.test.ts`:**
    - **Setup:** the `render.test.ts` harness, and `happyDOM.setViewport({ width: 390, height: 844 })` before import (start narrow: `change` first-fire quirk).
    - **Stubs:** stub the player host rect to M9 (`top 315, bottom 534`) with the `safety-net.test.ts` `rect()` pattern. `Object.defineProperty(document.documentElement, "scrollHeight", { value: 950, configurable: true })`. `vi.spyOn(window, "scrollTo")`, because happy-dom's smooth scroll ignores fake timers.
    - **Cases:**
      1. The tab bar follows the player host (`nav.previousElementSibling === host`), has one button per tab with the EN labels, and `style.minHeight` is `"44px"`.
      2. The sheet is closed at mount: `sidebar.parentElement === document.body`, `sidebar.inert === true`, and no `data-open`.
      3. Tapping "Science Corner" → `data-open="1"`, `inert` false, `style.top === "428px"`, `scrollTo` called with `{ top: 106, behavior: "smooth" }`, `[data-panel="science"]` shown, that tab's `aria-expanded` is `"true"`.
      4. ✕ closes; `Escape` closes; focus returns to the opener.
      5. The science pill at 390: `emitTime(11)` → "Open" button present (the host now exists); click → sheet open on science.
      6. The closed sheet does not scroll the page: `vi.spyOn(Element.prototype, "scrollIntoView")`, `emitTime(11)` → not called.
      7. Follow: while open, change the stubbed bottom to `300`, dispatch `scroll`, advance one frame → `style.top === "300px"`; bottom `700` → clamped to `464px`.
      8. Fullscreen: define a `document.fullscreenElement` getter returning a wrapper that contains the host, dispatch `fullscreenchange` → `sidebar.parentElement === wrapper`; restore → back to `body`.
      9. Stacking: `sidebar.style.zIndex === "1100"`.
      10. Teardown: removing the config removes `#vp-mobile-tabs` and `#vp-demo-sidebar`, and a later `Escape` dispatch throws nothing.
    - Restore `setViewport({ width: 1024, height: 768 })`, `vi.restoreAllMocks()` and `vi.unstubAllGlobals()` in `afterEach`.
- **MIRROR**: `render.test.ts:1-115`, `safety-net.test.ts:39-53,184-193`, `stacking.test.ts:95-135`.
- **VALIDATE**: `bun run test runtime-src/tests/demo-overlays/sidebar-host.test.ts runtime-src/tests/demo-overlays/mobile-sheet.test.ts`

### `[ ]` Task 9: UPDATE the existing tests that assert today's mobile behaviour

- **IMPLEMENT**:
  - **`lifecycle.test.ts:256-282`:**
    - Rename to `"installs the sheet host below 1024px and the desktop sidebar once the viewport widens"`.
    - At 390, `#vp-demo-sidebar` exists under `body` with `inert`, `#vp-mobile-tabs` exists, and `body.style.paddingRight === ""`.
    - At 1280, `#vp-mobile-tabs` is null and the sidebar is the rail.
    - Back at 390, the tabs are back.
  - **`safety-net.test.ts:196-210`:** after the 390 remount, `lsColumn.style.display === ""` (restored) and `#vp-mobile-tabs` exists.
  - **`safety-net.test.ts` rollback:** add a 390px variant with `throwOnSubscribe` → `#vp-mobile-tabs` and `#vp-demo-sidebar` are null.
  - **`open-affordance.test.ts` (P1) case 1:** the no-host case now needs the function removed. Mount at 390, `delete window.__vpSidebarTab` before `emitTime(11)`, and expect no button. Rename the case accordingly.
- **VALIDATE**: `bun run test runtime-src/tests/demo-overlays/`

### `[ ]` Task 10: UPDATE `e2e/overlay-mobile.spec.ts`

- **IMPLEMENT** (P3 assertions, using the P2 helpers):
  - `"the tab bar sits directly under the player"`: `|tabs.y - (player.y + player.h)| <= 1`.
  - `"each tab opens the sheet docked at the player's bottom"`, for every `[data-sheet-tab]`:
    1. Read the rects and scroll metrics via `evaluate`, and compute the expected top with `sheetTop` imported from `../runtime-src/demo-overlays/sheet-geometry`.
    2. `locator.tap()`, wait for `#vp-demo-sidebar[data-open="1"]` and 800ms for the smooth scroll.
    3. Expect: sheet top within ±2 of expected; player bottom ≤ sheet top + 1; the matching `[data-panel]` visible; `document.elementFromPoint(195, 800)` inside `#vp-demo-sidebar` (above LearningSuite's bottom bar); the scrim-free sheet rect's `left 0` and `right 390` (proves `body` did not capture `position:fixed`).
    4. Press `Escape`; expect no `data-open`.
  - `"the science pill opens Science Corner"`: `seekTo(sciences[0].timestampsSec[0] + 1.5)`, tap the pill's button, expect `[data-panel="science"]` visible.
  - `"✕ closes the sheet"`.
- **GOTCHA**:
  - The canary lesson's content is below the 1024px breakpoint here; V2 (landscape) stays a devtools check.
  - `sheet-geometry.ts` must stay dependency-free, so the Playwright transpile of the import does not pull in the runtime's i18n.
- **VALIDATE**: `E2E_RUNTIME_BASE_URL=http://localhost:3000/runtime/loader.js bun run e2e`

### `[ ]` Task 11: REGENERATE `public/runtime/demo-overlays.js`

- **VALIDATE**: `bun run build:runtime && git status --short public/runtime`

### `[ ]` Task 12: VERIFY in Chrome (Level 5)

- **VALIDATE**: all Level 5 boxes checked, with measured values in Agent Notes.

---

## Testing Strategy

### Unit Tests to Write

| Test File                      | Test Cases                                                                                                                                                   | Validates    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| `sheet-geometry.test.ts`       | M9 → 428/106; M10 → 156; scrolled-past; maxScroll ≤ 0; `sheetMaxTop`                                                                                         | AC3 geometry |
| `sidebar-host.test.ts`         | `chooseHostMode` 4 rows                                                                                                                                      | AC1          |
| `mobile-sheet.test.ts`         | tab bar; closed at mount; open via tab; ✕/Escape/focus; pill opens; no `scrollIntoView` while closed; follow + clamp; fullscreen re-parent; z 1100; teardown | AC1–AC7      |
| `lifecycle.test.ts` (updated)  | host switches across 1024                                                                                                                                    | AC8          |
| `safety-net.test.ts` (updated) | LearningSuite column restored; rollback removes the tab bar                                                                                                  | AC9          |

### Edge Cases Checklist

- [ ] Sheet opened while a science pill highlights a card: no page jump (case 6)
- [ ] Quiz open while the sheet is open: the quiz's capture-phase keys win (Escape does not close the sheet under a quiz)
- [ ] React strips `#vp-mobile-tabs`: `checkAlive` false → remount (watch for flicker in Level 5)
- [ ] Page cannot scroll at all (`maxScroll ≤ 0`): the sheet docks at the current player bottom
- [ ] Rotating the phone while open: the `resize` listener re-clamps (portrait 45% ↔ landscape 60%)
- [ ] iPhone native fullscreen: nothing to do (overlays cannot render over it)

---

## Validation Commands

🔁 **Validation loop:** the plan is not complete until every command below passes (exit 0). On any failure, fix the cause and re-run — loop until all pass. If a check is genuinely impossible, mark it `[f]`, note why in Agent Notes, and move on.

### Level 1: STATIC_ANALYSIS

```bash
bun run lint && bun run typecheck:runtime && bunx tsc --noEmit -p tsconfig.json
```

**EXPECT**: Exit 0

### Level 2: UNIT_TESTS

```bash
bun run test runtime-src/tests/
```

**EXPECT**: All pass

### Level 3: FULL_SUITE

```bash
bun run test && bun run build:runtime && git status --short public/runtime
```

**EXPECT**: Green; only `demo-overlays.js` regenerated (committed with the source)

### Level 4: DATABASE_VALIDATION

Not applicable.

### Level 5: BROWSER_VALIDATION (Chrome via `debugging-chrome-from-wsl`, live lesson, local runtime)

**Setup:**

- `bun run watch:runtime` beside `bun dev`.
- Reload until `__vpLocalRuntime === "local"`.

**Checks:**

- [ ] **V1 390×844 touch:**
  - The tab bar's top is at the player's bottom ±1.
  - Each tab opens the sheet on its tab.
  - The sheet top is 428 ±2 and the player is fully visible.
  - `elementFromPoint(195, 800)` is inside the sheet.
  - ✕ and Escape close it.
  - The science pill "Öffnen" (at `seek(13.5)`) opens Science Corner.
  - A science pill appearing while the sheet is closed does not change `scrollY`.
- [ ] **V2 844×390 landscape:** sheet height = 60% of 390 (234) ±2.
- [ ] **V3 820×1180:** the tab bar and sheet work; the sheet top is at the player bottom or the 45% clamp.
- [ ] **V5 1024×768 and V6 1920×945:** no `#vp-mobile-tabs`; the sidebar is the flex sibling as today (V5: x=597, w=380).
- [ ] **Breakpoint:** emulate 1100 → 900 → 1100; the mode switches after each change (about 220ms). No stale tab bar or LearningSuite column left hidden.
- [ ] **Flicker watch:** at V1, 30s of playback with the sheet closed → `#vp-mobile-tabs` is never removed (MutationObserver probe).
- [ ] **Fullscreen:** cannot be triggered under automation (M13). Record as manual device check (Level 6).

### Level 6: MANUAL_VALIDATION

- [ ] On an Android phone or iPad: enter LearningSuite fullscreen, tap the science pill → the sheet appears inside fullscreen. Record which element `document.fullscreenElement` is (closes PRD open question M13).

---

## Acceptance Criteria

- [ ] **AC1**: Below 1024px with content, a sheet host is installed; at ≥ 1024px the desktop host (unchanged); without content, none.
- [ ] **AC2**: A tab bar with one ≥ 44px button per tab sits directly after the player.
- [ ] **AC3**: Opening scrolls toward the player and docks the sheet at the computed top (M9: 428), with a minimum of 45% (portrait) or 60% (landscape).
- [ ] **AC4**: The science and meta pills open the sheet on their tab.
- [ ] **AC5**: ✕ and Escape close it; closed means `inert` and off-screen; focus returns to the opener.
- [ ] **AC6**: The sheet stacks above LearningSuite's bottom bar (z 1100 > 999) and below its overlays (1200).
- [ ] **AC7**: In fullscreen the sheet is re-parented into the fullscreen element.
- [ ] **AC8**: Crossing 1024px switches hosts via remount.
- [ ] **AC9**: Teardown and failed mounts leave no tab bar or sheet behind.
- [ ] **AC10**: A closed sheet never scrolls the page.
- [ ] Level 1–3 pass; Level 5 recorded; e2e mobile green.

---

## Completion Checklist

- [ ] Tasks 1–12 completed in order, each validated
- [ ] Desktop code moved byte-identical (reviewed with `git diff --color-moved=zebra`)
- [ ] Commit `[FEATURE]` on `feature/mobile-overlays`

---

## Risks and Mitigations

| Risk                                                              | Likelihood | Impact | Mitigation                                                                                        |
| ----------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------- |
| React strips the tab bar (sibling in LearningSuite's tree)        | MED        | MED    | `checkAlive` → remount; Level 5 flicker watch                                                     |
| A LearningSuite modal marks `body` children `inert`/`aria-hidden` | LOW        | MED    | The sheet is below LearningSuite's overlays (1200) anyway; verify with their menu open in Level 5 |
| Smooth scroll interrupted by the learner                          | MED        | LOW    | The top follows the player on `scroll`, within the clamp                                          |
| The moved desktop code drifts in the move                         | LOW        | HIGH   | Byte-identical move; the existing desktop tests (`lifecycle`, `safety-net`) are unchanged at 1024 |

---

## Questionables

<details>
<summary>Copy for the new strings</summary>

Assumed "Lesson details" / "Lektionsdetails" (sheet label), "Close" / "Schließen", and
"Lesson sections" / "Lektionsbereiche" (tab bar label). These are screen-reader labels only;
the visible tab labels reuse the existing `demo.tab.*`. Confirm or replace.

</details>

<details>
<summary>Focus moves to ✕ on open</summary>

Assumed yes (a dialog pattern, even if not modal), with `preventScroll`. The alternative is
leaving focus on the tab, which keeps screen-reader users outside the new content.

</details>

---

## Agent Notes

- The researcher verified that in Chrome 154 fixed children of `body` are not rendered while
  another element is fullscreen, and that children appended into the fullscreen element are.
  Hence re-parenting, not z-index.
- `detectTopNavHeight` also matches bare `nav` elements, but only fixed or sticky ones at
  `top ≤ 6`. The tab bar is static, so it is not a candidate (and it only exists in sheet mode,
  where `detectTopNavHeight` never runs).

---

## Amendments

_Append-only history of changes made **after** this plan was first built (newest at the bottom)._
