# Implementation Report

**Plan**: `.claude/PRPs/plans/completed/2026-08-04_runtime-i18n_locale-aware-overlay-strings.plan.md`
**Source Issue**: n/a
**Branch**: `feature/e2e-canary-playwright` (used at the user's direction — no new `git flow feature` branch)
**Date**: 2026-09-02
**Status**: COMPLETE (code + automated gates, incl. the two post-review follow-ups; Level 4 browser and Level 5 manual validation not run — no LearningSuite tenant access from this session)

---

## Summary

Every user-facing string in the three injected runtime bundles now renders from a
locale-aware catalogue instead of being hardcoded. The defect the plan set out to
fix — an English sidebar wrapped around a German quiz dialog on the same
LearningSuite page — is closed: on a `<html lang="de">` page the sidebar tabs,
section pill, voice-over banner, player control labels and `aria-label`s, and the
quiz dialog are all German; with `window.__vpLocale = "en"` the whole surface
flips together.

No i18n library was added. Locale resolution reads `window.__vpLocale` → the
primary subtag of `document.documentElement.lang` → the visitor's ordered
`navigator.languages` → `DEFAULT_LOCALE`, once per module instance.

---

## Assessment vs Reality

| Metric     | Predicted                                            | Actual                    | Reasoning                                                                                                                                                                                                                    |
| ---------- | ---------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complexity | LOW-MEDIUM — mechanical breadth, no new control flow | MEDIUM                    | The mechanical part matched. Two things the plan did not foresee added real work: AC8 forced a structural change (catalogue split), and the admin dialog's inline HTML forced an `esc()` exception with its own enforcement. |
| Confidence | ~40 keys, one flat catalogue                         | 80 keys, four modules     | The plan predates three merged features. Re-running its inventory greps (as the plan instructed) found the admin dialog had grown a third step and ~20 uninventoried literals.                                               |
| Est. tasks | 8                                                    | 8 + 1 unplanned test file | Task order held exactly; `locale-surface.test.ts` was added to make AC5 executable rather than a manual browser step.                                                                                                        |

**Where implementation deviated, and why:** see _Deviations from Plan_ below. The
two significant ones — the `en` default and the catalogue split — were a user
decision and the plan's own named escape hatch respectively.

---

## Tasks Completed

| #   | Task                                     | File                                                  | Status |
| --- | ---------------------------------------- | ----------------------------------------------------- | ------ |
| 1   | CREATE the catalogue and lookup          | `runtime-src/common/i18n/{core,demo,player,admin}.ts` | ✅     |
| 2   | Declare `window.__vpLocale`              | `runtime-src/global.d.ts`                             | ✅     |
| 3   | CREATE unit tests                        | `runtime-src/tests/common/i18n.test.ts`               | ✅     |
| 4   | Externalise demo-overlays (23 sites)     | `runtime-src/demo-overlays/index.ts`                  | ✅     |
| 5   | Externalise the quiz (9 sites)           | `runtime-src/demo-overlays/quiz.ts`                   | ✅     |
| 6   | Externalise reskin-player (28 sites)     | `runtime-src/reskin-player/index.ts`                  | ✅     |
| 7   | Externalise the admin dialog (15 keys)   | `runtime-src/admin-toggle/index.ts`                   | ✅     |
| 8   | Bare-string guard, rebuild, all gates    | `runtime-src/tests/common/no-bare-strings.test.ts`    | ✅     |
| +   | _(unplanned)_ AC5 as an integration test | `runtime-src/tests/common/locale-surface.test.ts`     | ✅     |

---

## Validation Results

| Check                    | Result | Details                                                                                                                                                                                                   |
| ------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typecheck:runtime`      | ✅     | 0 errors                                                                                                                                                                                                  |
| `eslint runtime-src`     | ✅     | 0 errors, 0 warnings                                                                                                                                                                                      |
| `prettier --check`       | ✅     | clean across `runtime-src`                                                                                                                                                                                |
| Unit + integration tests | ✅     | **339 passed** in 31 files (baseline 293 in 28)                                                                                                                                                           |
| `build:runtime`          | ✅     | succeeds; consecutive builds byte-identical, so the CI drift check will be clean                                                                                                                          |
| CRLF in bundles          | ✅     | 0 — `.gitattributes` pins `eol=lf`; verified via `git checkout-index`                                                                                                                                     |
| `eslint .` (repo-wide)   | ⚠️     | **7 errors — all pre-existing on HEAD**, in `app/` and `components/`. Verified unchanged by this work; `runtime-src` is clean.                                                                            |
| `next build`             | ⚠️     | Fails at `env.ts:13` on missing `DATABASE_URL` / `BLOB_READ_WRITE_TOKEN`. Pre-existing and documented in `feature-context.md`; the runtime bundles are static `public/` assets outside the compile graph. |
| Level 4 browser          | ⏭️     | Not run — no LearningSuite tenant access. Superseded in part by `locale-surface.test.ts`.                                                                                                                 |
| Level 5 manual           | ⏭️/✅  | Steps 1–4 not run. **Step 5 verified**: deleting a `de` key fails `typecheck:runtime` (`TS2741`).                                                                                                         |

### AC8 — bundle-size delta (recorded here for the commit message)

| Bundle          | Raw before | Raw after |  Δ raw | of which `navigator` step | Δ gzip |
| --------------- | ---------: | --------: | -----: | ------------------------: | -----: |
| `loader`        |      9,803 |     9,803 | **+0** |                        +0 |     +0 |
| `reskin-player` |     63,766 |    69,019 | +5,253 |                      +268 | ~+1.3K |
| `demo-overlays` |    106,088 |   111,582 | +5,494 |                      +268 | ~+1.4K |
| `admin-toggle`  |     17,785 |    22,536 | +4,751 |                      +268 | ~+1.3K |

Two bundles now sit **modestly above a literal 5,120** (5.13 KB and 5.37 KB)
against AC8's "under ~5 KB" — the `navigator` step, added after review, accounts
for 268 bytes of each. On the wire it is ~1.3 KB per bundle. Stated plainly
rather than rounded to fit: the budget's intent (no library, no order-of-magnitude
growth) holds, but the literal figure does not, and that is a trade the reviewer
should see. `loader` remains byte-identical — it imports no catalogue.

If the figure needs to come under 5,120, the honest lever is a further catalogue
split (`demo.ts` → `demo.ts` + `quiz.ts`), not shaving comments: esbuild strips
those already.

---

## Files Changed

| File                                                           | Action | Lines                                |
| -------------------------------------------------------------- | ------ | ------------------------------------ |
| `runtime-src/common/i18n/core.ts`                              | CREATE | +96                                  |
| `runtime-src/common/i18n/demo.ts`                              | CREATE | +96                                  |
| `runtime-src/common/i18n/player.ts`                            | CREATE | +76                                  |
| `runtime-src/common/i18n/admin.ts`                             | CREATE | +70                                  |
| `runtime-src/tests/common/i18n.test.ts`                        | CREATE | +280                                 |
| `runtime-src/tests/common/no-bare-strings.test.ts`             | CREATE | +160                                 |
| `runtime-src/tests/common/locale-surface.test.ts`              | CREATE | +374                                 |
| `runtime-src/tests/node-fs.d.ts`                               | CREATE | +9                                   |
| `runtime-src/global.d.ts`                                      | UPDATE | +5                                   |
| `runtime-src/demo-overlays/index.ts`                           | UPDATE | +40/-23                              |
| `runtime-src/demo-overlays/quiz.ts`                            | UPDATE | +11/-7                               |
| `runtime-src/reskin-player/index.ts`                           | UPDATE | +71/-35                              |
| `runtime-src/admin-toggle/index.ts`                            | UPDATE | +28/-15                              |
| `runtime-src/tests/demo-overlays/quiz.test.ts`                 | UPDATE | +4/-1                                |
| `.gitattributes`                                               | CREATE | +30 — pins `eol=lf` repo-wide        |
| `public/runtime/{demo-overlays,reskin-player,admin-toggle}.js` | UPDATE | **generated** — `build:runtime` only |

---

## Deviations from Plan

1. **`DEFAULT_LOCALE = "en"`, not `"de"`.** The plan's _Questionables_ asked for
   confirmation; the user chose `en`. One-line change as the plan predicted, but
   it inverts what an unlabelled page shows. Knock-on: `quiz.test.ts`'s
   `"67% richtig beantwortet"` assertion became `"67% answered correctly"`
   (the test document declares no `lang`, so it resolves to the default).

2. **Catalogue split per surface** — `common/i18n/{core,demo,player,admin}.ts`
   rather than one `common/i18n.ts`. This is the escape hatch the plan named
   under _Questionables_ ("split into `common/i18n/{demo,player,admin}.ts`
   sharing `resolveLocale()`. Do not do it pre-emptively"), taken only after
   measuring: the pooled catalogue cost **+13.5 / +13.2 / +11.7 KB** per bundle
   against AC8's ~5 KB, because every entry carried all three surfaces' copy —
   `demo-overlays` was paying for the admin dialog's ~2.8 KB of German rich text
   it never renders. Each entry now imports one catalogue plus the shared
   resolver. `core.ts` holds `LOCALES`, `Locale`, `DEFAULT_LOCALE`,
   `resolveLocale()`, `activeLocale()` and a `createT(messages)` factory; the
   cached locale and the warned-key set live there, so all surfaces in one mount
   necessarily agree (asserted in `i18n.test.ts`).

3. **An `esc()` exception for `admin.*Html` keys.** The admin dialog's prose is
   not plain text — it carries `<strong>`, `<em>`, `<code>` and an escaped
   `&lt;pre data-vp-config&gt;`. Passing it through `esc()` renders visible
   `&amp;lt;`; splitting it into markup-free fragments would fix word order
   across languages and defeat the point. The `*Html` suffix marks the six keys
   interpolated raw. Rather than rely on the convention, `i18n.test.ts` enforces
   both halves as data: no non-`Html` key may contain `<`, `>` or `&`, in any
   locale, in any catalogue. AC7 otherwise holds — every other `innerHTML` site
   keeps `esc()`, and `quiz.ts` is still `innerHTML`-free apart from two
   `slot.innerHTML = ""` clears.

4. **The lookup is imported as `tr`, not `t`.** The plan specified `t(key, vars?)`
   and the module exports exactly that, but `t` is already the runtime's name for
   the current playback time at nearly every call site (`renderScience(t)`,
   `onTime(t)`, `const t = mediaEl.currentTime`). All four entries alias on
   import; the requirement is documented in each catalogue's header.

5. **Scope: 80 keys, not ~40.** The plan instructed re-running its inventory
   greps, which surfaced both drift and gaps: the admin dialog had gained a third
   step (voice-over asset upload), and these were never inventoried — the section
   progress line (`{done} of {total} completed`), the `Intro` section fallback,
   the phase-duration pill, four voice-over control tooltips, four track-button
   tooltips, both drift-badge titles, and the `Off` / `Current` / `Play` /
   `Pause` / `Audio` / `Sound` / `Full` / `CC` control labels.

6. **German column follows the house vocabulary** (user decision): `Sektion`,
   `Master-Schritte`, `Auswertung`, `7 Master Steps` — the terms
   `admin-toggle/prompt.ts` already uses — rather than the plan's fresh
   `Kursabschnitt`, `Meta-Struktur`, `Zusammenfassung`. `Intervention(en)` kept
   per `CONTEXT.md`. This directly answers the plan's "have the `de` column
   reviewed against `CONTEXT.md` and the prompt's vocabulary before merge".

7. **One extra test file.** `locale-surface.test.ts` mounts the real
   `demo-overlays` and `reskin-player` entries under each locale signal and
   asserts the whole surface flips — turning AC5 from a manual browser step into
   an executable check.

8. **A 9-line ambient declaration, `runtime-src/tests/node-fs.d.ts`.** The guard
   test reads entry sources with `node:fs`, but `tsconfig.runtime.json` sets
   `types: []` on purpose so runtime code is typechecked as DOM-only. Declaring
   just `readFileSync` keeps that guard intact instead of pulling all of
   `@types/node` into the runtime programme.

---

## Issues Encountered

- **AC8 failed on the first build** (+13.5 / +13.2 / +11.7 KB). Diagnosed by
  measuring rather than guessing, then resolved with deviation 2. My first
  hypothesis — that `minify: false` meant comments were shipping — was **wrong**:
  esbuild strips comments regardless (`legalComments: "none"`), proven by trimming
  ~600 bytes of comment prose and observing a 0-byte change. Comment density in
  `runtime-src/common/` is therefore free; catalogue breadth is not.

- **`git stash` corrupted line endings.** A stash round-trip (used to confirm the
  pre-existing lint failures) passed every touched file through
  `core.autocrlf=true`, rewriting them CRLF. Because the bundles are unminified,
  source formatting propagates into generated output, so this also made two
  consecutive builds differ and looked briefly like build nondeterminism.
  Resolved with `prettier --write` (defaults to `endOfLine: lf`) and a rebuild;
  determinism then confirmed over three consecutive builds. **Fixed for good** by
  the `.gitattributes` added in the follow-up below — this hazard no longer exists.

- **Both new guards were mutation-tested**, not just run green. Reverting one
  call site (`demo.phase.interventions`) to a hardcoded `>Interventions<` fails
  `locale-surface.test.ts` ("English "Interventions" leaked onto a German page")
  and `no-bare-strings.test.ts` independently. `no-bare-strings.test.ts` was
  additionally run against the pre-change source from `HEAD` and failed on all
  four entries, confirming it is not vacuous.

---

## Follow-up Implemented (same session, after review)

Both items the report flagged were closed on request:

### 1. `navigator.languages` is now the third resolution step

`resolveLocale()` order is now
`window.__vpLocale` → `document.documentElement.lang` → **`navigator.languages`** → `DEFAULT_LOCALE`.

This deliberately **widens AC1**, which fixed the chain at three steps. It is the
right widening: AC1 was written assuming a German default, and with `en` the
`navigator` step is what keeps a German learner on a `lang`-less LearningSuite
page out of an English UI.

Two design points worth keeping:

- **The whole ordered list is walked, not `navigator.language` alone.** A visitor
  whose preferences are `["fr", "de", "en"]` wants German; reading only the first
  entry would miss it and fall through to the default. `navigator.language` is the
  fallback for browsers that expose no `languages` list.
- **A page that declares a language still outranks the browser.** An explicitly
  German lesson stays German for a visitor browsing in English.

Both orderings are pinned by mutation-tested cases: collapsing the walk to
`navigator.language` fails "walks the whole preference list"; moving the
`navigator` step above `documentElement.lang` fails two ordering tests, one unit
and one integration.

**Cost**: +268 bytes per bundle, of which ~45 is esbuild downlevelling `?.` for
the es2019 target. Kept the optional chain — `?.` is pervasive in this codebase
and consistency beat 45 bytes. Revised AC8 below.

### 2. `.gitattributes` closes the CRLF hazard

`* text=auto eol=lf` plus an explicit `text eol=lf` for `public/runtime/*.js` and
explicit `binary` for the tracked image/audio/font types.

Verified as a genuine fix, not a hopeful one — `git checkout-index` applies the
same eol filter a `stash pop` does:

|                          | `runtime-src/global.d.ts` | `public/runtime/loader.js` |
| ------------------------ | ------------------------- | -------------------------- |
| without `.gitattributes` | **CRLF**                  | **CRLF**                   |
| with `.gitattributes`    | LF                        | LF                         |

Zero-churn: a `--renormalize` dry-run against a throwaway index reported **0**
files whose stored content would change, and the real `.git/index` was left
byte-identical. The index was already 100% LF (224 text, 21 binary), so this
locks in the status quo rather than rewriting history.

`core.autocrlf=true` turns out to come from the machine's **global**
`~/.gitconfig`, so a repo-local `.gitattributes` is the correct scope — it fixes
this repo without touching the user's preference elsewhere, and protects every
future contributor rather than one checkout.

## Tests Written

| Test File                                  | Test Cases                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/common/i18n.test.ts` (31)           | `resolveLocale`: no signal · declared `lang` · subtag/case matching (`de-AT`, `de-DE`, `de_CH`, `DE`, `" de "`) · unknown language · empty `lang` · override precedence · override subtag matching · unknown override · non-string override. `activeLocale`: caching, mid-session `lang` change ignored, all surfaces agree. **`navigator`: browser language used when the page declares none · whole ordered list walked · list order honoured · page `lang` outranks it · `__vpLocale` outranks it · unsupported preferences fall back · no `languages` list · empty `languages` list.** `t`: active locale · default locale · every inventory placeholder · unmatched placeholder stays literal · extra vars ignored · default-locale fallback · key returned + exactly one warning. Catalogues: identical key sets · no empty message · markup confined to `admin.*Html` · placeholder sets match across locales · namespaces disjoint. |
| `tests/common/no-bare-strings.test.ts` (6) | Each of the four entries free of inline copy (29 copy literals + 28 contextual forms + 1 retired) · the catalogues still contain that copy (guards the inverse regression) · `prompt.ts` deliberately out of scope.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `tests/common/locale-surface.test.ts` (9)  | demo-overlays on `lang="de"`: sidebar + section pill + quiz all German, no English leak · `__vpLocale="en"` flips everything, no German survives · `lang="fr-CA"` + unsupported browser falls back · **German on an unlabelled page for a German browser** · **page `lang` outranks the browser** · zero missing-message warnings across a full render. reskin-player: German `aria-label`s and short visible labels · English on `lang="en"` · all 5 `aria-label`s and buttons survive attribute escaping.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `tests/demo-overlays/quiz.test.ts`         | Updated: score line now asserts the default locale's `"67% answered correctly"`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

---

## Next Steps

- [ ] Level 4 browser validation on the live tenant: German lesson → one language
      throughout; `window.__vpLocale = "en"` → all English; screen reader reads
      the control labels in the page language; no `[vp] missing message` warnings
      across a full playthrough; umlauts and `→` render in the editor dialog.
      Worth checking `document.documentElement.lang` on a real lesson while there —
      it decides whether the `navigator` step is the load-bearing one in practice.
- [ ] Native-speaker pass on the `de` column — it is one file, and wrong copy is
      a one-line fix. Specific calls worth a second opinion: `player.label.play`
      = `Start` (chosen over `Wiedergabe` to keep the control bar compact, with
      `player.aria.playPause` = `Wiedergabe/Pause` carrying the precise term),
      and `quiz.action.continue` = `Weiter` (was `Continue` in the German UI — an
      intended copy fix, worth naming in the commit message).
- [ ] Decide whether the AC8 overage on two bundles is acceptable, or split
      `demo.ts` again (see AC8 note).
- [ ] Commit. Suggested split: `[TASK]` for the externalisation, `[FEATURE]` for
      locale awareness, `[TASK]` for `.gitattributes`; record the AC8 deltas above.
- [ ] Follow-up from the plan, still open: E2E canary coverage of the locale flip.

**Resolved, no longer open**: the `navigator.language` question and the CRLF/
`.gitattributes` hazard — both implemented above.
