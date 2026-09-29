# Implementation Report

**Plan**: `.claude/PRPs/plans/2026-09-07_media-controls_restore-host-chrome.plan.md`
**Branch**: `feature/e2e-canary-playwright`
**Date**: 2026-09-07
**Status**: PARTIAL — tasks 1-15 complete, task 16 (browser validation) partial

---

## Summary

Deleted the runtime's own player control bar, both track menus and the native/HLS/LearningSuite subtitle sources, and stopped hiding LearningSuite's chrome. Mute and subtitles work again because the host owns them. The language pack — dubbed audio plus external VTT — survives in one self-contained control anchored bottom-left, rendered only when the video has a pack. The video is silenced for a dub through a Web Audio gain node instead of `mediaEl.muted`.

`reskin-player.js` went from 64.8 KB to 53 KB; `runtime-src/reskin-player/index.ts` from 1250 to ~690 lines.

---

## Assessment vs Reality

| Metric     | Predicted | Actual     | Reasoning                                                                                                                                                                                                                                   |
| ---------- | --------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complexity | HIGH      | HIGH       | As expected. The deletion was mechanical once the symbol graph was mapped; the cost landed almost entirely in the canary, exactly where the plan said the risk was.                                                                         |
| Confidence | 8/10      | ~8/10 held | The gate passed, the type-checker caught every predicted breakage, and no hidden coupling appeared beyond the one the plan had already found. The point deducted for the silencer was the right one to deduct — see the mute finding below. |

**Deviations from the plan**

- **Tasks 3-5 executed as a single pass.** Their symbols are mutually dependent: removing the bar without the menus (or vice versa) leaves `index.ts` untypecheckable, so there is no intermediate state worth committing.
- **`.vp-menu*` CSS kept rather than deleted.** Task 2 said remove it; the new control reuses exactly that menu, so deleting and re-adding near-identical rules would have been churn. `.vp-menu-wrap` was replaced by `.vp-langpack`, and `.vp-menu`'s `right: 0` became `left: 0` for the bottom-left anchor.
- **The Web Audio graph is built on the inner `<video>`, not `<hls-video>`.** Task 1's gate found the outer element's `src` is the CDN `.m3u8` while the inner one holds `blob:…`. The custom element is not an `HTMLMediaElement` and could not have been passed to `createMediaElementSource()` anyway.
- **The overlay offsets did not need re-tuning.** Measured clearance for the host's visible control row is 47px; `.vp-subtitle-layer` (58px) and `.vp-sync-badge` (56px) already clear it. The demo slots moved 70px → 58px to restore the previous ~11px rhythm.
- **The canary's play/mute locators are not what Task 14 assumed.** See "Issues" below.
- **Two Apollo-driven perf guards deleted rather than retargeted.** Their code path (the LearningSuite transcript subtitle source) is gone. One consequence is recorded as a coverage gap below.

---

## Tasks Completed

| #   | Task                                                 | Status                                        |
| --- | ---------------------------------------------------- | --------------------------------------------- |
| 1   | Measure on the tenant (gate)                         | ✅ passed — inner `<video>` is `blob:`-backed |
| 2   | `reskin-player/styles.ts`                            | ✅                                            |
| 3-5 | Delete bar, menus, host-owned sources, `setOverlays` | ✅ (one pass)                                 |
| 6   | `demo-overlays/index.ts`                             | ✅                                            |
| 7   | `demo-overlays/quiz.ts` guard                        | ✅                                            |
| 8   | `reskin-player/silence.ts`                           | ✅                                            |
| 9   | Silencer wiring + volume mirror                      | ✅                                            |
| 10  | `language-pack-control.ts`                           | ✅                                            |
| 11  | Mount the control                                    | ✅                                            |
| 12  | i18n catalogue                                       | ✅                                            |
| 13  | Unit tests                                           | ✅                                            |
| 14  | e2e assertions                                       | ✅ (verified against the working tree)        |
| 15  | Rebuild bundles                                      | ✅                                            |
| 16  | Browser validation + feature-context                 | ⚠️ partial                                    |

---

