# Feature: Mobile overlays P1 — no dead affordances

## Summary

The science pill's "Öffnen" button and the meta pill promise to open a sidebar tab, but below
1024px no sidebar is installed and the tap does nothing (spec M1). This phase makes
`window.__vpSidebarTab` exist only while a sidebar is actually installed, and renders the pills'
open affordances (button, pointer cursor, tooltip, click handler) only while it exists. The pill
itself stays visible as information. This is a `[BUGFIX]` that ships alone; P3 later installs a
mobile host, after which the guard is a safety net.

## User Story

As a learner watching a lesson on my phone
I want the science and meta pills to offer an "open" action only when it does something
So that I never tap a control that silently fails

## Problem Statement

At 390×844 on the live lesson, `typeof window.__vpSidebarTab === "function"` while
`#vp-demo-sidebar` is not in the document. Tapping the science pill's "Öffnen" button leaves the
DOM without a sidebar (measured 2026-09-29). Cause: `index.ts:1399` assigns
`w.__vpSidebarTab = setTab` unconditionally, while the sidebar is only attached inside
`if (showSidebar)` at `index.ts:1376-1379`. The pills render their affordances unconditionally
(`index.ts:664-668`, `index.ts:1188`).

## Solution Statement

Move the `__vpSidebarTab` assignment and its delete-cleanup inside the `if (showSidebar)` block.
In `renderScience` and `renderMetaStep`, read `const canOpen = typeof w.__vpSidebarTab ===
"function"` at render time. Emit the "Öffnen" `<button>`, `cursor:pointer`, the meta pill's `title`
and the click handlers only when `canOpen` is true. Guard the `querySelector("button")` that
currently assumes the button exists.

## Metadata

| Field            | Value                                                                               |
| ---------------- | ----------------------------------------------------------------------------------- |
| Type             | BUG_FIX                                                                             |
| Complexity       | LOW                                                                                 |
| Systems Affected | `runtime-src/demo-overlays/index.ts`, `public/runtime/demo-overlays.js` (generated) |
| Dependencies     | vitest ^4.1.10, happy-dom ^20.11.1 (tests only)                                     |
| Estimated Tasks  | 5                                                                                   |

---

## Lifecycle (append-only)

- **Created:** 2026-09-29T12:40Z
- **Modified:** 2026-09-29T12:40Z · 2026-09-29T15:30Z (implemented)
- **Commits:** 3f1a352 (P1 fix) · 8bc639b (pre-existing `.at()` typecheck fix, needed for Level 1)
- **Agent / Session:** claude-opus-5-5 (planning), session c9261ef3-2af4-4ce2-826b-0ee1520bc2a7 · claude-opus-5-5 (implementation), same session
- **Back refs:** `docs/superpowers/specs/2026-09-29-mobile-overlays-sidebar-design.md` (design, M1) · `.claude/PRPs/prds/mobile-overlays.prd.md` (phase 1)
- **Forward refs:** `.claude/PRPs/plans/2026-09-29_mobile-overlays_p3-mobile-sheet.plan.md` (replaces the assignment with `host.open`)

