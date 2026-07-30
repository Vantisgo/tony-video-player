# E2E Overlay Canary — Decisions

Decisions taken 2026-07-27 for verifying that the injected runtime
(`reskin-player` + `demo-overlays`) still mounts and works on the real,
auth-gated LearningSuite instance (`vantisgo.learningsuite.io`).

Implementation plan: `.claude/PRPs/plans/2026-07-27_e2e-canary_learningsuite-overlay-playwright.plan.md`

| #   | Question            | Decision                                                                                                   |
| --- | ------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | LearningSuite login | Email + password, no MFA → scriptable login                                                                |
| 2   | Test content        | Dedicated hidden test lesson(s) on the live instance                                                       |
| 3   | Bundle under test   | The deployed bundle loaded by LearningSuite's own script tag                                               |
| 4   | Execution mode      | Scheduled canary against prod **and** a PR-time run                                                        |
| 5   | PR-time bundle      | Redirect the `/runtime/*.js` request to the PR's Vercel preview deployment                                 |
| 6   | Assertions          | Mount markers + status strings; custom controls visible / native chrome hidden                             |
| 7   | Tool                | Playwright (separate config; vitest stays hermetic)                                                        |
| 8   | Playback depth      | Muted short playback in real Chrome (`channel: "chrome"`) — assert `currentTime` advances                  |
| 9   | Credentials         | `.env.local` locally + GitHub Actions secrets; setup project logs in once per run and saves `storageState` |
| 10  | Canary host         | GitHub Actions `schedule` + the existing `RUNTIME_ALERT_WEBHOOK_URL` sink for alerts                       |
| 11  | Coverage            | `reskin-player` + `demo-overlays`, 2 lessons (`admin-toggle` excluded — editor-only)                       |
| 12  | Visual checks       | DOM/visibility assertions; trace + video + screenshot retained on failure only (no screenshot baselines)   |

## Rationale worth keeping

- **No screenshot baselines.** LearningSuite is a third party that can restyle its
  page at any time; pixel baselines would churn and train everyone to ignore the
  alert. DOM/visibility assertions fail only on things that actually matter.
- **Chrome channel, not bundled Chromium.** Bunny HLS is H.264/AAC; Playwright's
  bundled Chromium may not carry those proprietary codecs. `channel: "chrome"`
  removes the question.
- **`window.player._diag().discovery` is the sharpest drift signal.** It reports
  which discovery strategy matched. A silent fall-through from the `[data-vp-player]`
  contract / known tags to the capability sweep means LearningSuite renamed the
  player — that is exactly the drift this canary exists to catch, and it is
  invisible to any other assertion.
- **The kill-switch can fail the canary.** `__vpReskinStatus` becomes
  `"reskin disabled by kill-switch"`, not an error. Surface the status verbatim so
  an intentional flip never reads as a breakage.

## Required environment

Not committable as a `.env.example` — `.gitignore` ignores `.env*`.

| Var                               | Where                        | Purpose                                                               |
| --------------------------------- | ---------------------------- | --------------------------------------------------------------------- |
| `E2E_LS_BASE_URL`                 | `.env.local` + repo variable | e.g. `https://vantisgo.learningsuite.io`                              |
| `E2E_LS_EMAIL`                    | `.env.local` + repo secret   | Dedicated test account (never a real person's)                        |
| `E2E_LS_PASSWORD`                 | `.env.local` + repo secret   | "                                                                     |
| `E2E_RUNTIME_BASE_URL`            | PR job only                  | Vercel preview base to redirect `/runtime/*.js` to                    |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | PR job only                  | Preview deployments are protected; without this the bundle fetch 401s |

## Open operational prerequisites

- Two hidden test lessons must exist with `<pre data-vp-config>`; the two player
  DOM shapes (light-DOM slotted `<video>` vs shadow-DOM `<video>`) are chosen by
  LearningSuite, so both must be _found_, not authored.
- Vercel **Protection Bypass for Automation** must be enabled for the PR job.
- The test account watches video for real, so LearningSuite records progress for
  it — hidden course only.
