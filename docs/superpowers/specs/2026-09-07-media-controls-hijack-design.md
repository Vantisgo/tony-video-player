# Media controls: restore LearningSuite's chrome, augment it

Status: approved design, planned
Date: 2026-09-07
Forward ref: `.claude/PRPs/plans/2026-09-07_media-controls_restore-host-chrome.plan.md` — implementation plan

## Problem

The runtime replaces LearningSuite's player chrome with a bar of its own. Three things
are wrong with that:

1. **Two of its controls do not work on the live tenant.** Mute does nothing during
   playback; selecting subtitles renders nothing.
2. **It does not look like the host's player.** Seven text labels (`Start`, `Audio`,
   `CC`, `Ton`, `Voll`) against LearningSuite's icon bar.
3. **It re-implements what the host already does** — four subtitle sources, two menu
   systems, its own subtitle renderer — and that re-implementation is what rots.

## Evidence

All measured against the live tenant on 2026-09-07 with the working tree's bundles.

- **Mute is reverted by the host, not ignored by the element.**
  `el.muted = true` → immediately `true` → after 600 ms `false`. Setting the inner
  `<video>` directly is reverted the same way. LearningSuite's **own** mute button
  works and sticks (`false → true`), because it writes the React state that is the
  authority rather than fighting it. This is the same root cause as the `pause()`
  defect fixed in 2983ec4.
- **Subtitles: our menu populates, our layer never renders.** Options come through as
  `Aus / Original (en) / en`, but `.vp-subtitle-layer` stays `hidden` with empty text
  while the video plays. LearningSuite's own player renders its subtitles correctly.
- **The host's chrome is only CSS-hidden.** Removing the single stylesheet
  `__custom-player-style` reveals a complete, working bar: scrubber, pause, volume,
  `0:51 / 1:38:57`, `1x` speed, captions, settings, fullscreen — and live subtitles.
- **Most of the chrome-hiding CSS matches nothing.** There are no `media-*` elements
  under the player on this tenant, so the rules naming `media-controls`, `media-poster`,
  `media-play-button` and friends are dead. The only rule doing work is the one hiding
  `[class*="PlayerControlsAbsoluteContainer"]`.
- **Their controls carry no stable hooks** — no `aria-label`, no `data-testid`, no
  `title`; MUI with hashed classes (`css-1gauxy4`). Anything that identifies an
  individual button of theirs will rot on their next restyle.
- **This is not a regression.** `feature/mm-refactoring` is an ancestor of HEAD and the
  player diff since its tip is the i18n commit plus one unrelated import removal. The
  mute and subtitle code is unchanged from that branch.

## Decision

Stop replacing the host's chrome. Restore it, delete our bar and the track machinery
behind it, and add back only the one capability the host genuinely lacks.

Rejected: restyling our bar to match theirs. It keeps every broken line, and **mute is
close to unfixable in that direction** — holding `muted` against the host needs a capped
re-assertion war like `enforceCuePause`, per control. Paying to rebuild a bar that
already exists, in order to re-fight the host on every button, is the wrong trade.

## Architecture

### Stays

- `attach()` discovery, `PlayerApi`, the event bus, `_diag()`. These bind to the **media
  element**, not to the chrome, so restoring the host's controls does not touch them.
- The overlay slots `demo-overlays` appends to the player host.
- The language-pack engine: `loadLanguagePackForMedia`, `parseVtt`, the external-audio
  element and its sync timer, `.vp-subtitle-layer` for **external** subtitles only.
- The `data-vp-reskinned="true"` attribute. Kept deliberately despite now being a
  misnomer: it is a DOM contract the canary, the CSS and `demo-overlays` all key on, and
  renaming it is a churn cascade that buys nothing here. Renaming `reskin-player` itself
  is explicitly out of scope.

### Goes

- `.vp-controls` and all seven controls, their CSS, and `toggleTrackMenu` with both menus.
- `getNativeSubtitleOptions`, `getHlsSubtitleOptions`, `getLearningSuiteSubtitleOptions`
  and the LearningSuite transcript reader behind the last one. The host renders its own
  subtitles; we no longer need to find them, list them or draw them.
- The audio-track menu paths that select **native / HLS / rendition** audio. The host's
  own settings menu owns those.
- Every chrome-hiding rule in `RESKIN_CSS`, including the dead `media-*` ones.
- `.vp-overlay-layer` and `setOverlays`. `demo-overlays` only ever calls it with `[]`;
  it draws into its own slots. Dead weight. Note this removes a member from the
  `PlayerApi` interface in `common/types.ts`, so the call site in `demo-overlays` goes in
  the same change.
