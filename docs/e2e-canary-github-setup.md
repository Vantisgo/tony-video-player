# Making the E2E canary run automatically on GitHub

What has to happen on <https://github.com/Vantisgo/tony-video-player> before
`.github/workflows/e2e-canary.yml` runs on its own.

This is the GitHub-side companion to `docs/e2e-canary.md`. That document covers
the suite itself — parameters, assertions, fixtures, how to read a failure. This
one covers only the repository: branches, triggers, variables, secrets and the
one security change that has to land before the workflow reaches a public
default branch.

Everything below was measured against the live repository on **2026-08-27**.
Re-measure before trusting it; the point of writing it down is that none of it
was discoverable from the checked-out tree.

---

## Current state — nothing has ever run

| Fact                                                | Value                                                                  |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| GitHub Actions runs, ever                           | **0**                                                                  |
| Workflows registered with Actions                   | **none**                                                               |
| Repository **variables**                            | **0**                                                                  |
| Repository **secrets**                              | **0**                                                                  |
| Default branch                                      | `main`                                                                 |
| `main` tip                                          | `f226858` — **2026-01-20**, _"Added "7 Master Steps" Tab and Overlay"_ |
| `.github/` on `main`                                | **does not exist** (neither workflow is there)                         |
| `feature/e2e-canary-playwright` on GitHub           | **never pushed**                                                       |
| Commits on the canary branch not on GitHub's `main` | **41**                                                                 |
| Repository visibility                               | **public**                                                             |
| Forks                                               | 0                                                                      |
| Environments (created by Vercel)                    | `Preview`, `Production`                                                |

The active development remote is `molto`
(`git@vcs06.moltomedia.de:vantisgo/tony-video-player.git`). GitHub is a mirror
that stopped being updated in January 2026. Both workflow files
(`e2e-canary.yml` and `runtime.yml`) exist only on the local/`molto` side.

### Why no trigger can fire yet

`schedule` and `deployment_status` are evaluated **only from the workflow file on
the repository's default branch**. `workflow_dispatch` likewise needs the file on
the default branch before it is listed at all.

So while `e2e-canary.yml` lives on a feature branch that GitHub has never seen,
**all three triggers are inert.** There is no configuration that changes this —
the file has to reach `main`.

---

## The prerequisite nobody had written down

**The tenant's stale runtime bundle and this stale GitHub repository are the same
problem.**

The Vercel project builds from GitHub's `spike/learningsuite-enrichment-poc`
branch, and `robbins.greator.com` loads its output. That branch on GitHub:

| Property                            | Value                                                             |
| ----------------------------------- | ----------------------------------------------------------------- |
| Last commit                         | `4a638db` — **2026-07-31**, _"Add intervention active end times"_ |
| `public/runtime/reskin-player.js`   | **44,533 bytes**                                                  |
| … occurrences of `__vpReskinStatus` | **0**                                                             |
| `public/runtime/loader.js`          | **absent** (hence the 404 the canary hits)                        |

That is byte-for-byte what the tenant serves, and it is why the canary fails on a
healthy page — see `docs/e2e-canary.md` § Status for the measurement from the
browser side.

**Consequence for planning:** getting current code onto GitHub is not a
housekeeping task to do after CI is wired. It is the step that makes the canary
_capable of passing_, and it fixes the tenant bundle at the same time. Wiring
secrets first, without it, produces a correctly-configured workflow that is red
every morning.

---

## Checklist

Work these in order. Steps 1, 2 and 5 are prerequisites for a green run; step 3
needs someone with admin rights.

- [ ] 1. Sync GitHub `main` and land the canary branch
- [ ] 2. Update the branch Vercel builds (fixes the tenant bundle)
- [ ] 3. Add 3 variables + 4 secrets — **needs repo admin**
- [ ] 4. Confirm Actions is enabled — **needs repo admin**
- [ ] 5. Fix the `deployment_status` trigger **before** the workflow reaches a public `main`
- [ ] 6. First run via `workflow_dispatch`, green
- [ ] 7. Let the schedule run, and confirm it actually fired
- [ ] 8. Verify the failure path (artifacts + webhook alert) once, deliberately

