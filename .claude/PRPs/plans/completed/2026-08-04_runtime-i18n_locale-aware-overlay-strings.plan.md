# Feature: Locale-aware UI strings for the injected runtime

## Summary

The three injected runtime bundles hardcode user-facing copy in **two different languages**:
`demo-overlays` renders English (`Coaching`, `Science`, `Meta Structure`, `Open`,
`Starting soon...`, `Interventions`), `reskin-player` renders English control labels
(`Play/Pause`, `Audio tracks`, `Subtitles`, `Mute`, `Fullscreen`, `Current`), and the quiz
subsystem added by the spike-parity plan renders German (`Frage überspringen`,
`Video fortsetzen`, `Zusammenfassung`, `Nochmal ansehen`, `Schließen`, `Bestanden`,
`% richtig beantwortet`). A learner on a German LearningSuite lesson therefore sees an English
sidebar wrapped around a German quiz dialog.

This plan introduces the smallest thing that fixes it without violating the runtime's bundle-size
constraint: a dependency-free `common/i18n.ts` with a flat message catalogue for `de` + `en`, a
`t()` lookup, and locale resolution from the host page (`document.documentElement.lang`) with a
`window.__vpLocale` override and a configurable default. Every literal in the three entries moves
into the catalogue; nothing else changes.

## User Story

As a **learner on a LearningSuite lesson in my own language**
I want to **see the enrichment overlays, player controls, and quiz dialogs in one consistent
language**
So that **the enrichment layer reads as part of the course rather than a bolted-on tool.**

## Problem Statement

1. **Mixed languages in one viewport.** `runtime-src/demo-overlays/index.ts` renders the sidebar
   tabs as `Coaching` / `Science` / `Meta Structure`; the quiz dialog rendered by
   `runtime-src/demo-overlays/quiz.ts` (from the spike-parity plan) renders
   `Frage überspringen` / `Video fortsetzen` / `Zusammenfassung`. Both are visible at once.
2. **No locale signal is read.** Nothing in `runtime-src/` looks at `document.documentElement.lang`,
   the LearningSuite locale, or a config field. The language is whatever the author of each
   commit happened to type.
3. **Strings are unreachable for translation.** They are inline in template literals
   (`index.ts`) and `qzEl(...)` calls (`quiz.ts`), so adding a third language means grepping the
   source rather than editing data.
4. **Screen-reader labels are English-only.** `reskin-player/index.ts:260-272` hardcodes
   `aria-label="Play/Pause"`, `"Audio tracks"`, `"Subtitles"`, `"Mute"`, `"Fullscreen"` — the
   accessibility surface is the least excusable place for a language mismatch.

## Solution Statement

- **`runtime-src/common/i18n.ts`** — a new module with:
  - `type Locale = "de" | "en"` and a `MESSAGES: Record<Locale, Record<MessageKey, string>>`
    catalogue (flat, dot-namespaced keys: `demo.tab.coaching`, `quiz.action.skip`,
    `player.aria.mute`).
  - `resolveLocale()` — `window.__vpLocale` (explicit override) → `document.documentElement.lang`
    prefix match → `DEFAULT_LOCALE`.
  - `t(key, vars?)` — catalogue lookup with `{name}` interpolation, falling back to the default
    locale and then to the key itself, warning once per missing key.
- **The three entries** replace every user-facing literal with a `t(...)` call. No markup, layout,
  or behaviour changes.
- **`de` is the default locale** — the authoring surface (`admin-toggle` dialog and LLM prompt) is
  German throughout, so German is the product language; `en` is the fallback for other hosts.
- The `admin-toggle` **LLM prompt** (`prompt.ts`) stays out of the catalogue: it is instruction
  text aimed at a model, not UI, and it already tells the model to keep the source material's
  language.

## Metadata

| Field            | Value                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Type             | REFACTOR (string externalisation) + ENHANCEMENT (locale awareness)                                                            |
| Complexity       | LOW-MEDIUM — mechanical breadth, no new control flow                                                                          |
| Systems Affected | `runtime-src/common`, `runtime-src/demo-overlays`, `runtime-src/reskin-player`, `runtime-src/admin-toggle`, `public/runtime/` |
| Dependencies     | **No new packages** — no i18n library (bundle-size Standing Constraint)                                                       |
| Estimated Tasks  | 8                                                                                                                             |

---

## Lifecycle (append-only)

- **Created:** 2026-08-04
- **Modified:** 2026-08-04, 2026-09-02, 2026-09-02 (follow-up)
- **Commits:** _(implemented on `feature/e2e-canary-playwright`, uncommitted at time of writing)_
- **Agent / Session:** claude-opus-5 / session ba3ec5c2-6e53-41f5-9ffc-608520dd5cb7, claude-opus-5 / session 55d279de-3263-4e89-9568-fb160637849b
- **Back refs:**
  - `.claude/PRPs/plans/completed/2026-08-04_spike-parity_quiz-lifecycle-darktheme.plan.md` — ships the German quiz strings this plan externalises; **must land first** (it creates `demo-overlays/quiz.ts`)
  - `.claude/PRPs/plans/completed/2026-07-24_refactor_runtime-ts-module-migration.plan.md` — established `runtime-src/common/` as the home for shared runtime modules
- **Forward refs:** _(none yet)_

> **Append-only:** `Created` is set once; every other field is a list you only ever add to.

---

## Blocking Dependency

**Satisfied as of 2026-08-04** — the spike-parity plan is implemented and archived, so
`runtime-src/demo-overlays/quiz.ts` and the reworked `admin-toggle/` now exist on
`feature/mm-refactoring`. Re-run the inventory greps in _Agent Notes_ against the current
source before starting: the German quiz strings landed as written, and `admin-toggle`'s button
label is now `enable Annotation` / `edit Annotation` (two strings, not one).

