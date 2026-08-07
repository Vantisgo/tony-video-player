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

## The two parameters

The suite takes two inputs. Both are optional; empty means the sensible default.

| Parameter  | Flag                                  | Env var      | Accepts                                                                             | Empty means                                             |
| ---------- | ------------------------------------- | ------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **target** | `--course=X` / `--lesson=X` (aliases) | `E2E_TARGET` | A course or lesson as a full URL, a LearningSuite id/slug, or a visible course name | The committed default fixtures — what the schedule runs |
| **video**  | `--video=N`                           | `E2E_VIDEO`  | 1-based index into the target course's ordered video lessons                        | **All** videos in that course                           |

```bash
bun run e2e                                   # default fixtures (what the schedule runs)
bun run e2e --course="Onboarding"             # every video in that course, by name
bun run e2e --course=abc123 --video=4         # only the 4th video, by course id/slug
bun run e2e --lesson=https://…/student/course/…  # a single lesson by URL
E2E_TARGET=abc123 E2E_VIDEO=4 bun run e2e     # the same thing via env (what CI uses)
```

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
account — do not raise it). A large course takes a while; use `--video=N` for a
fast re-check. The schedule runs the two-lesson defaults, not a whole course.

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

## Outstanding prerequisites (Task 1) — step by step

The harness is complete and typechecks, but it has never run against
LearningSuite. These facts are recorded nowhere in this repo and cannot be
guessed: the login form's real selectors, which lessons to use as fixtures, and
how a course page lists its lessons. Work through the steps below in order —
each one ends with something concrete written down or committed.

Progress checklist (details in the numbered steps):

- [ ] 1. Chrome installed
- [ ] 2. Test account confirmed (no MFA)
- [ ] 3. Login form recorded → `auth.setup.ts` locators replaced
- [ ] 4. Course + curriculum DOM recorded → URL shapes and paths written down
- [ ] 5. Two fixture lessons chosen → `e2e/fixtures/lessons.ts` filled in
- [ ] 6. A course with ≥ 3 videos picked → recorded below
- [ ] 7. `.env.local` written → first green local run
- [ ] 8. Vercel bypass secret (only if you want the PR job)
- [ ] 9. CI variables and secrets added → `workflow_dispatch` run green
- [ ] 10. Plan markers flipped to `[x]`

---

### Step 1 — Install Chrome

```bash
bunx playwright install --with-deps chrome
```

Needs sudo, so run it in a terminal that can prompt for a password (in Claude
Code, prefix it with `!`). On WSL2 the `--with-deps` part installs system
libraries the browser needs.

Chrome is required **for running the suite** (codecs). It is _not_ required for
Steps 3–4: recording selectors works fine with bundled Chromium, so you can start
recording before this finishes:

```bash
bunx playwright install chromium   # no sudo needed
```

### Step 2 — Confirm the test account

You need a dedicated LearningSuite account, **not** a real person's — it will
accumulate watch progress on everything the canary opens.

`docs/learningsuite-enrichment-research.md` used `test@cgoebel.net` on
`robbins.greator.com`. Either recover that password or create a fresh
account, then check by hand, in a normal browser:

- Logging in needs **only** email + password. If it sends a code or asks for an
  authenticator, stop — this suite cannot answer an MFA prompt, and the account
  needs MFA disabled before anything else here will work.
- The account can open the lessons you intend to use as fixtures.

Write the address into `.env.local` in Step 7. Never commit it.

### Step 3 — Record the login form with codegen

**Why:** `e2e/support/auth.setup.ts` currently uses resilient _guesses_ —
`getByLabel(/e-?mail/i).or(input[type="email"])` and similar, marked
`TODO(Task 1)`. They may well work, but nobody has watched them work. Codegen
replaces the guess with what the tenant actually renders.

#### 3a. Check you can open a browser window

Codegen is interactive: it opens a real browser window plus the Playwright
Inspector. On WSL2 that needs a display.

**On this dev machine it already works — nothing to install or configure.**
WSLg is active and a headed Chromium was verified to launch (2026-08-07):
`DISPLAY=:0`, `WAYLAND_DISPLAY=wayland-0`, `/mnt/wslg` mounted. Skip to 3b.

WSLg ships with WSL 2 on Windows 11 (and Windows 10 22H2 with a current WSL); it
is not a package you install inside the distro, which is why there is nothing to
do here. To re-check on another machine:

```bash
echo $DISPLAY                       # expect :0 — empty means no display
ls -d /mnt/wslg && ls /tmp/.X11-unix # WSLg mount + X socket
```

