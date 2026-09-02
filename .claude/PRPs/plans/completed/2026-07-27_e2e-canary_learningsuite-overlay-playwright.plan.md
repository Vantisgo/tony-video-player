# Feature: E2E Overlay Canary — Playwright against the live LearningSuite instance

## Summary

Stand up a Playwright suite that logs into the real, auth-gated LearningSuite
instance (`vantisgo.learningsuite.io`), opens the lessons it was pointed at, and
asserts that the injected runtime still mounts and works: `reskin-player`
reaches `__vpReskinStatus === "reskin attached"`, the host carries
`[data-vp-reskinned="true"]`, our `.vp-shell` controls are visible while the
native Mux/Vidstack chrome is not, muted playback actually advances
`currentTime`, and `demo-overlays` mounts its slots and sidebar. It runs on a
GitHub Actions schedule against production (the drift canary) and on PRs
touching `runtime-src/**` against the PR's Vercel preview bundle. Vitest stays
exactly as it is — Playwright gets its own config, its own directory, and its own
scripts.

**What gets tested is a parameter, not a constant.** The suite takes two inputs:

| Parameter                              | Accepts                                                             | Empty means                                             |
| -------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------- |
| **target** (`--course` / `E2E_TARGET`) | a course **or** lesson: full URL, LearningSuite id, or visible name | the committed default fixtures (what the schedule runs) |
| **video** (`--video` / `E2E_VIDEO`)    | 1-based index into the target course's ordered video lessons        | **all** videos in the course                            |

Because Playwright fixes its test list at collection time, a course whose video
list is only knowable after login is handled in two phases: `bun run e2e`
resolves the target (login → enumerate → `e2e/.auth/targets.json`), then runs
`playwright test`, which reads that file at collection and emits **one test per
video** — so each video gets its own pass/fail, its own retry, and its own
trace/video/screenshot.

## User Story

As a maintainer of the injected video runtime
I want an automated check that the overlay still mounts and plays on the real LearningSuite platform
So that I learn LearningSuite changed their page from a red build, not from a learner complaint

## Problem Statement

The runtime is injected into a third-party SaaS page we do not control. Every
existing check is blind to that page: `vitest` + happy-dom validates our modules
against **our own** DOM fixtures, `typecheck:runtime` validates types, and the
drift-check validates that `public/runtime/*.js` matches `runtime-src/`. None of
them can detect the failure mode that actually threatens this feature —
LearningSuite renaming `<hls-video>`, restructuring the host element so
`resolveHost()` picks a different ancestor, changing their control classnames so
the chrome-hiding CSS misses, or shipping a CSP that blocks our script. Today
that breakage surfaces only when a human opens a lesson and notices.

Testable statement of the gap: **there is no automated assertion anywhere in this
repo that executes the runtime on a `learningsuite.io` page.**

## Solution Statement

A Playwright project at `e2e/`, run by its own `playwright.config.ts`:

- A `setup` project logs in once per run with credentials from the environment
  and persists `storageState` to a gitignored `e2e/.auth/ls.json`; the test
  project declares `dependencies: ["setup"]` and `storageState`, so tests
  themselves never touch the login form.
- A `resolve` project turns the two parameters into a concrete, ordered list of
  video lesson URLs and writes `e2e/.auth/targets.json`. It runs as its own
  Playwright invocation _before_ the test invocation, because Playwright builds
  its test list by loading spec files — a file written mid-run cannot influence
  collection. `scripts/e2e.ts` sequences the two invocations behind the single
  `bun run e2e` command.
- Tests navigate to the resolved lesson URLs and let **LearningSuite's own
  script tag** load the runtime. In PR mode (`E2E_RUNTIME_BASE_URL` set) a
  `page.route("**/runtime/*.js")` handler re-fetches the bundle from the Vercel
  preview (carrying `x-vercel-protection-bypass`) and fulfils the request with
  it, plus an `addInitScript` setting `window.__vpRuntimeBaseUrl` so the
  kill-switch and telemetry relays resolve to the preview too.
- Assertions read the runtime's existing observable surface — `__vpReskinStatus`,
  `__vpDemoStatus`, `window.player._diag()`, `[data-vp-reskinned]`,
  `[data-vp="playpause"]`, `#vp-demo-sidebar` — so the tests assert contracts
  the runtime already publishes rather than inventing new hooks.
- Real Chrome (`channel: "chrome"`), muted, so Bunny's H.264/AAC HLS actually
  decodes and `currentTime` can be observed advancing.
- One workflow with three triggers: `schedule` (canary vs prod),
  `workflow_dispatch` (manual), and `deployment_status` (PR preview). Failures
  upload trace/video/screenshot and POST a compact alert to the existing
  `RUNTIME_ALERT_WEBHOOK_URL` sink.

## Metadata

| Field            | Value                                                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Type             | NEW_CAPABILITY                                                                                                                   |
| Complexity       | MEDIUM                                                                                                                           |
| Systems Affected | `e2e/` (new), `scripts/e2e.ts` (new), `playwright.config.ts` (new), `.github/workflows/` , `package.json`, `.gitignore`, `docs/` |
| Dependencies     | `@playwright/test` (latest), `dotenv` (latest), Google Chrome (via `playwright install chrome`); existing `zod@^4.3.5`           |
| Estimated Tasks  | 16                                                                                                                               |

---

## Lifecycle (append-only)

- **Created:** 2026-07-27
- **Modified:** 2026-07-27 (initial build)
- **Modified:** 2026-07-28 (parameterised target + video selection; two-phase resolve; tasks 1–12 → 1–16)
- **Modified:** 2026-08-07 (built: harness complete; Task 1 human prerequisites and Task 16 live verification outstanding)
- **Modified:** 2026-09-02 (first green live run; archived with residual verification debt — see the closing amendment)
- **Archived:** 2026-09-02 → `.claude/PRPs/plans/completed/`
- **Commits:** branch `feature/e2e-canary-playwright` (`9165f4f`, `118e890`, `a388bb8`, `85368af`, `208bce47`, + the 2026-09-02 target-variable commit)
- **Agent / Session:** claude-opus-5 / session 0d3c0d72-a581-4fbe-b9a6-8063390256c1
- **Agent / Session:** claude-opus-5[1m] / session 779c2b40-face-41b3-aa56-033283950364
- **Back refs:**
  - `docs/e2e-overlay-canary-decisions.md` — the 12 decisions this plan implements
  - `.claude/PRPs/plans/completed/2026-07-24_resilience_adaptability.plan.md` — player discovery + `_diag().discovery`, the drift signal this canary reads
  - `.claude/PRPs/plans/completed/2026-07-24_resilience_safety-net.plan.md` — the `[data-vp-reskinned="true"]` marker gate this canary asserts
  - `.claude/PRPs/plans/completed/2026-07-24_resilience_ops-telemetry.plan.md` — kill-switch + `RUNTIME_ALERT_WEBHOOK_URL` sink reused for alerting
- **Forward refs:**
  - `.claude/PRPs/plans/2026-07-28_runtime-loader_single-script-conditional-injection.plan.md` — replaces the three injected `<script>` tags with one `loader.js`. The `page.route("**/runtime/*.js")` interception and the `__vpReskinStatus` / `__vpDemoStatus` assertions still apply; the loader adds `__vpLoaderStatus` / `__vpLoaded` as further canary targets. This plan's "no changes to `runtime-src/**`" scope limit predates the loader and constrains only the canary itself; in loader mode the tenant carries `loader.js` and the canary must intercept/serve that URL too.