---

## String Inventory

Collected from the current branch (`feature/mm-refactoring`) plus the strings the spike-parity plan
adds. Grep commands used are in _Agent Notes_.

### `demo-overlays` — currently English

| Key                        | `en`                  | `de`                   | Site                      |
| -------------------------- | --------------------- | ---------------------- | ------------------------- |
| `demo.tab.coaching`        | Coaching              | Coaching               | `index.ts:812`            |
| `demo.tab.science`         | Science               | Wissenschaft           | `index.ts:813`            |
| `demo.tab.meta`            | Meta Structure        | Meta-Struktur          | `index.ts:814`            |
| `demo.section.eyebrow`     | Course Section        | Kursabschnitt          | `index.ts` section pill   |
| `demo.section.empty`       | Starting soon...      | Startet in Kürze …     | `index.ts:242`            |
| `demo.science.label`       | Science:              | Wissenschaft:          | `index.ts:387`            |
| `demo.science.open`        | Open                  | Öffnen                 | `index.ts:389`            |
| `demo.science.mentions`    | {count} mentions      | {count} Erwähnungen    | `index.ts:1157`           |
| `demo.phase.interventions` | Interventions         | Interventionen         | `index.ts:995`            |
| `demo.phase.count`         | {count} interventions | {count} Interventionen | `index.ts:984`            |
| `demo.meta.heading`        | 7 Master Steps        | 7 Master-Schritte      | `index.ts:1097`           |
| `demo.meta.step`           | Step {n} / 7          | Schritt {n} / 7        | `index.ts:793`            |
| `demo.meta.openTitle`      | Open Meta Structure   | Meta-Struktur öffnen   | `index.ts:791` (`title=`) |
| `demo.audio.by`            | by {voice}            | von {voice}            | `index.ts:724`            |
| `demo.audio.playing`       | Playing               | Spielt                 | `index.ts:726`            |
| `demo.audio.paused`        | Paused                | Pausiert               | `index.ts:726`            |

### `quiz` — currently German (added by the spike-parity plan)

| Key                    | `de`                       | `en`                      | Site                  |
| ---------------------- | -------------------------- | ------------------------- | --------------------- |
| `quiz.action.skip`     | Frage überspringen         | Skip question             | `quiz.ts` skip button |
| `quiz.action.continue` | Continue                   | Continue                  | feedback continue     |
| `quiz.action.resume`   | Video fortsetzen           | Resume video              | awaiting-continue     |
| `quiz.action.close`    | Schließen                  | Close                     | summary               |
| `quiz.action.restart`  | Nochmal ansehen            | Watch again               | summary               |
| `quiz.summary.heading` | Zusammenfassung            | Summary                   | summary heading       |
| `quiz.summary.score`   | {pct}% richtig beantwortet | {pct}% answered correctly | summary score sub     |
| `quiz.summary.passed`  | Bestanden                  | Passed                    | pass badge            |
| `quiz.summary.failed`  | Nicht bestanden            | Not passed                | pass badge            |

> `quiz.action.continue` is already `Continue` in the spike's German UI — a genuine inconsistency
> in the source, not a transcription error. Translating it to `Weiter` for `de` is part of this
> plan's value.

### `reskin-player` — currently English, accessibility-critical

| Key                      | `en`         | `de`             | Site            |
| ------------------------ | ------------ | ---------------- | --------------- |
| `player.aria.playPause`  | Play/Pause   | Wiedergabe/Pause | `index.ts:260`  |
| `player.aria.audio`      | Audio tracks | Tonspuren        | `index.ts:264`  |
| `player.aria.subtitles`  | Subtitles    | Untertitel       | `index.ts:268`  |
| `player.aria.mute`       | Mute         | Stumm            | `index.ts:271`  |
| `player.aria.fullscreen` | Fullscreen   | Vollbild         | `index.ts:272`  |
| `player.label.current`   | Current      | Aktuell          | `index.ts:377`  |
| `player.label.play`      | Play         | Wiedergabe       | `index.ts:1029` |
| `player.label.pause`     | Pause        | Pause            | `index.ts:1024` |

### `admin-toggle` — currently German, editor-only

Already consistently German and only ever seen by admins in a German editor. **In scope for
externalisation** (so the catalogue is complete and a future English editor is a data change), but
`de` remains the effective locale there in practice. The LLM prompt in `prompt.ts` is **out of
scope** — see Solution Statement.

**Approximately 40 keys total.** Two locales × ~40 short strings ≈ **3-4 KB** added per bundle
before gzip, and only the keys an entry actually uses if the catalogue is split per entry (see
_Questionables_).

---

## Mandatory Reading

| Priority | File                                      | Lines                                                            | Why Read This                                                                                         |
| -------- | ----------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| P0       | `docs/feature-context.md`                 | 1-56                                                             | Standing Constraints — generated `.js`, **no schema/heavy library in the bundle**, `esc()` discipline |
| P0       | `runtime-src/common/format.ts`            | all (7)                                                          | The reference for a minimal shared `common/` helper                                                   |
| P0       | `runtime-src/common/escape.ts`            | all (13)                                                         | `esc()` — every `t()` result interpolated into `innerHTML` must still pass through it                 |
| P0       | `runtime-src/demo-overlays/index.ts`      | 240-250, 380-395, 715-745, 785-800, 805-820, 960-1010, 1090-1120 | The literal sites listed in the inventory                                                             |
| P0       | `runtime-src/demo-overlays/quiz.ts`       | all                                                              | The German quiz strings (created by the spike-parity plan)                                            |
| P1       | `runtime-src/reskin-player/index.ts`      | 255-280, 370-385, 1015-1035                                      | The `aria-label` / `textContent` sites                                                                |
| P1       | `runtime-src/admin-toggle/index.ts`       | all                                                              | The German editor dialog                                                                              |
| P2       | `runtime-src/tests/common/format.test.ts` | all (24)                                                         | Test pattern for a tiny pure `common/` module                                                         |
| P2       | `scripts/build-runtime.mjs`               | all (39)                                                         | Confirms all four entries share the same bundling path (a `common/` addition reaches all of them)     |