If it is missing, `wsl --update` from PowerShell then `wsl --shutdown` gets it on
a supported Windows. Failing that: run codegen from a terminal on the Windows
host instead, start an X server (VcXsrv/X410) and export `DISPLAY`, or skip
codegen entirely and use the DevTools route in 3d below.

> Codegen does not need Chrome — bundled Chromium records selectors perfectly
> well, and codecs are irrelevant while recording. So Step 3 and Step 4 can be
> done before Step 1 finishes.

#### 3b. Record

```bash
bunx playwright codegen https://robbins.greator.com
```

Two windows open: the browser, and the **Playwright Inspector** showing generated
code as you click. The output language defaults to `playwright-test` (TypeScript
in the `@playwright/test` style), which is what this codebase uses — no change
needed. The Inspector's toolbar has a picker if you ever want another, and
`--target=<language>` sets it from the command line.

In the browser window, do exactly the login journey and nothing else:

1. Navigate to the login page if the start URL did not land there. **Write down
   the path** — that is `E2E_LS_LOGIN_PATH` (the code defaults to `/login`).
2. Dismiss the cookie/consent banner, if one appears.
3. Click the email field, type the address.
4. Click the password field, type the password.
5. Click the submit button.
6. Wait for the page you land on, then click one element that only exists when
   logged in (a course tile, an avatar menu). That click is how you capture a
   reliable "logged in" signal.
7. Note the URL you landed on and the path of the course list — that is
   `E2E_LS_COURSES_PATH` (the code defaults to `/student`).

Then stop the recorder and copy the generated code out of the Inspector.

#### 3c. Transfer it into `auth.setup.ts`

Open `e2e/support/auth.setup.ts` and replace the three `.or(...)` chains with the
recorded locators.

> **Delete the password from the pasted code.** Codegen writes what you typed as
> a plain string literal. It must become `e2eEnv.E2E_LS_PASSWORD` — a committed
> credential is the one mistake here that cannot be undone by an edit.

```ts
// before (a guess)
const email = page
  .getByLabel(/e-?mail/i)
  .or(page.locator('input[type="email"]'))
  .or(page.locator('input[name="email" i]'))
  .first();

// after (recorded) — an example of the shape, not the answer
const email = page.getByRole("textbox", { name: "E-Mail" });
```

Do the same for `password` and `submit`, and for `consent` if a banner appeared.
Then delete the `TODO(Task 1)` comment at the top of the file.

Two rules when choosing among what codegen offers:

- **Prefer `getByRole` / `getByLabel` / `getByPlaceholder`** over anything with a
  generated class name. LearningSuite's class names churn; roles and labels are
  tied to what a user sees.
- **Reject anything with `.nth(3)`, a long `div > div > div` chain, or a hashed
  class** (`.css-1x2y3z`). If codegen only offers that, keep the structural
  fallback that is already in the file — it is more honest than a brittle
  recording.

You do **not** need to copy the post-login navigation. `auth.setup.ts` already
verifies the session by requesting an authenticated page and checking it is not
bounced back to login, which is more robust than asserting one specific element.

#### 3d. If codegen cannot open a window

Log in manually in a normal browser, open DevTools, and read the same three
controls off the Elements panel: the accessible name (what a label or
`aria-label` says) and the input `type`/`name`. Write the locators by hand using
`getByLabel(...)` / `getByRole("textbox", { name: ... })`. Slower, same result.

### Step 4 — Record the course and curriculum DOM

**Why:** name-based targets (`--course="Onboarding"`) scrape the course list, and
course targets enumerate the curriculum. Both need to know what those pages look
like.

Record with a logged-in session so you do not log in twice:

```bash
# save a session (log in once in the window that opens, then close it)
bunx playwright codegen --save-storage=e2e/.auth/codegen.json https://robbins.greator.com

# reuse it for every later recording — opens already logged in
bunx playwright codegen --load-storage=e2e/.auth/codegen.json https://robbins.greator.com
```

`e2e/.auth/` is gitignored, so that file never leaves your machine. It is a live
session — treat it like the password.

With the Inspector open, use **Pick locator** in its toolbar and hover the page
elements. Write the answers down here:

| Question                                                               | Your answer |
| ---------------------------------------------------------------------- | ----------- |
| Course-list path (the page listing all courses)                        |             |
| Course URL shape (e.g. `/student/course/<slug>`)                       |             |
| Lesson URL shape (research says `/student/course/<slug>/<m>/<l>/<t>`)  |             |
| Are curriculum sections collapsed by default?                          |             |
| Is the lesson list paginated / behind "load more"?                     |             |
| How is a **video** lesson visually distinguished from a non-video one? |             |