> **Append-only:** `Created` is set once; every other field is a list you only ever add to — never overwrite or remove existing entries. Keep references bidirectional: when you add a back/forward ref here, add the reciprocal ref on the other plan.

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE (390×844)                           ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║   ┌──────────────────────────┐        ┌──────────────┐     ┌──────────────┐   ║
║   │ 🧪 Wissenschaft: … [Öffnen]│ ─tap─► │ openSci()    │ ──► │ setTab() on  │   ║
║   └──────────────────────────┘        │ __vpSidebarTab│     │ DETACHED     │   ║
║   ┌──────────────────────────┐        └──────────────┘     │ <aside>      │   ║
║   │ (1) Schritt 1/5 │ Kontakt │ ─tap─►        same      ──► │ nothing seen │   ║
║   └──────────────────────────┘                             └──────────────┘   ║
║   USER_FLOW: learner taps "Öffnen" or the meta pill; nothing happens          ║
║   PAIN_POINT: a visible control that silently does nothing (M1)               ║
║   DATA_FLOW: pill click → w.__vpSidebarTab (always set, index.ts:1399) →     ║
║              setTab styles panels inside an <aside> that is not in the page   ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                     ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║   < 1024px (no host)                    ≥ 1024px (sidebar installed)          ║
║   ┌─────────────────────────┐           ┌──────────────────────────┐          ║
║   │ 🧪 Wissenschaft: …       │           │ 🧪 Wissenschaft: … [Öffnen]│─tap─┐   ║
║   └─────────────────────────┘           └──────────────────────────┘     │   ║
║   (no button, default cursor,            ┌──────────────┐   ┌──────────┐ │   ║
║    no click handler)                     │ setTab()     │◄──│ openSci()│◄┘   ║
║   ┌─────────────────────────┐           └──────┬───────┘   └──────────┘     ║
║   │ (1) Schritt 1/5 │ Kontakt│                  ▼                           ║
║   └─────────────────────────┘           Science Corner tab visible          ║
║   USER_FLOW: on mobile the pills are information only; on desktop unchanged  ║
║   VALUE_ADD: no dead taps                                                     ║
║   DATA_FLOW: __vpSidebarTab exists ⇔ sidebar installed; pills read it at     ║
║              render time (canOpen)                                            ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location                               | Before                             | After                                      | User Impact                   |
| -------------------------------------- | ---------------------------------- | ------------------------------------------ | ----------------------------- |
| Science pill (`#vp-slot-tr`), < 1024px | "Öffnen" button, pointer, dead tap | No button, default cursor, no handler      | No false promise              |
| Meta pill (`#vp-slot-br`), < 1024px    | pointer, tooltip, dead tap         | default cursor, no tooltip, no handler     | No false promise              |
| Both pills, ≥ 1024px                   | Opens the tab                      | Unchanged                                  | None                          |
| `window.__vpSidebarTab`                | Always a function                  | Only while `#vp-demo-sidebar` is installed | Debug surface tells the truth |

---

## Mandatory Reading

| Priority | File                                                | Lines           | Why Read This                                                                                             |
| -------- | --------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| P0       | `runtime-src/demo-overlays/index.ts`                | 641-678         | `renderScience`: pill markup, `openSci`, the unguarded `querySelector("button")`                          |
| P0       | `runtime-src/demo-overlays/index.ts`                | 1175-1202       | `renderMetaStep`: pill markup with `cursor:pointer` and `title`, click handler                            |
| P0       | `runtime-src/demo-overlays/index.ts`                | 1374-1406       | `if (showSidebar)` install block, `setTab`, the unconditional `w.__vpSidebarTab = setTab` and its cleanup |
| P1       | `runtime-src/demo-overlays/index.ts`                | 1660-1717, 1749 | `recomputeActive` calls the pill renderers; the first call runs after line 1399                           |
| P1       | `runtime-src/tests/demo-overlays/render.test.ts`    | 1-115           | Harness to mirror: player stub capturing the bus, `emitTime`, `setupConfigDom`, `beforeEach` global reset |
| P1       | `runtime-src/tests/demo-overlays/lifecycle.test.ts` | 256-282         | `happyDOM.setViewport({ width: 390 })` pattern and restoring 1024 afterwards                              |
| P2       | `docs/feature-context.md`                           | 55-66, 96-118   | Mount controller rules; i18n (`tr`), white-space constraints                                              |

**External Documentation:**