## Validation Results

| Check                       | Result          | Details                                                                        |
| --------------------------- | --------------- | ------------------------------------------------------------------------------ |
| `typecheck:runtime`         | ✅              | exit 0                                                                         |
| Lint (`runtime-src`, `e2e`) | ✅              | 0 errors, 0 warnings                                                           |
| Unit tests                  | ✅              | 397 passed (was 383)                                                           |
| Build + bundle drift        | ✅              | rebuilt; `reskin-player.js` −640/+270 lines                                    |
| e2e canary — working tree   | ✅              | chrome-present, host-mute, playback-advances all pass, twice consecutively     |
| e2e canary — `bun run e2e`  | ❌ **expected** | the tenant serves the OLD deployed bundle, which still hides the host's chrome |

---

## Issues Encountered

**1. `bun run e2e` is red, and correctly so.** In deployed mode the canary exercises the tenant's currently-deployed runtime, which is the pre-change bundle that still hides LearningSuite's chrome — so the host's controls genuinely have no layout box. This is the deployment-freshness property `docs/feature-context.md` already records (2026-08-27). The new assertions were verified by routing `/runtime/*.js` to the working tree, where all three pass. **The canary will stay red until the tenant's script tag points at a deployment containing this commit.**

**2. Their controls are not `<button>`s, and Playwright cannot click them.** The bar holds bare `svg[data-icon]` nodes with their own wrapper divs on top, so locator clicks fail actionability. Hit-tested: **nothing of ours intercepts them** — the whole stack over their play icon is LearningSuite's own (`VideoInitialPlayOverlay`, z-index 11), and removing every node we add changes nothing. Learners are unaffected. The canary now reads the icon's rect via `getBoundingClientRect` and issues a real `page.mouse.click` at that point — a truer gesture than a locator click, and coupled to nothing but the icon name.

**3. Two `play` icons coexist** — 36px in the initial-play overlay, 16px in the bar — and `.first()` picked by DOM order, which was the source of intermittent failures. The canary now prefers the overlay's.

**4. The host's mute sets `volume = 0`, not `muted`.** Measured: `volume-high` → `volume-xmark`, both outer and inner `volume` 1 → 0, `muted` false throughout. This is the real mechanism behind the original defect and is recorded in `docs/feature-context.md`.

---

## Coverage Gaps (deliberate, not oversights)

- **The language-pack dub path was never exercised in a browser.** The canary's video has no pack (`externalAudioTracks: 0`), so the silencer, the dub sync and the volume mirror are covered by unit tests only. `window.__vpLanguagePacks` is the hook for a spike; the assets would also need routing.
- **`renderSubtitleCue`'s dirty check lost its unit coverage.** Its only reachable driver was the LearningSuite transcript source, which was deleted; the surviving external path needs a language-pack fixture to drive.
- **"A quiz blocks the host's bar" is no longer asserted anywhere.** It moved from a JS guard to CSS stacking, which happy-dom cannot test (it returns 0 from every `getBoundingClientRect`). The z-index relationship was measured once by hand; it is not regression-guarded.

---

## Tests Written

| Test File                                           | Test Cases                                                                                                                                                                   |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/reskin-player/silence.test.ts`               | inner-element resolution ×3; gain 0/1; graph built once per instance; never touches `muted`; fallback mutes; capped at 3; budget resets per `silence()`; stops after dispose |
| `tests/reskin-player/language-pack-control.test.ts` | both groups render; **no pack → zero nodes**; single group; selection reports + closes; `aria-checked`; Escape/outside-click close; cleanup; options re-read per open        |
| `tests/common/locale-surface.test.ts` (rewritten)   | control labels in de/en; hostile label rendered as text                                                                                                                      |
| `tests/reskin-player/styles.test.ts` (inverted)     | no rule targets the host; host chrome visible under the marker; our layers still styled                                                                                      |

---

## Next Steps

- [ ] Review, especially the three coverage gaps
- [ ] **Point the tenant's script tag at a deployment containing this commit** — until then the canary is red
- [ ] Decide whether to spike the dub path in a browser
