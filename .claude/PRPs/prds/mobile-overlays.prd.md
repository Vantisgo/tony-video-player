# Mobile overlays and sidebar

Design spec: `docs/superpowers/specs/2026-09-29-mobile-overlays-sidebar-design.md` (approved 2026-09-29).
It holds the full architecture, the baseline measurements M1–M13 and the per-phase Chrome
pass criteria. This PRD tracks the phases; the spec is the source of truth for the details.

## Problem Statement

A learner watching a coaching lesson on a phone cannot reach the lesson's coaching, science and
master-step content: the sidebar that carries it is not installed below 1024px (`159bf36`).
The overlays on the video are also broken at that size: the voice-over card is clipped and covers
the section pill, the science pill overlaps the section pill, "Öffnen" does nothing, and the quiz
answers sit in a 185px scroll box. The cost is that the product's differentiating content is
invisible or unusable for every phone viewer.

## Evidence

- Measured on the live lesson (2026-09-29, 390×844, local runtime), spec M1–M6:
  - "Öffnen" is a dead tap (`__vpSidebarTab` is set with no sidebar installed);
  - the voice-over card's top is 7px above the player, so it is clipped;
  - the science pill spans x 71–380 over the section pill at x 14–175;
  - the quiz content is 350px tall in a 185px visible box.
- M12: a desktop at 1024px shows a 461×260 player. The overlay problems are not phone-only.
- `159bf36` (2026-09-23) removed the sidebar on mobile to stop it covering the lesson. That
  fixed the layout by removing the content.
- **Assumption — needs validation:** the share of learners on phones is unknown. No analytics
  were available; the measured defects prove the problem exists, not how many people hit it.

## Proposed Solution

Keep a single sidebar implementation and give it a second host. At 1024px and wider it stays
beside the lesson, unchanged. Below that, it appears as a sheet docked under the video, opened
from a tab bar under the player and from the in-video pills. Independently, the in-player
overlays get a compact variant chosen by the player's own size, not the viewport's, because the
1024px desktop player is narrower than a tablet's. On compact players the quiz covers the whole
screen. Rejected alternatives: a separate mobile renderer (duplicates the intervention and
science cards), and viewport media queries (wrong at 1024px desktop and on tablets).

## Key Hypothesis

We believe a docked sheet plus compact overlays will make the lesson's coaching content usable on
phones for learners on mobile. We'll know we're right when, at 390×844, every overlay stays
inside the player with zero overlaps, every visible tap target works, and the sheet opens on the
correct tab from every entry point. This is verified in Chrome per phase and by the `canary-mobile`
Playwright project.

## What We're NOT Building

- A new sidebar breakpoint or a desktop redesign — desktop at 1180px and wider must stay
  pixel-identical.
- Scroll locking, drag-to-resize or swipe-to-close on the sheet — not needed to make content
  reachable; avoids touching LearningSuite's scrolling.
- Pausing the video when the sheet opens — decided: the video keeps playing (docked design).
- Usage telemetry for the sheet — decided: geometry checks are the success measure at the demo
  stage.
- A fix for TTS ending immediately in automated Chrome (429s) — an environment issue, worked
  around in the test harness only.

## Success Metrics

| Metric                                            | Target                                                                                | How Measured                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Overlays inside the player at V1/V5               | 100% of visible overlays                                                              | `expectInsidePlayer` in devtools and `canary-mobile`                  |
| Pairwise overlap of pills and voice-over at V1/V5 | 0px²                                                                                  | `expectNoOverlap`                                                     |
| Dead taps (visible "Öffnen" without a host)       | 0                                                                                     | P1 check: no "Öffnen" and no `__vpSidebarTab` without a host          |
| Sheet reachability                                | every tab, from tab bar and every pill                                                | P3 check at V1                                                        |
| Tap target size in compact mode                   | ≥ 40px                                                                                | button rects at V1                                                    |
| Quiz fully visible on a phone                     | card `scrollHeight === clientHeight`                                                  | P5 check at V1                                                        |
| Full-size regression                              | none for players ≥ 750×280 (voice-over 320×168; sidebar placement unchanged at V5/V6) | P4 check on a fresh load at 1920 (player 752×424); P3 checks at V5/V6 |
| Widening the window                               | never shrinks the player                                                              | P6 check: load at 1440, widen to 1600 (today 553 → 317)               |

