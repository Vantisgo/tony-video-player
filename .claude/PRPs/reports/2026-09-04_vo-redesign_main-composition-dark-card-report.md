# Implementation Report

**Plan**: `.claude/PRPs/plans/2026-09-04_vo-redesign_main-composition-dark-card.plan.md`
**Branch**: `feature/e2e-canary-playwright`
**Date**: 2026-09-04
**Status**: COMPLETE

---

## Summary

The voice-over overlay is now a compact 320px card in the bottom-right, carrying the reference
player's composition — portrait with mic badge, title/byline/status stack, progress bar above
the time row, four-button transport ending in a labelled Skip — rendered in the dark `T`
tokens. `audios[].avatar` is a new optional field resolving through the existing
`resolveAssetUrl` contract with initials from `voice` as fallback. Transport glyphs are inline
SVG, selected by a `[data-playing]` attribute so the per-`timeupdate` fast path stays a single
attribute write.

---

## Assessment vs Reality

| Metric     | Predicted | Actual        | Reasoning                                                                                                                                                                                                                                                                              |
| ---------- | --------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complexity | MEDIUM    | MEDIUM        | Sized correctly. The markup, CSS and avatar work went as planned; the cost overrun was entirely in one test that took three attempts to make non-vacuous.                                                                                                                              |
| Confidence | 7/10      | 8/10 realised | The two risks the plan flagged loudest both came out fine: the German Skip label fits at 320px with room to spare, and the hot-path conversion works as designed. The plan's own Task 8 GOTCHA about vacuous absence assertions turned out to describe a trap I then fell into anyway. |

**Deviations, with cause:**

1. **The no-beacon assertion could not be written as planned.** Task 8 case 3 specified "arm the
   spy and assert call count zero". Doing exactly that produced a test that passed even when
   `reportFailure` was added to the avatar path — because `report()` in `common/beacon.ts`
   early-returns when the runtime origin is unknown, which it always is under test (no injected
   `<script src>`), so `navigator.sendBeacon` is never reached. Setting `__vpRuntimeBaseUrl` to
   fix that arms the kill-switch **fetch**, which then delays `main()` past `nextFrames()` and
   nothing mounts (visible as a happy-dom `AbortError` at teardown). Replaced with an assertion
   on the two distinguishable `console.warn` messages, plus a control case proving the audio
   path still takes the loud branch. Verified non-vacuous by making `resolveAvatarUrl` delegate
   to `resolveAudioUrl` and confirming the test goes red.
2. **`vi.stubGlobal` leaks.** It is not undone by `vi.restoreAllMocks()`, so the stubbed
   `navigator` from the beacon attempt broke locale resolution in the two tests that followed.
   Removed the stub entirely rather than adding `vi.unstubAllGlobals()`, since the beacon
   approach was abandoned.
3. **Stale status label fixed in passing.** Not in the plan. The fast branch never wrote the
   "SPIELT"/"PAUSIERT" span, so after a pause the icon updated and the label did not — a
   pre-existing bug noted in the previous plan's report as out of scope there. Since this plan
   rewrites the same markup and adds a `[data-status]` hook anyway, fixing it was one line.

---

## Tasks Completed

| #   | Task                                 | File                                            | Status      |
| --- | ------------------------------------ | ----------------------------------------------- | ----------- |
| 0   | Dependency gate                      | —                                               | ✅ verified |
| 1   | Optional `avatar` field              | `runtime-src/common/types.ts`                   | ✅          |
| 2   | `demo.audio.avatarAlt`, both locales | `runtime-src/common/i18n/demo.ts`               | ✅          |
| 3   | `AUDIO_CSS`                          | `runtime-src/demo-overlays/styles.ts`           | ✅          |
| 4   | Reposition the slot                  | `runtime-src/demo-overlays/index.ts`            | ✅          |
| 5   | Avatar resolution + initials         | `runtime-src/demo-overlays/index.ts`            | ✅          |
| 6   | Markup rewrite                       | `runtime-src/demo-overlays/index.ts`            | ✅          |
| 7   | Hot-path conversion                  | `runtime-src/demo-overlays/index.ts`            | ✅          |
| 8   | Card tests                           | `runtime-src/tests/demo-overlays/audio.test.ts` | ✅          |
| 9   | Rebuild bundles                      | `public/runtime/demo-overlays.js`               | ✅          |
| 10  | Distil to feature context            | `docs/feature-context.md`                       | ✅          |

---

## Validation Results