> **Append-only:** `Created` is set once; every other field is a list you only ever add to — never overwrite or remove existing entries. Keep references bidirectional: when you add a back/forward ref here, add the reciprocal ref on the other plan.

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   ┌──────────────┐   ┌───────────────┐   ┌──────────────┐  ┌───────────────┐  ║
║   │ runtime-src/ │──►│ vitest +      │──►│ typecheck    │─►│ drift-check   │  ║
║   │   *.ts       │   │ happy-dom     │   │ :runtime     │  │ public/runtime│  ║
║   └──────────────┘   └───────────────┘   └──────────────┘  └───────────────┘  ║
║                             │                                                 ║
║                             ▼                                                 ║
║                    OUR fixtures, OUR DOM assumptions                          ║
║                                                                               ║
║   ══════════════════════ blind spot boundary ════════════════════════════      ║
║                                                                               ║
║   ┌───────────────────────────────────────────────────────────────────┐       ║
║   │ vantisgo.learningsuite.io  (third-party SaaS, auth-gated)          │       ║
║   │   <script src="…/runtime/reskin-player.js">                        │       ║
║   │   <hls-video> ← can be renamed / restructured WITHOUT NOTICE       │       ║
║   └───────────────────────────────────────────────────────────────────┘       ║
║                             │                                                 ║
║                             ▼                                                 ║
║                 ┌───────────────────────────┐                                 ║
║                 │  a learner notices it     │  ◄── the only detector today    ║
║                 │  broke, and tells someone │                                 ║
║                 └───────────────────────────┘                                 ║
║                                                                               ║
║   USER_FLOW: push runtime change → green CI → deploy → hope                    ║
║   PAIN_POINT: zero automated coverage of the only environment that matters     ║
║   DATA_FLOW: no signal path from the live page back to the team                ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   PHASE 1 — bun run e2e [--course=X] [--video=N]  (scripts/e2e.ts)            ║
║   ┌───────────────┐        ┌────────────────────────────────────────────┐     ║
║   │ setup project │───────►│ e2e/.auth/ls.json  (storageState, ignored)  │     ║
║   │ LS login      │        └────────────────────┬───────────────────────┘     ║
║   └───────┬───────┘                             │                             ║
║           ▼                                     │                             ║
║   ┌─────────────────┐      ┌────────────────────┴───────────────────────┐     ║
║   │ resolve project │─────►│ e2e/.auth/targets.json                     │     ║
║   │ URL │ id │ name │      │  [{ index, total, title, url }, …]         │     ║
║   │ → ordered videos│      │  --video=N → 1 entry · empty → all         │     ║
║   └─────────────────┘      └────────────────────┬───────────────────────┘     ║
║                                                 │ read at COLLECTION time     ║
║   PHASE 2 — playwright test → one test PER VIDEO│                             ║
║                                                 ▼                             ║
║   ┌───────────────────────────────────────────────────────────────────┐       ║
║   │ Chrome (channel:"chrome", muted) → LS lesson page                 │       ║
║   │                                                                    │      ║
║   │  canary mode ── LS script tag loads PROD /runtime/*.js             │       ║
║   │  PR mode  ──── page.route() serves the Vercel PREVIEW bundle       │       ║
║   │                + __vpRuntimeBaseUrl → preview (relays follow)      │       ║
║   └────────────────────────────┬──────────────────────────────────────┘       ║
║                                ▼                                              ║
║        ┌───────────────────────────────────────────────────────┐              ║
║        │ ASSERT the runtime's own published surface:            │              ║
║        │  __vpReskinStatus === "reskin attached"                │              ║
║        │  [data-vp-reskinned="true"] ⊃ .vp-shell                │              ║
║        │  [data-vp="playpause"] visible / native chrome hidden  │              ║
║        │  player._diag().discovery ≠ "none"  ◄── DRIFT SIGNAL   │              ║
║        │  click play → currentTime advances                     │              ║
║        │  __vpDemoStatus + #vp-demo-sidebar + slots             │              ║
║        └──────────────────┬────────────────────────────────────┘              ║
║                           │ fail                                              ║
║              ┌────────────┴────────────┐                                      ║
║              ▼                         ▼                                      ║
║   ┌─────────────────────┐   ┌──────────────────────────────┐                  ║
║   │ trace + video +     │   │ POST → RUNTIME_ALERT_WEBHOOK │                  ║
║   │ screenshot artifact │   │ (the sink that already exists)│                  ║
║   └─────────────────────┘   └──────────────────────────────┘                  ║
║                                                                               ║
║   USER_FLOW: schedule fires → alert lands → open trace → see the real page     ║
║   VALUE_ADD: LS drift is detected by machine, on a schedule, with evidence     ║
║   DATA_FLOW: live LS page → runtime globals → assertions → alert + artifacts   ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location                                 | Before                              | After                                                               | User Impact                                          |
| ---------------------------------------- | ----------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| `bun test`                               | vitest only, hermetic               | unchanged (vitest `include` never matches `e2e/**`)                 | no new flake in the fast loop                        |
| `bun run e2e` (new)                      | did not exist                       | runs the canary locally against prod, over the default fixtures     | one command to answer "is the overlay still alive?"  |
| `bun run e2e --course=X` (new)           | did not exist                       | resolves X (URL, id or name) and tests **every** video in it        | point the canary at any course without editing code  |
| `bun run e2e --course=X --video=4` (new) | did not exist                       | tests only the 4th video of that course                             | fast re-check of the one lesson that broke           |
| PR touching `runtime-src/**`             | unit + typecheck + drift only       | plus the overlay mounting on a real LS page with the preview bundle | catches host-integration breakage before deploy      |
| GitHub Actions schedule                  | did not exist                       | daily canary vs prod, alert + artifacts on failure                  | LS drift detected without a human in the loop        |
| `RUNTIME_ALERT_WEBHOOK_URL` sink         | only receives runtime-side failures | also receives canary failures                                       | one place to watch; note double-alerting (see Risks) |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File                                            | Lines           | Why Read This                                                                                                                   |
| -------- | ----------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| P0       | `runtime-src/reskin-player/index.ts`            | 239-271         | The exact marker + shell DOM the tests assert. `dataset.vpReskinned` is set on the **resolved host**, not on the player element |
| P0       | `runtime-src/reskin-player/index.ts`            | 1200-1218       | The two possible `__vpReskinStatus` values, incl. the kill-switch string                                                        |
| P0       | `runtime-src/reskin-player/index.ts`            | 140-182         | `_diag()` shape and `window.player = api` — the richest assertion surface, already exposed                                      |
| P0       | `runtime-src/demo-overlays/index.ts`            | 88-125, 175-215 | Demo status strings and the node ids it creates                                                                                 |
| P1       | `runtime-src/reskin-player/styles.ts`           | 1-12            | Exactly which native-chrome selectors the CSS hides — the "native chrome hidden" assertion mirrors this list                    |
| P1       | `runtime-src/common/runtime-url.ts`             | all             | `__vpRuntimeBaseUrl` override — the hook the PR-mode preview redirect uses                                                      |
| P1       | `runtime-src/tests/reskin-player/index.test.ts` | 20-40           | How `<pre data-vp-config>` is authored — the shape the fixture lessons must carry                                               |
| P1       | `.github/workflows/runtime.yml`                 | all             | The CI workflow style to mirror (bun setup, path filters, step naming)                                                          |
| P2       | `env.ts`                                        | all             | The zod-env pattern to mirror — but do NOT import this module from `e2e/` (see gotcha)                                          |
| P2       | `docs/e2e-overlay-canary-decisions.md`          | all             | The 12 decisions; do not re-litigate them                                                                                       |

**External Documentation:**

| Source                                                                                                                                                          | Section                         | Why Needed                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------- |
| [Playwright — Authentication](https://playwright.dev/docs/auth)                                                                                                 | "Basic: shared account…"        | The `setup` project + `storageState` + `dependencies` pattern     |
| [Playwright — Browsers](https://playwright.dev/docs/browsers#google-chrome--microsoft-edge)                                                                     | Google Chrome channel           | Why `channel: "chrome"` is required for proprietary media codecs  |
| [Playwright — Network](https://playwright.dev/docs/network#modify-responses)                                                                                    | Modify responses                | `route.fetch()` + `route.fulfill()` for the preview-bundle swap   |
| [Playwright — Test configuration](https://playwright.dev/docs/test-configuration)                                                                               | `use`, projects, artifacts      | `trace`/`video`/`screenshot` retain-on-failure config             |
| [Playwright — CI](https://playwright.dev/docs/ci-intro)                                                                                                         | GitHub Actions                  | Browser install + artifact upload in CI                           |
| [Vercel — Protection Bypass for Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation) | Header usage                    | `x-vercel-protection-bypass` — without it the preview bundle 401s |
| [GitHub Actions — events](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule)                                            | `schedule`, `deployment_status` | Canary cron + reading `deployment_status.environment_url`         |

> These links are canonical doc pages recorded from working knowledge, not freshly
> fetched. Confirm the `@playwright/test` version's own docs during Task 2.

---

## Patterns to Mirror

**MARKER + SHELL DOM (the assertion targets):**

```typescript
// SOURCE: runtime-src/reskin-player/index.ts:239-271
// The marker goes on the RESOLVED HOST (an ancestor), not the player element.
const host = resolveHost(hlsEl);
if (!host) throw new Error("[vp] no positioning host for player");
(host as HTMLElement).dataset.vpReskinned = "true";
// …
const shell = document.createElement("div");
shell.className = "vp-shell";
shell.innerHTML = `
      <div class="vp-overlay-layer" data-vp-overlays></div>
      <div class="vp-subtitle-layer" data-vp-subtitles hidden></div>
      <div class="vp-sync-badge" data-vp-sync-drift hidden></div>
      <div class="vp-controls">
        <button data-vp="playpause" aria-label="Play/Pause">Play</button>
        <input  data-vp="seek" class="vp-seek" type="range" min="0" max="0" step="0.1" value="0" />
        <span   data-vp="time" class="vp-time">0:00 / 0:00</span>
        …
        <button data-vp="mute" aria-label="Mute">Sound</button>
        <button data-vp="fs" aria-label="Fullscreen">Full</button>
      </div>
    `;
host.appendChild(shell);
```

**STATUS STRINGS (assert these verbatim — do not invent new ones):**

```typescript
// SOURCE: runtime-src/reskin-player/index.ts:1206, 1211-1218
return "reskin attached";
// …
void (async () => {
  const status = (await shouldRun(runtimeBaseUrl))
    ? main()
    : "reskin disabled by kill-switch";
  (window as unknown as { __vpReskinStatus?: string }).__vpReskinStatus =
    status;
})();

// SOURCE: runtime-src/demo-overlays/index.ts:116-120
    return "demo: waiting for config + video";
  }
  deferAndApply(initialContext);
  return "demo: setup queued";
```

**DIAGNOSTIC SURFACE (already exposed on `window` — the drift signal):**

```typescript
// SOURCE: runtime-src/reskin-player/index.ts:161-177
    _diag: () => ({
      runtime: { build: runtimeBuild, externalAudioAutoSync: false, externalAudioWarningThresholdSec },
      hasVideo: !!videoEl,
      discovery: lastDiscovery,
      currentTime: videoEl?.currentTime,
      duration: videoEl?.duration,
      paused: videoEl?.paused,
      readyState: videoEl?.readyState,
      activeOverlays: [...activeOverlays],
      tracks: getTrackDiagnostics(videoEl),
    }),
  };
  window.player = api;
```

**NATIVE CHROME SELECTORS (what "hidden" means, verbatim from the CSS):**

```typescript
// SOURCE: runtime-src/reskin-player/styles.ts:4-10
      [data-vp-reskinned="true"] hls-video > *:not([slot="media"]) { display: none !important; }
      [data-vp-reskinned="true"] hls-video [slot="ui"], … { display: none !important; }
      [data-vp-reskinned="true"] hls-video media-controls, … media-play-button,
      … media-gesture, … media-time-display, … media-volume-slider,
      … media-time-slider, … media-fullscreen-button,
      … media-captions-button, … media-menu { display: none !important; }
      [data-vp-reskinned="true"] > [class*="PlayerControlsAbsoluteContainer"] { display: none !important; pointer-events: none !important; }
```

**DEMO NODE IDS (assert a subset of these):**

```typescript
// SOURCE: runtime-src/demo-overlays/index.ts:175-179
      "vp-slot-tl",
      "vp-slot-tr",
      "vp-slot-br",
      "vp-slot-lt",
      "vp-demo-sidebar",
```

**CONFIG AUTHORING SHAPE (what the fixture lessons must contain):**

```typescript
// SOURCE: runtime-src/tests/reskin-player/index.test.ts:21-24
const cfg = document.createElement("pre");
cfg.setAttribute("data-vp-config", "");
cfg.textContent = "{}";
document.body.appendChild(cfg);
```

**ZOD ENV VALIDATION (mirror the style; own module, no `~/env` import):**

```typescript
// SOURCE: env.ts:1-14
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    BLOB_READ_WRITE_TOKEN: z.string().min(1),
    // …
```

**CI WORKFLOW STYLE (mirror step naming + bun setup):**

```yaml
# SOURCE: .github/workflows/runtime.yml:26-44
jobs:
  runtime:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - name: Build runtime bundles
        run: bun run build:runtime
```

---

## Files to Change

| File                               | Action | Justification                                                                                                            |
| ---------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| `playwright.config.ts`             | CREATE | Root config: `setup` + `resolve` + `canary` projects, Chrome channel, muted/autoplay args, artifacts                     |
| `e2e/support/env.ts`               | CREATE | Zod-validated e2e env (trust boundary), deliberately independent of `~/env`                                              |
| `e2e/support/auth.setup.ts`        | CREATE | Logs into LearningSuite once per run, writes `e2e/.auth/ls.json`                                                         |
| `e2e/support/target.ts`            | CREATE | Parses the two parameters into a typed `TargetSpec` (URL \| id \| name, video index \| all)                              |
| `e2e/support/targets-file.ts`      | CREATE | Zod schema + read/write for `e2e/.auth/targets.json` — the contract between the two phases                               |
| `e2e/support/resolve.setup.ts`     | CREATE | The `resolve` project: navigates the target, enumerates its ordered video lessons, writes the file                       |
| `scripts/e2e.ts`                   | CREATE | Two-phase runner: parses `--course`/`--lesson`/`--video`, runs resolve then test                                         |
| `e2e/support/runtime-source.ts`    | CREATE | Canary mode = passthrough; PR mode = fulfil `/runtime/*.js` from the preview + set base URL                              |
| `e2e/support/assertions.ts`        | CREATE | `expectReskinMounted`, `expectNativeChromeHidden`, `expectPlaybackAdvances`, `expectDemoMounted`                         |
| `e2e/fixtures/lessons.ts`          | CREATE | The committed **default** lessons used when no target parameter is given (the schedule's targets)                        |
| `e2e/overlay-canary.spec.ts`       | CREATE | The spec, generated one-test-per-video from `targets.json` at collection time                                            |
| `.github/workflows/e2e-canary.yml` | CREATE | `schedule` + `workflow_dispatch` (with `target`/`video` inputs) + `deployment_status` triggers, artifacts, webhook alert |
| `docs/e2e-canary.md`               | CREATE | Operator doc: parameters, fixture setup, secrets, running it, reading a failure                                          |
| `package.json`                     | UPDATE | `@playwright/test` + `dotenv` devDeps; `e2e`, `e2e:ui`, `e2e:report` scripts                                             |
| `.gitignore`                       | UPDATE | `e2e/.auth/`, `/test-results/`, `/playwright-report/`, `/blob-report/`                                                   |
| `docs/feature-context.md`          | UPDATE | Append the decisions/gotchas entry (per project convention)                                                              |

---

## NOT Building (Scope Limits)

- **No screenshot baselines / visual diffing.** Decision 12: LearningSuite can
  restyle at will; baselines would churn. Artifacts on failure only.
- **No `admin-toggle` coverage.** Editor-only banner, and it still queries
  `hls-video` directly by design (standing constraint).
- **No subtitle-cue or voice-over-audio assertions.** Playback depth is limited
  to "clicking play makes `currentTime` advance" (Decision 8). The deeper
  scenario was explicitly considered and excluded as brittle.
- **No LearningSuite progress-tracking assertion.** Not selected in Decision 6.
  The GraphQL-mutation check remains available as a follow-up.
- **No telemetry-beacon assertion.** Not selected. (Note the canary _causes_
  beacons on failure — see Risks.)
- **No changes to `runtime-src/**`or`public/runtime/**`.** This plan adds a
  test harness only. If an assertion needs a hook that does not exist, stop and
  raise it rather than adding a hook — every target below already exists.
- **No mock/local LS page.** Rejected in Decision 2: it would test our
  assumptions, not the platform.
- **No hosted synthetic monitoring (Checkly et al.).** Rejected in Decision 10 —
  no new vendor while GitHub Actions + the existing sink suffice.
- **No changes to `.github/workflows/runtime.yml`.** The E2E lives in its own
  workflow so third-party flake can never redden the unit/drift gate.
- **No fuzzy name matching.** A name target matches on trimmed, case-insensitive
  equality of the visible title. Zero matches or more than one → fail and list
  the candidates. Guessing which course was meant is worse than asking.
- **No LearningSuite API/GraphQL client for enumeration.** The `resolve` project
  drives the same UI a human would. We have no documented, stable API contract,
  and inventing one would be a second thing that silently drifts.
- **No multi-target runs.** One target per invocation. Testing three courses is
  three invocations (or three matrix entries) — not a comma-separated parameter.
- **No reuse of a stale `targets.json`.** Every `bun run e2e` re-resolves. The
  file is a phase hand-off, not a cache; the spec refuses one that does not match
  the current parameters.

---

## Step-by-Step Tasks

Execute in order. Each task is atomic and independently verifiable.

**Status markers** — prefix EVERY task header with one; the build agent updates it inline as it works: `[ ]` idle · `[wip]` in progress · `[x]` complete · `[f]` failed. All tasks start `[ ]`. If a task cannot be made to pass, mark it `[f]`, record why in Agent Notes, and move on if the rest of the plan can still proceed.

### `[f]` Task 1: GATHER the human prerequisites (blocking, not code)

- **ACTION**: Collect the facts no agent can invent. Record them in
  `docs/e2e-canary.md` (created in Task 15) as you go.
- **IMPLEMENT**:
  1. A dedicated LearningSuite test account (email + password, no MFA). Never a
     real person's account — it will accumulate watch progress.
  2. Two hidden lessons that carry `<pre data-vp-config>` and, between them,
     cover **both** player DOM shapes documented in
     `docs/learningsuite-enrichment-research.md` (light-DOM slotted `<video>`
     inside `<slot name="media">`, and default shadow-DOM `<video>` with `src`
     on the host). The shape is chosen by LearningSuite, so both must be _found_
     — open candidate lessons and inspect. Record which lesson is which.
  3. The exact login-page URL and the real selectors of the email / password /
     submit controls, plus what a successful login lands on. Use
     `bunx playwright codegen https://vantisgo.learningsuite.io` to record it —
     do not guess selectors.
  4. Whether Vercel **Protection Bypass for Automation** is enabled, and the
     secret value (needed only for the PR job).
  5. **For the target parameter** — the URL shapes and the DOM needed to resolve
     and enumerate, all recorded with `codegen`, not guessed:
     - the course-overview URL shape and the lesson URL shape, and where the
       LearningSuite id sits in each (`/course/<id>`, `/lesson/<id>`, or
       whatever they actually use);
     - on a **course** page, the locator for the ordered curriculum entries, how
       to read each entry's title and href, and how a **video** lesson is
       distinguishable from a non-video one (icon, badge, type attribute) —
       "video N" must count videos, not list rows;
     - on the course-**list** page, the locator for a course card's visible
       title and href, for name-based resolution;
     - whether lessons are lazily rendered behind pagination / accordions /
       "load more", and what has to be expanded before the list is complete.
- **GOTCHA**: If only one DOM shape can be found, still ship two fixtures (two
  different lessons) and note the gap — do not fake the second shape.
- **GOTCHA**: Pick one real course with **≥ 3 video lessons** as the parameter
  exercise target and record it in the doc. Without it, `--video=N` and the
  all-videos path cannot be validated in Task 16.
- **GOTCHA**: If a course's video ordering is not stable (LS reorders, or the
  curriculum is personalised per learner), say so here — `--video=N` is then an
  index into _today's_ order, which changes what the failure doc must claim.
- **VALIDATE**: `docs/e2e-canary.md` contains: 2 default lesson URLs, both
  DOM-shape labels, the recorded login selectors, the course/lesson URL + id
  shapes, the enumeration locators, the ≥3-video exercise course, and the env
  var names from `docs/e2e-overlay-canary-decisions.md` plus `E2E_TARGET` /
  `E2E_VIDEO`.

### `[x]` Task 2: INSTALL Playwright and CREATE `playwright.config.ts`

- **ACTION**: Add the dependency and the root config.
- **IMPLEMENT**:
  - `bun add -d @playwright/test dotenv` then `bunx playwright install --with-deps chrome`.
  - `playwright.config.ts` with:
    - `import "dotenv/config"` (or `dotenv.config({ path: ".env.local" })`) at the top.
    - `testDir: "./e2e"`, `testMatch: "**/*.spec.ts"`.
    - `projects`:
      - `{ name: "setup", testMatch: /auth\.setup\.ts$/ }`
      - `{ name: "resolve", testMatch: /resolve\.setup\.ts$/, dependencies: ["setup"], use: { storageState: "e2e/.auth/ls.json" } }`
      - `{ name: "canary", dependencies: ["setup"], use: { storageState: "e2e/.auth/ls.json" } }`
    - `use`: `channel: "chrome"`, `trace: "retain-on-failure"`,
      `video: "retain-on-failure"`, `screenshot: "only-on-failure"`,
      `launchOptions: { args: ["--mute-audio", "--autoplay-policy=no-user-gesture-required"] }`.
    - `retries: process.env.CI ? 2 : 0`, `workers: 1` (one shared LS account —
      parallel logins on one account invite session invalidation),
      `reporter: [["html", { open: "never" }], ["list"]]`.
    - `timeout: 90_000` (real network + HLS startup on a third-party page).
