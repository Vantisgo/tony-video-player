# Mobile overlays and sidebar — design

Date: 2026-09-29 · Slug: `mobile-overlays` (no ticket) · Status: approved in chat, pending spec review

## Intent

On phones (and on narrow desktop players) the demo overlays and the sidebar do not work:
`159bf36` stopped installing the sidebar below 1024px, so coaching, science and meta content is
unreachable there, and the in-player overlays were never adapted to a small player.

Success means:

- At a 390px phone every overlay fits inside the player, none covers another, and every tappable
  thing does what it shows.
- Coaching, Science Corner and Master-Schritte content is reachable on mobile.
- Desktop ≥ 1180px looks and behaves exactly as today.
- Quiz, voice-over and sidebar keep their behaviour; only layout and entry points change.
- Every phase is verified on the live LearningSuite lesson in Chrome at fixed viewports, and the
  key geometry is kept as a repeatable Playwright check.

## Baseline (measured 2026-09-29, live lesson, local runtime)

Canary lesson `/student/course/test/bksCcNnT/yPClsb9h/pgWcT1Bk` on `robbins.greator.com`.
iPhone viewport 390×844 unless noted.

| #   | Measurement                                                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | No sidebar is installed, but `window.__vpSidebarTab` is still a function. Tapping the science pill's "Öffnen" changes nothing.                                                                       |
| M2  | Player host `.fullscreen-container` is 390×219 at y=315, `overflow:hidden`, `position:relative`.                                                                                                     |
| M3  | The science pill (309×35, x 71–380) overlaps the section pill (x 14–175). The "Öffnen" button is 58×23.                                                                                              |
| M4  | The voice-over card is 320×168 with its top at y=308, 7px above the player top, so it is clipped. It covers the section pill. Transport buttons are 42–44×33.                                        |
| M5  | A tap opens the section pill through sticky `:hover` to 228×191, reaching 15px from the player bottom. `(hover:hover)` is false and `(pointer:coarse)` is true. `data-pinned` is never set anywhere. |
| M6  | Quiz (test quiz added client-side): the card is 358×187, but its content is 350px tall and only 185px is visible. Two columns of 158×93; 3 of 4 options sit below the visible area.                  |
| M7  | LearningSuite's control bar is removed from the DOM while playing. When shown, its progress line is about 57px above the player bottom (from screenshot), so `bottom:58px` is correct.               |
| M8  | LearningSuite's bottom nav bar is `position:fixed`, y=780, h=64, z-index 999. Its full-viewport overlay layers are z-index 1200. The header scrolls away with the page (not fixed).                  |
| M9  | The document is the scroller: scrollHeight 950 vs 844, so max scroll is 106px. Scrolled to the maximum, the player's bottom is at y≈428.                                                             |
| M10 | Phone landscape 844×390: player 732×413 at y=405, taller than the viewport.                                                                                                                          |
| M11 | Tablet portrait 820×1180: player 708×399, no sidebar. Tablet landscape 1180×820: flex-sibling sidebar 380px, player 632×356.                                                                         |
| M12 | Desktop 1024×768: sidebar installed, **player only 461×260**.                                                                                                                                        |
| M13 | Fullscreen target: not verified (LearningSuite's controls never reappear under automation). The host class `fullscreen-container` suggests the host itself goes fullscreen.                          |

## Decisions

- **Approach A: one sidebar, two hosts.** The `<aside>` and its renderers stay the single
  implementation. A host module places it either beside `<main>` (desktop, as today) or in a
  mobile sheet. Rejected: a separate mobile renderer (duplicates the intervention/science cards
  and their expand state), and viewport media queries for the overlays (M12: the 1024px desktop
  player is narrower than a tablet's).
- **Compact mode follows the player box, not the viewport.** A `ResizeObserver` on the player host
  sets `data-vp-compact="1"` on every slot; the compact variants are CSS keyed on that attribute.
  No `container-type` on the host: we do not impose size containment on a node LearningSuite owns.
- **Launcher: a tab bar directly under the player** (chosen over an in-player button, a floating
  button, and pills-only).
- **Sheet docked under the video; the video keeps playing** (chosen over a standard 70vh sheet and
  a full-screen pausing sheet).
- **Verification is both** hand-driven devtools checks per phase and a committed mobile Playwright
  project.

## Architecture

New modules beside `runtime-src/demo-overlays/index.ts` (1780 lines), following the
`intervention-card.ts` / `science-card.ts` pattern:

- `sidebar-host.ts` — `chooseHostMode(viewportMatches, hasContent)` → `"desktop" | "sheet" |
"none"`, plus the host object `{ mode, open(tab), cleanup }`. Desktop mode is today's
  `tryFlexSibling` → `applyFixedRightRail` code, moved unchanged. The 1024px media query and the
  remount on crossing it (`checkAlive` compares `sidebarFits`) stay.
- `mobile-sheet.ts` — the tab bar and the docked sheet (sheet mode only), plus the pure
  `sheetTop()` calculation.
- `compact.ts` — the `ResizeObserver` wiring and `isCompact(width, height)`.

`window.__vpSidebarTab` becomes a pointer to `host.open` and exists only while a host is
installed. Every entry point (science pill, meta pill, section pill, tab bar) calls `open(tab)`.

## Phases

Each phase ends with its Chrome check (see Verification) before the next starts.

### P1 — Dead affordances (item 1) · `[BUGFIX]`, shippable alone

- `w.__vpSidebarTab` is assigned only when a sidebar host is installed, and deleted on cleanup
  (as today).
- The science and meta pills render the "Öffnen" button and `cursor:pointer` only while
  `__vpSidebarTab` exists. Without it they are informational.
- After P3 this is a safety net: a science pill implies a science tab, which implies a host.

### P2 — Mobile canary harness

- New Playwright project `canary-mobile` in `playwright.config.ts`: 390×844, `isMobile`,
  `hasTouch`, same setup/resolve dependencies as `canary`.
- Test-only helpers in `e2e/support/`, never shipped in the runtime:
  - `seekTo(t)`
  - `playWithGesture()` — a real tap on the host play control; script `play()` carries no user
    activation.
  - `holdVoiceOver()` — stubs `speechSynthesis.speak` so a TTS cue stays open for its `dur`
    (TTS ends immediately in automated Chrome; 429s observed).
  - `injectQuiz(quiz)` — rewrites `[data-vp-config]` client-side; the controller remounts on config
    change.
  - `expectInsidePlayer(locator)` and `expectNoOverlap(locators)`.
- Starts with the assertions that already pass at V1 (runtime mounted, slots inside the player).
  P3–P5 each add theirs.
- Runs against local bundles via the existing preview mode:
  `E2E_RUNTIME_BASE_URL=http://localhost:3000/runtime/loader.js`.

### P3 — Mobile sheet (item 2)

**Tab bar**

- A `<nav>` inserted with `playerHost.after(…)`, built with `createElement` and covered by the
  `white-space` reset: LearningSuite's pre-wrap reaches siblings of the player too.
- One 44px-high button per existing tab (same `tabDefs`, same labels). A tap calls `open(tab)`.
- `checkAlive` also asserts it is still connected; a React pass that strips it triggers a remount,
  as for the slots.

**Sheet**

- The same `<aside>`, restyled, attached once and `inert` + hidden while closed.
- Parent: `document.body`, or `document.fullscreenElement` when that contains the player.
  Re-parented on `fullscreenchange`.
- `position:fixed; left:0; right:0; bottom:0`, rounded top corners, **z-index 1100** — above
  LearningSuite's bottom bar (999), below its overlay layers (1200).
- Header: the sidebar's existing tab row plus a 44×44 ✕ button. Escape also closes it.
- No backdrop; the video above stays interactive.

**Opening**

1. `targetScroll = min(maxScroll, scrollY + playerRect.top)`.
2. Smooth-scroll there and set the sheet top to the player bottom it will have at that scroll,
   computed, not measured afterwards.
3. `sheetTop()` clamps to a minimum sheet height of **45% of the viewport in portrait, 60% in
   landscape**. iPhone: top ≈ 428, sheet 416px (49%), video fully visible (M9). Landscape:
   60% clamp, the sheet covers the lower part of the video (M10).

**While open**

- On page scroll and resize (rAF-throttled) the top follows the player bottom within the same
  clamp.
- `overscroll-behavior:contain` on the panel.
- No scroll lock; no LearningSuite style is touched.

**Accessibility and strings**

- Sheet `role="dialog"`, not modal, with `aria-label`. Tab bar buttons carry `aria-expanded`.
- New strings (close, sheet label) go into the EN and DE catalogue (`no-bare-strings.test.ts`).

**Cleanup**

- Tab bar, sheet and every listener are registered with `onCleanup`. Nothing on the host to
  restore.

### P4 — Compact overlays (items 3 and 4)

**`isCompact(width, height)`** — written by the user during implementation. It must classify:

| Player                  | Size    | Expected |
| ----------------------- | ------- | -------- |
| Phone (M2)              | 390×219 | compact  |
| Desktop at 1024px (M12) | 461×260 | compact  |
| Tablet landscape (M11)  | 632×356 | full     |
| Tablet portrait (M11)   | 708×399 | full     |

Constraints: the full voice-over card needs about 283px of height (14 top + 35 pill + 8 + 168
card + 58 offset), and the two top pills side by side need about 500px of width. Hysteresis
around the threshold is the author's call.

**Compact variants (CSS on `.vp-slot[data-vp-compact="1"]`)**

- **Voice-over:** one row about 56px high, `left/right 14px`, still `bottom:58px`. Contents:
  32px avatar, title with ellipsis, play/pause and skip at 40×40. −10s/+10s, byline and status are
  hidden; progress becomes a 3px line along the card's bottom edge. It occupies 114 of 219px.
- **Science pill:** 🧪 + "Öffnen" only, about 100×40. A tap calls `open("science")`.
- **Section pill:** `max-width: calc(100% - 140px)` (250px on a phone), so it never moves when
  the science pill appears. It never expands in compact mode; a tap calls `open("coaching")`.
- **Meta pill:** `max-width: calc(100% - 28px)`, title with ellipsis. The "Schritt n / N" label
  and the divider are hidden in compact mode. A tap calls `open("meta")`.
- **Everywhere:** our buttons are at least 40px in compact mode.

**All modes**

- On non-compact touch devices a section-pill tap toggles `data-pinned`, which puts the existing
  CSS to use.
- Every `:hover` rule moves under `@media (hover:hover)`.

**Item 4**

- `bottom:58px` stays (M7), with a comment recording the measurement.

### P5 — Quiz on mobile (item 3)

- When compact mode is on and the player is not fullscreen, the `#vp-slot-quiz` element moves to
  `document.body` with `data-vp-promoted`:
  - scrim `position:fixed; inset:0`, **z-index 1150** (above the bottom bar 999 and our sheet
    1100, below LearningSuite overlays 1200);
  - options in a single column;
  - card `max-height` = viewport − 32px.
- The element moves back into the player when compact mode or fullscreen changes. It is the same
  element, so `checkAlive`, the container query and the event swallowing keep working.
- Why move the element rather than only set `position:fixed`: the player creates its own stacking
  layer and clips its content (M2), so a fixed child could still be clipped or painted under the
  bottom bar.

## Verification

### Unit (vitest + happy-dom)

- happy-dom does no layout (zero-sized boxes, no `ResizeObserver` callbacks), so layout decisions
  live in pure functions tested directly:
  - `isCompact` against the P4 table;
  - `sheetTop` against M9 (expect 428) and M10 (expect the 60% clamp);
  - `chooseHostMode`.
- DOM behaviour is tested the way `lifecycle.test.ts` does it, with a mocked `matchMedia` and
  stubbed element boxes:
  - `__vpSidebarTab` is absent without a host;
  - no "Öffnen" without a host;
  - `open(tab)` shows the right panel;
  - ✕ and Escape close the sheet;
  - fullscreen re-parents the sheet;
  - the quiz slot moves to `<body>` and back;
  - cleanup removes every node and listener.
- Every acceptance criterion gets a test.

### Chrome check per phase (devtools, live lesson, local runtime)

Viewports: V1 390×844 mobile+touch · V2 844×390 landscape · V3 820×1180 · V4 1180×820 ·
V5 1024×768 desktop · V6 1920×945 desktop.

Recipe:

- Reload until `window.__vpLocalRuntime === "local"` (the first probe after a cold `bun dev` can
  miss).
- Start playback with a real click.
- Stub `speechSynthesis.speak` to hold a voice-over.
- Add a quiz to `[data-vp-config]` client-side.
- Seek times: meta 5.5 · science 13.5 · voice-over from 40 (cue at 45) · quiz 70 (injected).

| Phase | Pass criteria                                                                                                                                                                                                                                                                                                                                            |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1    | V1: no "Öffnen" and `typeof __vpSidebarTab === "undefined"`. V6: "Öffnen" still switches the sidebar to Science Corner.                                                                                                                                                                                                                                  |
| P2    | `canary-mobile` passes against local bundles.                                                                                                                                                                                                                                                                                                            |
| P3    | **V1:** the tab bar top is at the player bottom ±1. Every tab and every pill opens the sheet on its tab. The sheet top is 428 ±2 with the player fully visible. `elementFromPoint(195, 800)` is inside the sheet. ✕ and Escape close it. **V2:** sheet height 60% ±2. **V5/V6:** no tab bar, sidebar as today. Resizing across 1024px switches the mode. |
| P4    | **V1 and V5:** every visible overlay is inside the player rect; pairwise intersection of section pill, science pill, meta pill and voice-over is 0; every button ≥ 40px; voice-over ≤ 60px tall; a section-pill tap opens the sheet. **V3/V4/V6:** full variants unchanged (voice-over 320×168). **V3:** a tap pins the section pill.                    |
| P5    | **V1:** scrim rect = (0, 0, 390, 844); `elementFromPoint(195, 812)` is the scrim; card `scrollHeight === clientHeight`; answering works; afterwards the slot is back in the player. **V6:** the quiz is unchanged inside the player.                                                                                                                     |

### Kept as a repeatable test

P3–P5 add their V1 criteria to `canary-mobile`, so the daily canary and PR preview runs cover
mobile from then on.

## Out of scope

- Changing the 1024px sidebar breakpoint or the desktop sidebar's look.
- Scroll locking, drag-to-resize, swipe-to-close on the sheet.
- Pausing the video when the sheet opens.
- TTS failing in automated Chrome (429s): an environment issue; worked around in the harness only.

## Risks and open points

- **M13 fullscreen target is unverified.** P3/P5 fullscreen handling keys on
  `document.fullscreenElement.contains(playerHost)`, which is correct whichever element
  LearningSuite fullscreens. Verify manually on a device in P3.
- **React may strip the tab bar** (a sibling in LearningSuite's tree). This is mitigated by the
  `checkAlive` remount, and P3's check watches for flicker.
- **A transformed ancestor would capture `position:fixed`.** The sheet and the promoted quiz live
  in `body`, which avoids this. P5's scrim-rect check proves it.
- **The tenant's script tag loads the runtime from the `feature/e2e-canary-playwright` Vercel
  preview.** Pushing to that branch deploys to the live lesson.
