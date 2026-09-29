# Feature: Mobile overlays P6 — keep `<main>`'s flex parent at two visible columns

## Summary

When the desktop sidebar is installed as a flex sibling, `tryFlexSibling` hides `<main>`'s other
siblings once, at mount. LearningSuite's React **inserts** its lesson column as a new sibling
whenever the window crosses 1536px (MUI `xl`) after that, and nothing hides it. The player then
drops from 553×312 to 317×179 (spec amendment (b), M15, reproduced 2026-09-29).

This phase adds a `childList` `MutationObserver` on `<main>`'s flex parent on `tryFlexSibling`'s
success path. It hides any element added there other than `<main>` and our sidebar, records the
element's original inline `display` in the same `prevDisplays` map `restoreHost` uses, and
disconnects on cleanup. There is no remount. A throwaway probe of exactly this logic on the live
lesson gave 641×361 after widening 1440 → 1600, identical to a fresh load, and it stayed correct
across a shrink/widen round trip.

## User Story

As a learner on a desktop browser
I want the video to keep its size when I widen or maximise the window
So that the lesson does not shrink to a thumbnail next to the coaching sidebar

## Problem Statement

Measured on the live lesson (spec M15): load at 1440 (player 553×312), then widen to 1600. React
adds `div.MuiStack-root` (300px) as a child of `<main>`'s flex parent (probe: `added DIV`),
`tryFlexSibling` never hides it, `checkAlive` stays true, and the player is 317×179. Every later
crossing of 1536 inserts a new element (probe: `removed DIV` below, `added DIV` above).

## Solution Statement

On the success branch of `tryFlexSibling`, directly after `onCleanup(restoreHost)`:

```ts
const siblingWatch = new MutationObserver((records) => {
  for (const rec of records)
    rec.addedNodes.forEach((n) => {
      if (!(n instanceof HTMLElement)) return;
      if (n === mainEl || n.id === "vp-demo-sidebar") return;
      if (n.tagName === "MAIN" || n.querySelector("main")) return;
      if (!prevDisplays.has(n)) prevDisplays.set(n, n.style.display);
      n.style.display = "none";
    });
});
siblingWatch.observe(flexParent, { childList: true });
onCleanup(() => siblingWatch.disconnect());
```

The hide happens synchronously in the callback, with no debounce. Callbacks are microtasks, so
the column is hidden before the next paint.

## Metadata

| Field            | Value                                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type             | BUG_FIX                                                                                                                                                     |
| Complexity       | LOW                                                                                                                                                         |
| Systems Affected | `runtime-src/demo-overlays/sidebar-host.ts` (after P3), tests, `e2e/overlay-canary.spec.ts`, `e2e/support/assertions.ts`, `public/runtime/demo-overlays.js` |
| Dependencies     | none new; optional devDependency patch bump happy-dom 20.11.1 → ≥ 20.11.2 (Task 1)                                                                          |
| Estimated Tasks  | 6                                                                                                                                                           |

---

## Lifecycle (append-only)

- **Created:** 2026-09-29T15:40Z
- **Modified:** 2026-09-29T15:40Z · 2026-09-29T18:50Z (implemented)
- **Commits:** 91a4c88 (fix) · 55decb6 (happy-dom 20.14.5)
- **Agent / Session:** claude-opus-5-5 (planning), session c9261ef3-2af4-4ce2-826b-0ee1520bc2a7 · claude-opus-5-5 (implementation), same session
- **Back refs:** `docs/superpowers/specs/2026-09-29-mobile-overlays-sidebar-design.md` (amendment (b): M15, P6 design) · `.claude/PRPs/prds/mobile-overlays.prd.md` (phase 6) · `.claude/PRPs/plans/completed/2026-09-29_mobile-overlays_p3-mobile-sheet.plan.md` (moves `tryFlexSibling` into `sidebar-host.ts`)
- **Forward refs:**