## Open Questions

- [ ] Which element does LearningSuite put into fullscreen? M13 is unverified; the design keys on
      `document.fullscreenElement.contains(playerHost)`, so it is correct either way. Confirm on a
      device during P3.
- [ ] Does a React re-render of LearningSuite's page remove the tab bar (a sibling of the player)?
      The `checkAlive` remount covers it; P3's check watches for flicker.
- [ ] What share of learners use phones? (See Evidence.)

---

## Users & Context

**Primary User**

- **Who:** a learner (coaching trainee) watching a Tony coaching lesson on `robbins.greator.com`,
  on a phone, or in a narrow desktop window.
- **Current behavior:** watches the video; sees pills and the voice-over card appear, clipped and
  overlapping; taps "Öffnen" and nothing happens; cannot read interventions or science texts at all.
- **Trigger:** a science moment, a master step or a voice-over appears, or the learner wants to
  see where they are in the coaching arc.
- **Success state:** one tap opens the relevant tab in a sheet below the still-visible,
  still-playing video.

**Job to Be Done**

When I watch a coaching lesson on my phone, I want to read what the coach is doing and why, right
where the video is, so I can learn the method and not just watch the session.

**Non-Users**

- Content authors in the LearningSuite editor: the admin toggle is unaffected.
- Desktop learners at 1180px and wider: their experience must not change.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability                                           | Rationale                                                            |
| -------- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| Must     | No dead taps (P1)                                    | A visible control that does nothing is a defect today                |
| Must     | Sheet host with tab bar and docked sheet (P3)        | The only way the content becomes reachable on phones                 |
| Must     | Compact overlays keyed on the player size (P4)       | Stops clipping and overlap on phones and at 1024px desktop           |
| Should   | Quiz covers the whole screen on compact players (P5) | The quiz works today but is barely usable in 185px                   |
| Should   | `canary-mobile` Playwright project (P2)              | Stops a later change silently regressing mobile (as happened before) |
| Won't    | Sheet telemetry, gestures, scroll lock               | Deferred; see What We're NOT Building                                |

### MVP Scope

P1 + P3 + P4: content reachable and overlays usable on a phone. P2 is sequenced early so the
later phases can assert against it. P5 completes mobile parity.

### User Flow

1. The learner opens the lesson on a phone: video, then the tab bar (Coaching · Science Corner ·
   Master-Schritte).
2. They tap a tab, or a science or meta pill in the video.
3. The page scrolls as far as it can toward the player, and the sheet docks at the player's
   bottom edge, on that tab.
4. They read while the video plays.
5. ✕ or Escape closes the sheet.

---

## Technical Approach

**Feasibility:** HIGH. All pieces exist or are small:

- the `<aside>` and its renderers already work unchanged;
- the host placement code moves into a module;
- the local-runtime handshake lets every step be tested on the live host page;
- the e2e canary already has a preview mode for serving bundles from a chosen URL.

**Architecture Notes**

- New modules beside `runtime-src/demo-overlays/index.ts`: `sidebar-host.ts` (mode choice,
  `open(tab)`), `mobile-sheet.ts` (tab bar, sheet, pure `sheetTop()`), `compact.ts`
  (`ResizeObserver`, `isCompact()`).
- `window.__vpSidebarTab` points at `host.open`, and exists only while a host is installed.
- Stacking, from the measurements:
  - LearningSuite bottom bar: 999;
  - our sheet: 1100;
  - promoted quiz: 1150;
  - LearningSuite overlay layers: 1200.
    The sheet and the promoted quiz live in `body`, or in the fullscreen element when the player
    is fullscreen.
- `isCompact(width, height)` is written by the user during P4, against the spec's table of
  measured players.

**Technical Risks**