The first three go into `.env.local` (`E2E_LS_COURSES_PATH`) and into
`COURSE_PATH_PREFIX` in `e2e/support/resolve.setup.ts` if the shape differs from
`/student/course`.

The last three matter for correctness, not convenience:

- **Collapsed or paginated** → `expandEverything()` in `resolve.setup.ts` clicks
  everything with `aria-expanded="false"` plus common "load more" buttons. If
  LearningSuite uses neither, add the real control there. A half-rendered
  curriculum silently renumbers every video, which changes what `--video=N` means.
- **A video badge/icon exists** → this is the one optional win. `resolve.setup.ts`
  currently decides "is this a video lesson?" by opening each candidate lesson and
  probing for a player element (`hasPlayer()`, marked `TODO(Task 1)`). That is
  correct but costs one page load per lesson. If video rows are marked on the
  course page, replace `hasPlayer()` with that locator and the resolve phase
  becomes a single query.

### Step 5 — Choose the two fixture lessons

These are the default targets — what the scheduled canary tests when nobody
passes a parameter. **`e2e/fixtures/lessons.ts` is currently empty**, so until
this step is done `bun run e2e` with no parameters fails with "No default lessons
are configured". Parameterised runs (`--course=…`, `--lesson=…`) work regardless.

It is empty rather than pre-filled because the only lesson URL this repo has ever
recorded is on the **old** tenant (`vantisgo.learningsuite.io`, from the POC in
`docs/learningsuite-enrichment-research.md`), and the suite now targets
`robbins.greator.com`. That path is kept in the file as a commented example of
the shape; pointing the canary at it would produce a "no player element" failure
that reads like a runtime regression.

Open a candidate lesson while logged in and run this in the DevTools console:

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