### External Documentation

| Source                                                                                                    | Section            | Why Needed                                                                                   |
| --------------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------- |
| [MDN — `HTMLElement.lang` / `:lang()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/lang) | Inheritance        | `document.documentElement.lang` is the host's declared locale; may be `""`, `de`, or `de-DE` |
| [BCP 47 language tags](https://www.rfc-editor.org/rfc/rfc5646)                                            | Subtag structure   | Match on the primary subtag (`de-AT` → `de`), never on the full tag                          |
| [MDN — `Intl.NumberFormat`](https://developer.mozilla.org/en-US/docs/Web/API/Intl/NumberFormat)           | Percent formatting | Decide whether `{pct}%` goes through `Intl` or stays a plain template (see _Questionables_)  |

---

## Patterns to Mirror

**MINIMAL_SHARED_MODULE** — the shape a new `common/` module takes.

```typescript
// SOURCE: runtime-src/common/format.ts (all 7 lines)
export function formatTime(s: number): string {
  if (!isFinite(s)) return "0:00";
  const v = Math.max(0, s | 0);
  return `${(v / 60) | 0}:${String(v % 60).padStart(2, "0")}`;
}
```

**ESCAPE_STILL_APPLIES** — `t()` output going into `innerHTML` keeps its wrapper.

```typescript
// SOURCE: runtime-src/demo-overlays/index.ts:977
<h3 style="…">${esc(p.title)}</h3>
// AFTER: catalogue strings are ours, but keep the discipline uniform —
<div style="…">${esc(t("demo.phase.interventions"))}</div>
```

**SAFE_DOM_BUILDER_NEEDS_NO_ESC** — quiz strings go through `createTextNode`, so no `esc()`.

```typescript
// SOURCE: runtime-src/demo-overlays/quiz.ts (qzEl)
qzEl("button", { type: "button", class: "vp-quiz-skip" }, [
  t("quiz.action.skip"),
]);
```

**WINDOW_OVERRIDE_GLOBAL** — the established way the runtime takes host opt-ins.

```typescript
// SOURCE: docs/feature-context.md:25-26 — `window.__vpTrustedOrigins` precedent
// Same shape for the locale override: window.__vpLocale = "en"
```

---

## Files to Change

| File                                               | Action | Justification                                                |
| -------------------------------------------------- | ------ | ------------------------------------------------------------ |
| `runtime-src/common/i18n.ts`                       | CREATE | `Locale`, `MessageKey`, `MESSAGES`, `resolveLocale()`, `t()` |
| `runtime-src/tests/common/i18n.test.ts`            | CREATE | Resolution, interpolation, fallback, missing-key warning     |
| `runtime-src/global.d.ts`                          | UPDATE | Declare `window.__vpLocale`                                  |
| `runtime-src/demo-overlays/index.ts`               | UPDATE | ~16 literals → `t()`                                         |
| `runtime-src/demo-overlays/quiz.ts`                | UPDATE | ~9 literals → `t()`                                          |
| `runtime-src/reskin-player/index.ts`               | UPDATE | ~8 literals → `t()` (incl. all `aria-label`s)                |
| `runtime-src/admin-toggle/index.ts`                | UPDATE | ~11 dialog literals → `t()`                                  |
| `runtime-src/tests/common/no-bare-strings.test.ts` | CREATE | Guard: the inventoried literals no longer appear inline      |
| `public/runtime/*.js`                              | UPDATE | **Generated** — `npm run build:runtime` only                 |
| `docs/feature-context.md`                          | UPDATE | Record the locale-resolution decision                        |

---

## NOT Building (Scope Limits)

- **An i18n library** (`i18next`, `intl-messageformat`, `@formatjs/*`). Standing Constraint —
  anything added here inlines into the injected bundle; zod's ~50 KB is the cautionary precedent.
  A `Record` + `String.replace` covers `{name}` interpolation in ~20 lines.
- **Plurals, genders, ordinals, or ICU MessageFormat.** The inventory has exactly two
  count-bearing strings (`{count} mentions`, `{count} interventions`). If a plural rule is needed
  later, `Intl.PluralRules` is built into the platform — do not pre-build for it.
- **Locales beyond `de` and `en`.** Adding a third is a data-only change afterwards.
- **Translating the `admin-toggle` LLM prompt** (`prompt.ts`, 81 lines). It is model instruction
  text, not UI, and it already instructs the model to preserve the source material's language.
- **Config-authored copy** (course creators overriding UI strings via `[data-vp-config]`). Would
  make every label untrusted input and multiply the `esc()` surface for little gain.
- **Runtime locale switching.** Locale is resolved once at mount. A host that changes
  `documentElement.lang` mid-session re-resolves only on the next remount, which the spike-parity
  lifecycle already provides for free.
- **Next.js app i18n.** `app/`, `components/`, and `lib/` are untouched — this is the injected
  runtime only.

---

## Step-by-Step Tasks

**Status markers** — prefix EVERY task header with one: `[ ]` idle · `[wip]` in progress ·
`[x]` complete · `[f]` failed.

### `[x]` Task 1: CREATE `runtime-src/common/i18n.ts` _(shipped as `common/i18n/{core,demo,player,admin}.ts` — see Amendments)_

- **ACTION**: CREATE the catalogue and lookup
- **IMPLEMENT**:

  ```typescript
  export const LOCALES = ["de", "en"] as const;
  export type Locale = (typeof LOCALES)[number];
  export const DEFAULT_LOCALE: Locale = "de";

  // Flat, dot-namespaced keys. `en` is the completeness reference: MessageKey is
  // derived from it, so a key missing from `de` is a type error, not a runtime hole.
  const EN = {
    /* every key from the String Inventory */
  } as const;
  export type MessageKey = keyof typeof EN;
  const DE: Record<MessageKey, string> = {
    /* … */
  };
  const MESSAGES: Record<Locale, Record<MessageKey, string>> = {
    en: EN,
    de: DE,
  };

  export function resolveLocale(): Locale;
  export function t(
    key: MessageKey,
    vars?: Readonly<Record<string, string | number>>,
  ): string;
  ```

  `resolveLocale()`: `window.__vpLocale` when it is a known locale → primary subtag of
  `document.documentElement.lang` (lowercased, split on `-`) when known → `DEFAULT_LOCALE`.
  `t()`: look up `MESSAGES[resolveLocale()][key]`, fall back to `MESSAGES[DEFAULT_LOCALE][key]`,
  then to `key` itself with a **once-per-key** `console.warn("[vp] missing message", key)`;
  interpolate `{name}` placeholders from `vars` via a single `replace(/\{(\w+)\}/g, …)`, leaving an
  unmatched placeholder in place rather than emitting `undefined`.

- **MIRROR**: `runtime-src/common/format.ts` (module shape), `runtime-src/common/killswitch.ts`
  (how a `common/` module reads a `window` global)
- **GOTCHA (no library — hard constraint)**: `docs/feature-context.md:19-21`. Do not reach for
  `i18next` "just for the fallback logic".
- **GOTCHA (derive `MessageKey` from `EN`)**: typing the catalogue as
  `Record<string, string>` on both sides lets a locale silently miss keys. Deriving
  `MessageKey = keyof typeof EN` and annotating `DE: Record<MessageKey, string>` makes an omission
  fail `npm run typecheck:runtime`.
- **GOTCHA (cache resolution, but not across remounts)**: `t()` is called on the per-`timeupdate`
  render path (~4×/s). Resolve the locale once into a module-level `let` on first use — but re-read
  it when the module is re-evaluated (a re-injected bundle is a fresh module instance, so this is
  automatic). Do **not** call `resolveLocale()` inside every `t()`.
- **GOTCHA (`lang` may be empty or regional)**: `""` → default; `de-AT` / `DE` → `de`. Match the
  primary subtag case-insensitively, never the full tag.
- **VALIDATE**: `npm run typecheck:runtime`

### `[x]` Task 2: UPDATE `runtime-src/global.d.ts` — declare `__vpLocale`

- **ACTION**: ADD the window global declaration
- **IMPLEMENT**: `__vpLocale?: string;` on the existing `Window` interface — typed as `string`, not
  `Locale`, because a host can set anything; `resolveLocale()` validates.
- **MIRROR**: the existing `__vpTrustedOrigins` / `__vpRuntimeBaseUrl` declarations in the same file
- **VALIDATE**: `npm run typecheck:runtime`

### `[x]` Task 3: CREATE `runtime-src/tests/common/i18n.test.ts`

- **ACTION**: CREATE unit tests
- **IMPLEMENT**:
  - `resolveLocale()`: `__vpLocale = "en"` wins over `lang="de"`; `lang="de-AT"` → `de`;
    `lang="DE"` → `de`; `lang="fr"` → `DEFAULT_LOCALE`; `lang=""` → `DEFAULT_LOCALE`;
    `__vpLocale = "klingon"` → falls through to `lang`.
  - `t()`: returns the locale string; interpolates `{count}`/`{voice}`/`{pct}`/`{n}`; leaves an
    unmatched placeholder untouched; falls back to `DEFAULT_LOCALE` for a key present only there;
    returns the key + warns exactly **once** for a genuinely missing key.
  - Catalogue completeness: `LOCALES.every((l) => keys(MESSAGES[l]) deep-equals keys(EN))` — a
    runtime assertion of what the types already enforce, so a `Record` widening never slips past.
  - No string contains an unescaped `<` or `&` that would change meaning inside `innerHTML`.
- **MIRROR**: `runtime-src/tests/common/format.test.ts`
- **GOTCHA**: `document.documentElement.lang` is writable in happy-dom; reset it and
  `window.__vpLocale` in `beforeEach`, and re-import the module (`vi.resetModules()`) so the cached
  locale from a previous test does not leak.
- **VALIDATE**: `npm test -- runtime-src/tests/common/i18n.test.ts`

### `[x]` Task 4: UPDATE `runtime-src/demo-overlays/index.ts` — externalise ~16 literals

- **ACTION**: REPLACE each inventoried literal with a `t()` call
- **IMPLEMENT**: Work down the `demo-overlays` inventory table. Template-literal sites keep their
  `esc()` wrapper: `${esc(t("demo.tab.coaching"))}`. Count-bearing sites pass vars:
  `t("demo.phase.count", { count: p.interventions.length })`.
- **MIRROR**: the surrounding template-literal style; change only the string expression
- **GOTCHA (dirty-check signatures)**: `renderCoaching` / `renderMeta` / `renderSection`
  dirty-check on a signature before rebuilding `innerHTML`
  (`docs/feature-context.md:62-65`). Locale is constant within a mount, so it does **not** need to
  join those signatures — but do not accidentally _remove_ signature fields while editing nearby.
- **GOTCHA (do not touch the config-derived values)**: `esc(p.title)`, `esc(s.name)`,
  `esc(active.voice)` are author content, not UI copy. Only the surrounding chrome moves into the
  catalogue.
- **VALIDATE**: `npm run typecheck:runtime && npm test`

### `[x]` Task 5: UPDATE `runtime-src/demo-overlays/quiz.ts` — externalise ~9 literals

- **ACTION**: REPLACE the German quiz literals with `t()` calls
- **IMPLEMENT**: `qzEl("button", …, [t("quiz.action.skip")])` and friends. The score line becomes
  `t("quiz.summary.score", { pct })`; the pass badge picks
  `t(passed ? "quiz.summary.passed" : "quiz.summary.failed")`.
- **GOTCHA (no `esc()` here)**: `qzEl` builds text nodes — adding `esc()` would render literal
  `&amp;`. Keep the module free of `innerHTML`.
- **GOTCHA (`Continue` → `Weiter`)**: the feedback-continue button is `Continue` in the spike's
  otherwise-German UI. Set `de` to `Weiter`; this is an intended copy fix, so call it out in the
  commit message rather than letting it look like a stray edit.
- **VALIDATE**: `npm run typecheck:runtime && npm test -- runtime-src/tests/demo-overlays/quiz.test.ts`

### `[x]` Task 6: UPDATE `runtime-src/reskin-player/index.ts` — externalise ~8 literals

- **ACTION**: REPLACE the control `aria-label`s and state labels with `t()` calls
- **IMPLEMENT**: `aria-label="${esc(t("player.aria.mute"))}"` etc. in the control-shell template;
  `btn.textContent = t("player.label.pause")` at the play/pause toggle sites.
- **GOTCHA (attribute context)**: these are inside a quoted HTML attribute in a template literal —
  `esc()` must escape `"` for that position. Verify `common/escape.ts` handles quotes; if it only
  escapes `<`/`&`, either extend it or set the attribute via `setAttribute` instead of interpolating.