| Risk                                                       | Likelihood | Mitigation                                                                             |
| ---------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------- |
| React strips the tab bar (sibling in LearningSuite's tree) | M          | `checkAlive` asserts it and remounts; P3's check watches for flicker                   |
| Fullscreen target differs from assumption (M13)            | L          | Parent choice uses `fullscreenElement.contains(playerHost)`; device check in P3        |
| A transformed ancestor captures `position:fixed`           | L          | Sheet and promoted quiz are children of `body`; P5 asserts scrim rect = viewport       |
| Pushing the base branch deploys to the live lesson         | M          | Work stays on `feature/mobile-overlays`; nothing is pushed without the user's go       |
| happy-dom has no layout                                    | H          | Layout decisions live in pure functions; geometry is verified in Chrome and Playwright |

---

## Implementation Phases

<!--
  STATUS: pending | in-progress | complete
  PARALLEL: phases that can run concurrently (e.g., "with 3" or "-")
  DEPENDS: phases that must complete first (e.g., "1, 2" or "-")
  PRP: link to generated plan file once created
-->

| #   | Phase                    | Description                                                                                                | Status   | Parallel  | Depends | PRP Plan                                                                                   |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------------- | -------- | --------- | ------- | ------------------------------------------------------------------------------------------ |
| 1   | Dead affordances         | `__vpSidebarTab` and "Öffnen" only while a host is installed                                               | complete | with 2    | -       | `.claude/PRPs/plans/completed/2026-09-29_mobile-overlays_p1-dead-affordances.plan.md`      |
| 2   | Mobile canary harness    | `canary-mobile` Playwright project and test-only helpers                                                   | complete | with 1    | -       | `.claude/PRPs/plans/completed/2026-09-29_mobile-overlays_p2-mobile-canary-harness.plan.md` |
| 3   | Mobile sheet             | `sidebar-host.ts` and `mobile-sheet.ts`: tab bar, docked sheet, `open(tab)`                                | complete | -         | 1, 2    | `.claude/PRPs/plans/completed/2026-09-29_mobile-overlays_p3-mobile-sheet.plan.md`          |
| 4   | Compact overlays         | `compact.ts` and compact CSS for voice-over and pills; tap targets; hover guards                           | complete | -         | 3       | `.claude/PRPs/plans/completed/2026-09-29_mobile-overlays_p4-compact-overlays.plan.md`      |
| 5   | Quiz on mobile           | Move the quiz slot to `body` on compact players and cover the whole screen                                 | complete | -         | 4       | `.claude/PRPs/plans/completed/2026-09-29_mobile-overlays_p5-quiz-on-mobile.plan.md`        |
| 6   | Desktop squeeze ≥ 1536px | Hide the lesson column LearningSuite inserts next to `<main>` after our mount (resize past 1536 → 317×179) | complete | with 4, 5 | 3       | `.claude/PRPs/plans/completed/2026-09-29_mobile-overlays_p6-desktop-squeeze.plan.md`       |

### Phase Details

**Phase 1: Dead affordances**

- **Goal:** no control on the page does nothing.
- **Scope:** assign `w.__vpSidebarTab` only when a host is installed; render "Öffnen" and the
  pointer cursor on the science and meta pills only when it exists; unit tests.
- **Success signal:** V1 shows no "Öffnen" and `typeof __vpSidebarTab === "undefined"`. On V6,
  "Öffnen" still switches the sidebar to Science Corner.

**Phase 2: Mobile canary harness**

- **Goal:** mobile geometry is checkable repeatably, locally and on the schedule.
- **Scope:**
  - `canary-mobile` project (390×844, `isMobile`, `hasTouch`);
  - helpers `seekTo`, `playWithGesture`, `holdVoiceOver`, `injectQuiz`, `expectInsidePlayer`,
    `expectNoOverlap`;
  - assertions that already pass at V1;
  - runs against local bundles via `E2E_RUNTIME_BASE_URL=http://localhost:3000/runtime/loader.js`.
- **Success signal:** `canary-mobile` passes against local bundles; the helpers' pure parts have
  vitest coverage.

**Phase 3: Mobile sheet**

- **Goal:** coaching, science and meta content is reachable on mobile.
- **Scope:**
  - `sidebar-host.ts` (desktop code moved unchanged, `chooseHostMode`, `open`);
  - `mobile-sheet.ts` (tab bar after the player, `inert` sheet in `body` or the fullscreen
    element, `sheetTop()` with a 45% portrait / 60% landscape minimum, follows scroll and resize,
    ✕ and Escape, `role="dialog"`, EN and DE strings);
  - pills open their tab;
  - `checkAlive` covers the tab bar;
  - `canary-mobile` assertions.
- **Success signal:** the spec's P3 criteria at V1, V2, V5 and V6 (tab bar at the player bottom
  ±1; sheet top 428 ±2; sheet above LearningSuite's bar at y=800; V2 height 60% ±2; desktop
  unchanged; mode switches across 1024px).