---

### Step 1 — Sync `main` and land the canary branch

GitHub's `main` is 41 commits and seven months behind. Bringing it forward is a
decision about repository topology, not a mechanical push, so it belongs to
whoever owns the `molto` ↔ GitHub relationship:

- Is GitHub meant to be a full mirror of `molto`, or only the branch Vercel
  builds? Today it is neither consistently.
- If it stays a mirror, what keeps it in sync — a push target on every release, or
  a scheduled mirror job? A mirror that silently stops is exactly what produced
  the stale bundle.

Whatever the answer, `e2e-canary.yml` has to end up on `main` for the triggers to
exist. Until then only a manual `gh workflow run` against an explicitly named ref
is possible, and even that requires the file to be present on the default branch
first.

> `runtime.yml` is also absent from GitHub. It is independent of the canary — it
> only checks `public/runtime/` against `runtime-src/` — but it is the check that
> would have caught the committed bundles drifting, so it is worth landing in the
> same pass.

### Step 2 — Update the branch Vercel builds

The canary asserts on `__vpReskinStatus`, `__vpDemoStatus` and
`_diag().discovery`. None of them exist in the bundle currently deployed, so the
suite cannot pass until a current build is live and the tenant loads it.

Two sub-decisions, both outside this repository:

1. **Which branch should Vercel build?** Continuing to build
   `spike/learningsuite-enrichment-poc` means keeping a spike branch
   production-critical. Repointing at `main` is cleaner but only once step 1
   makes `main` current.
2. **What does the tenant's global script slot load?** It currently carries the
   pre-loader three-tag snippet (`reskin-player.js`, `demo-overlays.js`,
   `admin-toggle.js`). The current runtime is designed around a single
   `loader.js` tag, and preview mode (`E2E_RUNTIME_BASE_URL`) normalises its
   input to a loader URL — so the slot should move to the one-line loader form.

Neither is a GitHub setting, but the canary cannot go green until both are done,
which is why they sit here rather than at the end.

### Step 3 — Variables and secrets (needs admin)

Reading these requires no special rights; **creating them requires `admin`**.
An account with `maintain` cannot do it — verified: the `mm-vanver` account holds
`{admin: false, maintain: true, push: true}` and so cannot complete this step.

| Kind         | Name                              | Value                                        |
| ------------ | --------------------------------- | -------------------------------------------- |
| **Variable** | `E2E_LS_BASE_URL`                 | `https://robbins.greator.com`                |
| **Variable** | `E2E_LS_LOGIN_PATH`               | `/auth`                                      |
| **Variable** | `E2E_LS_COURSES_PATH`             | `/student/courses`                           |
| **Secret**   | `E2E_LS_EMAIL`                    | the dedicated test account                   |
| **Secret**   | `E2E_LS_PASSWORD`                 | "                                            |
| **Secret**   | `VERCEL_AUTOMATION_BYPASS_SECRET` | Vercel → Deployment Protection (PR job only) |
| **Secret**   | `RUNTIME_ALERT_WEBHOOK_URL`       | the runtime's existing alert sink            |

```bash
gh variable set E2E_LS_BASE_URL     --body "https://robbins.greator.com" --repo Vantisgo/tony-video-player
gh variable set E2E_LS_LOGIN_PATH   --body "/auth"                       --repo Vantisgo/tony-video-player
gh variable set E2E_LS_COURSES_PATH --body "/student/courses"            --repo Vantisgo/tony-video-player

gh secret set E2E_LS_EMAIL                    --repo Vantisgo/tony-video-player
gh secret set E2E_LS_PASSWORD                 --repo Vantisgo/tony-video-player
gh secret set VERCEL_AUTOMATION_BYPASS_SECRET --repo Vantisgo/tony-video-player
gh secret set RUNTIME_ALERT_WEBHOOK_URL       --repo Vantisgo/tony-video-player
```

Three things that are easy to get wrong here:

- **`E2E_LS_LOGIN_PATH` and `E2E_LS_COURSES_PATH` are mandatory in CI**, despite
  being listed as optional in `docs/e2e-canary.md`. "Optional" there means the
  code has a default; both defaults (`/login`, `/student`) are **wrong for this
  tenant**, so a run without them fails at login or at course resolution.
- **`E2E_LS_EMAIL` must not be a real person's account.** The account currently
  in local `.env.local` is a personal **admin** account: it accrues watch
  progress on every lesson the canary opens, and `admin-toggle.js` mounts extra
  markup for it, so the canary would assert against a DOM no learner sees. See
  `docs/e2e-canary.md` § Step 2.
- **Never commit the bypass secret.** It is currently readable by any logged-in
  learner from the tenant's page source, so it should be rotated when the script
  slot is next edited. Read it from Vercel or the tenant page — not from a file
  in this repository, where it must never appear.

### Step 4 — Confirm Actions is enabled (needs admin)

`GET /repos/Vantisgo/tony-video-player/actions/permissions` returns **403** for a
non-admin token, so whether Actions is enabled could not be verified from
outside. With 0 runs ever recorded, it has certainly never been exercised.

An admin should confirm, under **Settings → Actions → General**:

- Actions are **allowed** for this repository.
- The allowed-actions policy permits `actions/checkout`,
  `oven-sh/setup-bun` and `actions/upload-artifact` (all three are used).
- Workflow permissions are whatever the org standard is — the canary needs no
  write scope on `GITHUB_TOKEN`.

### Step 5 — Fix the `deployment_status` trigger before it reaches a public `main`

**Do this before step 1 lands the workflow, not after.** On a public repository
the trigger as written is a credential-exfiltration path.

`e2e-canary.yml` guards `deployment_status` on the deployment's **state** and
**environment name** only:

```yaml
if: >-
  github.event_name != 'deployment_status' ||
  (github.event.deployment_status.state == 'success' &&
   github.event.deployment_status.environment != 'Production' &&
   github.event.deployment_status.environment != 'production')
```

Nothing there checks **provenance**. The sequence:

1. Anyone forks the public repository and opens a pull request.
2. Vercel builds a preview → environment `Preview`, state `success` → **the guard
   passes**.
3. `deployment_status` is a base-repository event, so the job runs **with the
   real secrets** — `E2E_LS_PASSWORD` and `RUNTIME_ALERT_WEBHOOK_URL` are in the
   environment.
4. `E2E_RUNTIME_BASE_URL` is set from the fork's `environment_url`, so the canary
   fetches `/runtime/*.js` from an attacker-controlled deployment and injects it
   into the real tenant page **while logged in as the test account**.
5. On this event `github.sha` resolves to the deployment's commit — the fork's —
   so `actions/checkout@v4` followed by `bun install` and `bun run e2e` can
   execute fork-authored code with those secrets in scope.

Steps 3 and 4 alone are enough to matter; step 5 makes it worse. `deployment_status`
is on GitHub's own list of dangerous triggers for exactly this reason, alongside
`pull_request_target` and `workflow_run`. There are 0 forks today, which is not a
control.

Three ways out, in increasing order of effort:

| Option                                                                             | Effect                                                                                                                      |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Drop the `deployment_status` trigger**                                           | Keeps `schedule` + `workflow_dispatch`, which is the drift canary the feature was justified by. Loses PR-time preview runs. |
| **Add a same-repository provenance guard**                                         | Keeps the PR job for internal branches; requires asserting the deployment's ref/SHA belongs to this repository, not a fork. |
| **Gate the job behind the existing `Preview` environment with required reviewers** | A human approves each preview run before secrets are exposed. Highest friction, strongest guarantee.                        |

Given the PR job has never run and its flake rate is unknown, dropping the
trigger and reinstating it deliberately is the cheapest safe path.

### Step 6 — First run via `workflow_dispatch`

Once steps 1–5 are done and a current bundle is live:

```bash
gh workflow run e2e-canary.yml --repo Vantisgo/tony-video-player && gh run watch
```

Then a targeted run. Note the parameter restriction: on this tenant only lesson
URLs work — course targets and `--video=N` are unsupported, because the
curriculum rows are not links. See `docs/e2e-canary.md` § Step 4.

