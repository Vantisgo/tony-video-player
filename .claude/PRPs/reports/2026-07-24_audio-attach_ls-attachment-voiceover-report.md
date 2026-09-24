# Implementation Report

**Plan**: `.claude/PRPs/plans/completed/2026-07-24_audio-attach_ls-attachment-voiceover.plan.md`
**Source Issue**: n/a
**Branch**: `feature/mm-refactoring`
**Date**: 2026-07-27
**Status**: COMPLETE (Level 5 browser pass deferred to the author)

---

## Summary

The audio overlay now plays a real voice-over file that the author attached to the
LearningSuite lesson, instead of always synthesizing `script` with `SpeechSynthesis`.

An author adds the attachment's exact filename to an `audios[]` entry as `audioFile`.
At the cue's trigger time the runtime resolves that filename against the lesson DOM
(`a[href*="/courses/steps/"]` whose visible text is the filename), reads the live signed
Google-Cloud-Storage `href`, and plays it through one persistent hidden `<audio>` element
whose `timeupdate`/`ended` events drive the overlay's progress bar and cue lifecycle.
When the filename is absent, unmatched, non-`https:`, or playback fails, the controller
falls back to the previous TTS behaviour with the banner unchanged — so every existing
config (and `DEFAULT_AUDIOS`) behaves exactly as before.

No audio is hosted on our infrastructure and no LearningSuite auth token is touched:
the page already renders a currently-valid signed URL on each load, so the URL is
resolved lazily per cue and never persisted.

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning                                                                                                                                                             |
| ---------- | --------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complexity | MEDIUM    | MEDIUM | The plan's file/TTS mode split was correct. The only unforeseen work was cross-mode state hygiene (a cue that starts in file mode and falls back mid-flight).         |
| Confidence | HIGH      | HIGH   | The DOM shape in `docs/audio/source.html` matched the plan exactly (anchor text is the bare filename, no size suffix), so the resolver worked on the first smoke run. |

