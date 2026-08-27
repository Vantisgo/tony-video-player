# E2E Overlay Canary

An automated check that the injected runtime (`reskin-player` + `demo-overlays`)
still mounts and works on the real, auth-gated LearningSuite platform
(`robbins.greator.com`).

Everything else in this repo tests our code against our own assumptions:
`bun test` runs the modules against happy-dom fixtures we wrote, `typecheck:runtime`
checks types, and the drift-check confirms `public/runtime/*.js` matches
`runtime-src/`. None of them can see the failure that actually threatens this
feature — LearningSuite renaming `<hls-video>`, restructuring the host element,
changing their control class names, or shipping a CSP that blocks our script.
This suite is the only thing that executes the runtime on a `learningsuite.io`
page.

Decisions behind it: `docs/e2e-overlay-canary-decisions.md`.

---

## Status — blocked on a stale deployed bundle (verified 2026-08-27)

The harness is complete and the login works. The canary **cannot go green
today**, and no fixture or selector change will fix it: `robbins.greator.com`
loads a runtime bundle that predates every global the canary asserts on.

Measured against the tenant on 2026-08-27:

|                                          | deployed (what the tenant runs) | this repo's `public/runtime/` |
| ---------------------------------------- | ------------------------------- | ----------------------------- |
| `reskin-player.js`                       | 44,533 bytes                    | 64,803 bytes                  |
| sets `__vpReskinStatus`                  | **no**                          | yes                           |
| `_diag().discovery`                      | **absent**                      | present                       |
| `demo-overlays.js` sets `__vpDemoStatus` | **no**                          | yes                           |
| `loader.js`                              | **404**                         | exists                        |

The tenant's global script slot still carries the **pre-loader three-tag
snippet** pointing at the spike-branch alias
(`…-spike-learningsuite-e-f1e7ad-vantisgo-web.vercel.app`), whose deployment is
old enough that `loader.js` had not been written yet. `_diag().runtime.build` on
the page reads `audio-drift-badge-passive`.

> `docs/feature-context.md` claims "the tenant now loads `loader.js`". That is
> **wrong**, and it is why preview mode (`E2E_RUNTIME_BASE_URL`) was built to
> normalise its input to a _loader_ script URL. Preview mode has never been run.

The runtime itself is healthy on the tenant — only its _observability surface_ is
missing. On the test lesson the reskin visibly mounts (`[data-vp-reskinned]`×1,
`.vp-shell`×1, `[data-vp="playpause"]` and `[data-vp="time"]` present), the demo
overlays mount (`#vp-demo-sidebar` plus all four `#vp-slot-tl/tr/br/lt`), and the
console logs `[vp] config loaded from element` and `[vp] demo overlays mounted`.
But `__vpReskinStatus` and `__vpDemoStatus` are `null`, and `_diag()` has no
`discovery` key.

**First live run** — `bun run e2e --lesson=…/test/bksCcNnT/yPClsb9h/pgWcT1Bk`,
2026-08-27, 4.5 min:

| Test                                    | Result                                                         |
| --------------------------------------- | -------------------------------------------------------------- |
| `reskin-player mounts on the live page` | ❌ `window.__vpReskinStatus was never set` (90s timeout)       |
| `native player chrome is hidden`        | ✅ passed                                                      |
| `pressing play advances playback`       | ❌ `_diag()` returned an unexpected shape (no `discovery`)     |
| `demo-overlays mounts`                  | ⏭ skipped — `__vpDemoStatus` never set, so the spec bails out |

That is the harness working: it detected a bundle mismatch and named it. **The
fix is an ops change, not a code change** — redeploy the runtime and repoint the
tenant's script slot at it.

Nothing current is deployed to point at yet either:
`tony-video-player.vercel.app/runtime/*` returns 404, and the `git-main` alias
returns 302 (deployment protection).

### The bypass secret is exposed on the tenant

The three script tags in the global slot carry
`?x-vercel-protection-bypass=<secret>` in plain sight of any logged-in learner
who opens View Source. This is not a repo leak — the value appears only on the
tenant — but it should be rotated when the slot is next edited (Vercel → Project
Settings → Deployment Protection). Never paste the value into this repo.

---

## The two parameters

The suite takes two inputs. Both are optional; empty means the sensible default.