- **GOTCHA (hot path)**: the play/pause label flips on every play/pause event, not per frame —
  a `t()` call there is fine.
- **VALIDATE**: `npm run typecheck:runtime && npm test`

### `[x]` Task 7: UPDATE `runtime-src/admin-toggle/index.ts` — externalise the dialog

- **ACTION**: REPLACE the ~11 German dialog literals with `t()` calls
- **IMPLEMENT**: `Advanced Video Modus aktivieren`, `Code-Block hinzufügen`,
  `Code-Elemente → Code einbetten`, `Prompt kopieren`, `Prompt an LLM, dann Antwort einfügen`,
  `Speichern`, `Vorschau`, and the two button labels from the spike-parity plan
  (`enable Annotation` / `edit Annotation`) become catalogue keys under `admin.*`.
- **GOTCHA**: leave `prompt.ts` alone entirely (_NOT Building_).
- **GOTCHA**: `→` and `ü`/`ö`/`ß` must survive the bundle — esbuild is configured
  `charset: "utf8"` (`scripts/build-runtime.mjs:26`), so they stay literal rather than becoming
  `\u` escapes. Confirm in the generated output.
- **VALIDATE**: `npm run typecheck:runtime && npm test`

### `[x]` Task 8: CREATE the bare-string guard, rebuild, and verify