> **Append-only:** `Created` is set once; every other field is a list you only ever add to — never overwrite or remove existing entries. Keep references bidirectional: when you add a back/forward ref here, add the reciprocal ref on the other plan.

> **Planned ahead of its dependency.** Written before P3 was implemented. The code referenced here
> is at `runtime-src/demo-overlays/index.ts:1318-1372` today; P3 Task 6 moves it verbatim into
> `installDesktop(sidebar, onCleanup)` in `sidebar-host.ts`. Before Task 2, locate
> `tryFlexSibling` there and confirm the success branch still reads
> `if (fitsToRightOfMain && visibleInViewport) { onCleanup(restoreHost); return true; }`.

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                    BEFORE: load at 1440, then widen to 1600                   ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║ 1440  [LS nav][ main: player 553×312 ][ our sidebar 432 ]                     ║
║            │ resize ≥ 1536 → MUI useMediaQuery → React inserts lesson column   ║
║            ▼                                                                  ║
║ 1600  [LS nav][main 421: player 317×179][ our sidebar 480 ][ LS column 300 ] ║
║ PAIN_POINT: the lesson shrinks below phone size on a wide desktop             ║
║ DATA_FLOW: tryFlexSibling hid siblings once at mount; body observer →         ║
║            evaluate → checkAlive true (our nodes intact) → nothing happens    ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                    AFTER: load at 1440, then widen to 1600                    ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║ 1440  [LS nav][ main: player 553×312 ][ our sidebar 432 ]                     ║
║            │ React inserts LS column → siblingWatch (childList, microtask)    ║
║            │   → prevDisplays.set(col, "") → col.style.display = "none"        ║
║            ▼                                                                  ║
║ 1600  [LS nav][ main: player 641×361 ][ our sidebar 480 ]   (= fresh load)    ║
║ teardown: disconnect → restoreHost → col.style.display = ""  (LS column back) ║
║ VALUE_ADD: widening never shrinks the player; no remount, so a running        ║
║            voice-over or open quiz is untouched                              ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location                           | Before                                     | After                                 | User Impact                              |
| ---------------------------------- | ------------------------------------------ | ------------------------------------- | ---------------------------------------- |
| Widening across 1536px after load  | player 553 → 317 wide                      | player 553 → 641 (same as fresh load) | Lesson keeps a usable size               |
| Narrowing below 1536               | LearningSuite removes its column           | unchanged                             | none                                     |
| Teardown (config removed, remount) | `restoreHost` restores mount-time siblings | also restores columns inserted later  | LearningSuite's layout comes back intact |

---

## Mandatory Reading

| Priority | File                                                                                           | Lines                  | Why Read This                                                                                                            |
| -------- | ---------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| P0       | `runtime-src/demo-overlays/sidebar-host.ts` (after P3) or `runtime-src/demo-overlays/index.ts` | 1318-1379 today        | `tryFlexSibling`, `prevDisplays`, `restoreHost`, the success branch, and the caller registering `sidebar.remove()`       |
| P0       | `runtime-src/demo-overlays/index.ts`                                                           | 199-215, 336-338       | `teardownMount` LIFO drain; `onCleanup` = `mountState.cleanups.push`                                                     |
| P1       | `runtime-src/demo-overlays/index.ts`                                                           | 246-270                | The only other demo observer (process-scoped, debounced, ignores records). Why this one is different                     |
| P1       | `runtime-src/tests/demo-overlays/safety-net.test.ts`                                           | 1-92, 127-230          | Harness: `rect()`, `addConfig`, `nextFrames`, the flex-parent + `getBoundingClientRect` spy, the `lsColumn` restore test |
| P1       | `runtime-src/tests/demo-overlays/lifecycle.test.ts`                                            | 1-97, 161-176, 240-254 | `settle()`, `runCleanups()`; slot-identity (no-remount) assertion; "no resurrection after teardown" pattern              |
| P1       | `e2e/overlay-canary.spec.ts`                                                                   | all                    | Where the desktop resize test goes                                                                                       |
| P1       | `e2e/support/assertions.ts`                                                                    | 1-135                  | `HOST`, the `evaluate(getBoundingClientRect)` idiom, `waitForReskinSettled`, `demoScriptRan`                             |
| P2       | `docs/feature-context.md`                                                                      | 43-45, 55-68, 203-206  | "every host mutation must register its inverse"; cleanup scopes; the `tryFlexSibling` precondition history               |