**Phase 4: Compact overlays**

- **Goal:** the overlays fit, don't overlap and are tappable on small players.
- **Scope:**
  - `compact.ts` (`ResizeObserver` → `data-vp-compact`; `isCompact` written by the user);
  - compact CSS for voice-over (one row, about 56px), science pill (icon + button), section pill
    (reserved corner, tap → `open("coaching")`), meta pill (capped, ellipsis);
  - buttons at least 40px;
  - `(hover:hover)` guards;
  - `data-pinned` on touch devices that aren't compact;
  - keep the 58px offset with a comment recording the measurement.
- **Success signal:** the spec's P4 criteria (V1 and V5 inside the player, zero overlap, ≥ 40px,
  voice-over ≤ 60px; V3/V4/V6 full variants unchanged; V3 tap pins).

**Phase 5: Quiz on mobile**

- **Goal:** the quiz is fully usable on a phone.
- **Scope:**
  - move `#vp-slot-quiz` to `body` with `data-vp-promoted` when compact and not fullscreen;
  - fixed scrim at z-index 1150, one column, card height up to the viewport minus 32px;
  - move it back when compact mode or fullscreen changes;
  - `canary-mobile` assertion.
- **Success signal:** at V1 the scrim rect is (0, 0, 390, 844), the scrim is on top at y=812, and
  the card needs no scrolling; at V6 the quiz is unchanged.

**Phase 6: Desktop squeeze at ≥ 1536px**

- **Goal:** widening the window past 1536px after the page has loaded never squeezes the player.
- **Context (spec amendment (b), M15, reproduced):**
  - `tryFlexSibling` hides `<main>`'s siblings once, at mount;
  - LearningSuite inserts its `xl` lesson column as a **new** sibling whenever the window crosses
    1536px afterwards, and nothing hides it;
  - load at 1440 → 553×312; widen to 1600 → 317×179. A fresh load at 1600 gives 641×361.
- **Scope (approved design):**
  - on `tryFlexSibling`'s success path in `sidebar-host.ts`, a `MutationObserver` (`childList`)
    on `<main>`'s flex parent hides any element added there other than `<main>` and our sidebar;
  - its original `display` goes into `restoreHost`'s map; the observer is disconnected on cleanup;
  - no remount;
  - unit tests, Chrome check, and an e2e "widening never shrinks the player" check on the desktop
    canary.
- **Success signal:** load at 1440 → widen to 1600 → player 641×361 ±2 (same as a fresh load);
  teardown restores LearningSuite's column; widening never shrinks the player.

### Parallelism Notes

Phases 1 and 2 touch disjoint files (`runtime-src/demo-overlays/` vs `e2e/` and
`playwright.config.ts`) and can run in parallel. Phase 3 needs both: it replaces P1's assignment
of `__vpSidebarTab` with `host.open`, and it adds its assertions to P2's project. Phases 4 and 5
run in sequence: the compact section-pill tap calls P3's `open()`, and P5 keys on P4's compact
attribute. Phases 3–5 all edit `index.ts` and `styles.ts`, so running them in parallel would
conflict.