| Source                                                                            | Section                     | Why Needed                                                                                                                                                                      |
| --------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [happy-dom 20 `matchMedia`](https://github.com/capricorn86/happy-dom/wiki/Window) | `setViewport`, `matchMedia` | `setViewport` updates `innerWidth` and fires `resize`; a query already true when attached does not fire on its first flip to false (verified quirk) — start mobile tests at 390 |

---

## Patterns to Mirror

**RENDER-TIME GUARD (existing optional call):**

```typescript
// SOURCE: runtime-src/demo-overlays/index.ts:670-677
const openSci = (e: Event) => {
  e.stopPropagation();
  w.__vpSidebarTab?.("science");
};
(
  slotTR.querySelector('[data-overlay-action="science"]') as HTMLElement
).onclick = openSci;
(slotTR.querySelector("button") as HTMLElement).onclick = openSci;
```

**INSTALL BLOCK + CLEANUP REGISTRATION:**

```typescript
// SOURCE: runtime-src/demo-overlays/index.ts:1376-1402
if (showSidebar) {
  if (!tryFlexSibling()) applyFixedRightRail();
  onCleanup(() => sidebar.remove());
}
…
w.__vpSidebarTab = setTab;
onCleanup(() => {
  delete w.__vpSidebarTab;
});
```

**TEST HARNESS (bus-driven time):**

```typescript
// SOURCE: runtime-src/tests/demo-overlays/render.test.ts:11-34
function installPlayerStub(): void {
  currentTime = 0;
  busHandlers = [];
  const stub: PlayerApi = {
    get current() {
      return currentTime;
    },
    duration: 100,
    play() {},
    pause() {},
    seek() {},
    on: (_event, fn) => {
      busHandlers.push(fn);
      return () => {};
    },
  };
  (window as unknown as { player: PlayerApi }).player = stub;
}
function emitTime(t: number): void {
  currentTime = t;
  for (const handler of busHandlers)
    handler({ type: "time", time: t, duration: 100 });
}
```

**VIEWPORT SWITCH IN TESTS:**

```typescript
// SOURCE: runtime-src/tests/demo-overlays/lifecycle.test.ts:258-282
const happyDOM = (window as unknown as {
  happyDOM: { setViewport(v: { width: number }): void };
}).happyDOM;
happyDOM.setViewport({ width: 390 });
…
happyDOM.setViewport({ width: 1024 }); // restore default so later tests see a wide viewport
```

---

## Files to Change

| File                                                      | Action     | Justification                                                           |
| --------------------------------------------------------- | ---------- | ----------------------------------------------------------------------- |
| `runtime-src/demo-overlays/index.ts`                      | UPDATE     | Conditional `__vpSidebarTab`; `canOpen` guard in both pill renderers    |
| `runtime-src/tests/demo-overlays/open-affordance.test.ts` | CREATE     | One test per acceptance criterion                                       |
| `public/runtime/demo-overlays.js`                         | REGENERATE | Committed bundle, drift-checked in CI (`.github/workflows/runtime.yml`) |

---

## NOT Building (Scope Limits)

- A mobile place for the sidebar — that is P3.
- Restyling the pills (compact variants) — that is P4.
- Changing the section pill — it never called `__vpSidebarTab`.

---

## Step-by-Step Tasks

### `[x]` Task 1: UPDATE `runtime-src/demo-overlays/index.ts` — install-scoped `__vpSidebarTab`

- **ACTION**: Move `w.__vpSidebarTab = setTab;` and its `onCleanup(() => { delete w.__vpSidebarTab; })` (lines 1399-1402) into a block guarded by `showSidebar`. `setTab` stays defined unconditionally: tab clicks and the panels use it.
- **IMPLEMENT**: After the `setTab` declaration:
  ```ts
  // Only a sidebar that is actually on the page can be opened. Assigned below
  // 1024px as well, this pointed pills at an <aside> that was never attached,
  // so "Öffnen" was a dead tap (measured 2026-09-29, spec M1).
  if (showSidebar) {
    w.__vpSidebarTab = setTab;
    onCleanup(() => {
      delete w.__vpSidebarTab;
    });
  }
  ```
  Keep the ordering: this still runs before the first `recomputeActive` (line 1749), so pills rendered at mount already see the correct value.
- **MIRROR**: `index.ts:1376-1379` (the `if (showSidebar)` guard style).
- **GOTCHA**: A remount below 1024px must also leave no stale function behind. The previous mount's cleanup deletes it, and this mount no longer re-assigns it. Verify with the teardown test in Task 3.
- **VALIDATE**: `bun run typecheck:runtime`

### `[x]` Task 2: UPDATE `runtime-src/demo-overlays/index.ts` — `canOpen` in both pill renderers

- **ACTION**: In `renderScience` (641-678) and `renderMetaStep` (1175-1202), compute `const canOpen = typeof w.__vpSidebarTab === "function";` right before writing `innerHTML`.
- **IMPLEMENT**:
  - **Science pill:** `cursor:${canOpen ? "pointer" : "default"}` in the outer div's inline style. Emit the `<button …>${esc(tr("demo.science.open"))}</button>` only when `canOpen`. Assign `onclick` on the outer div and the button only when `canOpen`, and null-guard the button lookup:
    ```ts
    if (canOpen) {
      const openSci = (e: Event) => {
        e.stopPropagation();
        w.__vpSidebarTab?.("science");
      };
      (
        slotTR.querySelector('[data-overlay-action="science"]') as HTMLElement
      ).onclick = openSci;
      const btn = slotTR.querySelector("button");
      if (btn) btn.onclick = openSci;
    }
    ```
  - **Meta pill:** emit `cursor:${canOpen ? "pointer" : "default"}`, and `title="…"` only when `canOpen`. Assign `onclick` only when `canOpen`.
  - Keep `data-overlay-action` on both. It is the e2e/diagnostic hook, not an affordance.
- **MIRROR**: `index.ts:663-677` for the markup and handler shape; keep `esc()` on every interpolation (feature-context: config is untrusted).
- **IMPORTS**: none new.
- **GOTCHA**:
  - `no-bare-strings.test.ts` scans `index.ts` for literals like `">Open<"`. Keep using `tr("demo.science.open")` and do not inline copy.
  - The early return `if (slotTR.dataset.activeSci === active.id) return;` (658) means a pill rendered once is not re-rendered while the same science stays active. That is fine: `canOpen` cannot change within a mount (Task 1 assigns once per mount).
- **VALIDATE**: `bun run typecheck:runtime && bun run lint`

### `[x]` Task 3: CREATE `runtime-src/tests/demo-overlays/open-affordance.test.ts`

- **ACTION**: CREATE a test file covering every acceptance criterion.
- **IMPLEMENT**:
  - **Harness:** copy the harness from `render.test.ts:1-115` (player stub with `busHandlers`, `emitTime`, `setupConfigDom`, `nextFrames`, the `beforeEach` that runs `__vpDemoCleanup` and deletes the `__vp*` globals). Add `"__vpSidebarTab"` and `"__vpExpandedScience"` to the deleted keys.
  - **Config:** two phases (so the sidebar has content), one science at `timestampsSec: [10]`, one meta step at `t: 2`.
  - **Cases:**
    1. `"offers no open action below 1024px"`
       - `happyDOM.setViewport({ width: 390 })` **before** import (start narrow — happy-dom's `change` first-fire quirk).
       - `emitTime(11)`. Expect `#vp-slot-tr [data-overlay-action="science"]` exists, `#vp-slot-tr button` is null, the outer div's `style.cursor` is `"default"`, and `typeof window.__vpSidebarTab === "undefined"`.
       - `emitTime(3)`. Expect the meta pill exists, has no `title`, and `style.cursor` is `"default"`.
       - Restore `setViewport({ width: 1024 })` in `finally`.
    2. `"opens the Science Corner tab from the science pill on desktop"`
       - Default 1024 viewport. `emitTime(11)`; the button exists; `button.click()`.
       - Expect `[data-panel="science"]` `style.display` is `""` and `[data-panel="coaching"]` is `"none"`.
    3. `"opens the meta tab from the meta pill on desktop"` — `emitTime(3)`, click `[data-overlay-action="meta"]`, expect `[data-panel="meta"]` shown.
    4. `"removes __vpSidebarTab when the mount is torn down"` — desktop mount; expect a function; remove the `[data-vp-config]` element; wait `220ms` plus `nextFrames()`; expect `undefined`.
- **MIRROR**: `runtime-src/tests/demo-overlays/render.test.ts:1-183`; viewport handling `lifecycle.test.ts:256-282`.
- **IMPORTS**: `import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"; import type { PlayerApi, PlayerEvent } from "../../common/types";`
- **GOTCHA**:
  - happy-dom returns zero rects, so `tryFlexSibling` fails and the fixed rail installs on desktop. That is expected; the assertions do not depend on placement.
  - Use `vi.resetModules()` and a fresh `await import("../../demo-overlays/index")` per test.
- **VALIDATE**: `bun run test runtime-src/tests/demo-overlays/open-affordance.test.ts`

### `[x]` Task 4: REGENERATE `public/runtime/demo-overlays.js`

- **ACTION**: `bun run build:runtime`, then include the regenerated `public/runtime/*.js` in the commit. `.js.map` is gitignored.
- **MIRROR**: every runtime commit on this branch, e.g. `90f3d6a` touches `public/runtime/demo-overlays.js`.
- **GOTCHA**: never hand-edit `public/runtime/*.js` (feature-context, line 12).
- **VALIDATE**: `bun run build:runtime && git status --short public/runtime`. This shows only `demo-overlays.js` modified.

### `[x]` Task 5: VERIFY in Chrome (live lesson, local runtime)

- **ACTION**: Run the Level 5 checks below and record the measured values in Agent Notes.
- **VALIDATE**: all Level 5 boxes checked.

---

## Testing Strategy

### Unit Tests to Write

| Test File                                                 | Test Cases                                                           | Validates |
| --------------------------------------------------------- | -------------------------------------------------------------------- | --------- |
| `runtime-src/tests/demo-overlays/open-affordance.test.ts` | no open action < 1024px (science + meta, `__vpSidebarTab` undefined) | AC1, AC2  |
| same                                                      | science pill opens Science Corner on desktop                         | AC3       |
| same                                                      | meta pill opens meta tab on desktop                                  | AC3       |
| same                                                      | teardown deletes `__vpSidebarTab`                                    | AC4       |

### Edge Cases Checklist

- [ ] Remount crossing 1024 → 390: no stale `__vpSidebarTab` (covered by AC4 plus Task 1's gotcha)
- [ ] Science pill already rendered when the mount is torn down: slots are removed with the mount, so nothing to handle
- [ ] Config with sciences but no phases/meta: the science tab alone still installs a sidebar on desktop (`showScienceTab`)

---

## Validation Commands

🔁 **Validation loop:** the plan is not complete until every command below passes (exit 0). On any failure, fix the cause and re-run — loop until all pass. If a check is genuinely impossible, mark it `[f]`, note why in Agent Notes, and move on.

### Level 1: STATIC_ANALYSIS

```bash
bun run lint && bun run typecheck:runtime
```

**EXPECT**: Exit 0

### Level 2: UNIT_TESTS

```bash
bun run test runtime-src/tests/demo-overlays/
```

**EXPECT**: All pass (use `bun run test`, never `bun test` — feature-context)

### Level 3: FULL_SUITE

```bash
bun run test && bun run build:runtime && git diff --stat public/runtime
```

**EXPECT**: All tests pass. The only bundle diff is `demo-overlays.js`, and it is committed with the source.

### Level 4: DATABASE_VALIDATION

Not applicable.

### Level 5: BROWSER_VALIDATION (Chrome via `debugging-chrome-from-wsl`)

**Setup:**

- `bun dev` running. `curl -s localhost:3000/runtime/dev-handshake.json` returns `{"vpDevRuntime": true}`.
- `~/.claude/skills/debugging-chrome-from-wsl/chrome-debug`.
- Open `https://robbins.greator.com/student/course/test/bksCcNnT/yPClsb9h/pgWcT1Bk`.
- Reload until `window.__vpLocalRuntime === "local"`.

**Checks:**

- [ ] V1 (`emulate` 390x844x3,mobile,touch; reload):
  - `typeof window.__vpSidebarTab === "undefined"`.
  - `window.player.seek(13.5)`: the science pill exists, `#vp-slot-tr button` is null, and computed `cursor` is `default`.
  - `seek(5.5)`: the meta pill has no `title` and `cursor` is `default`.
- [ ] V6 (1920×945 desktop):
  - `seek(13.5)`: "Open"/"Öffnen" exists.
  - Real click (`click` tool) → the Science Corner tab is active (`[data-panel="science"]` display `""`).
  - `seek(5.5)`: clicking the meta pill → the meta tab is active.
- [ ] Console: no new errors from `[vp]`.

### Level 6: MANUAL_VALIDATION

None beyond Level 5.

---

## Acceptance Criteria

- [ ] **AC1**: Below 1024px, `window.__vpSidebarTab` is undefined after mount.
- [ ] **AC2**: Below 1024px, the science pill renders no button and no pointer cursor, and the meta pill renders no pointer cursor or tooltip. Neither has a click handler.
- [ ] **AC3**: At ≥ 1024px, both pills still open their tab (unchanged behaviour).
- [ ] **AC4**: Tearing the mount down removes `window.__vpSidebarTab`.
- [ ] Level 1-3 pass; Level 5 checks recorded.

---

## Completion Checklist

- [ ] All tasks completed in dependency order
- [ ] Each task validated immediately after completion
- [ ] Level 1: Static analysis passes
- [ ] Level 2: Unit tests pass
- [ ] Level 3: Full suite + runtime build succeeds; bundle committed
- [ ] Level 5: Browser validation passes (V1, V6)
- [ ] All acceptance criteria met
- [ ] Commit with prefix `[BUGFIX]` on `feature/mobile-overlays`

---

## Risks and Mitigations

| Risk                                                | Likelihood | Impact | Mitigation                                                                                     |
| --------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------- |
| A pill rendered before `__vpSidebarTab` is assigned | LOW        | MED    | The assignment precedes the first `recomputeActive` (1749); Task 3 case 2 would fail otherwise |
| A test leaks the 390 viewport into later tests      | MED        | MED    | Restore `setViewport({ width: 1024 })` in `finally`                                            |

---

## Questionables

<details>
<summary>Should the pill hint that the content is unavailable on mobile?</summary>

Assumed no: P3 makes it available, so P1 only removes the false affordance. A hint would be
throwaway copy.

</details>

---

## Agent Notes

- The Chrome verification recipe (local runtime, real-click playback, `speechSynthesis` stub,
  client-side quiz injection) is in the spec's Verification section. P1 needs only seeks.
- `setTab` operates on the closure's `sidebar` element, not a document lookup
  (`index.ts:1381-1398`). That is why the dead tap produced no error.

---

## Amendments

_Append-only history of changes made **after** this plan was first built (newest at the bottom)._

<details>
<summary>2026-09-29T15:30Z — implemented</summary>

- **Built as planned:** install-scoped `__vpSidebarTab`; `canOpen` guards in both pill renderers,
  with a null-guarded button lookup; `open-affordance.test.ts` (4 cases, and AC1 fails on the
  unfixed code).
- **Deviations:**
  - the science pill's right padding is 12px without the button;
  - fixed the pre-existing `science-card.ts` `.at()` typecheck failure in `8bc639b`.
- **Level 5:**
  - V1: no button, default cursor, `__vpSidebarTab` undefined; the science pill is 249px wide.
  - V6: real clicks open Science Corner and Master-Schritte.

</details>