| Check                     | Result | Details                                                                     |
| ------------------------- | ------ | --------------------------------------------------------------------------- |
| Type check                | ✅     | exit 0                                                                      |
| Lint                      | ✅     | 0 findings in `runtime-src/`; the 7 pre-existing errors elsewhere untouched |
| Unit tests                | ✅     | 371 passed (was 359); `demo-overlays` + `common` 255 passed                 |
| Build                     | ✅     | only `demo-overlays.js` changed (+180/-31)                                  |
| e2e canary                | ✅     | 4 passed against the live tenant — `#vp-slot-*` id assertions unaffected    |
| Browser (real Chrome 152) | ✅     | see below                                                                   |

### Browser validation

Against the local harness reproducing the host's `pre-wrap` wrapper with the real built bundle.
The browser resolved to **German**, so the locale risk was exercised without being contrived.

- Card 320px wide, 168px tall, bottom-right; `__vp-audio-style` and `__vp-slot-style` both live
- Row heights 54 / 26 / 34 — no wrapper inflated by the inherited `pre-wrap`
- Initials "CS" from "Coach-Stimme"; mic badge attached at the avatar's corner (verified zoomed
  — it is a microphone, not the download arrow it resembles at 9px)
- **`"Überspringen"` fits**: controls `scrollWidth 290 === clientWidth 290`, no overflow
- Icon toggle correct in both directions, and the status label now tracks it
  (`Spielt` ⇄ `Pausiert`)
- Long title truncates; card height stays 168px
- Narrow player (host 260px): slot clamps to 232px and stays inside the host
- Meta pill empty while the card is up — the shared-corner invariant holds
- The playback gate from the dependency plan still holds: idle at mount, slot empty

**Not browser-verified**: the `<img>` portrait branch. `resolveAssetUrl` requires https, so an
`http://localhost` avatar is correctly rejected as insecure and the harness always shows
initials. Pointing it at an https host that does not resolve hung the page. The branch is
covered by a unit test asserting the element, `src` and `alt` with an https asset.

---

## Files Changed

| File                                            | Action             | Lines    |
| ----------------------------------------------- | ------------------ | -------- |
| `runtime-src/common/types.ts`                   | UPDATE             | +8       |
| `runtime-src/common/i18n/demo.ts`               | UPDATE             | +2       |
| `runtime-src/demo-overlays/styles.ts`           | UPDATE             | +100     |
| `runtime-src/demo-overlays/index.ts`            | UPDATE             | +139/-45 |
| `runtime-src/tests/demo-overlays/audio.test.ts` | UPDATE             | +160     |
| `public/runtime/demo-overlays.js`               | UPDATE (generated) | +180/-31 |
| `docs/feature-context.md`                       | UPDATE             | +33      |

---

## Issues Encountered

1. **A test that passed while testing nothing** — the beacon case above. Caught by the same
   discipline that caught the previous plan's stylesheet bug: deliberately reintroduce the
   defect and confirm the test goes red. It did not, which is how the vacuity surfaced.
2. **A leaked global stub** breaking two unrelated tests downstream, from `vi.stubGlobal` not
   being covered by `restoreAllMocks`.
3. **An icon I nearly "fixed" for no reason** — the 9px mic badge reads like a download arrow
   in a full-page screenshot. Zooming it 7× showed a correct microphone. Worth recording as a
   method note: verify a suspected visual defect at size before changing it.

---

## Tests Written

| Test File       | Test Cases                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audio.test.ts` | portrait renders from an expanded https avatar; initials fallback when absent; one initial from a single word; placeholder from punctuation-only; a markup-bearing voice is escaped not parsed; unusable avatar does not raise an audio fault; control — a broken audio asset does; icon swaps by attribute without rebuilding the card; status label tracks the icon; Skip has a visible label; all four transport hooks wired; `AUDIO_CSS` injected and outranking the slot reset |

Net: `demo-overlays` suite 93 → 105 cases; whole suite 359 → 371.

---

## Next Steps

- [ ] Review, especially the three deviations
- [ ] Compare against `docs/voice-over-main.png` — composition should match, colour should not
- [ ] Verify on the live tenant after deploy + tenant tag bump; check the `<img>` branch there
      with a real `{{asset:…}}` portrait
- [ ] Teach `admin-toggle/prompt.ts` about `avatar` so authors can discover it — noted as an
      open thread in the plan, still open
- [ ] Commit (bundle included — CI drift-checks `public/runtime`)