All five plans were written on 2026-09-29, at the user's request to plan every item up front. The
plans for phases 3–5 were drafted before their dependencies were implemented. Each one carries a
"planned ahead" note listing the contracts it relies on, and must be re-checked against the code
before its first task. "in-progress" here means "plan written", not "implementation started".

Phase 6 depends on P3, because the desktop placement code lives in `sidebar-host.ts` from then on.
Its approved design touches only `sidebar-host.ts`, its tests and the desktop e2e spec, not
`index.ts` or `styles.ts`. So once P3 is done it can run in parallel with P4 and P5.

---

## Decisions Log

| Decision        | Choice                                                                 | Alternatives                                     | Rationale                                                                                                                                                                                                                                                         |
| --------------- | ---------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture    | One sidebar, two hosts, compact mode via `ResizeObserver`              | Separate mobile renderer; viewport media queries | No duplicated card rendering; M12 shows the viewport is the wrong signal                                                                                                                                                                                          |
| Mobile launcher | Tab bar under the player                                               | In-player button; floating button; pills only    | Always visible, never covers the video, mirrors the desktop tabs                                                                                                                                                                                                  |
| Sheet behaviour | Docked at the player bottom, video keeps playing                       | 70vh standard sheet; full-screen pausing sheet   | The video stays visible (sheet top 428 on iPhone); no new pause logic                                                                                                                                                                                             |
| Sheet stacking  | z-index 1100                                                           | Above everything                                 | Above LearningSuite's bar (999), below its overlay layers (1200) so its menus win                                                                                                                                                                                 |
| Quiz on phones  | Move the slot to `body` and cover the whole screen                     | Keep it in the player; fixed inside the player   | The player clips its content and has its own stacking layer; moving the element avoids both                                                                                                                                                                       |
| Verification    | Devtools per phase and `canary-mobile`                                 | Devtools only; Playwright only                   | Fast iteration plus regression protection                                                                                                                                                                                                                         |
| Success measure | Geometry checks only                                                   | Plus usage telemetry                             | Demo stage; no tracking or privacy question                                                                                                                                                                                                                       |
| Branch          | `git flow feature start mobile-overlays feature/e2e-canary-playwright` | Plain branch; commit on base                     | Follows CLAUDE.md git flow while keeping the sidebar commits. Finish as a PR into the base branch, not into `develop`                                                                                                                                             |
| Compact rule    | `width < 750 \|\| height < 280` (user-written in P4)                   | 760 (first choice); 740; ~540; width only        | First agreed at 760 on wrong desktop numbers (resize, not fresh load). Corrected M14: 1920 gives 752×424, so 750 gives 1920 desktops the full overlays at a 1–3px worst-case overlap risk for max-length titles. The height check covers players that aren't 16:9 |
| Desktop squeeze | New phase P6                                                           | Separate bug; ignore                             | User choice: keep it tracked with this work                                                                                                                                                                                                                       |
| P6 approach     | `MutationObserver` on `<main>`'s flex parent hides inserted siblings   | `checkAlive` remount                             | A remount stops a running voice-over and resets an open quiz; the watcher keeps the two-column invariant without touching our overlays                                                                                                                            |

---

## Research Summary

**Market Context**
Not researched: the approach was settled against the real host page's measured geometry (spec
M1–M13), and competitor patterns would not change the choice of where the content goes on this
host.

**Technical Context**

- The runtime executes on LearningSuite's origin. The player host `.fullscreen-container` clips
  its content and is the positioning parent for our slots.
- The document is the scroller (max scroll 106px on the canary lesson). The header is not fixed;
  the bottom nav bar is (z-index 999).
- Local runtime: `bun dev` serves `/runtime/dev-handshake.json`, and the tenant loader prefers
  local bundles (the first probe after a cold start can miss; reload).
- Automated Chrome needs a real tap for playback; TTS ends immediately (429s), so the harness
  stubs `speechSynthesis.speak`. The quiz is testable by rewriting `[data-vp-config]`
  client-side.

---

_Generated: 2026-09-29T12:20Z_
_Status: IMPLEMENTED — all six phases complete on feature/mobile-overlays (2026-09-29); mobile share of learners still unvalidated_