```bash
gh workflow run e2e-canary.yml -f target=<lesson-url> --repo Vantisgo/tony-video-player && gh run watch
```

A run with no inputs exercises the committed default fixtures in
`e2e/fixtures/lessons.ts`. That file is **currently empty**, so a no-input run
fails with _"No default lessons are configured"_ until the fixtures are filled in
— which is itself blocked on step 2.

### Step 7 — Let the schedule run, then confirm it fired

The cron is `0 6 * * *` — 06:00 UTC daily, against the deployed bundle and the
default fixtures.

Two scheduling facts worth knowing before relying on it:

- **GitHub disables scheduled workflows after 60 days of repository inactivity.**
  This repository has been inactive for seven months, so it will hit this rule
  unless GitHub-side activity becomes routine. A silent canary is not a green
  one.
- **Scheduled runs are queued, not punctual.** Delays of tens of minutes are
  normal on shared runners; do not treat a late run as a failure.

Confirm the first scheduled run actually happened rather than assuming it:

```bash
gh run list --workflow=e2e-canary.yml --event=schedule --repo Vantisgo/tony-video-player
```

### Step 8 — Verify the failure path once, deliberately

The workflow uploads `playwright-report/` and `test-results/` on any non-cancelled
outcome (14-day retention), and POSTs a compact alert to
`RUNTIME_ALERT_WEBHOOK_URL` on failure. Neither path has ever executed.

Break one assertion, push, confirm the artifact appears and the alert arrives,
then revert.

> **Tell whoever watches the alert sink first.** It is the same sink the
> runtime's own failure beacons use, so a deliberate canary failure looks like a
> production incident. The payload carries `"source": "e2e-canary"` to tell them
> apart.

An unset `RUNTIME_ALERT_WEBHOOK_URL` makes the alert step **skip**, not fail —
deliberate, so a missing webhook cannot turn a red canary into a confusing error.
The corollary is that a missing webhook is also silent, so verify it is set
rather than inferring it from a green run.

---

## Who can do what

| Task                                      | Minimum rights | `mm-vanver` can? |
| ----------------------------------------- | -------------- | ---------------- |
| Push branches, open PRs                   | `push`         | yes              |
| Read variables and secret **names**       | `maintain`     | yes              |
| **Create** variables and secrets (step 3) | **`admin`**    | **no**           |
| Read/change Actions settings (step 4)     | **`admin`**    | **no**           |
| Configure environment reviewers (step 5c) | **`admin`**    | **no**           |
| Change the Vercel source branch (step 2)  | Vercel project | outside GitHub   |

Steps 3, 4 and possibly 5 therefore need an account with admin on
`Vantisgo/tony-video-player`.

---

## Quick verification commands

Read-only; safe to re-run at any time to re-measure the table at the top.

```bash
R=Vantisgo/tony-video-player

gh api repos/$R --jq '{default: .defaultBranchRef.name, public: (.visibility=="PUBLIC"), forks: .forks_count}'
gh api repos/$R --jq '.permissions'                      # can I do step 3 at all?
gh api repos/$R/actions/workflows --jq '.workflows[].path'
gh api repos/$R/actions/runs --jq '.total_count'
gh api repos/$R/actions/variables --jq '.variables[] | "\(.name)=\(.value)"'
gh api repos/$R/actions/secrets --jq '.secrets[].name'
gh api repos/$R/contents/.github/workflows?ref=main --jq '.[].name'   # 404 = triggers inert

# Is the bundle Vercel builds current?
gh api repos/$R/contents/public/runtime?ref=spike/learningsuite-enrichment-poc --jq '.[].name'
```

---

## Related documents

- `docs/e2e-canary.md` — the suite itself: parameters, assertions, fixtures,
  the stale-bundle blocker as seen from the browser, and how to read a failure.
- `docs/e2e-overlay-canary-decisions.md` — why the canary is shaped the way it is.
- `docs/runtime-ops-setup.md` — the kill-switch and the alert relay.
- `docs/feature-context.md` — durable decisions, including the 2026-08-27
  corrections about what the tenant actually loads.