Pick two lessons that between them cover **both** shapes — `light-dom-slotted`
(a `<video>` slotted into `<slot name="media">`) and `shadow-dom` (a `<video>`
inside the host's shadow root). The shape is LearningSuite's choice, not an
authoring option, so both must be _found_.

Then edit `e2e/fixtures/lessons.ts` and add two entries, uncommenting the example
as a starting point. Each needs `name`, `path` (a path under the base URL, not a
full URL), the `domShape` you measured, and `why` it was chosen.

> If only one shape exists on this tenant, commit two fixtures anyway (two
> different lessons) and note the gap here. Do not invent a URL for the missing
> shape — an absent fixture is visible, a wrong one looks like a runtime failure.

Prefer hidden/internal lessons: the test account really watches this video, and
LearningSuite records the progress.

### Step 6 — Pick a course with ≥ 3 video lessons

Needed to exercise `--video=N` and the all-videos path in Step 7. Record it here
so the next person does not have to hunt:

|                                                                                |     |
| ------------------------------------------------------------------------------ | --- |
| Exercise course name                                                           |     |
| Exercise course id/slug                                                        |     |
| Number of video lessons                                                        |     |
| Is the order stable? (does LearningSuite reorder, or personalise per learner?) |     |

The last row changes what the docs can promise: `--video=N` is a position in
_today's_ curriculum. If the order moves, say so — anyone needing stability
passes the lesson URL instead.

### Step 7 — Write `.env.local` and run it

```bash
cat > .env.local <<'ENV'
E2E_LS_BASE_URL=https://robbins.greator.com
E2E_LS_EMAIL=…
E2E_LS_PASSWORD=…
# only if Step 3/4 found different paths:
# E2E_LS_LOGIN_PATH=/login
# E2E_LS_COURSES_PATH=/student
ENV

bun run e2e                                  # the default fixtures
```

Then walk the parameter matrix, using the course from Step 6:

```bash
bun run e2e --course=<id>              # one test group per video, numbered 1..total
bun run e2e --course=<id> --video=2    # exactly one — cross-check it is the lesson
                                       # the run above labelled "2/total"
bun run e2e --course="<name>"          # same course, resolved by name
bun run e2e --lesson=<lesson-url>      # a single lesson
bun run e2e --course=<id> --video=999  # must exit non-zero, naming the valid range
bun run e2e --course="<nonsense>"      # must exit non-zero, listing candidates
bun run e2e --video=2                  # must exit non-zero: --video needs --course
bunx playwright test --project=canary  # must refuse with the specKey mismatch message
```

The `--video=2` cross-check is the one that actually proves the index semantics —
it is what catches an off-by-one or a non-video row sneaking into the count.

Failures: `bun run e2e:report` opens the HTML report with trace, video, screenshot
and the attached `diag.json`. The decision table at the bottom of this document
maps symptoms to causes.

### Step 8 — Vercel bypass secret (only for the PR job)

Skip this if you only want the scheduled canary.

1. Vercel → Project Settings → **Deployment Protection** → enable **Protection
   Bypass for Automation**, copy the generated secret.
2. Store it as the `VERCEL_AUTOMATION_BYPASS_SECRET` repository secret.
3. Verify locally against a real preview deployment:

   ```bash
   E2E_RUNTIME_BASE_URL=https://<preview>.vercel.app \
   VERCEL_AUTOMATION_BYPASS_SECRET=… \
   bun run e2e
   ```

   Confirm the preview bundle actually executed — check `window.__vpRuntimeInfo.build`
   in the trace, or that the run annotates `preview bundle: …`. A 401 fails with a
   labelled error rather than letting Vercel's HTML run as JavaScript.

### Step 9 — CI

Add these in the repository settings:

| Kind         | Name                                               |
| ------------ | -------------------------------------------------- |
| **Variable** | `E2E_LS_BASE_URL`                                  |
| Variable     | `E2E_LS_LOGIN_PATH` (if not `/login`)              |
| Variable     | `E2E_LS_COURSES_PATH` (if not `/student`)          |
| **Secret**   | `E2E_LS_EMAIL`                                     |
| Secret       | `E2E_LS_PASSWORD`                                  |
| Secret       | `VERCEL_AUTOMATION_BYPASS_SECRET` (Step 8)         |
| Secret       | `RUNTIME_ALERT_WEBHOOK_URL` (probably already set) |

Then:

```bash
gh workflow run e2e-canary.yml && gh run watch                      # defaults
gh workflow run e2e-canary.yml -f target=<id> -f video=2 && gh run watch
```

Finally, break one assertion locally on purpose and confirm the artifacts and the
webhook alert behave — then revert. **Tell whoever watches the alert sink first**:
a deliberate failure fires a real webhook POST.

### Step 10 — Close out Task 1

Mark the plan's Task 1 and Task 16 `[x]` in
`.claude/PRPs/plans/2026-07-27_e2e-canary_learningsuite-overlay-playwright.plan.md`,
along with Tasks 5, 6, 9, 11, 13 and 14 (currently `[wip]` — their code is
complete, only their live validation was outstanding). Then the plan can be
archived to `plans/completed/`.

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
gh workflow run e2e-canary.yml -f target=<id> -f video=2 && gh run watch
```

---

## Reading a failure

```bash
bun run e2e:report     # opens the HTML report: trace, video, screenshot, diag.json
```

`diag.json` is attached to **every** test, passing or failing — it is the record
of what the runtime saw.

| Symptom                                            | Likely cause                                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `"reskin disabled by kill-switch"`                 | Someone flipped Edge Config `runtimeConfig.enabled`. Not a breakage                           |
| `discovery === "none"` / no `[data-vp-reskinned]`  | LearningSuite renamed or removed the player element                                           |
| `discovery` fell back to the capability sweep      | LS renamed the tag but a `<video>` is still reachable — fix it before it degrades further     |
| Our controls visible **and** native chrome visible | The chrome-hiding CSS selectors no longer match LS markup                                     |
| No `.vp-shell` but the native player is fine       | `attach()` rolled back — the safety net worked; read the telemetry beacon                     |
| `__vpReskinStatus` never set                       | The bundle never loaded: CSP, a 404, or the loader's gate never passing                       |
| Reskin **and** demo both fail on one lesson        | The lesson's `[data-vp-config]` was removed by an editor. One cause, two red tests — expected |
| Login setup fails                                  | Test account locked, password rotated, or MFA newly enforced                                  |
| `no resolved targets` / `specKey` mismatch         | `playwright test` was run directly — use `bun run e2e`                                        |
| `course not found`, candidates listed              | The name changed or is ambiguous — pass the id or the URL instead                             |
| `--video=N out of range (1..T)`                    | The course was reordered or a video removed; indices are positional, not stable ids           |
| One video red, the rest green                      | Lesson-specific: config removed by an editor, or a broken/expired source for that lesson      |
| Preview bundle fetch failed: 401                   | `VERCEL_AUTOMATION_BYPASS_SECRET` missing, wrong, or rotated                                  |
| Playback never advances, `readyState < 2`          | The media never loaded: expired signed manifest, CDN, or a missing codec (bundled Chromium?)  |