**External Documentation:**

| Source                                                                                                 | Section                                                          | Why Needed                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| [DOM Standard — MutationObserver](https://dom.spec.whatwg.org/#interface-mutationobserver)             | `disconnect()` "Empty this's record queue"; notify via microtask | Records queued at teardown are discarded (so `sidebar.remove()`'s record is never delivered); callbacks run before rendering, so there is no flash |
| [MDN disconnect](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/disconnect)         | pending notifications                                            | Same, verified in Chrome and happy-dom                                                                                                             |
| [Playwright `page.setViewportSize`](https://playwright.dev/docs/api/class-page#page-set-viewport-size) | resize                                                           | Resolves before the page's `resize`/media-query `change`/React commit run (verified). The test must wait for the column                            |
| [MUI useMediaQuery](https://mui.com/material-ui/react-use-media-query/)                                | double render                                                    | Hydration may insert and remove once at load; the observer tolerates it                                                                            |
| [happy-dom v20.11.2 release](https://github.com/capricorn86/happy-dom/releases/tag/v20.11.2)           | fix                                                              | "MutationObserver callback being GC'd due to orphaned WeakRef" — the installed 20.11.1 is affected                                                 |

---

## Patterns to Mirror

**THE SUCCESS BRANCH BEING EXTENDED:**

```typescript
// SOURCE: runtime-src/demo-overlays/index.ts:1328-1335,1353-1369 (moves verbatim in P3)
const prevDisplays = new Map<HTMLElement, string>();
[...flexParent.children].forEach((child) => {
  const c = child as HTMLElement;
  if (c !== mainEl && c.id !== "vp-demo-sidebar") {
    prevDisplays.set(c, c.style.display);
    c.style.display = "none";
  }
});
…
const restoreHost = (): void => {
  prevDisplays.forEach((v, child) => { child.style.display = v; });
  flexParent.style.display = prevParentDisplay;
  …
};
if (fitsToRightOfMain && visibleInViewport) {
  onCleanup(restoreHost);
  return true;
}
```

**OBSERVER + CLEANUP REGISTRATION (process-scoped precedent):**

```typescript
// SOURCE: runtime-src/demo-overlays/index.ts:261-270
const observer = new MutationObserver(scheduleScan);
observer.observe(document.body || document.documentElement, { subtree: true, childList: true, characterData: true });
pushCleanup(CLEANUP_KEY, () => { observer.disconnect(); … });
```

The new observer is **mount-scoped** (`onCleanup`), narrow (childList, no subtree) and **not
debounced**.

**FLEX HARNESS:**

```typescript
// SOURCE: runtime-src/tests/demo-overlays/safety-net.test.ts:176-196
const flexParent = document.createElement("div");
const main = document.createElement("main");
const lsColumn = document.createElement("div");
flexParent.append(main, lsColumn);
document.body.appendChild(flexParent);
addConfig(VALID_CONFIG);
vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
  function (this: Element) {
    if (this.tagName === "MAIN") return rect(600, 400);
    if ((this as HTMLElement).id === "vp-demo-sidebar") {
      const r = rect(340, 400);
      return { ...r, left: 620, right: 960, x: 620 } as DOMRect;
    }
    return rect(0, 0);
  },
);
await import("../../demo-overlays/index");
await nextFrames();
expect(lsColumn.style.display).toBe("none");
```

**NO-REMOUNT ASSERTION:**

```typescript
// SOURCE: runtime-src/tests/demo-overlays/lifecycle.test.ts:161-176 (shape)
const before = document.getElementById("vp-slot-tl");
/* mutate */ await settle();
expect(document.getElementById("vp-slot-tl")).toBe(before);
```

---

## Files to Change

| File                                                         | Action                    | Justification                                                       |
| ------------------------------------------------------------ | ------------------------- | ------------------------------------------------------------------- |
| `package.json` / `bun.lock`                                  | UPDATE (optional, Task 1) | happy-dom ≥ 20.11.2 (observer GC fix)                               |
| `runtime-src/demo-overlays/sidebar-host.ts`                  | UPDATE                    | `siblingWatch` on `tryFlexSibling`'s success branch                 |
| `runtime-src/tests/demo-overlays/flex-sibling-watch.test.ts` | CREATE                    | One test per rule and AC                                            |
| `e2e/support/assertions.ts`                                  | UPDATE                    | Export `hostBox(page)` (player box via the existing evaluate idiom) |
| `e2e/overlay-canary.spec.ts`                                 | UPDATE                    | "widening past 1536 never shrinks the player"                       |
| `public/runtime/demo-overlays.js`                            | REGENERATE                | Committed bundle                                                    |

---

## NOT Building (Scope Limits)

- Changing the sidebar's width curve (`clamp(380px, 30vw, 532px)`). With the column hidden, the
  measured players (641 at 1600, 752 at 1920) are fine.
- Watching `<main>`'s grandparents or LearningSuite's left navigation (≥ 1280). Those are outside
  the flex parent and are not ours to reshuffle.
- Handling a replaced `<main>`. `checkAlive` already remounts when the player host disconnects.
  This phase only guarantees it never hides a `<main>`.
- `!important` class overrides on LearningSuite's column. Not observed: inline `display:none` held
  on the live probe. See Risks.

---

## Step-by-Step Tasks

### `[x]` Task 1: UPDATE happy-dom to ≥ 20.11.2 (optional, test environment only)

- **ACTION**: `bun update happy-dom`. `^20.11.1` already allows it, so only `bun.lock` changes.
- **GOTCHA**: 20.11.1 registers the observer callback in a `WeakRef` that can be collected
  ("orphaned WeakRef", fixed in 20.11.2). The runtime's observer stays reachable through the
  mount's cleanup closure, which mitigates it, but a patch bump removes the flake risk from the
  new tests. If the bump is declined, mark `[f]` with the reason and keep the observer referenced
  by the cleanup (Task 2 does).
- **VALIDATE**: `bun run test` (the whole suite is still green on the new patch)

### `[x]` Task 2: UPDATE `runtime-src/demo-overlays/sidebar-host.ts` — `siblingWatch`

- **ACTION**: In `tryFlexSibling`'s success branch, after `onCleanup(restoreHost);` and before
  `return true;`, add the observer from the Solution Statement with this comment:
  ```ts
  // LearningSuite renders some columns only at certain widths: its lesson column
  // is inserted as a NEW sibling of <main> whenever the window crosses 1536px
  // (MUI xl), long after this ran. Unhidden, it squeezed the player from 553×312
  // to 317×179 (measured 2026-09-29, spec M15). Keep the invariant — only <main>
  // and our sidebar are visible here — instead of the mount-time snapshot.
  //
  // Synchronous in the callback, never debounced: records are delivered as a
  // microtask, before the next paint, so the column is never drawn. Moves arrive
  // as remove+add; `has()` keeps the first-seen display so a moved node never
  // records our own "none". A <main> (or a wrapper around one) is never hidden:
  // a replaced lesson is checkAlive's remount, not ours. Registered after
  // restoreHost so it disconnects first (LIFO); disconnect also drops queued
  // records, e.g. the one sidebar.remove() produces during the same teardown.
  ```
- **MIRROR**: `index.ts:1328-1335` (sibling filter `c !== mainEl && c.id !== "vp-demo-sidebar"`,
  `prevDisplays.set` before the write).
- **GOTCHA**:
  - Only on the success branch. The failure branch calls `restoreHost()` at once, then falls back
    to the fixed rail. An observer there would hide LearningSuite's columns with no sidebar beside
    them.
  - No layout reads (`getBoundingClientRect`) inside the callback.
  - Filter text nodes (`instanceof HTMLElement`).
  - `tsconfig.runtime.json` is es2020 lib, so no `WeakRef`. `Map` is what `prevDisplays` already
    is.
- **VALIDATE**: `bun run typecheck:runtime && bun run lint`

### `[x]` Task 3: CREATE `runtime-src/tests/demo-overlays/flex-sibling-watch.test.ts`

- **IMPLEMENT**:
  - **Harness:** copy the helpers and hooks from `safety-net.test.ts:1-92` (player stub,
    `addConfig`, `rect`, `nextFrames`, `VALID_CONFIG`, `beforeEach`/`afterEach`), plus
    `runCleanups()` from `lifecycle.test.ts`. The mount uses the flex harness from `safety-net.test.ts:176-196`, without `lsColumn`.
  - **Waiting:** after each DOM mutation, `await Promise.resolve()`. happy-dom delivers
    MutationObserver callbacks via `queueMicrotask` (verified); no timers are needed.
  - **Cases:**
    1. `"AC1: hides a sibling inserted after mount"`: `const col = document.createElement("div"); flexParent.appendChild(col);` → `col.style.display === "none"`.
    2. `"AC2: teardown restores the inserted sibling's original display"`: `col.style.display = "flex"` before inserting. After mount and insertion, `runCleanups()` → `"flex"`.
    3. `"a removed and re-inserted sibling stays hidden and still restores"`: insert (`"flex"`) → `col.remove()` → `flexParent.appendChild(col)` → `"none"`; `runCleanups()` → `"flex"`, not `"none"`.
    4. `"a moved sibling keeps its first-seen display"`: insert `col` (`"flex"`), then `flexParent.insertBefore(col, main)` (a remove plus add) → `"none"`; teardown → `"flex"`.
    5. `"ignores text nodes and our sidebar"`: `flexParent.appendChild(document.createTextNode("x"))` does not throw. `flexParent.appendChild(document.getElementById("vp-demo-sidebar")!)` leaves the sidebar's `style.display === "flex"`.
    6. `"never hides a <main> or a wrapper around one"`: append `document.createElement("main")` and a `div` containing a `main` → neither is `"none"`.
    7. `"the fixed-rail path installs no watcher"`: unsized main (no spy, as in `safety-net.test.ts:127-146`) → the sidebar is under `body`; insert a sibling next to `<main>` → not hidden.
    8. `"AC4: no remount"`: record `#vp-slot-tl`, insert a sibling, `await settle()` (220ms + frames) → same element.
    9. `"after teardown the watcher is gone"`: `runCleanups()`, then insert a new sibling → not hidden.
- **MIRROR**: `safety-net.test.ts:176-210` (restore assertions), `lifecycle.test.ts:161-176,240-254`.
- **IMPORTS**: `import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"; import type { PlayerApi } from "../../common/types";`
- **GOTCHA**: `runCleanups()` runs the process registry, whose body-observer cleanup calls
  `teardownMount()`. That is what drains the mount cleanups, including `restoreHost` and the
  disconnect.
- **VALIDATE**: `bun run test runtime-src/tests/demo-overlays/flex-sibling-watch.test.ts`

### `[x]` Task 4: UPDATE `e2e/support/assertions.ts` and `e2e/overlay-canary.spec.ts`

- **IMPLEMENT**:
  - `assertions.ts`: `export async function hostBox(page: Page): Promise<{ w: number; h: number }>`,
    using the existing idiom `page.locator(HOST).first().evaluate((el) => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height }; })`, with a "why" comment: never `boundingBox()`, see `pressHostControl`.
  - `overlay-canary.spec.ts`: new test `"widening past LearningSuite's xl breakpoint never shrinks the player"`.
    1. `await page.setViewportSize({ width: 1440, height: 900 })`, `page.reload()`, `waitForReskinSettled`.
    2. Skip if `!(await demoScriptRan(page))`, or if `#vp-demo-sidebar` is absent or its parent is not `main`'s parent. It only applies to the flex-sibling layout.
    3. `const before = await hostBox(page)`.
    4. `await page.setViewportSize({ width: 1600, height: 900 })`.
    5. `await page.waitForFunction(() => (document.querySelector("main")?.parentElement?.children.length ?? 0) >= 3, undefined, { timeout: 10_000 }).catch(() => null)`. If it times out, `test.skip(true, "LearningSuite rendered no extra column at 1600 on this lesson")`.
    6. Wait two frames (`page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))`).
    7. Assert that the extra child (not `main`, not `#vp-demo-sidebar`) has computed `display === "none"`. This proves the path ran.
    8. `expect((await hostBox(page)).w, "widening the window must never shrink the lesson player (spec M15)").toBeGreaterThanOrEqual(before.w - 1)`.
- **GOTCHA**:
  - `setViewportSize` resolves **before** the page's `resize`/media-query `change` and React's
    commit (verified). Measuring right after it passes even without the fix; hence the wait and the
    column assertion.
  - The `canary` project's default viewport is 1280×720, where LearningSuite's left navigation
    appears. The test sets its own sizes.
- **VALIDATE**: `E2E_RUNTIME_BASE_URL=http://localhost:3000/runtime/loader.js bun run e2e -- --grep "xl breakpoint"`

### `[x]` Task 5: REGENERATE `public/runtime/demo-overlays.js`

- **VALIDATE**: `bun run build:runtime && git status --short public/runtime`

### `[x]` Task 6: VERIFY in Chrome (Level 5)

- **VALIDATE**: all Level 5 boxes checked, with values in Agent Notes.

---

## Testing Strategy

### Unit Tests to Write

| Test File                    | Test Cases                                                                                                                                                                                        | Validates             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `flex-sibling-watch.test.ts` | inserted sibling hidden; teardown restores; remove+re-insert; move keeps first-seen value; text/sidebar ignored; `<main>` never hidden; fixed rail installs none; no remount; gone after teardown | AC1–AC4, design rules |

### Edge Cases Checklist

- [ ] Hydration double pass (column inserted and removed at load): tolerated; an entry for a detached node is harmless
- [ ] Column inserted in the same task as teardown: its record is discarded by `disconnect()`, and it stays visible, which is correct since teardown gives the layout back
- [ ] React re-renders the column with an unchanged `style` prop: inline `display:none` kept (React only writes changed style keys; MUI uses classes). Verified by the research probe with React 19 + MUI 6
- [ ] Rapid resizes across 1536: one new element per crossing; each is hidden on insertion
- [ ] Mobile sheet mode and fixed rail: no observer

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

### Level 5: BROWSER_VALIDATION (Chrome via `debugging-chrome-from-wsl`, live lesson, local runtime)

**Setup:** reload until `__vpLocalRuntime === "local"`. **Always measure after the resize
settles (≥ 1s), and take fresh-load baselines with a reload.** Measuring a resized page as if it
were a fresh load produced the wrong M14 values once.

**Checks:**

- [ ] Fresh load at 1440 → player 553×312. Widen to 1600 → player 641×361 ±2; the third child of
      `<main>`'s parent has inline `display:none`.
- [ ] Shrink to 1440 (column removed by LearningSuite) and widen to 1600 again → 641×361 ±2.
- [ ] Fresh load at 1600 → 641×361 (unchanged behaviour).
- [ ] Teardown: rewrite `[data-vp-config]` to `{}` (no content, so no sidebar) → LearningSuite's
      column is visible again at 1600 (`display` restored).
- [ ] 30s of playback at 1600 after widening → the column stays hidden and the player keeps its size.
- [ ] Console: no `[vp]` errors.

### Level 6: MANUAL_VALIDATION

- [ ] Real browser window: load narrow, maximise on a ≥ 1600px screen → the lesson does not shrink.

---

## Acceptance Criteria

- [ ] **AC1**: After the window crosses 1536px post-mount, the inserted column is hidden and the player equals a fresh load at that width (±2px; 1600 → 641×361).
- [ ] **AC2**: Teardown restores the column's original `display`.
- [ ] **AC3**: Widening the window never shrinks the player (e2e).
- [ ] **AC4**: No remount happens (slot elements keep their identity).
- [ ] Level 1–3 pass; Level 5 recorded; the e2e test passes (or skips with a stated reason on a lesson without the column).

---

## Completion Checklist

- [ ] All tasks done in order, each validated
- [ ] `docs/feature-context.md`: add the M15 gotcha. `tryFlexSibling`'s sibling set is not static; LearningSuite inserts breakpoint columns at runtime.
- [ ] Commit `[BUGFIX]` on `feature/mobile-overlays`

---

## Risks and Mitigations

| Risk                                                        | Likelihood | Impact         | Mitigation                                                                                                                                                             |
| ----------------------------------------------------------- | ---------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LearningSuite styles the column with `display:… !important` | LOW        | MED            | Inline `display:none` held on the live probe. If it ever fails, switch to `setProperty("display","none","important")` and record `getPropertyPriority` for the restore |
| LearningSuite replaces `<main>`                             | LOW        | HIGH if hidden | Never hide `MAIN` or a node containing one (case 6); `checkAlive` remounts on a disconnected player host                                                               |
| happy-dom 20.11.1 observer GC flake                         | MED        | LOW            | Task 1 bump; the observer is reachable via the cleanup closure                                                                                                         |
| The e2e check passes vacuously                              | MED        | MED            | Wait for the column plus two frames, and assert the column is hidden before comparing widths                                                                           |

---

## Questionables

<details>
<summary>happy-dom bump (Task 1)</summary>

A devDependency patch within the declared range (`^20.11.1`), so only `bun.lock` changes.
Assumed acceptable. It removes a known GC bug affecting MutationObserver callbacks in the new
tests. Decline by marking Task 1 `[f]`.

</details>

---

## Agent Notes

- **Live probe (2026-09-29, throwaway, devtools):**
  - the same callback logic, installed on `<main>`'s parent after a fresh load at 1440;
  - widen to 1600 → `added DIV` → hidden → player 641×361, stable after 4s;
  - shrink to 1440 → `removed DIV` (LearningSuite removes the column);
  - widen again → `added DIV` (a new element) → hidden → 641×361;
  - the map held 2 entries.
- Research (verified in Chrome 151, React 19.2.1 and MUI 6):
  - moves produce remove+add record pairs;
  - `disconnect()` discards queued records;
  - style writes produce no `childList` records;
  - React overwrites an external inline `display` only when the node's own `style` prop changes
    its `display` value; MUI uses emotion classes.

---

## Amendments

_Append-only history of changes made **after** this plan was first built (newest at the bottom)._

<details>
<summary>2026-09-29T18:50Z — implemented</summary>

- **Built as planned:**
  - `siblingWatch` on the success branch;
  - `flex-sibling-watch.test.ts` (9 cases; the watcher and the `has()` guard are both
    mutation-checked);
  - `hostBox` and the desktop e2e test, which fails on the pre-P6 runtime.
- **Deviation:** happy-dom went to 20.14.5 via `bun update` (the specifier is now `^20.14.5`).
- **Chrome:**
  - 1440 → 1600 now gives 641×361 (was 317×179);
  - the round trip and 30s of playback are stable;
  - a fresh load at 1600 is unchanged;
  - teardown restores LearningSuite's column.
- **Final e2e:** 18/18.

</details>