- The native / HLS / LearningSuite branches of `getTrackDiagnostics`, which shrinks
  `_diag().tracks`. Safe: `diagSchema` does not list `tracks` and zod strips unknown
  keys, so the canary's shape validation is unaffected — but `_diag()` is an operator
  surface, so the change belongs in the commit message.

### New

A single self-contained **language-pack control**, anchored to the player host rather
than injected into the host's bar. Injecting would look native and rot; anchoring is
immune to their restyles at the cost of visibly being a second control. Given that every
other lesson-level affordance we add (the pills, the voice-over card) is already visibly
ours, that cost is small.

- **Rendered only when `loadLanguagePackForMedia` returns a pack for this video.** On a
  lesson without one, the runtime adds no controls at all and the player is one hundred
  percent LearningSuite's.
- **Placement is constrained on all four sides** and must be resolved by measurement, not
  taste. Top-right is taken by the science pill (`vp-slot-tr`, `top:10px; right:10px`),
  bottom-right by the meta pill (`vp-slot-br`) and the voice-over card (`vp-slot-lt`), and
  the bottom edge by the host's bar. Note `vp-slot-br`'s `bottom:70px` was chosen to clear
  **our** 60px bar; the host's bar is a different height, so that offset has to be
  re-measured as part of this change whether or not the slots move.
- One button opening a menu with two groups: **Audio** from the pack's `audioTracks`, and
  **Untertitel** from its `subtitleTracks` plus an Off entry.
- The pack's `useNative: true` track means "the video's own audio" and needs no external
  element. Only the non-native tracks start the external audio element.
- External subtitles keep rendering in `.vp-subtitle-layer`. The host's CC button keeps
  rendering the host's own tracks. The two are independent sources and may both be on;
  that is acceptable and the learner can turn either off.
- The external-audio drift badge stays, re-anchored clear of the host's bar. It is an
  operator diagnostic tied to the feature we are keeping.

## Behaviour

- **Play pressed during a live voice-over cue: the video stays parked.** Already the
  behaviour of `enforceCuePause`; it needs no hook into the host's markup and cannot be
  confused with the host's own re-assertion, which is exactly what that guard absorbs.
  The voice-over card's own play/pause/skip remain the way to drive the cue.
- **Space keeps toggling the voice-over.** It is a document-level `keydown` with no
  dependency on the host's DOM, so it survives this change unchanged.
- **`demo-overlays` drops its `[data-vp="playpause"]` click interception**, which has no
  target once our button is gone.

## Open risk: mute versus external audio

**This must be resolved during planning, before implementation.**

When a non-native audio track is selected, the video has to be silent while the external
element carries the dub. Today that is done with `mediaEl.muted = true` — the exact write
we measured the host reverting within 600 ms. So **dubbing is likely already broken on
this tenant**, independently of this change, and handing mute back to the host does not
create the problem so much as expose it.

Candidate resolutions, in order of preference:

1. Reuse the capped re-assertion pattern from `enforceCuePause` to hold `muted` while an
   external track is active.
2. `volume = 0` instead of `muted`, if the host does not own volume as tightly.
3. Route the video through a WebAudio gain node — heaviest, and may break HLS playback.

This needs a spike against a lesson that actually has a pack. The canary's video has
none, but `window.__vpLanguagePacks` is an existing override hook that can inject one.

## Testing

- **Unit:** `styles.test.ts` inverts — it currently asserts the host's chrome is hidden.
  New tests cover the language-pack control's two states (pack present → control
  rendered; no pack → nothing added to the DOM at all).
- **Canary:** `expectNativeChromeHidden` inverts into an assertion that the host's
  control container is present **and visible**. `expectReskinMounted` drops its
  `.vp-controls` / `[data-vp="playpause"]` / `[data-vp="time"]` assertions and asserts the
  `PlayerApi`, `_diag()` and the overlay slots instead — the things that actually still
  belong to us.
- **New canary test:** the host's own mute works while our runtime is mounted. That is
  the assertion that would have caught this class of defect in the first place.
- Verify during implementation that the overlay slots do not collide with the host's bar
  along the bottom edge; the voice-over card currently sits bottom-right.

## Out of scope

- Cue anchoring versus the host's resume-position feature — separate, deferred by the
  user on 2026-09-07.
- Renaming `reskin-player` / `data-vp-reskinned`.
- Any change to the voice-over card, quiz or pills beyond re-anchoring if they collide.