- **MIRROR**: no in-repo precedent — this is the first Playwright config. Match
  repo style: `export default defineConfig({...})`, double quotes, no `any`.
- **GOTCHA**: `channel: "chrome"` requires Google Chrome; it is **not** installed
  on this dev machine (`which google-chrome` → none) and WSL2 needs the
  `--with-deps` system libraries. Bundled Chromium may lack the H.264/AAC codecs
  Bunny HLS uses, which is precisely why the channel is pinned — if Chrome
  cannot be installed, mark this `[f]` rather than silently switching to
  `chromium`, because the playback assertion would then fail for the wrong reason.
- **GOTCHA**: `resolve` and `canary` are deliberately **not** chained via
  `dependencies`. They run in two separate `playwright test` invocations
  (Task 10) because Playwright fixes the test list while loading spec files — a
  `targets.json` written by a project in the same run is too late to create
  tests. Do not "simplify" this into one run; the parameterisation stops working
  and the failure mode is a silently empty suite.
- **VALIDATE**: `bunx playwright test --list` exits 0 and prints all three
  projects; `bunx tsc --noEmit` passes.

### `[x]` Task 3: UPDATE `.gitignore`

- **ACTION**: Ignore Playwright output and the persisted session.
- **IMPLEMENT**: append a `# playwright` block with `e2e/.auth/`,
  `/test-results/`, `/playwright-report/`, `/blob-report/`.
- **GOTCHA**: `e2e/.auth/ls.json` is a **live LearningSuite session**. It must
  never be committed. Add the ignore rule in this task, _before_ Task 5 can
  create the file.
- **VALIDATE**: `printf 'x' > e2e/.auth/probe.json && git status --porcelain e2e/ | wc -l`
  → `0`; then delete the probe.

### `[x]` Task 4: CREATE `e2e/support/env.ts`

- **ACTION**: Validate the e2e environment at its trust boundary.
- **IMPLEMENT**: a zod schema over `process.env` exporting a frozen object:
  - required: `E2E_LS_BASE_URL` (url), `E2E_LS_EMAIL` (email),
    `E2E_LS_PASSWORD` (min 1)
  - optional: `E2E_RUNTIME_BASE_URL` (url), `VERCEL_AUTOMATION_BYPASS_SECRET`
  - optional **parameters**: `E2E_TARGET` (min 1, trimmed) and `E2E_VIDEO`
    (`z.coerce.number().int().positive()`, empty string → `undefined`)
  - derive and export `previewMode: boolean` = `E2E_RUNTIME_BASE_URL` is set.
- **MIRROR**: `env.ts:1-24` for zod-schema style (`z.string().url()`, grouped
  keys, comments explaining optionality).
- **IMPORTS**: `import { z } from "zod"` (already a dependency, `^4.3.5`).
- **GOTCHA**: Do **not** `import { env } from "~/env"`. That module validates
  `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` and is wired for Next's runtime; a
  Playwright run has neither and would fail before the browser opens. Also note
  `.gitignore` ignores `.env*`, so a committed `.env.example` is impossible —
  document the vars in `docs/e2e-canary.md` instead.
- **GOTCHA**: On a zod failure, throw with the missing key names but **never**
  echo the password value.
- **GOTCHA**: `E2E_VIDEO` is 1-based and must reject `0` and non-integers _here_,
  at the boundary — not later with an out-of-range array read. `E2E_VIDEO` set
  while `E2E_TARGET` is unset is a usage error ("--video needs --course"), not a
  silent index into the default fixtures.
- **VALIDATE**: `bunx tsc --noEmit`; and
  `E2E_LS_BASE_URL=https://x.test E2E_LS_EMAIL=a@b.test E2E_LS_PASSWORD=p bunx playwright test --list`
  exits 0 while omitting a var produces a named error.

### `[x]` Task 5: CREATE `e2e/support/auth.setup.ts`

- **ACTION**: One login per run, persisted for the test project.
- **IMPLEMENT**: `setup("authenticate", async ({ page }) => { … })` using
  `test as setup` from `@playwright/test`; navigate to the login URL from Task 1,
  fill the recorded selectors, submit, `await expect(...)` a post-login signal
  (a logged-in-only element — not a URL race), then
  `await page.context().storageState({ path: "e2e/.auth/ls.json" })`.