| Parameter  | Flag                                  | Env var      | Accepts                                                                             | Empty means                                             |
| ---------- | ------------------------------------- | ------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **target** | `--course=X` / `--lesson=X` (aliases) | `E2E_TARGET` | A course or lesson as a full URL, a LearningSuite id/slug, or a visible course name | The committed default fixtures — what the schedule runs |
| **video**  | `--video=N`                           | `E2E_VIDEO`  | 1-based index into the target course's ordered video lessons                        | **All** videos in that course                           |

```bash
bun run e2e                                   # default fixtures (what the schedule runs)
bun run e2e --course="Onboarding"             # by name        — UNSUPPORTED on this tenant
bun run e2e --course=abc123 --video=4         # 4th video only — UNSUPPORTED on this tenant
bun run e2e --lesson=https://…/student/course/…  # a single lesson by URL
E2E_TARGET=abc123 E2E_VIDEO=4 bun run e2e     # the same thing via env (what CI uses)
```

> **Course and video targets do not work on this tenant.** `--course` and
> `--video=N` need a course page whose curriculum rows are links; LearningSuite
> renders them as React-router buttons instead (see "Course enumeration" below).
> Only `--lesson=<url>` and the committed default fixtures work on
> `robbins.greator.com`. The flags are kept because the code is written and
> another tenant may render anchors — but they are **unsupported here**, and
> AC10–AC12 are recorded as won't-fix.

The env vars are the contract; the flags are sugar over them. Anything a flag can
express, `E2E_TARGET` / `E2E_VIDEO` express identically — which is why CI sets the
env vars directly.

`--lesson` and `--course` are deliberate aliases for one parameter. Which one a
value denotes is decided by what it resolves to, not by which flag was typed.

> **`--video=N` is a position, not an identifier.** It indexes today's curriculum
> order. If LearningSuite reorders the course or a video is removed, `N` silently
> means a different lesson. Anyone who needs stability passes the lesson URL.

---

## How a run works (and why `playwright test` alone is wrong)

A run is **two** Playwright invocations, sequenced by `scripts/e2e.ts`:

1. **resolve** — logs in, turns the parameters into a concrete ordered list of
   video lesson URLs, and writes `e2e/.auth/targets.json`.
2. **canary** — reads that file _while loading the spec_ and emits one test group
   per video.

They cannot be one invocation. Playwright fixes its test list while loading spec
files, so a targets file written by a project in the same run arrives too late:
the suite would collect zero tests and report a green run having asserted
nothing. That is why `bun run e2e` is a script and not an alias for
`playwright test`, and why the `resolve` and `canary` projects are deliberately
**not** chained with `dependencies`.

Running `playwright test --project=canary` directly is refused: the spec compares
the targets file's `specKey` against the current parameters and fails with an
actionable message rather than testing something you did not ask for.

Wall-clock is `videos × 4 tests` with `workers: 1` (one shared LearningSuite
account — do not raise it). On this tenant a run is always one lesson or the
committed defaults, so it is minutes, not hours — the single live run so far took
4.5 min for one video.

---

## Environment

`.gitignore` ignores `.env*`, so there is no committable `.env.example`. This
table is the authoritative list. Locally these live in an uncommitted
`.env.local`; in CI they are repository variables and secrets.

| Var                               | Where                            | Required | Purpose                                                                                                    |
| --------------------------------- | -------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| `E2E_LS_BASE_URL`                 | `.env.local` + repo **variable** | yes      | `https://robbins.greator.com`                                                                              |
| `E2E_LS_EMAIL`                    | `.env.local` + repo **secret**   | yes      | Dedicated test account — never a real person's, it accrues watch progress                                  |
| `E2E_LS_PASSWORD`                 | `.env.local` + repo **secret**   | yes      | "                                                                                                          |
| `E2E_LS_LOGIN_PATH`               | `.env.local` + repo variable     | no       | Path of the login page. Default `/login`; this tenant uses `/auth`                                         |
| `E2E_LS_COURSES_PATH`             | `.env.local` + repo variable     | no       | Path of the course list, used for name resolution. Default `/student`; this tenant uses `/student/courses` |
| `E2E_TARGET`                      | anywhere                         | no       | The target parameter (see above)                                                                           |
| `E2E_VIDEO`                       | anywhere                         | no       | The video parameter (see above)                                                                            |
| `E2E_RUNTIME_BASE_URL`            | PR job only                      | no       | Preview deployment to serve `/runtime/*.js` from. **Set ⇒ preview mode**                                   |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | PR job only                      | no       | Preview deployments are protection-gated; without it the bundle fetch 401s                                 |
| `RUNTIME_ALERT_WEBHOOK_URL`       | repo secret                      | no       | Failure alerts. Unset ⇒ the alert step skips, it does not fail                                             |