**Deviations** (all small, all recorded in the plan's Amendments section):

- `resolveAttachmentUrl` accepts `string | null | undefined` and trims before the empty
  check, mirroring `getBunnyVideoId`'s defensive signature rather than the plan's
  `string | undefined`.
- The file/TTS branch was extracted into two local helpers (`startFile`, `fallbackToTts`)
  instead of being inlined, because four call sites need it (`activate`, `togglePlay`,
  the `play()` rejection, and the element's `error` listener).
- `end()` strips the `<audio>` `src` when the element **has** one rather than when
  `mode === "file"`: a cue that fell back to TTS mid-flight would otherwise leave a stale
  `src` on the persistent element.
- The `ended` listener also requires `mode === "file"`, so a stale media event can never
  cut a TTS utterance short.
- `togglePlay`'s file-mode resume logs `console.warn` on a rejected `play()` rather than
  swallowing it.
- `vp-audio-el` was added to the `applySetup` safety-net rollback id list, matching how the
  other created nodes are rolled back.

---

## Tasks Completed

| #   | Task                                          | File                                            | Status |
| --- | --------------------------------------------- | ----------------------------------------------- | ------ |
| 1   | Add optional `audioFile` to `Audio`           | `runtime-src/common/types.ts`                   | ✅     |
| 2   | Pure `resolveAttachmentUrl` resolver          | `runtime-src/common/attachments.ts`             | ✅     |
| 3   | Resolver unit tests                           | `runtime-src/tests/common/attachments.test.ts`  | ✅     |
| 4   | Document `audioFile` in the German LLM prompt | `runtime-src/admin-toggle/prompt.ts`            | ✅     |
| 5   | Mode-aware `AudioController` (file + TTS)     | `runtime-src/demo-overlays/index.ts`            | ✅     |
| 6   | Controller behaviour tests                    | `runtime-src/tests/demo-overlays/audio.test.ts` | ✅     |
| 7   | Rebuild the committed runtime bundles         | `public/runtime/*.js`                           | ✅     |
| 8   | Full static + test validation                 | —                                               | ✅     |
| 9   | Resolver smoke against the real LS DOM dump   | `docs/audio/source.html` (throwaway, removed)   | ✅     |

---

## Validation Results

| Check                       | Result | Details                                                                                                                                                                                                                              |
| --------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run typecheck:runtime` | ✅     | No errors                                                                                                                                                                                                                            |
| `npm run lint`              | ✅     | 17 errors / 29 warnings — all pre-existing in `app/`+`components/` (baseline on HEAD: 17/28). ESLint on every touched file exits 0; the one added warning is in the generated bundle, matching the existing generated-code warnings. |
| `npm test`                  | ✅     | 18 files, 111 passed, 0 failed (84 before this change, +27 new: 11 resolver + 16 controller)                                                                                                                                         |
| `npm run build:runtime`     | ✅     | `demo-overlays.js` 62.2kb, `admin-toggle.js` 15.4kb — regenerated and committed                                                                                                                                                      |
| Drift check                 | ✅     | `git diff --exit-code -- public/runtime` clean after the commit                                                                                                                                                                      |
| Level 5 (real browser)      | ⏭️     | Deferred: needs an authenticated LearningSuite lesson with a real `.mp3` attachment                                                                                                                                                  |
| Level 6 (resolver smoke)    | ✅     | Both real filenames in `docs/audio/source.html` resolved to their `courses/steps/<cuid>` URLs; unknown filename → `""`                                                                                                               |

---

## Files Changed

| File                                            | Action             | Lines    |
| ----------------------------------------------- | ------------------ | -------- |
| `runtime-src/common/types.ts`                   | UPDATE             | +4/-0    |
| `runtime-src/common/attachments.ts`             | CREATE             | +46      |
| `runtime-src/admin-toggle/prompt.ts`            | UPDATE             | +6/-1    |
| `runtime-src/demo-overlays/index.ts`            | UPDATE             | +141/-19 |
| `runtime-src/tests/common/attachments.test.ts`  | CREATE             | +125     |
| `runtime-src/tests/demo-overlays/audio.test.ts` | CREATE             | +380     |
| `public/runtime/demo-overlays.js`               | UPDATE (generated) | +136/-20 |
| `public/runtime/admin-toggle.js`                | UPDATE (generated) | +6/-1    |

`runtime-src/demo-overlays/data.ts` (`DEFAULT_AUDIOS`) was deliberately left unchanged, so
the demo defaults keep exercising the TTS fallback.

---

## Issues Encountered

- **happy-dom media surface.** `play()` is `async` (a real Promise), `pause()`/`currentTime`
  work, and `load()` dispatches `emptied` rather than `error`. No `timeupdate`/`ended` is ever
  fired, so the tests dispatch them explicitly — which is the right level anyway, since the
  assertion is about the controller's wiring, not about decoding audio.
- **Test player element.** `render.test.ts` uses `<hls-video>`, which in happy-dom is an
  unknown element with no media methods, so video pause/resume could not be asserted. The new
  test mounts a real `<video data-vp-player>` (the discovery "contract" strategy) and asserts
  actual `paused` / `currentTime` transitions.
- **Smoke-test noise.** Injecting the full 205KB `docs/audio/source.html` into happy-dom makes
  it try to fetch every external stylesheet, which floods stderr with `NetworkError`s. The
  assertions still pass; the throwaway test was removed afterwards as the plan required.

---

## Tests Written

| Test File                                       | Test Cases                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `runtime-src/tests/common/attachments.test.ts`  | exact match; case-insensitive match; exact wins over case-only; non-`/courses/steps/` anchor ignored; no text match; non-`https:` skipped; falls through to a valid anchor; whitespace + inner `<svg>`; absent/empty/blank filename; two distinct attachments; explicit `Document` argument (11 cases)                                                                                                                                                                                                                                                                         |
| `runtime-src/tests/demo-overlays/audio.test.ts` | **file mode**: plays resolved attachment + pauses video + shows banner + no `crossorigin`; progress clock from real `timeupdate`; clock capped at `dur`; `ended` ends cue + resumes video at `videoResumeTime`; ±10s seeks the element; re-arm after rewind; play/pause controls the element; single `<audio>` across re-injection. **TTS fallback**: no matching anchor; cue without `audioFile`; non-`https:` href; `play()` rejection; `error` event; `ended` ignored after fallback; `src` cleared when a fallen-back cue ends; no simulated clock in file mode (16 cases) |

---

## Next Steps

- [ ] Review the implementation (see the deviation list above)
- [ ] Level 5: load the runtime on a real LearningSuite lesson with an `.mp3` attachment and
      confirm real playback, progress tracking, ±10s, and TTS fallback after removing it
- [ ] Create PR: `gh pr create` / `/prp-pr`
- [ ] Follow-ups explicitly out of scope: an admin-toggle "capture filename" button, and
      deleting the now-dead `public/uploads/audio/*.mp3` + audio branches of
      `app/api/upload/route.ts`