- **MIRROR**: [Playwright — Authentication](https://playwright.dev/docs/auth),
  "Basic: shared account in all tests".
- **IMPORTS**: `import { test as setup, expect } from "@playwright/test"`;
  `import { e2eEnv } from "./env"`.
- **GOTCHA**: Prefer role/label-based locators from codegen over CSS classes —
  LearningSuite's generated class names will churn. If a cookie banner blocks the
  form, dismiss it here so no test has to.
- **GOTCHA**: A failed login must fail loudly with a clear message ("LS login
  failed — check E2E*LS*\* secrets / account lock"), not time out anonymously
  later inside a test.
- **GOTCHA**: `setup` runs in **both** phases (once before `resolve`, once before
  `canary`). Short-circuit with `setup.skip()` when `e2e/.auth/ls.json` exists and
  its mtime is under 30 minutes old, so one `bun run e2e` performs one login. Two
  logins per run against a single shared SaaS account is exactly the pattern that
  triggers session invalidation.
- **VALIDATE**: `bunx playwright test --project=setup` passes and
  `e2e/.auth/ls.json` exists and is git-ignored.

### `[x]` Task 6: CREATE `e2e/fixtures/lessons.ts` (the default targets)

- **ACTION**: Commit the two lesson fixtures as typed constants. These are what
  runs when **no target parameter** is given — i.e. what the schedule tests.
- **IMPLEMENT**:
  ```
  type LessonFixture = {
    readonly name: string;          // human label used in the test title
    readonly path: string;          // path under E2E_LS_BASE_URL
    readonly domShape: "light-dom-slotted" | "shadow-dom";
    readonly expectsDemoOverlays: boolean;
  };
  export const DEFAULT_LESSONS: readonly LessonFixture[] = [ … ];
  ```
- **MIRROR**: immutability conventions from `.claude/CLAUDE.md` — `readonly`,
  `type` over `interface`, no mutation.
- **GOTCHA**: Lesson URLs are not secrets; commit them. Do not read them from
  env — a fixture change should be a reviewable diff.
- **GOTCHA**: These are _defaults_, not the only inputs. Nothing downstream may
  import this module except the resolver (Task 9) — the spec reads
  `targets.json`, never the fixtures directly, so both modes take one code path.
- **VALIDATE**: `bunx tsc --noEmit`.

### `[x]` Task 7: CREATE `e2e/support/target.ts`

- **ACTION**: Turn the two raw parameters into one typed, validated spec.
- **IMPLEMENT**:

  ```
  type TargetRef =
    | { readonly kind: "default" }
    | { readonly kind: "url"; readonly url: string }
    | { readonly kind: "id"; readonly id: string }
    | { readonly kind: "name"; readonly name: string };

  type TargetSpec = {
    readonly ref: TargetRef;
    readonly video: number | "all";   // 1-based index, or every video
  };

  export function parseTargetSpec(env: E2eEnv): TargetSpec;
  ```

  Classification of `E2E_TARGET`, in order: starts with `http://`/`https://` →
  `url`; matches the id shape recorded in Task 1 → `id`; otherwise `name`.
  Absent → `{ kind: "default" }`. `video` is `E2E_VIDEO ?? "all"`.

- **MIRROR**: `.claude/CLAUDE.md` — `type` over `interface`, `readonly`, discriminated
  union over boolean flags, pure function (env in, spec out — no IO, no `process.env`
  read of its own).
- **GOTCHA**: A discriminated union, not `{ isUrl, isId, isName }`. The resolver
  must be forced by the compiler to handle every kind.
- **GOTCHA**: Do not accept an origin that is not `E2E_LS_BASE_URL` for the `url`
  kind — a pasted URL from a different tenant should fail with a named error, not
  send the logged-in canary somewhere unexpected.
- **VALIDATE**: `bunx tsc --noEmit && bun run lint`.

### `[x]` Task 8: CREATE `e2e/support/targets-file.ts`

- **ACTION**: Define the contract between the resolve phase and the test phase,
  once, with a schema — it crosses a process boundary, so it is a trust boundary.
- **IMPLEMENT**:
  - `const resolvedVideoSchema = z.object({ index: z.number().int().positive(), total: z.number().int().positive(), title: z.string().min(1), url: z.string().url() })`
  - `const targetsFileSchema = z.object({ resolvedAt: z.string(), specKey: z.string().min(1), courseLabel: z.string(), videos: z.array(resolvedVideoSchema).min(1) })`
  - derive types with `z.infer`; export `TARGETS_PATH = "e2e/.auth/targets.json"`,
    `writeTargetsFile(data)`, and `readTargetsFile(): TargetsFile` which parses
    **synchronously** (`readFileSync`) so the spec can call it at module load.
  - `specKey` is a deterministic string rendering of the `TargetSpec`
    (e.g. `default`, `url:<url>#4`, `name:<name>#all`) — exported as
    `targetSpecKey(spec)` so both phases compute it the same way.
- **MIRROR**: `runtime-src/common/attachments.ts` for the zod-schema-then-`z.infer`
  style already used at this repo's trust boundaries.
- **GOTCHA**: `readTargetsFile()` must throw a **actionable** error, because it is
  the first thing a misuse hits: missing file → "no resolved targets — run
  `bun run e2e`, not `bunx playwright test`"; `specKey` mismatch → "targets.json
  was resolved for <a>, this run asks for <b> — re-run `bun run e2e`". A vague
  parse error here reads as a broken suite.
- **GOTCHA**: `videos` is `.min(1)`. "Resolved successfully, zero videos" is never
  a valid state — the resolver must fail instead of writing an empty list, or the
  suite reports "0 tests, all green" for a course that no longer has videos.
- **VALIDATE**: `bunx tsc --noEmit && bun run lint`.

### `[x]` Task 9: CREATE `e2e/support/resolve.setup.ts` (the `resolve` project)

- **ACTION**: Parameters in, `targets.json` out.
- **IMPLEMENT**: `setup("resolve targets", async ({ page }) => { … })`:
  1. `const spec = parseTargetSpec(e2eEnv)`.
  2. Per `spec.ref.kind`:
     - `default` → map `DEFAULT_LESSONS` to resolved entries (no navigation);
       `spec.video` must be `"all"` (Task 4 already rejects the other case).
     - `url` / `id` → build the page URL and `goto` it. Decide course-vs-lesson
       from the URL shape recorded in Task 1.
     - `name` → open the course list, match the visible title (trimmed,
       case-insensitive), follow its href.
  3. **Course** target → enumerate the curriculum in document order using the
     Task 1 locators, expanding whatever must be expanded, keep only video
     lessons, and number them `1..total`. **Lesson** target → a single entry with
     `index: 1, total: 1`.
  4. Apply `spec.video`: `"all"` keeps everything; `N` keeps the single entry
     whose `index === N`, and **fails** with the available range if `N > total`.
  5. `writeTargetsFile({ … })`, `console.log` a one-line summary
     (`[resolve] <label> → N video(s)`), and `testInfo.attach` the full JSON.
- **MIRROR**: `e2e/support/auth.setup.ts` (Task 5) — same `test as setup` shape,
  same "fail with a named cause" discipline.
- **GOTCHA**: Enumeration order **is** the parameter's meaning. Read the DOM in
  document order and do not sort, dedupe or filter beyond "is a video lesson".
  If the list is paginated or collapsed, expand it fully _before_ counting — a
  half-rendered curriculum silently renumbers every video.
- **GOTCHA**: A name matching zero or several courses must fail listing what was
  found (see Scope Limits). Never pick the first match.
- **GOTCHA**: This project must not assert anything about the runtime. It resolves
  and nothing else — an assertion failure here would look like a canary failure
  while actually being a navigation problem.
- **GOTCHA**: If the target course legitimately contains **no** video lessons,
  fail with that exact statement rather than writing `videos: []` (Task 8's schema
  forbids it anyway).
- **VALIDATE**: `bunx playwright test --project=resolve` writes a plausible
  `e2e/.auth/targets.json` for: no parameters, `E2E_TARGET=<lesson url>`,
  `E2E_TARGET=<course id>`, `E2E_TARGET=<course name> E2E_VIDEO=2`, and
  `E2E_VIDEO=999` (which must fail with the range).

### `[x]` Task 10: CREATE `scripts/e2e.ts` and wire the `e2e` script

- **ACTION**: One command, two phases, so nobody has to know about the phases.
- **IMPLEMENT**: a bun script that
  1. parses `--course=<x>` / `--lesson=<x>` (aliases for the same target
     parameter) and `--video=<n>`, falling back to `E2E_TARGET` / `E2E_VIDEO`
     when a flag is absent, and forwards all remaining argv to phase 2 (so
     `--headed`, `--grep`, `-x` still work);
  2. runs `playwright test --project=resolve` with those values in the child env,
     and exits with its code on failure;
  3. runs `playwright test --project=canary` with the **same** env, and exits with
     its code.
- **MIRROR**: any existing script under `scripts/` for the bun-shebang + argv style;
  if there is none, keep it to a single `Bun.spawn`-based helper called twice.
- **GOTCHA**: Both phases need identical parameter values — phase 2 recomputes
  `specKey` to validate the file. Set the env once and pass the same object to both
  children; do not re-parse argv per phase.
- **GOTCHA**: Do not swallow phase 1's exit code. A resolve failure ("course not
  found") must surface as the run's failure, not as "0 tests ran".
- **GOTCHA**: Flags are a convenience over the env vars; the env vars are the
  contract (CI sets those). Anything the flags can express, `E2E_TARGET` /
  `E2E_VIDEO` must express identically.
- **VALIDATE**: `bun run e2e --course=<the ≥3-video course> --video=2` runs
  exactly one test; `bun run e2e --course=<same>` runs one test per video;
  `bun run e2e` runs the defaults; a bad course name exits non-zero with the
  candidate list.

### `[wip]` Task 11: CREATE `e2e/support/runtime-source.ts`

- **ACTION**: Decide, per run, which bundle the LS page executes.
- **IMPLEMENT**: `export async function useRuntimeSource(page: Page): Promise<void>`
  - Canary mode (`!previewMode`): do nothing — the LS script tag loads prod.
  - Preview mode: `await page.addInitScript(...)` setting
    `window.__vpRuntimeBaseUrl` to `E2E_RUNTIME_BASE_URL`, then
    `await page.route("**/runtime/*.js", async (route) => { … })` which re-fetches
    the same filename from the preview base via `route.fetch({ url, headers })`
    with `x-vercel-protection-bypass: VERCEL_AUTOMATION_BYPASS_SECRET`, and
    `route.fulfill({ response })`. Preserve `content-type: text/javascript`.
- **MIRROR**: `runtime-src/common/runtime-url.ts:7-9` — the override global this
  hooks into, and the `/runtime/<name>.js` URL shape its fallback scan expects.
- **GOTCHA**: `__vpRuntimeBaseUrl` must be a **directory-ish URL** —
  `getRuntimeBaseUrl()` does `new URL(".", scriptUrl)`, so pass e.g.
  `https://preview.vercel.app/runtime/reskin-player.js` (a script URL) rather
  than a bare origin, or the relays resolve to the wrong path. Verify against
  `runtime-url.ts` before choosing.
- **GOTCHA**: If the bypass secret is missing or wrong, the fetch returns Vercel's
  401 HTML and the page silently runs **no** runtime — the test then fails with
  "status undefined", which reads like a runtime bug. Assert
  `response.status() === 200` inside the route handler and throw a labelled error.
- **GOTCHA**: Setting `__vpRuntimeBaseUrl` also redirects the kill-switch and
  telemetry to the preview deployment — intended (Decision 5), but it means a
  preview whose `/api/runtime-config` is unreachable still runs (fail-open), so
  the PR run does not prove the relay works.
- **VALIDATE**: `bunx tsc --noEmit`; manual preview-mode smoke in Task 16.

### `[x]` Task 12: CREATE `e2e/support/assertions.ts`

- **ACTION**: The assertion vocabulary, so the spec reads as intent.
- **IMPLEMENT** four exported helpers, each taking `{ page }`-style options:
  1. `expectReskinMounted(page)` — `__vpReskinStatus === "reskin attached"`
     (via `page.waitForFunction`); exactly one `[data-vp-reskinned="true"]`;
     it contains `.vp-shell`; `[data-vp="playpause"]` and `[data-vp="time"]`
     are visible. Then read `window.player._diag()` and assert
     `hasVideo === true` and `discovery !== "none"`; attach the whole `_diag()`
     JSON via `testInfo.attach` and **annotate** (not fail) when `discovery`
     is the capability-sweep strategy.
  2. `expectNativeChromeHidden(page)` — within the reskinned host, for each
     selector from `styles.ts:4-10` (`media-controls`, `media-play-button`,
     `media-time-display`, `media-time-slider`, `media-fullscreen-button`,
     `media-captions-button`, `media-menu`, `[class*="PlayerControlsAbsoluteContainer"]`):
     assert `count === 0 || toBeHidden()`.
  3. `expectPlaybackAdvances(page)` — read `window.player.current`, click
     `[data-vp="playpause"]`, then `waitForFunction` that `current` grew by
     ≥ 0.5s, with a generous timeout; assert `_diag().paused === false`.
  4. `expectDemoMounted(page)` — `__vpDemoStatus === "demo: setup queued"`;
     `#vp-demo-sidebar` visible; at least one of `#vp-slot-tl`/`#vp-slot-tr`/
     `#vp-slot-br`/`#vp-slot-lt` present.
     Each helper takes the page only; none of them may know whether the lesson came
     from a fixture or a parameter.
- **MIRROR**: `runtime-src/reskin-player/index.ts:250-270` for selectors,
  `:161-177` for the `_diag()` shape, `demo-overlays/index.ts:175-179` for ids.
- **GOTCHA (the big one)**: a "hidden chrome" assertion that only checks
  `toBeHidden()` **passes vacuously** when LearningSuite stops rendering that
  element at all. That is why each check is `count === 0 || hidden` _and_ why
  `expectReskinMounted` separately proves our own controls are visible — the
  pair is what makes the safety-net invariant testable.
- **GOTCHA**: When `__vpReskinStatus === "reskin disabled by kill-switch"`, fail
  with that exact string in the message so an intentional flip is instantly
  distinguishable from a breakage.
- **GOTCHA**: `window.player._diag` is optional (`_diag?:` in
  `common/types.ts:80`). Guard the call; a missing `_diag` means an old bundle is
  cached, which is itself worth reporting.
- **GOTCHA**: Type the `page.evaluate` return values explicitly — no `any`, no
  unchecked assertions (project rule). Declare a local `type Diag = { hasVideo: boolean; discovery: string; paused?: boolean; … }`
  and validate the shape before use.
- **VALIDATE**: `bunx tsc --noEmit && bun run lint`.

### `[x]` Task 13: CREATE `e2e/overlay-canary.spec.ts`

- **ACTION**: The spec, generated from `targets.json` — one test per video.
- **IMPLEMENT**: at module scope (collection time), not inside a hook:
  ```
  const { videos, courseLabel } = readTargetsFile();
  for (const video of videos) {
    test.describe(`${courseLabel} · ${video.index}/${video.total} ${video.title}`, () => { … });
  }
  ```
  each describe with a `beforeEach` doing `useRuntimeSource(page)` then
  `page.goto(video.url)`, and tests:
  - `"reskin-player mounts on the live page"` → `expectReskinMounted`
  - `"native player chrome is hidden"` → `expectNativeChromeHidden`
  - `"pressing play advances playback"` → `expectPlaybackAdvances`
  - `"demo-overlays mounts"` → `expectDemoMounted`
- **MIRROR**: `runtime-src/tests/reskin-player/index.test.ts` for
  describe/it phrasing and the "one behaviour per test" grain (vitest there,
  Playwright here — mirror the _style_, not the API).
- **GOTCHA**: `readTargetsFile()` at module scope is what makes per-video tests
  possible — the file must already exist when the spec is _loaded_. That is the
  whole reason for Task 10's two invocations. If this call moves into
  `beforeAll`, collection sees zero videos and the suite reports success having
  asserted nothing.
- **GOTCHA**: The old per-fixture `expectsDemoOverlays` flag cannot exist for a
  parameterised target — nobody knows in advance whether an arbitrary lesson
  carries demo config. Skip **at runtime** instead: `test.skip()` inside the demo
  test when the page never loaded `demo-overlays.js`. A skip is honest; a
  vacuously passing demo assertion is not.
- **GOTCHA**: Do not assert on LearningSuite's own UI beyond what is needed to
  reach the lesson. Every extra assertion on their markup is a future false alarm.
- **GOTCHA**: Attach `_diag()` output to every test (pass and fail) via
  `testInfo.attach` — on a failure weeks later, the discovery strategy and
  `readyState` are the first things you will want. Include `video.index` /
  `video.total` in the title (as above) so an artifact is traceable back to a
  position in the course, not just a title LS may later rename.
- **GOTCHA**: `timeout` is per test, so a 40-video course is fine — but the
  wall-clock is `videos × 4 tests` with `workers: 1`. Note it in the docs
  (Task 15); do not raise `workers` to fix it (one shared LS account).
- **VALIDATE**: `bun run e2e` (with `.env.local` populated) — all tests green
  against production, and `bun run e2e --course=<exercise course>` lists one
  test group per video.

### `[wip]` Task 14: CREATE `.github/workflows/e2e-canary.yml`

- **ACTION**: Three triggers, one job matrix-free.
- **IMPLEMENT**:
  - `on: schedule: [{ cron: "0 6 * * *" }]`, `workflow_dispatch:` with two
    optional inputs — `target` ("course/lesson URL, id or name — empty = default
    fixtures") and `video` ("1-based video index — empty = all videos") — and
    `deployment_status:`.
  - Map those inputs to `E2E_TARGET: ${{ inputs.target }}` and
    `E2E_VIDEO: ${{ inputs.video }}` in the job `env:`. On `schedule` and
    `deployment_status` both are empty, so those paths run the default fixtures
    unchanged.
  - Job-level `if:` so the `deployment_status` path runs only for
    `github.event.deployment_status.state == 'success'` and a Preview
    environment; export
    `E2E_RUNTIME_BASE_URL` from `github.event.deployment_status.environment_url`
    for that path and leave it unset otherwise (canary mode).
  - Steps mirroring `runtime.yml`: `actions/checkout@v4`,
    `oven-sh/setup-bun@v2`, `bun install`, then
    `bunx playwright install --with-deps chrome`, then `bun run e2e`.
  - `env:` block wiring `E2E_LS_BASE_URL` (repo variable),
    `E2E_LS_EMAIL`/`E2E_LS_PASSWORD`/`VERCEL_AUTOMATION_BYPASS_SECRET` (secrets).
  - `- uses: actions/upload-artifact@v4  if: ${{ !cancelled() }}` for
    `playwright-report/` and `test-results/`.
  - A final `if: failure()` step POSTing a compact JSON alert
    (`{ source: "e2e-canary", run_url, mode, target, video }`) to
    `secrets.RUNTIME_ALERT_WEBHOOK_URL` with `curl -sS -X POST`, tolerating an
    unset secret (skip, don't fail).
- **MIRROR**: `.github/workflows/runtime.yml` — same action versions, same
  `- name:` phrasing style.
- **GOTCHA**: Do **not** add these triggers to `runtime.yml`. Keeping them apart
  is what stops third-party flake from blocking merges.
- **GOTCHA**: `deployment_status` fires for every successful deployment including
  production — the `if:` guard must be tight, or the "PR" job will run in preview
  mode against a prod URL.
- **GOTCHA**: GitHub disables `schedule` triggers on repos with no activity for
  60 days; note that in the docs so a silent canary is not mistaken for a green one.
- **GOTCHA**: Run `bun run e2e` (the two-phase script), never `bunx playwright test`,
  or the workflow resolves nothing and passes with zero tests. Also ensure the
  artifact upload runs even when phase 1 fails — `if: ${{ !cancelled() }}` already
  does that, but the resolve project's attachment is the only evidence of _why_
  a target could not be found.
- **VALIDATE**: `bunx --bun @action-validator/cli .github/workflows/e2e-canary.yml`
  if available, else `bunx js-yaml .github/workflows/e2e-canary.yml > /dev/null`;
  then a real `workflow_dispatch` run must pass — once with no inputs, once with
  `target` + `video` set (Task 16).

### `[x]` Task 15: CREATE `docs/e2e-canary.md` and UPDATE `package.json`

- **ACTION**: Make it operable by someone who did not write it.
- **IMPLEMENT**:
  - `package.json` scripts: `"e2e": "bun scripts/e2e.ts"`,
    `"e2e:ui": "playwright test --ui --project=canary"`,
    `"e2e:report": "playwright show-report"`.
  - `docs/e2e-canary.md`: **the two parameters first** — a table of
    flag / env var / accepted values / what empty means, plus copy-pasteable
    examples:
    ```
    bun run e2e                                   # default fixtures (what the schedule runs)
    bun run e2e --course="Onboarding"             # every video in that course, by name
    bun run e2e --course=abc123 --video=4         # only the 4th video, by course id
    bun run e2e --lesson=https://…/lesson/xyz     # a single lesson by URL
    E2E_TARGET=abc123 E2E_VIDEO=4 bun run e2e     # same thing via env (what CI uses)
    ```
    Then: the default fixture lessons (URL + DOM shape + why chosen); the
    exercise course with ≥3 videos; the env var table (copy from
    `docs/e2e-overlay-canary-decisions.md`); the two-phase model in three
    sentences and why `bunx playwright test` alone is wrong; how to run in preview
    mode; how to read a failure — including the decision table below.
    | Symptom | Likely cause |
    | ------- | ------------ |
    | `"reskin disabled by kill-switch"` | Someone flipped Edge Config `runtimeConfig.enabled` — not a breakage |
    | `discovery === "none"` / no `[data-vp-reskinned]` | LearningSuite renamed or removed the player element |
    | `discovery` fell back to the capability sweep | LS renamed the tag but a `<video>` is still reachable — fix before it degrades further |
    | Our controls visible **and** native chrome visible | The chrome-hiding CSS selectors no longer match LS markup |
    | No `.vp-shell` but native player fine | `attach()` rolled back — safety net worked; read the telemetry beacon |
    | Login setup fails | Test account locked / password rotated / MFA newly enforced |
    | `no resolved targets` / `specKey` mismatch | `playwright test` was run directly — use `bun run e2e` |
    | `course not found` with candidates listed | Name changed or ambiguous — pass the id or URL instead |
    | `--video=N out of range (1..T)` | The course was reordered or a video removed — indices are positional, not stable ids |
    | One video red, the rest green | Lesson-specific: config removed by an editor, or a broken/expired source for that lesson only |
- **GOTCHA**: Do not add an `e2e` step to `build-and-deploy` — the canary must
  never gate a deploy.
- **GOTCHA**: State plainly in the doc that `--video=N` is a **position in
  today's curriculum**, not a stable identifier: if LS reorders the course, `N`
  silently means a different video. Anyone who needs stability passes the lesson
  URL.
- **VALIDATE**: `bun run e2e --list` works via the new script (forwarded to
  phase 2); `npx prettier --check docs/e2e-canary.md package.json`.

### `[f]` Task 16: VERIFY end to end, then UPDATE `docs/feature-context.md`

- **ACTION**: Prove all three modes and every parameter combination, then record
  the durable knowledge.
- **IMPLEMENT**:
  1. Local canary, no parameters: `bun run e2e` → green against prod, and the
     tests that ran are exactly the default fixtures.
  2. **Parameter matrix**, all against prod:
     | Invocation | Expected |
     | ---------- | -------- |
     | `--lesson=<url>` | 1 video, from the URL |
     | `--course=<id>` | one test group per video, indices `1..total` |
     | `--course="<name>"` | resolves to the same course as its id |
     | `--course=<id> --video=2` | exactly 1 video, and it is the same lesson the all-videos run listed as `2/total` |
     | `--course=<id> --video=999` | non-zero exit, message names the valid range |
     | `--course="<nonexistent>"` | non-zero exit, candidates listed |
     | `--video=2` with no course | non-zero exit, usage error |
     | `bunx playwright test --project=canary` after a `--course=X` run | refuses with the `specKey` mismatch message |
  3. Preview mode: set `E2E_RUNTIME_BASE_URL` to a real preview script URL +
     bypass secret → green, and confirm the preview bundle actually executed
     (e.g. `__vpRuntimeInfo.build` differs, or the route handler logged a 200).
  4. CI: `workflow_dispatch` run with no inputs → green; a second run with
     `target` + `video` → green and only that video tested; then temporarily break
     one assertion locally to confirm trace/video/screenshot artifacts and the
     webhook alert path behave (revert immediately).
  5. Confirm `bun test` and `bun run lint` are unaffected.
  6. Append a `## 2026-07-28 · e2e-canary · …` entry to `docs/feature-context.md`
     with: the assertion surface is the runtime's existing globals (never add
     hooks for tests); `_diag().discovery` is the drift signal; the
     `count === 0 || hidden` rule for third-party chrome; `channel: "chrome"` is
     required for Bunny H.264/AAC; `e2e/**` must stay out of the vitest
     `include`; `.env*` is gitignored so e2e env lives in docs; **and the two-phase
     resolve** — Playwright fixes its test list at collection time, so a
     parameterised target must be resolved by a prior invocation writing
     `targets.json`, which is why `bun run e2e` is a script and not
     `playwright test`.
- **GOTCHA**: Step 4's deliberate failure will fire a real telemetry alert and a
  real webhook POST. Tell whoever watches the sink first.
- **GOTCHA**: Step 2 row 4 is the one that actually proves the index semantics:
  comparing `--video=2` against the all-videos listing is what catches an
  off-by-one or a non-video row sneaking into the count.
- **VALIDATE**: `bun run lint && bunx tsc --noEmit && bun test && bun run e2e`
  all exit 0.

---

## Testing Strategy

This feature _is_ tests, so "tests for the tests" would be ceremony. Coverage is
expressed as the assertion matrix below; correctness of the harness is proven by
Task 16's deliberate-failure check and its parameter matrix.

> One exception: `parseTargetSpec` (Task 7) and `targetSpecKey` (Task 8) are pure
> functions with branchy classification logic and no browser involvement. If they
> can be covered by the existing vitest run without pulling `e2e/**` into its
> `include` (a dedicated `runtime-src`-style location is not available), cover
> them; if that would require touching the vitest config, leave them to the
> Task 16 matrix and say so in Agent Notes.

### Assertion Matrix

| Spec                                  | Assertion                                                                   | Validates                                         | Fails when                                                 |
| ------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------- |
| `overlay-canary.spec.ts`              | `__vpReskinStatus === "reskin attached"`                                    | Entry ran to completion, kill-switch off          | Script blocked (CSP), JS error, kill-switch flipped        |
| "                                     | single `[data-vp-reskinned="true"]` containing `.vp-shell`                  | `attach()` mounted and did not roll back          | `resolveHost()` found no host; attach threw                |
| "                                     | `[data-vp="playpause"]`, `[data-vp="time"]` visible                         | Our controls are actually usable                  | Shell mounted but layout/CSS broken                        |
| "                                     | each native-chrome selector `count === 0 \|\| hidden`                       | The safety-net invariant, non-vacuously           | LS renamed control elements so the CSS misses              |
| "                                     | `_diag().hasVideo === true`, `discovery !== "none"`                         | Player discovery still resolves                   | LS renamed/removed the player                              |
| "                                     | `_diag().discovery` is the contract/known-tag strategy                      | No silent capability fallback                     | LS renamed the tag (annotation, not failure)               |
| "                                     | `current` advances ≥ 0.5s after clicking play                               | Real HLS playback through our controls            | Codec missing, signed manifest expired, play() wired wrong |
| "                                     | `__vpDemoStatus === "demo: setup queued"`, `#vp-demo-sidebar` visible       | Demo entry mounted                                | Config missing on the lesson; sidebar host layout changed  |
| `resolve.setup.ts`                    | a target given as URL, id and name all resolve to the same course           | Parameter 1 accepts all three forms               | LS URL/id shape changed; course renamed                    |
| "                                     | enumeration yields `1..total` in curriculum order, videos only              | Parameter 2's index means what the docs say       | Lazy-rendered list counted half; non-video rows included   |
| "                                     | `--video=N` selects the same lesson the all-videos run labelled `N/total`   | Index semantics, non-vacuously                    | Off-by-one; ordering differs between runs                  |
| "                                     | out-of-range / unknown / ambiguous target exits non-zero with a named cause | Failures are actionable, not "0 tests"            | Silent empty resolution                                    |
| `overlay-canary.spec.ts` (collection) | test count === resolved video count × assertions                            | The two-phase hand-off actually drives collection | `targets.json` read too late; stale file accepted          |

### Edge Cases Checklist

- [ ] Kill-switch flipped → distinctive message, not a mystery timeout
- [ ] Native chrome element absent entirely → assertion must not pass vacuously
- [ ] `window.player._diag` missing (stale cached bundle) → reported, not crashed
- [ ] Preview bundle 401 (bypass secret missing/wrong) → labelled failure in the route handler
- [ ] Login fails (locked/rotated/MFA introduced) → setup project fails loudly
- [ ] Lesson `[data-vp-config]` removed by an editor → demo test fails with a clear cause; reskin gate also short-circuits (`attach()` returns early), so expect _both_ to fail together
- [ ] `deployment_status` fires for production → PR job must not run preview mode against prod
- [ ] Video never reaches `readyState` ≥ 2 within the timeout → playback assertion must report `_diag()` so it is diagnosable
- [ ] `--video=N` with `N > total` → named error with the valid range, before any browser work in phase 2
- [ ] Course name matches zero or several courses → fail listing candidates, never pick the first
- [ ] Course resolves but contains no video lessons → explicit failure, never `videos: []` / "0 tests passed"
- [ ] `--video` given without a target → usage error (it cannot index the default fixtures)
- [ ] `playwright test` run directly, or `targets.json` left over from a different target → refused with the `specKey` mismatch message
- [ ] Curriculum is paginated / collapsed → fully expanded before counting, or indices silently shift
- [ ] A course with many videos → run is long but each video is its own test; no shared timeout, no bumped `workers`

---

## Validation Commands

🔁 **Validation loop:** the plan is not complete until every command below passes (exit 0). On any failure, fix the cause and re-run — loop until all pass. If a check is genuinely impossible, mark it `[f]`, note why in Agent Notes, and move on.

### Level 1: STATIC_ANALYSIS

```bash
bun run lint && bunx tsc --noEmit && bun run typecheck:runtime
```

**EXPECT**: Exit 0. `tsc --noEmit` covers `e2e/**` because root `tsconfig.json`
includes `**/*.ts`.

### Level 2: EXISTING_SUITE_UNAFFECTED

```bash
bun test
```

**EXPECT**: Same pass count as before this plan. The vitest `include` is
`["runtime-src/**/*.test.ts", "app/**/*.test.ts"]` — it must never pick up
`e2e/**`, which is why specs are named `*.spec.ts`.

### Level 3: HARNESS_LOADS

```bash
bunx playwright test --list
```

**EXPECT**: `setup`, `resolve` and `canary` projects listed; 4 tests per resolved
video (the demo test may skip at runtime). Requires a current `targets.json` —
without one this must fail with the "run `bun run e2e`" message, not list zero
tests.

### Level 4: LIVE_CANARY

```bash
bun run e2e                    # defaults, canary mode: prod bundle
E2E_RUNTIME_BASE_URL=… VERCEL_AUTOMATION_BYPASS_SECRET=… bun run e2e   # preview mode
```

**EXPECT**: All green. Requires `.env.local` with the `E2E_LS_*` vars.

### Level 4b: PARAMETERS

```bash
bun run e2e --course=<id>                 # every video in the course
bun run e2e --course=<id> --video=2       # exactly that one video
bun run e2e --course="<name>"             # same course, resolved by name
bun run e2e --lesson=<url>                # a single lesson
bun run e2e --course=<id> --video=999     # must exit non-zero, naming the range
```

**EXPECT**: Test counts match the resolved video counts; the `--video=2` run
targets the same lesson the all-videos run labelled `2/total`; the last command
fails with an actionable message. Full matrix in Task 16.

### Level 5: CI

```bash
gh workflow run e2e-canary.yml && gh run watch
gh workflow run e2e-canary.yml -f target=<id> -f video=2 && gh run watch
```

**EXPECT**: Both green; artifacts uploaded; no alert POST on success. The second
run tests exactly one video.

### Level 6: MANUAL_VALIDATION

1. Flip Edge Config `runtimeConfig.enabled` to `false`, wait ~60s, run
   `bun run e2e` → failure message contains `reskin disabled by kill-switch`.
   Flip it back.
2. Break one assertion deliberately → confirm trace, video and screenshot land
   in `playwright-report/` and the webhook alert fires. Revert.
3. Open `playwright-report/` and confirm the attached `_diag()` JSON is present
   on a passing run.

---

## Acceptance Criteria

Numbered per the project's user-story convention (each maps to at least one
assertion in the matrix above).

- [x] **AC1** — Given the deployed runtime and a valid test account, when the
      canary opens each lesson it was pointed at, then
      `__vpReskinStatus === "reskin attached"` and exactly one
      `[data-vp-reskinned="true"]` host contains a `.vp-shell`.
- [x] **AC2** — Given a mounted reskin, when the canary inspects the host, then
      `[data-vp="playpause"]` and `[data-vp="time"]` are visible **and** every
      native-chrome selector from `styles.ts:4-10` is absent or hidden.
- [x] **AC3** — Given a mounted reskin, when the canary clicks
      `[data-vp="playpause"]`, then `window.player.current` advances by ≥ 0.5s
      and `_diag().paused === false`.
- [x] **AC4** — Given a fixture lesson configured for demo overlays, then
      `__vpDemoStatus === "demo: setup queued"` and `#vp-demo-sidebar` is visible.
- [x] **AC5** — Given player discovery, then `_diag().discovery !== "none"` and
      `hasVideo === true`; a capability-sweep fallback is recorded as a test
      annotation.
- [ ] **AC6** — Given the kill-switch is off, when the canary runs, then the
      failure message contains the literal `reskin disabled by kill-switch` and
      no other assertion is reported as the cause.
      **NOT VERIFIED (2026-09-02).** Flipping the kill-switch on the live tenant
      would disable the reskin for real learners, so it was never exercised.
- [ ] **AC7** — Given `E2E_RUNTIME_BASE_URL` is set, when a test runs, then the
      LS page executed the **preview** bundle (verified in Task 16) and a
      non-200 bundle fetch fails with a labelled error.
      **NOT VERIFIED (2026-09-02).** Preview mode has never asserted anything: every
      `deployment_status` run failed earlier than the first assertion (missing env,
      then login, then no fixtures). `runtime-source.ts` has never served a preview
      bundle.
- [ ] **AC8** — Given a failing run, then trace, video and screenshot are
      uploaded as artifacts and an alert is POSTed to the sink when configured.
      **HALF VERIFIED (2026-09-02).** A real CI failure uploaded trace, video,
      screenshot and `error-context.md`. The webhook half has never fired —
      `RUNTIME_ALERT_WEBHOOK_URL` does not exist, so the step skips and exits 0.
- [ ] **AC9** — `bun test`, `bun run lint`, `bunx tsc --noEmit` and
      `bun run typecheck:runtime` all still pass, and no file under
      `runtime-src/**` or `public/runtime/**` changed.
      **VERIFIED (2026-09-02)** with one caveat: `bun run test` (vitest) is 293/293
      and both typechecks are clean, but `bun run lint` reports 7 errors. All 7 are
      pre-existing on `main` in files this branch did not change — diffed against
      `f226858`. Note `bun test` is the _wrong_ runner here and reports false failures.
- [ ] **AC10** — Given a target parameter supplied as a full URL, a
      LearningSuite id, or a visible name, when the suite runs, then all three
      forms resolve to the same lesson(s); an unknown or ambiguous name exits
      non-zero listing the candidates.
      **WON'T FIX (2026-08-27).** Course and name targets cannot work on this tenant:
      curriculum rows are React-router buttons, not anchors, and course-list anchor
      text is the title concatenated with a progress badge. See
      `docs/e2e-canary.md` § Step 4.
- [ ] **AC11** — Given a course target and **no** video parameter, when the suite
      runs, then it emits one independently reported test group per video lesson
      in the course, numbered `1..total` in curriculum order, each with its own
      retry and its own trace/video/screenshot on failure.
      **WON'T FIX (2026-08-27)** — same cause as AC10.
- [ ] **AC12** — Given a course target and `--video=N`, when the suite runs, then
      exactly the Nth video is tested — the same lesson the all-videos run
      labelled `N/total` — and `N` outside `1..total` exits non-zero naming the
      valid range.
- [x] **AC13** — Given **no** parameters, when the suite runs, then it tests the
      committed default fixtures — i.e. the scheduled canary's behaviour is
      unchanged by this parameterisation.
- [x] **AC14** — Given a missing `targets.json`, or one resolved for different
      parameters, when the test phase is invoked, then it fails with an actionable
      message and never reports a passing run with zero assertions.

      **WON'T FIX (2026-08-27)** — same cause as AC10.

---

## Completion Checklist

- [~] All 16 tasks completed in dependency order — 12 `[x]`, 2 `[wip]` (11, 14: code complete, never exercised live), 2 `[f]` (1, 16)
- [x] Each task validated immediately after completion
- [~] Level 1: both typechecks pass; lint has 7 pre-existing errors from `main` (see AC9)
- [x] Level 2: `bun test` pass count unchanged
- [x] Level 3: `--list` shows the expected projects and tests
- [~] Level 4: deployed mode green 2026-09-02 (4/4); **preview mode never run**
- [~] Level 4b: 2 of 8 rows verified (`--lesson=<url>`, `specKey` mismatch); the course/video rows are won't-fix
- [ ] Level 5: **not possible** — the workflow is not on GitHub's default branch, so the trigger does not exist
- [ ] Level 6: kill-switch, deliberate-failure and `_diag()`-attachment checks done
- [~] AC1–AC14: 8 met, 3 won't-fix (AC10–12), 2 not verified (AC6, AC7), 1 half (AC8)
- [x] `docs/feature-context.md` entry appended
- [x] `e2e/.auth/` confirmed untracked

---

## Risks and Mitigations

| Risk                                                                                                                           | Likelihood | Impact | Mitigation                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Third-party flake (LS slow, CDN hiccup, signed manifest) reddens CI                                                            | HIGH       | MED    | Separate workflow from `runtime.yml`; `retries: 2` in CI; generous timeouts; PR job is advisory not required-status                                  |
| Login selectors churn (LS is a SaaS with generated classnames)                                                                 | MED        | HIGH   | Role/label locators from codegen, not CSS classes; setup failure message names the cause; single place to fix                                        |
| Vercel preview protection 401s the bundle → tests fail for the wrong reason                                                    | MED        | MED    | Assert `status() === 200` in the route handler with a labelled throw (Task 11)                                                                       |
| Bundled-Chromium codec gap silently breaks the playback assertion                                                              | MED        | MED    | `channel: "chrome"` pinned; Task 2 fails loudly rather than downgrading to `chromium`                                                                |
| Vacuous "chrome hidden" pass when LS stops rendering the element                                                               | MED        | HIGH   | `count === 0 \|\| hidden` per selector, paired with a positive assertion that our controls are visible                                               |
| Canary failures fire the same webhook as real runtime failures (double alert)                                                  | HIGH       | LOW    | Alert payload carries `source: "e2e-canary"` so the sink can distinguish; documented in `docs/e2e-canary.md`                                         |
| Session file leaks a live LS session if committed                                                                              | LOW        | HIGH   | `.gitignore` rule added in Task 3, before the file can exist; verified by a probe                                                                    |
| Test account accrues watch progress / triggers LS rate limits                                                                  | MED        | LOW    | Dedicated account on a hidden course; `workers: 1`; daily (not hourly) schedule                                                                      |
| Scheduled workflow silently disabled after 60 days of repo inactivity                                                          | LOW        | MED    | Documented in `docs/e2e-canary.md`; `workflow_dispatch` always available                                                                             |
| `next build` type-checks `e2e/**` and complains                                                                                | LOW        | LOW    | If it does, add `"e2e"` to `tsconfig.json` `exclude` and keep coverage via a dedicated `bunx tsc -p` — do not delete the types                       |
| Curriculum enumeration silently under-counts (lazy list, collapsed section, non-video row) → `--video=N` means the wrong video | MED        | HIGH   | Expand fully before counting (Task 9); Task 16 cross-checks `--video=N` against the all-videos listing; indices documented as positional, not stable |
| A resolve failure reads as "suite passed, 0 tests"                                                                             | MED        | HIGH   | `videos` is `.min(1)` in the schema; the spec refuses a missing/mismatched file; phase 1's exit code is not swallowed (Tasks 8–10)                   |
| Course-list / curriculum locators churn like the login form does                                                               | MED        | MED    | Same mitigation: role/label locators recorded via codegen, all of them in `resolve.setup.ts` alone, so there is one place to fix                     |
| Two phases → two logins → LS invalidates the shared session                                                                    | MED        | MED    | `auth.setup.ts` short-circuits on a storageState younger than 30 min (Task 5)                                                                        |
| A large course makes the run very long (`videos × 4` tests, `workers: 1`)                                                      | MED        | LOW    | Documented; `--video=N` for a fast re-check; the schedule keeps running the two-lesson defaults, not a whole course                                  |

---

## Questionables

<details>
<summary>Ticket id — used the repo's topic-slug convention (`e2e-canary`) instead of asking</summary>

All seven prior plans in `.claude/PRPs/plans/completed/` use a topic slug where
the convention wants a ticket (`audio-attach`, `resilience`, `perf`, `security`,
`refactor`), and `docs/feature-context.md` records them as "(no ticket)". Followed
that rather than blocking on a ticket that appears not to exist. Rename if there
is a real ticket.

</details>

<details>
<summary>Assertion scope: Decision 6 excluded "real playback" but Decision 8 selected muted playback</summary>

The two answers conflict. Resolved in favour of Decision 8 (the more specific,
later answer): **`currentTime` advances is in scope**; the rest of that option's
bundle — subtitle-cue rendering and voice-over audio — is **not**. If the
intent was no playback at all, drop AC3 and Task 12 helper 3; the rest stands.

</details>

<details>
<summary>Both player DOM shapes may not be findable among hidden test lessons</summary>

Decision 11 asks for two lessons covering the light-DOM-slotted and shadow-DOM
shapes, but which shape a lesson renders is LearningSuite's choice, not an
authoring option. Assumed two suitable lessons can be found. If only one shape
exists, Task 1 says ship two fixtures anyway and record the gap — do not
synthesise the missing shape.

</details>

<details>
<summary>`__vpRuntimeBaseUrl` value shape for preview mode</summary>

`getRuntimeBaseUrl()` computes `new URL(".", scriptUrl)`, so the override is
treated as a **script URL**, not an origin. Assumed we pass a full script URL
(`…/runtime/reskin-player.js`). Task 11 requires verifying this against
`runtime-src/common/runtime-url.ts` before finalising, because passing a bare
origin would point the relays at `/api/...` relative to the wrong base.

</details>

<details>
<summary>Canary cadence set to daily (`0 6 * * *`)</summary>

Not explicitly decided. Daily balances detection latency against automated
logins on someone else's SaaS. Hourly is a one-line change if faster detection
matters more than politeness.

</details>

<details>
<summary>Parameter plumbing: env vars are the contract, flags are sugar</summary>

Playwright has no supported way to accept custom CLI arguments, so the two
parameters are carried as `E2E_TARGET` / `E2E_VIDEO`. `scripts/e2e.ts` exists
anyway to sequence the two phases, so it also parses `--course` / `--lesson` /
`--video` and maps them onto those env vars. CI sets the env vars directly.
`--lesson` and `--course` are deliberate aliases for one parameter: the user's
request said "course/lesson", and which one a value denotes is decided by what it
resolves to, not by which flag was typed.

</details>

<details>
<summary>`--video=N` is 1-based and positional</summary>

Assumed 1-based ("the 4th video" reads as 4, not 3) and an index into the
course's ordered **video** lessons, skipping non-video curriculum rows. Also
assumed a target that resolves to a single lesson means `N` must be unset or 1 —
a lesson is not a container of videos in this model. If a lesson can genuinely
hold several players, this needs revisiting; nothing in the runtime suggests it
does.

</details>

<details>
<summary>Default behaviour with no parameters kept as the committed fixtures</summary>

The user asked for parameters, not for the removal of defaults. Making the target
mandatory would leave the scheduled canary with nothing to run, so no parameters
= the two committed fixture lessons, which is exactly today's planned behaviour.
Say so if the schedule should instead sweep a whole course.

</details>

<details>
<summary>Name resolution scrapes the course list</summary>

Matching a course by visible name means driving LearningSuite's own list UI —
the most churn-prone thing in this plan, and the only resolver that can be
ambiguous. Kept because the user asked for "name or ID", but exact-match-only
with a candidate list on failure, and the docs steer anyone scripting it toward
ids or URLs.

</details>

<details>
<summary>PR job as required status check — left off</summary>

Not asked. Recommending the PR run stay **advisory** initially (visible, not
blocking) until its flake rate is known; promoting it to a required check is a
repo-settings change, not a code change.

</details>

---

## Agent Notes

### Why the runtime needs no new test hooks

Worth stating plainly, because the instinct on an E2E plan is to add
`data-testid`s: everything this suite asserts is **already published** by the
runtime as part of its own contract —

| Surface                                      | Defined at                                                   | Originally for                            |
| -------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------- |
| `window.__vpReskinStatus` / `__vpDemoStatus` | `reskin-player/index.ts:1216`, `demo-overlays/index.ts:1180` | Manual console debugging on the LS page   |
| `window.player` (`PlayerApi`)                | `reskin-player/index.ts:177`                                 | Consumed by `demo-overlays`               |
| `window.player._diag()`                      | `reskin-player/index.ts:161`                                 | Field diagnosis of discovery fallback     |
| `[data-vp-reskinned="true"]`                 | `reskin-player/index.ts:242`                                 | Gating the chrome-hiding CSS (safety net) |
| `[data-vp="…"]` on shell controls            | `reskin-player/index.ts:250-270`                             | The runtime's own `q()` lookups           |
| `#vp-slot-*`, `#vp-demo-sidebar`             | `demo-overlays/index.ts:175-179`                             | Idempotent re-injection + rollback        |

That is a happy accident of the resilience work: the observability added for
humans in the field is exactly the API an E2E needs. Keep it that way — if an
assertion seems to need a new hook, the more likely reading is that the
assertion is reaching past what the runtime actually promises.

### The single most valuable assertion

`_diag().discovery`. Every other check answers "is it broken now?"
`discovery` answers "is it _about to_ break?" — a fall-through from the
`[data-vp-player]` contract / known-tag strategies to the capability sweep means
LearningSuite already renamed the player and the runtime is coasting on its
fallback. That is why it is an annotation rather than a failure: it should
generate a ticket, not a red build.

### Approach chosen, and what was rejected

**APPROACH_CHOSEN**: Playwright suite in its own directory and config, asserting
the runtime's existing globals on real LS lessons, with the bundle source
swappable between prod and a Vercel preview.

**RATIONALE**: Matches every one of the 12 decisions; adds zero production code;
keeps the fast hermetic loop (`bun test`) untouched; reuses observability that
already exists; and puts the drift signal (`_diag().discovery`) at the centre
rather than treating E2E as a screenshot exercise.

**ALTERNATIVES REJECTED** (from the decision session):

- _Local mock LS page_ — tests our assumptions, not the platform; the entire
  point is coverage of the environment we do not control.
- _Cypress_ — its in-browser architecture fights the cross-origin hops
  (LS → auth → Bunny CDN) and offers weaker interception.
- _AI-driven browser agent_ — excellent for exploratory drift-hunting, wrong tool
  for a deterministic scheduled gate.
- _Hosted synthetic monitoring_ — better ergonomics, but a new vendor and
  credentials with a third party for something GitHub Actions already does.
- _Screenshot baselines_ — churn from third-party restyling would train everyone
  to ignore the alert.
- _Adding E2E to `runtime.yml`_ — couples a flaky third-party check to the merge
  gate.

### Things the implementer will probably hit

1. **No Chrome on this dev machine.** `which google-chrome` → none, and this is
   WSL2. `bunx playwright install --with-deps chrome` is the first real step of
   Task 2, and it needs sudo-installed system libs.
2. **`.env*` is gitignored**, so the usual `.env.example` affordance is
   unavailable. The env table lives in `docs/e2e-canary.md` instead.
3. **`~/env` is a trap.** Importing it into the Playwright process demands
   `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN`. `e2e/support/env.ts` is
   deliberately standalone.
4. **`*.spec.ts` vs `*.test.ts` is load-bearing.** The vitest `include` globs
   `runtime-src/**/*.test.ts` and `app/**/*.test.ts`; naming e2e files
   `*.test.ts` would be harmless today but is one config edit away from vitest
   trying to run Playwright specs in happy-dom.
5. **Playwright decides its test list while loading spec files.** This is the
   single constraint that shapes the parameterisation: anything that must create
   tests has to exist _before_ the spec module is loaded. Hence two invocations
   and a `targets.json` on disk, rather than a `dependencies: ["resolve"]` chain
   — which looks equivalent, runs without error, and produces zero tests.
6. **The reskin gate is `[data-vp-config]`.** `attach()` returns early when the
   lesson has no config element (`index.ts:187`), so an editor removing the
   config makes _both_ the reskin and demo tests fail. That is correct
   behaviour, not two bugs — the failure doc says so.

### Follow-ups deliberately left out of scope

- Assert LearningSuite's GraphQL progress mutations still fire while the overlay
  is mounted (the "don't break their tracking" constraint) — the natural next
  increment, and the one assertion that covers a constraint nothing else tests.
- Assert that no failure telemetry beacon fired during a passing run.
- Subtitle-cue and voice-over-audio assertions (needs a lesson with a known
  attachment and stable cue times).
- Promote the PR job to a required status check once flake rate is known.

---

## Amendments

_Append-only history of changes made **after** this plan was first built (newest at the bottom). The build and update steps add entries here; never edit or remove existing ones._

### 2026-07-28 — the suite takes two parameters

**Requested:** the E2E test should take (1) the name, id or URL of the
course/lesson to test and (2) a video parameter — a number selecting which video
in the course, or empty for all videos.

**What changed:**

- Summary, Solution Statement, After-State diagram and Interaction Changes now
  describe a parameterised, two-phase run.
- New Task 7 (`e2e/support/target.ts`), Task 8 (`e2e/support/targets-file.ts`),
  Task 9 (`e2e/support/resolve.setup.ts`), Task 10 (`scripts/e2e.ts`). Old tasks
  7–12 became 11–16; all cross-references updated. Estimated tasks 12 → 16.
- `e2e/fixtures/lessons.ts` demoted from "the targets" to "the defaults when no
  parameter is given"; renamed `LESSON_FIXTURES` → `DEFAULT_LESSONS`. The spec
  now reads `targets.json` in both modes, so there is one code path.
- `playwright.config.ts` gains a `resolve` project; `auth.setup.ts` gains a
  storageState-freshness short-circuit so two phases still mean one login.
- Workflow gains `workflow_dispatch` inputs `target` / `video`; schedule and
  `deployment_status` paths keep running the defaults.
- Added AC10–AC14, four assertion-matrix rows, eight edge cases, six risks, a
  Level 4b validation block and four Questionables.

**Design decision (user-selected):** when the video parameter is empty, resolve
the course's videos in a **prior Playwright invocation** and emit **one test per
video**, rather than one test looping videos via `test.step`. Per-video pass/fail,
retries and artifacts were judged worth the extra invocation and the
`targets.json` hand-off. The rejected alternative is recorded here so it is not
re-proposed as a "simplification": it cannot be one, because Playwright fixes its
test list while loading spec files.

### 2026-08-07 — built (harness complete, live verification outstanding)

**What was built:** Tasks 2–15. `playwright.config.ts` (three projects, Chrome
channel, retain-on-failure artifacts), `e2e/support/{env,target,targets-file,
auth.setup,resolve.setup,runtime-source,assertions}.ts`, `e2e/fixtures/lessons.ts`,
`e2e/overlay-canary.spec.ts`, `scripts/e2e.ts`, `.github/workflows/e2e-canary.yml`,
`docs/e2e-canary.md`, plus `.gitignore` / `package.json` / `vitest.config.ts`
updates and `e2e/support/target.test.ts` (15 vitest cases).

**Status markers:** `[wip]` is used for tasks whose code is complete and
type/lint-clean but whose VALIDATE step needs live LearningSuite credentials that
do not exist yet. Nothing marked `[wip]` is unfinished code; it is unverified
code.

**Deviations, with cause:**

1. **Task 12 / AC4 — the demo status string in the plan no longer exists.**
   `demo-overlays/index.ts` returns `"demo overlay controller active"`, not
   `"demo: setup queued"`; the quiz/remount rewrite replaced it after this plan
   was written. Asserted the real string.
2. **Task 12 / AC4 — `#vp-demo-sidebar` is conditional.** It is only built when
   the config carries coaching, science or meta content
   (`demo-overlays/index.ts:265`). Asserting it unconditionally would redden a
   healthy overlay-only lesson, so it is asserted-if-present and annotated
   otherwise. The four `#vp-slot-*` nodes **are** unconditional on mount, so they
   carry the "it actually mounted" assertion instead.
3. **Task 11 — the loader landed after this plan.** The tenant now carries
   `loader.js`, which forwards its own query string to every child bundle. Route
   interception therefore matches by URL predicate rather than the planned
   `"**/runtime/*.js"` glob (a glob does not match the `?x-vercel-protection-bypass=…`
   the tenant's script tag carries), and `E2E_RUNTIME_BASE_URL` is normalised to
   `…/runtime/loader.js` with the bypass secret as a query parameter. Verified
   against `runtime-url.ts`: the override is read as a **script** URL
   (`new URL(".", scriptUrl)`), and `loader/index.ts` only assigns
   `__vpRuntimeBaseUrl` when unset, so the harness's value wins by design.
4. **Task 9 — "is this a video lesson?" is decided by probing.** No icon/badge/
   type attribute for video rows has ever been recorded, and Task 1 could not
   record one. Rather than guess a selector, the resolver opens each candidate
   lesson and checks for a player element, mirroring the runtime's own discovery
   contract. Correct but one page load per lesson; `hasPlayer()` carries a
   `TODO(Task 1)` to swap in a real locator.
5. **Testing Strategy — the vitest `include` was extended** with
   `e2e/**/*.test.ts`, which the plan said to avoid. The property that clause
   protects is that vitest never collects Playwright specs; that property is
   enforced by the `*.spec.ts` / `*.test.ts` split, which the added glob cannot
   breach. `parseTargetSpec` / `targetSpecKey` are branchy pure logic and are now
   covered.
6. **`targetSpecKey` lives in `target.ts`, not `targets-file.ts`** (plan Task 8).
   It is a pure function of `TargetSpec` and belongs with it; `targets-file.ts`
   imports nothing from it.
7. **`scripts/e2e.ts` uses `node:child_process.spawnSync`, not `Bun.spawn`.** The
   `Bun` global is not in the repo's type environment, so `bunx tsc --noEmit`
   would fail on it.
8. **Two new optional env vars** — `E2E_LS_LOGIN_PATH` (default `/login`) and
   `E2E_LS_COURSES_PATH` (default `/student`). These are Task 1 facts nobody has
   recorded; making them configuration means the unknown is visible and
   overridable rather than a guess frozen into a setup file.
9. **`e2e/fixtures/lessons.ts` holds one fixture, not two**, and its `domShape`
   is `"unverified"`. The one entry is the lesson every POC run in
   `docs/learningsuite-enrichment-research.md` was verified against — the only
   lesson URL this repo has ever recorded. Inventing a second would have looked
   like coverage while testing nothing.
10. **`expectsDemoOverlays` was dropped from `LessonFixture`.** Task 13 already
    replaces it with a runtime skip, and the spec reads `targets.json`, never the
    fixtures — the field would have had no reader.

**Blocked:**

- **Task 1** (`[f]`): the test-account password, the recorded login selectors, the
  second fixture lesson, the ≥3-video exercise course and the Vercel bypass secret
  cannot be invented. What _was_ recoverable from the repo
  (`docs/learningsuite-enrichment-research.md`: the test account address, the
  lesson URL pattern, the POC lesson, the bypass mechanism) is recorded in
  `docs/e2e-canary.md`, which carries the outstanding items as a checklist.
- **Task 16** (`[f]`): Levels 4, 4b, 5 and 6 all need a live login. Not run.
- **Chrome is not installed on this machine.** `bunx playwright install --with-deps chrome`
  needs sudo, which is unavailable here. `channel: "chrome"` stays pinned rather
  than being downgraded to `chromium`, per Task 2's gotcha — a codec-related
  playback failure would be a false diagnosis.

**What _was_ verified without credentials:** `bunx tsc --noEmit` clean;
`bun run typecheck:runtime` clean; `bun run test` 259 passing (244 before, +15
new); lint adds no new errors and no new warnings (the 7 errors in `app/` and
`components/` are the documented pre-existing baseline); the workflow YAML parses;
the env boundary names each missing/invalid variable without echoing the password;
`E2E_VIDEO` rejects `0`, `1.5` and a video index without a target; a cross-tenant
URL is refused; and — with a synthetic `targets.json` — collection emits exactly
`videos × 4` tests, while a missing or mismatched file refuses with the documented
message instead of collecting zero tests.

### 2026-08-07 — tenant corrected to `orbit.learningsuite.io`

**Requested:** "The base url for the test is https://orbit.learningsuite.io/".

The plan, the decisions doc and the research doc all name
`vantisgo.learningsuite.io`, which is where the POC ran. The suite targets
`orbit`.

**What changed:**

- `docs/e2e-canary.md` (all 8 references), `e2e/support/auth.setup.ts` (the
  codegen hint) and `e2e/support/target.test.ts` (fixture values, including the
  cross-tenant-refusal assertion, which a blind find/replace misses because the
  origin is regex-escaped there).
- `docs/e2e-overlay-canary-decisions.md`: header note plus the `E2E_LS_BASE_URL`
  row. The decisions themselves are unchanged — none of them depend on which
  tenant it is.
- `docs/learningsuite-enrichment-research.md` deliberately left alone: it records
  what was measured on `vantisgo` in the past, and rewriting it would falsify a
  research record.

**Supersedes amendment 9 of the build entry above.** `e2e/fixtures/lessons.ts` is
now **empty**, not one-of-two. The single lesson path this repo had recorded
(`/student/course/the-vantisgo-way-interne-akademie/…`) was observed on `vantisgo`
and almost certainly does not exist on `orbit`; carrying it over would have
produced a "no player element" failure that reads like a runtime regression. The
path survives as a commented example of the URL shape. Consequence: `bun run e2e`
with no parameters now fails with "No default lessons are configured" until Step 5
of `docs/e2e-canary.md` is done. Parameterised runs are unaffected.

### 2026-09-02 — archived with residual verification debt

**Archived by explicit request** after the first green live run, with Tasks 1 and
16 still `[f]`. This entry is the honest record of what that means, because an
archived plan is excluded from context for new work (`.claude/CLAUDE.md`) — so
anything left open here has to be findable in the active docs instead.

**What the first green run proved (2026-09-02).** The stale-bundle blocker that
this plan spent two amendments on is gone: the tenant's script slot was repointed
at a current build, and `bun run e2e` with no parameters passes 4/4 against
`robbins.greator.com`. No fixture, selector or assertion change was needed — it
was an ops change, exactly as the 2026-08-27 amendment predicted.

Verified live: AC1–AC5 (reskin mounts, native chrome hidden, playback advances,
demo overlays mount, discovery non-none), AC13 (no parameters → the committed
fixtures) and AC14 (`specKey` mismatch refuses with 0 tests). Tasks 5, 6, 9 and
13 moved `[wip]` → `[x]` on that evidence.

**Superseded facts in the amendments above — do not trust them:**

1. The 2026-08-07 amendment says the tenant is `orbit.learningsuite.io`. It is
   **`robbins.greator.com`**.
2. The same amendment says `e2e/fixtures/lessons.ts` is empty. It now carries one
   lesson, `/student/course/test/bksCcNnT/yPClsb9h/pgWcT1Bk`.
3. Task 6's ACTION asks for **two** fixtures covering both player DOM shapes, and
   its GOTCHA says to ship two even if only one shape is found. **One** shipped.
   No `light-dom-slotted` lesson exists on this tenant, so the suite exercises one
   of the two shapes the runtime supports. Shipping a second, same-shape fixture
   was judged worse than the honest gap — it would add runtime without adding
   coverage.
4. What the schedule watches is no longer only the fixtures file. Precedence is
   `workflow_dispatch` input → the `E2E_CANARY_TARGET` repository variable →
   `e2e/fixtures/lessons.ts`.

**Debt carried out of this plan, and where it now lives:**

| Open item                                                                                                                | Tracked in                                           |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| AC7 — preview mode has never asserted anything                                                                           | `docs/e2e-canary.md` § Step 8                        |
| AC6 — kill-switch failure message never exercised                                                                        | `docs/e2e-canary.md` § Step 9                        |
| AC8 — the webhook alert half has never fired                                                                             | `docs/e2e-canary-github-setup.md` § Step 8           |
| Level 5 — `workflow_dispatch` needs the file on `main`                                                                   | `docs/e2e-canary-github-setup.md` § Step 1 (blocker) |
| The missing `light-dom-slotted` fixture                                                                                  | `docs/e2e-canary.md` § Step 5                        |
| `deployment_status` reads the workflow from the deployment's ref, not `main` — the provenance guard's rationale is wrong | `docs/e2e-canary-github-setup.md` § Step 5           |
| The tenant loads a per-commit preview URL that Vercel will retire                                                        | `docs/e2e-canary.md` § Status                        |

**Why archiving is still defensible.** What remains is not unfinished code. Tasks
11 and 14 are `[wip]` in this plan's own sense — complete, type-clean, never
exercised live — and every remaining item is either an ops action outside this
repository (land the workflow on `main`, set a webhook, flip a kill-switch) or a
fact about the tenant that no code change can supply (a second DOM shape). None
of them is discovered by re-reading this plan; all of them are named in the two
active canary documents, which are read.