A missing or malformed variable fails by name before a browser opens. The
password is never echoed in an error.

### Local setup

```bash
bun install
bunx playwright install --with-deps chrome   # needs sudo; real Chrome, see below
printf 'E2E_LS_BASE_URL=https://robbins.greator.com\nE2E_LS_EMAIL=…\nE2E_LS_PASSWORD=…\n' > .env.local
bun run e2e
```

**Real Chrome is required**, not Playwright's bundled Chromium: Bunny streams
H.264/AAC HLS and the bundled build may not carry those proprietary codecs, which
would fail the playback assertion for a reason unrelated to our runtime.
`channel: "chrome"` is pinned in `playwright.config.ts` on purpose — do not
downgrade it to `chromium` to make a machine without Chrome pass.

---

## Outstanding prerequisites — step by step

The harness is complete and typechecks. What was missing was the set of facts
recorded nowhere in this repo: the login form's real selectors, which lessons to
use as fixtures, and how a course page lists its lessons. Most of those were
recorded on 2026-08-07 and 2026-08-27; what remains is listed below.

Progress checklist:

- [x] **1. Chrome installed** — Chrome 151.0.7922.173, Playwright 1.62.1
- [~] **2. Test account** — a login works, but it is a _personal admin_ account, not a dedicated one
- [x] **3. Login form recorded** — `auth.setup.ts` locators replaced and confirmed by a live run
- [x] **4. Course + curriculum DOM recorded** — URL shapes and locators written down below
- [ ] **5. Two fixture lessons chosen** — `e2e/fixtures/lessons.ts` still empty (one found, one missing)
- [n/a] **6. A course with ≥ 3 videos** — not available, and moot: course targets are unsupported here
- [~] **7. `.env.local` written** — done; a green local run is **blocked** (see Status at the top)
- [~] **8. Vercel bypass secret** — already enabled and in use by the tenant; not yet in CI
- [ ] **9. CI variables and secrets added** → `workflow_dispatch` run green
- [ ] **10. Plan markers flipped**

> **Blocking everything: the stale deployed bundle** (see Status at the top of
> this document). Steps 5 and 7 cannot complete until the tenant serves a current
> runtime, because the canary's four primary assertions read globals that the
> deployed bundle never publishes.

---

### Step 1 — Install Chrome ✅ done

```bash
bunx playwright install --with-deps chrome
```

Needs sudo, so run it in a terminal that can prompt for a password (in Claude
Code, prefix it with `!`). On WSL2 the `--with-deps` part installs system
libraries the browser needs.

Chrome is required **for running the suite** (codecs), not for recording
selectors — bundled Chromium records fine, and `bunx playwright install chromium`
needs no sudo.

### Step 2 — Confirm the test account ⚠️ works, but it is the wrong account

A login with the credentials in `.env.local` succeeds: `bunx playwright test
--project=setup` passes in ~10s. MFA is not enforced.

**But it is a personal admin account, not a dedicated test account.** The
logged-in UI shows `Patrick Mereien · Admin` and an "Admin-Perspektive" control,
and the lesson DOM carries `vp-admin-toggle-style` — `admin-toggle.js` mounts its
annotation launcher for this session. Two consequences:

- Watch progress accrues on a real person's account, on every lesson the canary
  opens.
- The canary asserts against a DOM **no learner ever sees**. The admin launcher
  is extra markup inside the same host the reskin mounts into, so an
  admin-session green run does not prove a student-session green run.

Create a dedicated account (MFA off), enrol it in the fixture courses, and swap
`E2E_LS_EMAIL` / `E2E_LS_PASSWORD`. Never commit either.

### Step 3 — Login form ✅ recorded and confirmed

`e2e/support/auth.setup.ts` carries locators recorded with `playwright codegen`
against `robbins.greator.com` on 2026-08-07, with structural `.or(...)` fallbacks
kept behind them because the form's accessible names are half German ("E-Mail")
and half English ("Password", "Login"). Re-confirmed live on 2026-08-27.

Two facts worth keeping visible:

- `E2E_LS_LOGIN_PATH=/auth` — **not** the code default `/login`.
- The session is **not a cookie**. LearningSuite keeps a refresh token in
  `localStorage` (`auth_refresh_token_<tenantId>`). Playwright's `storageState`
  captures it, so a stored state with zero cookies is normal here, not a failed
  login.

If the form changes, re-record with `bunx playwright codegen
https://robbins.greator.com` and prefer `getByRole` / `getByLabel` /
`getByPlaceholder` over anything with a generated class name. **Delete the
password from anything codegen writes** — it must read `e2eEnv.E2E_LS_PASSWORD`.

### Step 4 — Course and curriculum DOM ✅ recorded 2026-08-27

| Question                                                      | Answer                                                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Course-list path                                              | `/student/courses` (`E2E_LS_COURSES_PATH`, already set — **not** the code default `/student`)                |
| Course URL shape                                              | `/student/course/<slug>/<id>` — **two** segments, e.g. `/student/course/test/bksCcNnT`                       |
| Lesson URL shape                                              | `/student/course/<slug>/<id>/<module>/<lesson>`, e.g. `…/test/bksCcNnT/yPClsb9h/pgWcT1Bk`                    |
| … and a second, different shape                               | `/student/course/<slug>/<id>/t/<id>` for non-video ("topic") lessons, e.g. `…/test/bksCcNnT/t/CV1Bklhy`      |
| Are courses on the list page anchors?                         | **Yes** — `a[href]` with the course path. Name resolution is feasible in principle (but see defects below)   |
| Are curriculum rows on the _course_ page anchors?             | **No.** The only deeper anchors are `/info` and `/bookmarks`                                                 |
| Are curriculum sections collapsed by default?                 | On the course page, no `[aria-expanded]` at all. On a _lesson_ page, two `[aria-expanded="false"]`           |
| Is the lesson list paginated / behind "load more"?            | No — it is progress-gated instead ("Schließe zuerst das vorherige Modul ab")                                 |
| How is a **video** lesson distinguished from a non-video one? | Not on the course page. The `/t/` URL segment marks topic lessons, but that is only visible after navigating |
| Useful `data-cy` values                                       | `continue-lesson` (the course page's start/resume control), `notification-icon`, `paragraph-element`, `leaf` |

The account sees two courses: `Robbins Greator Coaching Practitioner`
(`/student/course/robbins-greator-coaching-practitioner/k5GFQsnw`) and `Test`
(`/student/course/test/bksCcNnT`).

#### Course enumeration cannot work on this tenant

Curriculum rows are React-router buttons, not links, and modules are
progress-gated so later ones are unreachable until earlier ones are completed.
`lessonLinksBelow()` in `e2e/support/resolve.setup.ts` therefore finds nothing on
a course page, and a click-driven walk would have to _complete lessons_ to
enumerate them.

**Decision (2026-08-27): `--course` and `--video=N` are unsupported on this
tenant.** The canary ships lesson-URL-only: committed default fixtures for the
schedule, `--lesson=<url>` for ad-hoc runs. AC10–AC12 are won't-fix. The code
stays in place — it is written, tested at the unit level, and another tenant may
render anchors — but nothing here depends on it.

One lead if this is ever revisited: a **lesson** page does expose a sibling-lesson
anchor plus two collapsible sections. Enumerating from a lesson URL rather than a
course URL may be tractable where enumerating from the course root is not.

#### Resolver defects found while recording Step 4

These are latent — nothing exercises them while course targets are unsupported —
but they would each bite the moment someone re-enables `--course`:

1. **Bare-id course URLs are built wrong.** `COURSE_PATH_PREFIX` +
   `/<id>` yields `/student/course/bksCcNnT`, but this tenant needs
   `/student/course/<slug>/<id>`. `--course=<bare-id>` cannot resolve.
2. **`findCourseByName` can never match.** It compares the anchor's text
   _exactly_, but the course-list anchor text is title **concatenated with the
   progress badge**: `"TestNicht gestartet"`,
   `"Robbins Greator Coaching PractitionerNicht gestartet"`. `--course="Test"`
   always fails with "No course matches".
3. **`/student/courses` is offered as a course.** The prefix test is
   `path.startsWith("/student/course")`, which also matches the course-list path
   itself, so the "Dashboard" link appears in the candidate list.
4. **The documented lesson URL shape was wrong.** The research doc's
   `<m>/<l>/<t>` (three segments below the course) does not match either real
   shape recorded above.

### Step 5 — Choose the two fixture lessons ⬜ one found, one missing

`e2e/fixtures/lessons.ts` is still empty, so `bun run e2e` with no parameters
fails with "No default lessons are configured". Filling it in is **blocked on the
stale bundle**: committing a fixture now would commit a permanently-red canary.

**Confirmed good (2026-08-27):**

```
name:     Test Video Player   (course "Test")
path:     /student/course/test/bksCcNnT/yPClsb9h/pgWcT1Bk
domShape: shadow-dom          # <hls-video> with a <video> in its shadowRoot
config:   <pre data-vp-config>, 5627 chars ✓
duration: 5937s (~99 min), readyState 4
```

**Still missing: a `light-dom-slotted` lesson** (a `<video>` slotted into
`<slot name="media">`). Not found on this tenant — the one lesson inspected is
shadow-DOM, and the `Test` course holds only that single video. The shape is
LearningSuite's choice, not an authoring option, so it has to be _found_, never
assumed. Do not invent a URL for it: an absent fixture is visible, a wrong one
looks like a runtime failure.

To vet a candidate, open it while logged in and run this in the DevTools console:

```js
// 1. Does the lesson carry the config the runtime gates on?
//    No config => attach() returns early and BOTH the reskin and demo tests fail.
document.querySelector("[data-vp-config]")?.textContent ?? "NO CONFIG";

// 2. Which player DOM shape is it?
const el = document.querySelector(
  "hls-video, mux-player, media-controller video, video",
);
console.log("tag:", el?.tagName);
console.log(
  "light-dom-slotted:",
  !!document.querySelector('[slot="media"] video, video[slot="media"]'),
);
console.log("shadow-dom:", !!el?.shadowRoot?.querySelector("video"));

// 3. Is our runtime healthy on this lesson right now?
console.log(
  window.__vpLoaderStatus,
  window.__vpReskinStatus,
  window.__vpDemoStatus,
);
console.log(window.player?._diag());
```

If step 3 prints `undefined undefined undefined`, you are looking at the stale
bundle, not a broken lesson.

Prefer hidden/internal lessons: the test account really watches this video, and
LearningSuite records the progress.

### Step 6 — A course with ≥ 3 video lessons 🚫 not applicable

Needed only to exercise `--video=N` and the all-videos path, both of which are
unsupported here (Step 4). Recorded for completeness:

|                         |                                                |
| ----------------------- | ---------------------------------------------- |
| Exercise course name    | `Test`                                         |
| Exercise course id/slug | `/student/course/test/bksCcNnT`                |
| Number of video lessons | **1** (plus one `/t/` topic lesson)            |
| Is the order stable?    | Unknown, and moot — no enumeration path exists |

### Step 7 — `.env.local` and the first green run ⬜ blocked

`.env.local` is written and correct:

```bash
E2E_LS_BASE_URL=https://robbins.greator.com
E2E_LS_EMAIL=…
E2E_LS_PASSWORD=…
E2E_LS_LOGIN_PATH=/auth
E2E_LS_COURSES_PATH=/student/courses
```

`bun run e2e --lesson=<url>` runs end to end and fails on the stale bundle — see
the run table in Status. Once the tenant serves a current runtime, re-run it,
then commit the fixtures (Step 5) and confirm `bun run e2e` with no parameters is
green.

The parameter matrix in the original plan is reduced to what this tenant
supports:

```bash
bun run e2e --lesson=<lesson-url>      # a single lesson
bun run e2e                            # the committed default fixtures
bunx playwright test --project=canary  # must refuse with the specKey mismatch message
```

Failures: `bun run e2e:report` opens the HTML report with trace, video,
screenshot and the attached `diag.json`. The decision table at the bottom of this
document maps symptoms to causes.

### Step 8 — Vercel bypass secret ⚠️ already live, not yet in CI

Protection Bypass for Automation is **already enabled** — the tenant's script
tags carry the secret as a query parameter today. Two things follow:

1. Nothing needs enabling. Read the current value off the tenant's page source,
   or regenerate it from Vercel → Project Settings → Deployment Protection.
2. It is exposed to any logged-in learner (see the note in Status). Rotating it
   means editing the tenant's script slot in the same pass.

Store it as the `VERCEL_AUTOMATION_BYPASS_SECRET` repository secret for the PR
job, then verify locally against a real preview deployment:

```bash
E2E_RUNTIME_BASE_URL=https://<preview>.vercel.app \
VERCEL_AUTOMATION_BYPASS_SECRET=… \
bun run e2e --lesson=<url>
```

Confirm the preview bundle actually executed — check `window.__vpRuntimeInfo.build`
in the trace, or that the run annotates `preview bundle: …`. A 401 fails with a
labelled error rather than letting Vercel's HTML run as JavaScript.

> Preview mode normalises its input to a **`loader.js`** URL. That is correct for
> the current runtime but does **not** match what the tenant loads today (three
> direct tags, no loader). Preview mode has never been exercised; expect to debug
> it on first use.

### Step 9 — CI ⬜ open

Add these in the repository settings:

| Kind         | Name                                                  |
| ------------ | ----------------------------------------------------- |
| **Variable** | `E2E_LS_BASE_URL` — `https://robbins.greator.com`     |
| Variable     | `E2E_LS_LOGIN_PATH` — `/auth` (required, not default) |
| Variable     | `E2E_LS_COURSES_PATH` — `/student/courses` (required) |
| **Secret**   | `E2E_LS_EMAIL`                                        |
| Secret       | `E2E_LS_PASSWORD`                                     |
| Secret       | `VERCEL_AUTOMATION_BYPASS_SECRET` (Step 8)            |
| Secret       | `RUNTIME_ALERT_WEBHOOK_URL` (probably already set)    |

Then:

```bash
gh workflow run e2e-canary.yml && gh run watch
```

Finally, break one assertion locally on purpose and confirm the artifacts and the
webhook alert behave — then revert. **Tell whoever watches the alert sink first**:
a deliberate failure fires a real webhook POST.

### Step 10 — Close out ⬜ open

In `.claude/PRPs/plans/2026-07-27_e2e-canary_learningsuite-overlay-playwright.plan.md`:
flip Tasks 5, 6, 9, 11, 13 and 14 from `[wip]` to `[x]` once a live run is green,
mark Task 1 `[x]` with the Step 4/6 gaps noted, and record AC10–AC12 as won't-fix
with the enumeration decision above. Only then archive the plan to
`plans/completed/`.

---

## What it asserts

Every target is a surface the runtime already publishes for its own reasons. No
`data-testid` was added for these tests, and none should be: if an assertion
seems to need a new hook, the likelier reading is that it is reaching past what
the runtime promises.

| Test                                    | Assertion                                                                                                                                                                                                                   |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reskin-player mounts on the live page` | `__vpReskinStatus === "reskin attached"`; exactly one `[data-vp-reskinned="true"]` containing a `.vp-shell`; `[data-vp="playpause"]` and `[data-vp="time"]` visible; `_diag().hasVideo === true` and `discovery !== "none"` |
| `native player chrome is hidden`        | Our `.vp-controls` visible **and** every native-chrome selector from `styles.ts` absent-or-hidden                                                                                                                           |
| `pressing play advances playback`       | `window.player.current` grows ≥ 0.5s after clicking our play button; `_diag().paused === false`                                                                                                                             |
| `demo-overlays mounts`                  | `__vpDemoStatus === "demo overlay controller active"`; all four `#vp-slot-*` present; `#vp-demo-sidebar` visible when the config builds one                                                                                 |

**`_diag().discovery` is the most valuable signal here.** Every other check
answers "is it broken now?"; `discovery` answers "is it about to break?" A
fall-through from the `[data-vp-player]` contract or a known tag to the
capability sweep means LearningSuite already renamed the player and the runtime
is coasting on its fallback. It is recorded as a test **annotation**, not a
failure — it should generate a ticket, not a red build.

Two deliberate non-assertions:

- **Chrome-hiding is `count === 0 || hidden`, paired with a positive check.** A
  bare `toBeHidden()` passes perfectly on a page where our runtime never ran.
  The positive assertion that our own controls are visible is what makes the
  absence check mean anything.
- **The demo test skips at run time** when `demo-overlays.js` never ran, because
  whether an arbitrary lesson carries demo config cannot be known in advance. A
  skip is honest; a demo assertion that passes because nothing was there is not.

No screenshot baselines. LearningSuite can restyle at any time and pixel
baselines would churn until everyone ignored the alert. Trace, video and
screenshot are retained on failure only.

---

## Preview (PR) mode

Set `E2E_RUNTIME_BASE_URL` and the run switches from "test the deployed bundle"
to "test this PR's bundle on the real host page":

```bash
E2E_RUNTIME_BASE_URL=https://<preview>.vercel.app \
VERCEL_AUTOMATION_BYPASS_SECRET=… \
bun run e2e
```

The value may be a deployment origin or a full script URL; it is completed to
`…/runtime/loader.js` and given the bypass secret as a query parameter, because
`getRuntimeBaseUrl()` reads the override as a _script_ URL
(`new URL(".", scriptUrl)`) and the loader copies its own query string onto every
child bundle URL. Every `/runtime/*.js` request is then re-fetched from the
preview and fulfilled; a non-200 fails with a labelled error rather than letting
Vercel's 401 HTML run as JavaScript.

Note that this also points the kill-switch and telemetry relays at the preview
deployment. Intended — but it means a preview whose `/api/runtime-config` is
unreachable still runs (the kill-switch fails open), so a green PR run does not
prove the relay works.

---

## CI

`.github/workflows/e2e-canary.yml`, three triggers, one job:

- `schedule` (`0 6 * * *`) — the drift canary, against production, default fixtures.
- `workflow_dispatch` — with optional `target` and `video` inputs.
- `deployment_status` — the PR path, in preview mode, guarded so it never runs
  against a Production deployment.

Failures upload `playwright-report/` and `test-results/` and POST a compact alert
to `RUNTIME_ALERT_WEBHOOK_URL`. That is the same sink the runtime's own failure
beacons use, so **a canary failure and a runtime failure can arrive together**;
the payload carries `"source": "e2e-canary"` to tell them apart.

Two things to know:

- The canary is **not** part of `build-and-deploy` and must never gate a deploy.
- GitHub disables `schedule` triggers on repositories with no activity for 60
  days. A silent canary is not a green one — `workflow_dispatch` always works.

```bash
gh workflow run e2e-canary.yml && gh run watch
gh workflow run e2e-canary.yml -f target=<lesson-url> && gh run watch
# `-f video=N` and course targets are unsupported on this tenant — see "The two parameters"
```

---

## Reading a failure

```bash
bun run e2e:report     # opens the HTML report: trace, video, screenshot, diag.json
```

`diag.json` is attached to **every** test, passing or failing — it is the record
of what the runtime saw.

| Symptom                                            | Likely cause                                                                                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"reskin disabled by kill-switch"`                 | Someone flipped Edge Config `runtimeConfig.enabled`. Not a breakage                                                                                |
| `discovery === "none"` / no `[data-vp-reskinned]`  | LearningSuite renamed or removed the player element                                                                                                |
| `discovery` fell back to the capability sweep      | LS renamed the tag but a `<video>` is still reachable — fix it before it degrades further                                                          |
| Our controls visible **and** native chrome visible | The chrome-hiding CSS selectors no longer match LS markup                                                                                          |
| No `.vp-shell` but the native player is fine       | `attach()` rolled back — the safety net worked; read the telemetry beacon                                                                          |
| `__vpReskinStatus` never set                       | **A deployed bundle older than the global** (the live cause — see Status), or the bundle never loaded: CSP, a 404, the loader's gate never passing |
| Reskin **and** demo both fail on one lesson        | The lesson's `[data-vp-config]` was removed by an editor. One cause, two red tests — expected                                                      |
| Login setup fails                                  | Test account locked, password rotated, or MFA newly enforced                                                                                       |
| `_diag() returned an unexpected shape`             | Same stale-bundle cause: the deployed `_diag()` predates the field the schema requires (e.g. `discovery`)                                          |
| `no resolved targets` / `specKey` mismatch         | `playwright test` was run directly — use `bun run e2e`                                                                                             |
| `course not found`, candidates listed              | The name changed or is ambiguous — pass the id or the URL instead                                                                                  |
| `--video=N out of range (1..T)`                    | Cannot occur on this tenant (course targets unsupported). Elsewhere: reordered or shortened course — indices are positional, not stable ids        |
| One video red, the rest green                      | Lesson-specific: config removed by an editor, or a broken/expired source for that lesson                                                           |
| Preview bundle fetch failed: 401                   | `VERCEL_AUTOMATION_BYPASS_SECRET` missing, wrong, or rotated                                                                                       |
| Playback never advances, `readyState < 2`          | The media never loaded: expired signed manifest, CDN, or a missing codec (bundled Chromium?)                                                       |