- **ACTION**: CREATE a regression guard; REGENERATE the bundles; run every gate
- **IMPLEMENT**: `runtime-src/tests/common/no-bare-strings.test.ts` reads the four entry source
  files with `node:fs` and asserts none of the inventoried literals appears outside
  `common/i18n.ts` — a cheap guard against a future edit reintroducing inline copy. Keep the
  forbidden list explicit (the inventory), not a heuristic regex over all quoted strings, or it will
  produce false positives on CSS and selectors. Then:
  ```bash
  npm run build:runtime
  npm run typecheck:runtime && npm test && npm run lint
  git diff --exit-code -- public/runtime   # clean after committing the regenerated .js
  ```
  Record the per-bundle size delta (before/after `wc -c public/runtime/*.js`) in the commit message.
- **GOTCHA**: reading source files from a test is unusual here but legitimate for a lint-style
  guard; use paths relative to the test file, not `process.cwd()`.
- **GOTCHA**: **never hand-edit** `public/runtime/*.js` (Standing Constraint).
- **VALIDATE**: all commands above exit 0

---

## Testing Strategy

### Unit Tests to Write

| Test File                                          | Test Cases                                                                                                               | Validates |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------- |
| `runtime-src/tests/common/i18n.test.ts`            | resolution precedence, subtag/case matching, interpolation, fallback chain, once-per-key warning, catalogue completeness | AC1–AC4   |
| `runtime-src/tests/common/no-bare-strings.test.ts` | none of the inventoried literals appears in the four entry files                                                         | AC6       |
| existing suites (`quiz`, `render`, `styles`, …)    | updated where they assert on visible copy                                                                                | AC5       |

### Edge Cases Checklist

- [ ] `<html>` with no `lang` attribute → default locale, no warning
- [ ] `lang="de-AT"`, `lang="DE"`, `lang=" de "` → `de`
- [ ] `lang="fr-CA"` → default locale (not a crash, not `fr`)
- [ ] `window.__vpLocale = "en"` on a `lang="de"` page → `en`
- [ ] `window.__vpLocale = 42` / `"klingon"` → ignored, falls through to `lang`
- [ ] `t()` with a `vars` object missing a referenced placeholder → placeholder left literal, no `undefined`
- [ ] `t()` with extra unused `vars` keys → ignored
- [ ] A key present in `en` but not `de` → `en` value returned (fallback), typecheck would have caught it at build time
- [ ] Catalogue string containing `&` or `<` → correctly escaped in `innerHTML` contexts, literal in `createTextNode` contexts
- [ ] Locale resolved once per mount; a mid-session `lang` change applies only after the next remount
- [ ] German umlauts and `→` survive the esbuild bundle as UTF-8, not `\u` escapes
- [ ] Bundle size delta stays under ~5 KB per entry

---

## Validation Commands

🔁 **Validation loop:** not complete until every command exits 0.

### Level 1: STATIC_ANALYSIS

```bash
npm run lint && npm run typecheck:runtime
```

**EXPECT**: exit 0. A locale missing a key is a **type error** here, by design.

### Level 2: UNIT_TESTS

```bash
npm test -- runtime-src/tests/common/i18n.test.ts \
            runtime-src/tests/common/no-bare-strings.test.ts
```

### Level 3: FULL_SUITE + GENERATED-OUTPUT DRIFT

```bash
npm test
npm run build:runtime
git diff --exit-code -- public/runtime
wc -c public/runtime/*.js        # record the delta
```

### Level 4: BROWSER_VALIDATION

- [ ] German LearningSuite lesson (`<html lang="de">`) → sidebar tabs, section pill, audio banner, player `aria-label`s, and quiz dialog are **all German**
- [ ] Same page with `window.__vpLocale = "en"` set before the loader → all English
- [ ] Screen reader announces the control labels in the page language
- [ ] No `[vp] missing message` warnings in the console on a full playthrough
- [ ] Umlauts and `→` render correctly (no mojibake) in the editor dialog

### Level 5: MANUAL_VALIDATION

1. Baseline: `npm test` green on the merged spike-parity branch.
2. Load a lesson with `lang="de"`, complete a quiz break, open all three sidebar tabs, trigger a voice-over — confirm one consistent language throughout.
3. Set `window.__vpLocale = "en"`, reload, repeat — confirm the whole surface flips.
4. Set `window.__vpLocale = "fr"` — confirm graceful fall back to German, no console errors.
5. Delete a key from the `de` catalogue locally → confirm `npm run typecheck:runtime` fails (the guard works), then restore.

---

## Acceptance Criteria

- [ ] **AC1** `resolveLocale()` prefers a valid `window.__vpLocale`, then the primary subtag of `document.documentElement.lang` (case-insensitive), then `DEFAULT_LOCALE`; unknown or non-string values are ignored rather than throwing.
- [ ] **AC2** `t(key, vars)` returns the resolved locale's string with `{name}` placeholders interpolated; an unmatched placeholder is left literal and never renders `undefined`.
- [ ] **AC3** A key absent from the active locale falls back to `DEFAULT_LOCALE`, then to the key itself with exactly one `console.warn` per key per module instance.
- [ ] **AC4** A locale missing any key fails `npm run typecheck:runtime` (`MessageKey` derived from the `en` catalogue).
- [ ] **AC5** Every string in the _String Inventory_ renders from the catalogue in both locales; on a `lang="de"` page the sidebar, section pill, audio banner, player control labels, and quiz dialog are all German, and all English with `__vpLocale = "en"`.
- [ ] **AC6** None of the inventoried literals remains inline in the four entry source files (enforced by `no-bare-strings.test.ts`).
- [ ] **AC7** `t()` output interpolated into `innerHTML` still passes through `esc()`; `quiz.ts` remains `innerHTML`-free.
- [ ] **AC8** No i18n library was added; the per-bundle size increase is under ~5 KB and recorded in the commit message.
- [ ] **AC9** `admin-toggle/prompt.ts` is unchanged; `app/`, `components/`, and `lib/` are unchanged.
- [ ] **AC10** `public/runtime/*.js` regenerated, drift check clean, umlauts and `→` intact as UTF-8.

---

## Completion Checklist

- [ ] All 8 tasks completed in order, each validated immediately
- [ ] Level 1–3 pass; bundle-size delta recorded
- [ ] Level 4 browser validation in both locales
- [ ] Level 5 manual script walked, including the deliberate typecheck-failure check
- [ ] AC1–AC10 met
- [ ] `docs/feature-context.md` updated with the locale-resolution decision and the "no i18n library" reaffirmation
- [ ] Commits prefixed `[TASK]` (externalisation) / `[FEATURE]` (locale awareness) on a `git flow feature` branch

---

## Risks and Mitigations

| Risk                                                                                         | Likelihood | Impact | Mitigation                                                                                                                                                    |
| -------------------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A string is missed and one label stays hardcoded — the exact bug this plan fixes, half-fixed | **HIGH**   | MED    | The inventory is exhaustive and grep-derived; `no-bare-strings.test.ts` guards it; Level 4 requires a full playthrough with zero missing-message warnings.    |
| A translation is wrong or unidiomatic (planning agent is not a translator)                   | MED        | MED    | Copy is data in one file — flag the `de` column for a native-speaker pass before merge; wrong copy is a one-line fix, not a refactor.                         |
| An `esc()` wrapper is dropped while editing ~44 interpolation sites                          | MED        | HIGH   | Every task states the escaping rule for its context; `grep -c "esc("` before/after must not decrease in `demo-overlays/index.ts` or `reskin-player/index.ts`. |
| `t()` on the per-frame render path costs measurable time                                     | LOW        | MED    | Locale resolved once into a module `let`; `t()` is an object lookup + one `replace` only when `vars` is passed.                                               |
| Bundle grows more than expected                                                              | LOW        | LOW    | Two locales × ~40 short strings; measured in Task 8 and gated by AC8. Per-entry catalogue splitting is the escape hatch (_Questionables_).                    |
| Conflicts with the spike-parity plan                                                         | MED        | MED    | Hard sequencing: _Blocking Dependency_ section — do not start until that plan is merged.                                                                      |
| `esc()` does not escape `"` and an `aria-label` breaks out of its attribute                  | MED        | MED    | Task 6 makes verifying `common/escape.ts` an explicit step, with `setAttribute` as the fallback.                                                              |

---

## Questionables

<details>
<summary>Should the default locale be `de` or `en`?</summary>

**Assumption taken: `de`.** The entire authoring surface is German — the `admin-toggle` dialog, the
LLM prompt, `DEFAULT_PHASES`' descriptions in `demo-overlays/data.ts`, and the quiz UI the spike
wrote — which reads as a German-first product. `en` becomes the fallback for a host that declares
another language.

**If wrong:** flip `DEFAULT_LOCALE`. One-line change, no structural impact. Worth confirming, since
it decides what an unlabelled page shows.

</details>

<details>
<summary>One shared catalogue, or one per entry?</summary>

**Assumption taken: one shared `common/i18n.ts`.** Simpler to keep complete and to review, and
esbuild bundles each entry separately anyway.

**Cost:** no tree-shaking across entries — `admin-toggle` carries the quiz strings it never renders,
and vice versa. With ~40 short strings that is well under a kilobyte per bundle.

**Escape hatch if AC8 is ever threatened:** split into `common/i18n/{demo,player,admin}.ts` sharing
`resolveLocale()`. Do not do it pre-emptively.

</details>

<details>
<summary>`Intl.NumberFormat` for the score percentage, or a plain template?</summary>

`quiz.summary.score` is the only formatted number (`{pct}% richtig beantwortet`).
`Intl.NumberFormat(locale, { style: "percent" })` would give correct separators and placement for
free, and is built into the platform (zero bundle cost).

**Assumption taken: plain template interpolation**, matching the spike's
`${pct}% richtig beantwortet`, because `pct` is an integer 0–100 where `de` and `en` agree on
rendering. Revisit when a locale that places `%` differently (or uses a decimal comma) is added.

</details>

<details>
<summary>Are the `de` translations of the English strings the right domain terms?</summary>

`Coaching` is likely left untranslated (it is the domain term in German coaching literature), but
`Science` → `Wissenschaft`, `Meta Structure` → `Meta-Struktur`, `Course Section` → `Kursabschnitt`,
and `Interventions` → `Interventionen` are the planning agent's choices, not a domain expert's.
`CONTEXT.md` already establishes that the project cares about precise terminology (it explicitly
forbids "Interaction" as a synonym for "Intervention").

**Recommendation:** have the `de` column reviewed against `CONTEXT.md` and the LLM prompt's existing
German vocabulary before merge — the prompt already uses `Sektionen`, `Wissenschafts-Pop-Ups`, and
`Master-Schritt`, which may be the house terms to reuse rather than these fresh translations.

</details>

---

## Agent Notes

### Why now, and why so small

The spike-parity plan deliberately shipped the German quiz strings verbatim rather than improvising
a fix mid-port. That was the right call — but it leaves a visible defect (two languages in one
viewport), so this plan exists to close it as a focused follow-up rather than an afterthought.

The scope is deliberately minimal: **no library, two locales, one flat catalogue, ~44 call sites.**
Every temptation to generalise (plurals, ICU, config-authored copy, runtime switching) is listed
under _NOT Building_ with a reason. The runtime is injected onto a third-party page; every kilobyte
and every abstraction is paid for on someone else's site.

### The type trick that makes this safe

Deriving `MessageKey` from the `en` catalogue and annotating `de` as
`Record<MessageKey, string>` converts "a locale is missing a string" from a runtime hole a user
discovers into a `npm run typecheck:runtime` failure. That is the single highest-leverage line in
the plan, and Task 3's completeness test plus Level 5 step 5 both verify the guard actually bites.

### Inventory derivation

```bash
# demo-overlays UI text between tags, plus quoted title attributes
grep -oE '>[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß0-9 ,.:/!?()–—'"'"'-]{2,40}<' runtime-src/demo-overlays/index.ts | sort -u

# reskin-player accessibility + state labels
grep -noE 'aria-label="[^"]+"|title="[^"]+"|textContent = "[^"]+"' runtime-src/reskin-player/index.ts

# admin-toggle dialog copy
grep -oE '>[A-Za-zÄÖÜäöüß][^<>]{3,60}<' runtime-src/admin-toggle/index.ts | sort -u

# quiz strings (after the spike-parity plan lands)
grep -oE '\[[^]]*"[^"]{3,40}"[^]]*\]' runtime-src/demo-overlays/quiz.ts
```

The greps are start-anchored on a letter to skip CSS, selectors, and data attributes. Re-run them at
implementation time — if a new literal appeared since planning, add it to the catalogue **and** to
the `no-bare-strings` forbidden list.

### Approaches considered and rejected

- **Pick one language and hardcode it** (translate the quiz to English, or the overlays to German).
  Cheapest possible fix and genuinely defensible. Rejected because the player's `aria-label`s are an
  accessibility surface that should follow the page language, and the host locale is already sitting
  there in `documentElement.lang` unread.
- **`i18next` / `@formatjs/intl-messageformat`.** Rejected on the bundle-size Standing Constraint.
- **Let course creators author the copy in `[data-vp-config]`.** Rejected: turns every UI label into
  untrusted input, multiplying the `esc()` surface the hardening pass worked to bound, for a need
  nobody has expressed.
- **Read strings from an API at runtime.** Rejected: a network dependency for chrome copy, on a
  runtime whose every other network call is explicitly fail-open and optional.
- **`Intl.DisplayNames` / browser-provided labels for the player controls.** Rejected: it covers
  languages and regions, not `Mute`/`Fullscreen`.

### Follow-ups

- Native-speaker review of the `de` column against `CONTEXT.md` and the LLM prompt's vocabulary.
- A third locale, if the product needs one — data-only after this lands.
- Whether `admin-toggle`'s LLM prompt should follow the locale (currently out of scope by design).
- E2E canary coverage of the locale flip, in the existing canary plan.

---

## Amendments

_Append-only history of changes made **after** this plan was first built (newest at the bottom)._

<details>
<summary>2026-08-04 — initial plan created</summary>

Created as the companion follow-up to
`.claude/PRPs/plans/completed/2026-08-04_spike-parity_quiz-lifecycle-darktheme.plan.md`, per the user's
decision to keep that plan's German quiz strings as-is and plan i18n separately. String inventory
derived by grep from `feature/mm-refactoring` plus the strings the spike-parity plan introduces.

</details>

<details>
<summary>2026-09-02 — implemented (4 deviations)</summary>

Implemented on `feature/e2e-canary-playwright` at the user's direction (no new
`git flow feature` branch). All 8 tasks complete; Level 1–3 green; 329 tests
(baseline 293).

**Deviations, in order of significance:**

1. **`DEFAULT_LOCALE` is `en`, not `de`.** User decision when the plan's
   _Questionables_ was put to them. Consequence the plan did not consider: an
   unlabelled host page now shows English, so `resolveLocale()` never reading
   `navigator.language` matters more than it did. AC1's chain was implemented
   exactly as specified rather than widened — see the report's open question.
2. **The catalogue is split per surface**, `common/i18n/{core,demo,player,admin}.ts`,
   not one `common/i18n.ts`. Taking the escape hatch the plan named under
   _Questionables_: one pooled catalogue cost **+13.5 / +13.2 / +11.7 KB** per
   bundle against AC8's ~5 KB budget, because each entry carried all three
   surfaces' copy (the admin dialog's ~2.8 KB of rich text included). Split:
   **+0 / +5.0 / +5.2 / +4.5 KB**.
3. **An `esc()` exception for `admin.*Html` keys.** The admin dialog's prose
   carries inline `<strong>`/`<em>`/`<code>`/`&lt;pre&gt;` that `esc()` would
   render as visible entities. Those keys are interpolated raw; the boundary is
   enforced as data by `i18n.test.ts` ("confine markup to the admin.\*Html keys")
   so a non-`Html` key can never gain a `<`.
4. **The lookup is exported as `t` but must be imported as `tr`.** Across
   `runtime-src/`, `t` is the established name for the current playback time
   (`renderScience(t)`, `onTime(t)`, `const t = mediaEl.currentTime`); an
   unaliased import shadows it at nearly every call site.

**Scope grew from the plan's ~40 keys to 80** (32 demo/quiz + 23 player + 15
admin, ×2 locales). The plan predates three merged features; re-running its
inventory greps found the admin dialog had grown a third step, plus uninventoried
copy: the section progress line, the `Intro` fallback, the phase-duration pill,
four voice-over control tooltips, four track-button tooltips, the drift-badge
titles, and the `Off` / `Current` / `Play` / `Sound` / `Full` / `CC` control labels.

**German column** uses `admin-toggle/prompt.ts`'s house vocabulary per user
decision (`Sektion`, `Master-Schritte`, `Auswertung`, `7 Master Steps`) rather
than the plan's fresh translations (`Kursabschnitt`, `Meta-Struktur`,
`Zusammenfassung`).

**Extra test beyond the plan:** `tests/common/locale-surface.test.ts` mounts the
real `demo-overlays` and `reskin-player` entries under each locale and asserts
the whole surface flips together — AC5 as an executable check rather than a
manual browser step. Both it and `no-bare-strings.test.ts` were mutation-tested:
reverting one call site to a hardcoded literal fails each independently.

**Not verified:** Level 4 browser validation on a live LearningSuite tenant and
Level 5 manual walkthrough (no tenant access from this session). Level 5 step 5
— deleting a `de` key must fail `typecheck:runtime` — WAS verified.

</details>

<details>
<summary>2026-09-02 — follow-up: navigator.language fallback + CRLF fix</summary>

Both items the implementation report raised were closed on the user's request.

**1. `resolveLocale()` gained a third step — this WIDENS AC1.**
Order is now `window.__vpLocale` → `document.documentElement.lang` →
`navigator.languages` → `DEFAULT_LOCALE`. AC1 fixed the chain at three steps, but
it was written assuming `DEFAULT_LOCALE = de`; once the user chose `en`, the
`navigator` step became the thing that keeps a German learner on a `lang`-less
LearningSuite page out of an English UI. The **whole ordered list** is walked
(`navigator.language` only as the fallback for browsers without `languages`), so
a visitor preferring `["fr", "de", "en"]` gets German rather than the default.
A page that declares a language still outranks the browser. Both orderings are
mutation-tested. Cost: **+268 bytes per bundle**, which puts `reskin-player`
(+5,253) and `demo-overlays` (+5,494) modestly above AC8's literal 5,120 —
recorded rather than rounded; see the report.

**2. `.gitattributes` added** — `* text=auto eol=lf`, an explicit
`public/runtime/*.js text eol=lf`, and explicit `binary` for tracked
image/audio/font types. Closes the CRLF hazard recorded in the previous
amendment: `core.autocrlf=true` (from the machine's global `~/.gitconfig`) had
any checkout — a `git stash` round-trip included — rewriting files as CRLF, which
breaks the committed-bundle drift check. Verified with `git checkout-index`
(the same eol filter a `stash pop` uses): CRLF without the file, LF with it.
Zero churn — a `--renormalize` dry-run reported 0 files whose stored content
would change, and the index was already 100% LF.

Tests: **339 passing** (was 329), +10 covering the navigator step and its
precedence. All Level 1–3 gates green.

</details>
