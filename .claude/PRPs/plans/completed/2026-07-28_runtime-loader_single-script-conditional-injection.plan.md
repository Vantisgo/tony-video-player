# Feature: Runtime Loader — one injected script that conditionally loads the three bundles

## Summary

Replace the three `<script src>` tags pasted into the LearningSuite tenant with a
single injected `loader.js`. The loader resolves its own origin (and carries its
own query string, i.e. the Vercel protection-bypass secret, to every child URL),
asks the kill-switch **once**, then injects `reskin-player.js`,
`demo-overlays.js` and `admin-toggle.js` only when that entry's precondition is
actually met — and only when it becomes met, since LearningSuite renders
`[data-vp-config]` asynchronously via React after head scripts run. Ordering
becomes explicit: `demo-overlays` is injected only after `reskin-player` has
published `window.player`, removing today's implicit race. The three bundles keep
their own self-gating and stay independently injectable; the loader is additive
and changes no rendering behaviour.

## User Story

As the maintainer who pastes the runtime into a LearningSuite tenant
I want to inject one script tag that decides for itself what to load
So that updating the runtime never means re-pasting three URLs into a third-party
CMS, and pages that will never use the runtime download nothing beyond a ~2KB
loader

## Problem Statement

Today the tenant carries three `<script src>` tags
(`docs/learningsuite-enrichment-research.md:490-508`), each with the bypass
secret appended, each independently self-gating. Three consequences:

1. **Every lesson downloads and executes all three bundles** (~63KB +
   ~63KB + ~16KB unminified) even when the page has no `[data-vp-config]` and no
   `/admin/editor/` in its URL. Both `reskin-player` and `demo-overlays` also each
   fetch `/api/runtime-config` (`runtime-src/common/killswitch.ts:11`) — two
   requests per page load for one boolean.
2. **The load order of `reskin-player` vs `demo-overlays` is not guaranteed.**
   `demo-overlays` dereferences `window.player` unconditionally
   (`runtime-src/demo-overlays/index.ts:1157`), which `reskin-player` publishes at
   `runtime-src/reskin-player/index.ts:177`. It works today because demo defers
   its mount behind a config+player wait plus two `requestAnimationFrame`s, not
   because anything enforces the order. A slow/failed `reskin-player.js` fetch
   makes demo throw into its own safety net.
3. **Changing what gets injected requires a human editing the tenant**, in a CMS
   we do not control, with the secret pasted three times.

`admin-toggle` additionally runs with **no kill-switch at all** — it calls
`main()` synchronously (`runtime-src/admin-toggle/index.ts:226`), so the remote
disable switch cannot stop it.

Testable statement of the gap: **there is no single injected entry point that
decides which runtime bundles a given LearningSuite page needs.**

## Solution Statement

A fourth esbuild entry, `runtime-src/loader/index.ts` → `public/runtime/loader.js`:

- **Origin + secret propagation.** Resolve `document.currentScript.src` (with the
  existing fallback scan and `window.__vpRuntimeBaseUrl` override from
  `runtime-src/common/runtime-url.ts:6-19`), set `window.__vpRuntimeBaseUrl` so
  children inherit it instead of re-deriving it from a dynamically inserted tag,
  and build child URLs as `<base><name>.js<loader's own search string>` so
  `?x-vercel-protection-bypass=…` reaches every child (`…:471` — without it the
  children 401).
- **One kill-switch call.** The loader calls `shouldRun()` and publishes the
  verdict on `window.__vpRuntimeGate`; `shouldRun()` short-circuits on that flag
  so children do not re-fetch. Absent flag → unchanged behaviour, so standalone
  injection of a single bundle still works. Verdict `false` → nothing is injected,
  including `admin-toggle`, which is newly kill-switchable.
- **Lazy per-entry gates,** each evaluated immediately and then re-evaluated on a
  debounced MutationObserver + a URL poll (LearningSuite mutates the DOM via
  React and navigates via `pushState`, mirroring
  `runtime-src/admin-toggle/index.ts:196-225`):

  | Entry           | Gate                                                                            | Why this gate                                                                                                                                                                                                 |
  | --------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `admin-toggle`  | `/admin/editor/` in path and `?view=preview` absent                             | Same predicate as `isEditMode()` (`runtime-src/admin-toggle/index.ts:164`)                                                                                                                                    |
  | `reskin-player` | a config is present on the page                                                 | Same predicate as its own `attach()` gate (`runtime-src/reskin-player/index.ts:188`); deliberately **not** "a player exists", which would suppress the `reskin-no-player-after-deadline` telemetry at `:1198` |
  | `demo-overlays` | config present **and** `reskin-player` loaded **and** `window.player` published | Preserves the `demo-context-timeout` telemetry at `runtime-src/demo-overlays/index.ts:110-115` while making the ordering explicit                                                                             |

- **Each entry injected at most once**; the loader itself is idempotent under
  re-injection via the shared cleanup registry (`runtime-src/common/cleanup.ts`)
  under a new `__vpLoaderCleanup` key.
- **Observable surface** for the e2e canary: `window.__vpLoaderStatus` (string)
  and `window.__vpLoaded` (array of entry names, in injection order).

## Metadata

| Field            | Value                                                                                                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type             | NEW_CAPABILITY (+ small refactor of the kill-switch)                                                                                                                                               |
| Complexity       | MEDIUM                                                                                                                                                                                             |
| Systems Affected | `runtime-src/loader/` (new), `runtime-src/common/killswitch.ts`, `runtime-src/global.d.ts`, `scripts/build-runtime.mjs`, `public/runtime/` (generated), `runtime-src/tests/loader/` (new), `docs/` |
| Dependencies     | None — no new packages. esbuild + vitest + happy-dom already in place                                                                                                                              |
| Estimated Tasks  | 9                                                                                                                                                                                                  |

---

## Lifecycle (append-only)

- **Created:** 2026-07-28
- **Modified:** 2026-07-28 (initial plan), 2026-07-28 (implemented)
- **Commits:** `97ad07d`
- **Agent / Session:** claude-opus-5 / session 90414b1b-b5ee-4aee-a4c9-5437f467702f (plan + implementation)
- **Back refs:**
  - `.claude/PRPs/plans/2026-07-27_e2e-canary_learningsuite-overlay-playwright.plan.md` — its `page.route("**/runtime/*.js")` interception and `__vpReskinStatus` / `__vpDemoStatus` assertions must keep working through the loader
  - `.claude/PRPs/plans/completed/2026-07-24_resilience_ops-telemetry.plan.md` — the kill-switch this plan calls once instead of twice
  - `.claude/PRPs/plans/completed/2026-07-24_resilience_adaptability.plan.md` — player discovery + the no-player deadline telemetry the gates must not suppress
  - `.claude/PRPs/plans/completed/2026-07-24_refactor_runtime-ts-module-migration.plan.md` — the `runtime-src/` + esbuild entry structure this adds a fourth entry to
- **Forward refs:**
  - `.claude/PRPs/reports/2026-07-28_runtime-loader_single-script-conditional-injection-report.md` — implementation report

> **Append-only:** `Created` is set once; every other field is a list you only ever add to — never overwrite or remove existing entries. Keep references bidirectional: when you add a back/forward ref here, add the reciprocal ref on the other plan.

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                    BEFORE — tenant carries three tags                          ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  LearningSuite global <script> slot:                                           ║
║    <script src=".../runtime/reskin-player.js?bypass=SECRET" defer>             ║
║    <script src=".../runtime/demo-overlays.js?bypass=SECRET" defer>             ║
║    <script src=".../runtime/admin-toggle.js?bypass=SECRET" defer>              ║
║                                                                                ║
║  ANY page (marketing page, quiz, PDF lesson — no video, no config):            ║
║    ├─ downloads 3 bundles (~143KB unminified)                                  ║
║    ├─ reskin  → fetch /api/runtime-config → main() → observers armed, idle     ║
║    ├─ demo    → fetch /api/runtime-config → main() → observer waits forever    ║
║    └─ admin   → main() runs, NO kill-switch gate                               ║
║                                                                                ║
║  Ordering: whichever of the two bundles the network returns first wins.         ║
║  demo touches window.player (index.ts:1157) hoping reskin already ran.         ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                    AFTER — tenant carries one tag                              ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  LearningSuite global <script> slot:                                           ║
║    <script src=".../runtime/loader.js?bypass=SECRET" defer>                    ║
║                                                                                ║
║  loader.js (~2KB):                                                             ║
║    1. base = origin of own <script>;  window.__vpRuntimeBaseUrl = base         ║
║       search = own "?…"  → appended to every child URL (secret survives)       ║
║    2. await shouldRun(base)   ── one request, fails open                       ║
║         false → __vpRuntimeGate = false; __vpLoaderStatus = "…kill-switch";    ║
║                 inject nothing (admin-toggle now gated too)                    ║
║    3. __vpRuntimeGate = true; evaluate gates now, then on DOM/URL change:      ║
║                                                                                ║
║       /admin/editor/ && !view=preview ──────────► inject admin-toggle.js       ║
║                                                                                ║
║       config on page ───► inject reskin-player.js                              ║
║                             └─ onload + window.player ──► inject demo-overlays ║
║                                                                                ║
║       neither ─────────► nothing injected; page untouched                      ║
║                                                                                ║
║  Observable: __vpLoaderStatus, __vpLoaded = ["reskin-player","demo-overlays"]  ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

- **Learner on a configured lesson:** identical visible behaviour. One extra
  round-trip of latency before `reskin-player.js` starts downloading (loader must
  execute and the kill-switch must resolve first). Both scripts are `defer`/
  dynamic, so this is not render-blocking, but the reskin can appear marginally
  later — the native chrome is hidden only once `attach()` runs, so there is no
  new flash-of-native-controls window beyond the existing one.
- **Learner on an unconfigured page:** now downloads ~2KB instead of ~143KB and
  makes one API call instead of two.
- **Admin in the editor:** unchanged, except the banner can now be switched off
  remotely.

---

## Mandatory Reading

Read before writing code. These are the contracts the loader must not break.

- `runtime-src/common/runtime-url.ts` (all 39 lines) — `__vpRuntimeBaseUrl`
  override, `document.currentScript` resolution, the `/runtime/<name>.js`
  fallback scan, and the fact that `getRuntimeBaseUrl()` uses `new URL(".", …)`
  and therefore **drops the query string**.
- `runtime-src/common/killswitch.ts` (all 44 lines) — the fail-open contract. The
  short-circuit added in Task 2 must not weaken it.
- `runtime-src/common/cleanup.ts` — `resetCleanup(key)` / `pushCleanup(key, fn)`;
  the idempotency pattern every entry uses.
- `runtime-src/common/config.ts:16-56` — `loadVpConfig()` finds the config in
  three shapes (`<script type=application/json data-vp-config>`, any
  `[data-vp-config]:not(script)` element, and an HTML comment delimited by
  `VP_CONFIG`). Note the comment scan walks every comment node — do not run it on
  every mutation.
- `runtime-src/reskin-player/index.ts:177` (`window.player = api`), `:186-189`
  (the `[data-vp-config]` attach gate), `:1195-1202` (no-player deadline
  telemetry), `:1207-1218` (the kill-switch IIFE and `__vpReskinStatus`).
- `runtime-src/demo-overlays/index.ts:84-119` (readiness wait +
  `demo-context-timeout`), `:1157` (`window.player` dereference), `:1173-1181`
  (kill-switch IIFE and `__vpDemoStatus`).
- `runtime-src/admin-toggle/index.ts:164-170` (`isEditMode()`), `:196-225`
  (MutationObserver + `popstate` + 600ms URL poll), `:226` (sync `main()`, no
  kill-switch).
- `scripts/build-runtime.mjs:14-20` — the `entryPoints` map to extend.
- `.github/workflows/runtime.yml:30-38` — the drift check: committed
  `public/runtime/*.js` must equal a fresh build.
- `docs/learningsuite-enrichment-research.md:395-410` (the self-gating table),
  `:455-482` (bypass secret as a query parameter on **every** request),
  `:489-508` (the three-tag snippet to replace).

---

## Patterns to Mirror

```ts
// SOURCE: runtime-src/admin-toggle/index.ts:196-225
// Debounced MutationObserver + popstate + URL poll, every handle registered for
// teardown. The loader's gate re-evaluation mirrors this exactly — same 250ms
// scan debounce, same 600ms URL poll, same pushCleanup discipline.
let scanPending: ReturnType<typeof setTimeout> | 0 = 0;
function scheduleApply(): void {
  if (scanPending) return;
  scanPending = setTimeout(() => {
    scanPending = 0;
    applyMode();
  }, 250);
}
const mo = new MutationObserver(scheduleApply);
mo.observe(document.body, { subtree: true, childList: true });
pushCleanup(CLEANUP_KEY, () => {
  mo.disconnect();
  if (scanPending) clearTimeout(scanPending);
});
```

```ts
// SOURCE: runtime-src/demo-overlays/index.ts:103-107
// Observe body OR documentElement — the loader may execute before <body> exists.
watcher.observe(document.body || document.documentElement, {
  subtree: true,
  childList: true,
});
```

```ts
// SOURCE: runtime-src/reskin-player/index.ts:1207-1218
// Kill-switch gate + status global. The loader keeps this shape:
// one async IIFE, a status string on a window key, no top-level await.
void (async () => {
  const status = (await shouldRun(runtimeBaseUrl)) ? main() : "…disabled…";
  (window as unknown as { __vpReskinStatus?: string }).__vpReskinStatus =
    status;
})();
```

```ts
// SOURCE: runtime-src/tests/common/killswitch.test.ts:1-33
// Test style: vi.stubGlobal for fetch, unstubAllGlobals in afterEach, AC ids in
// the test name. Loader tests follow this — no DOM libraries beyond happy-dom.
```

---

## Files to Change

| File                                          | Action    | Justification                                                                                                       |
| --------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------- |
| `runtime-src/loader/index.ts`                 | CREATE    | The loader entry: base/secret resolution, one kill-switch call, gate wiring, status globals                         |
| `runtime-src/loader/gates.ts`                 | CREATE    | Pure predicates (`isAdminEditMode`, `hasVpConfig`) + `childUrl()` URL builder — the units the tests target directly |
| `runtime-src/common/killswitch.ts`            | UPDATE    | Short-circuit on `window.__vpRuntimeGate` so children do not re-fetch the flag                                      |
| `runtime-src/global.d.ts`                     | UPDATE    | Declare `__vpRuntimeGate`, `__vpLoaderStatus`, `__vpLoaded` (keeps the no-`any`/no-assertion rule honest)           |
| `scripts/build-runtime.mjs`                   | UPDATE    | Add the `loader` entry point                                                                                        |
| `public/runtime/loader.js` (+ `.js.map`)      | GENERATED | Committed build output; drift check requires it                                                                     |
| `runtime-src/tests/loader/gates.test.ts`      | CREATE    | AC1–AC3 predicate + URL-building coverage                                                                           |
| `runtime-src/tests/loader/loader.test.ts`     | CREATE    | AC4–AC9: injection decisions, ordering, idempotency, kill-switch                                                    |
| `runtime-src/tests/common/killswitch.test.ts` | UPDATE    | Cover the new short-circuit without weakening the fail-open cases                                                   |
| `docs/learningsuite-enrichment-research.md`   | UPDATE    | Replace the three-tag snippet with the one-tag snippet; document the loader row in the gating table                 |
| `docs/feature-context.md`                     | UPDATE    | Append the durable decisions/gotchas (project convention)                                                           |

---

## NOT Building (Scope Limits)

- **No removal of the three bundles' own gates.** They stay independently
  injectable: the e2e canary plan loads `reskin-player.js` directly, and defence
  in depth costs nothing here.
- **No bundling of the three entries into one file.** Separate bundles are what
  make conditional loading worthwhile; merging them is the opposite change.
- **No minification, hashing, or cache-busting.** `minify: false` is the current
  deliberate setting (`scripts/build-runtime.mjs:26`); the loader inherits it.
  Versioned URLs are a separate concern.
- **No change to any rendering, overlay, playback or telemetry behaviour.** No
  edits inside `reskin-player/`, `demo-overlays/` or `admin-toggle/` beyond what
  the kill-switch short-circuit implies (which is in `common/`).
- **No dynamic `import()` / ESM.** The output stays a classic IIFE injecting
  classic `<script src>` tags — required for a third-party page with unknown CSP
  and `es2019` targeting.
- **No new telemetry events.** The loader reports nothing; if a child never
  loads, that child's existing deadline telemetry is what should fire (see
  Risks for the one case this cannot cover).
- **No propagation of the bypass secret into `beacon.ts` / `killswitch.ts` API
  URLs.** They already drop the query string (`runtime-url.ts:23-31`); that is
  pre-existing behaviour and a separate fix. Note it in Agent Notes, do not
  change it here.
- **No changes to `.github/workflows/runtime.yml`.** Its path filters already
  cover `runtime-src/**`, `public/runtime/**` and `scripts/build-runtime.mjs`.
- **No tenant-side change performed by the agent.** Updating the LearningSuite
  script slot is a human step, documented in Task 8.

---

## Step-by-Step Tasks

Execute in order. Each task is atomic and independently verifiable.

**Status markers** — prefix EVERY task header with one; the build agent updates it inline as it works: `[ ]` idle · `[wip]` in progress · `[x]` complete · `[f]` failed. All tasks start `[ ]`. If a task cannot be made to pass, mark it `[f]`, record why in Agent Notes, and move on if the rest of the plan can still proceed.

### `[x]` Task 1: CREATE `runtime-src/loader/gates.ts`

- **ACTION**: Write the pure predicates and the child-URL builder first, so the
  decision logic is testable without a DOM harness.
- **IMPLEMENT**:
  - `export const ENTRIES = ["reskin-player", "demo-overlays", "admin-toggle"] as const;`
    plus `export type Entry = (typeof ENTRIES)[number];`
  - `isAdminEditMode(loc: { pathname: string; search: string }): boolean` —
    `pathname.includes("/admin/editor/")` and
    `new URLSearchParams(search).get("view") !== "preview"`. Take the location as
    a parameter (options object per repo style is overkill for two fields on a
    single value — pass the `Location`-shaped object) so tests need no history
    manipulation. Must stay byte-for-byte equivalent to
    `runtime-src/admin-toggle/index.ts:164-170`.
  - `hasVpConfig(): boolean` — `document.querySelector("[data-vp-config]")`
    first; only if that misses, fall back to `loadVpConfig() !== null` from
    `../common/config` to also catch the HTML-comment shape.
  - `childUrl(scriptUrl: string, entry: Entry): string` — derive the directory
    from `scriptUrl` and re-attach `scriptUrl`'s **search** string:
    `new URL(entry + ".js" + search, new URL(".", scriptUrl)).href`. Return `""`
    when `scriptUrl` is empty or unparseable (caller then no-ops).
- **MIRROR**: `runtime-src/common/origins.ts` — small pure exported helpers,
  `try/catch` around `new URL`, no assertions.
- **GOTCHA**: the querySelector-first order in `hasVpConfig()` is not an
  optimisation detail, it is required: `loadVpConfig()` walks **every comment
  node** in the document (`common/config.ts:38-54`) and this predicate runs on a
  debounced mutation loop.
- **VALIDATE**: `bun run typecheck:runtime` exits 0.

### `[x]` Task 2: UPDATE `runtime-src/common/killswitch.ts` + `runtime-src/global.d.ts`

- **ACTION**: Let the loader vouch for the flag so children make no second
  request, without weakening fail-open.
- **IMPLEMENT**:
  - In `global.d.ts`, extend the existing `declare global { interface Window }`
    block with `__vpRuntimeGate?: boolean`, `__vpLoaderStatus?: string`,
    `__vpLoaded?: string[]`. Keep the existing `player` declaration and the
    comment style.
  - At the top of `shouldRun()`, before the URL resolution:
    `if (typeof window.__vpRuntimeGate === "boolean") return window.__vpRuntimeGate;`
    with a comment stating why (the loader already asked; one request per page).
  - Export nothing new.
- **GOTCHA**: the check must be `typeof … === "boolean"`, not truthiness — a
  `false` verdict must be honoured, and an absent flag must fall through to the
  fetch so standalone injection keeps working.
- **VALIDATE**: `bun run typecheck:runtime`; `bun test runtime-src/tests/common/killswitch.test.ts`
  still green (existing cases must be unaffected because they never set the flag —
  if happy-dom leaks `window` between tests, delete the flag in `afterEach`).

### `[x]` Task 3: CREATE `runtime-src/loader/index.ts`

- **ACTION**: The loader itself. Target ~110 lines; if it grows past ~150, stop
  and simplify rather than adding options.
- **IMPLEMENT**, in this order:
  1. `const CLEANUP_KEY = "__vpLoaderCleanup";`
  2. `const scriptUrl = getRuntimeScriptUrl();` (from `../common/runtime-url` —
     must run at module top level, while `document.currentScript` is still valid)
     and `const baseUrl = getRuntimeBaseUrl();`
  3. `window.__vpRuntimeBaseUrl = baseUrl;` — set it **before** any child is
     injected so children skip their own `currentScript` resolution.
  4. `function inject(entry: Entry): Promise<void>` — resolve immediately if
     already in `window.__vpLoaded`; otherwise push the name, create
     `document.createElement("script")` with `src = childUrl(scriptUrl, entry)`,
     `async = false`, `defer = false`, append to
     `document.head || document.documentElement`, and resolve on `load`, warn +
     resolve on `error` (never reject — one failed child must not stop the rest).
     Register a `pushCleanup` that removes the tag.
  5. `function waitForPlayer(timeoutMs: number): Promise<boolean>` — resolve true
     as soon as `window.player` is set, polling every 50ms, false on timeout
     (3000ms).
  6. `function main(): string` — `resetCleanup(CLEANUP_KEY)`, then:
     - `applyGates()`: if `isAdminEditMode(location)` → `inject("admin-toggle")`;
       if `hasVpConfig()` and reskin not yet injected → `inject("reskin-player")`
       `.then(() => waitForPlayer(3000))` `.then(() => inject("demo-overlays"))`.
     - Call `applyGates()` once, then arm the debounced MutationObserver on
       `document.body || document.documentElement` (250ms) plus `popstate` and a
       600ms URL poll, all registered via `pushCleanup` — mirroring
       `admin-toggle/index.ts:196-225`.
     - Disarm the observers once every entry has been injected (all three gates
       satisfied) — nothing left to watch for.
     - Return `"loader armed"`.
  7. The bottom IIFE, mirroring `reskin-player/index.ts:1207-1218`:
     ```ts
     void (async () => {
       const allowed = await shouldRun(baseUrl);
       window.__vpRuntimeGate = allowed;
       window.__vpLoaderStatus = allowed
         ? main()
         : "loader: disabled by kill-switch";
     })();
     ```
- **GOTCHA**:
  - Set `__vpRuntimeGate` **before** injecting anything, or the children race the
    loader and fetch the flag themselves.
  - `async = false` on a dynamically created script preserves execution order
    relative to other dynamically inserted scripts; the `demo-overlays`
    injection additionally waits on `window.player`, so both mechanisms agree.
  - `document.currentScript` is valid only during synchronous top-level
    execution — resolving `scriptUrl` inside `main()` (which runs after an
    `await`) would return `null` and fall back to the regex scan, which would
    then match `loader.js` itself. Resolve at module top level.
  - Do **not** gate `reskin-player` on a player being present: that would kill
    the `reskin-no-player-after-deadline` signal (`:1195-1202`), which is exactly
    the "LearningSuite renamed the player element" alarm.
- **VALIDATE**: `bun run typecheck:runtime` exits 0; no `any`, no `as` outside
  the `window as unknown as …` pattern already used in the codebase (with the
  `global.d.ts` additions from Task 2, none should be needed).

### `[x]` Task 4: UPDATE `scripts/build-runtime.mjs` and build

- **ACTION**: Add the fourth entry point and produce the bundle.
- **IMPLEMENT**: add `loader: "runtime-src/loader/index.ts"` to `entryPoints`
  (`scripts/build-runtime.mjs:15`). Change nothing else — same `iife`, `es2019`,
  `sourcemap: "external"`, `minify: false`, same banner.
- **VALIDATE**: `bun run build:runtime` then confirm `public/runtime/loader.js`
  exists, starts with the GENERATED banner, is under ~10KB, and contains no
  `import`/`export` tokens at top level.

### `[x]` Task 5: CREATE `runtime-src/tests/loader/gates.test.ts`

- **ACTION**: Cover the pure decision layer (AC1–AC3).
- **IMPLEMENT** with vitest + happy-dom, mirroring
  `runtime-src/tests/common/killswitch.test.ts` style (AC ids in test names,
  `afterEach` cleanup of `document.body.innerHTML`):
  - `isAdminEditMode`: `/admin/editor/abc` → true; `/admin/editor/abc?view=preview`
    → false; `/lesson/xyz` → false; `/admin/editor/abc?view=edit` → true.
  - `hasVpConfig`: false on an empty document; true for
    `<script type="application/json" data-vp-config>{}</script>`, for
    `<pre data-vp-config>{}</pre>`, and for `<!-- VP_CONFIG {} VP_CONFIG -->`;
    still true for a `[data-vp-config]` element holding **invalid** JSON (the
    reskin gate is presence-based, so the loader must not be stricter).
  - `childUrl`: propagates the search string
    (`…/runtime/loader.js?x-vercel-protection-bypass=S` →
    `…/runtime/reskin-player.js?x-vercel-protection-bypass=S`); works without a
    search string; returns `""` for `""` and for garbage input.
- **VALIDATE**: `bun test runtime-src/tests/loader/gates.test.ts` green.

### `[x]` Task 6: CREATE `runtime-src/tests/loader/loader.test.ts`

- **ACTION**: Cover the injection behaviour (AC4–AC9). This is the test that
  proves the feature.
- **IMPLEMENT**: the loader runs its IIFE on import, so use dynamic
  `await import("../../loader/index")` inside each test after arranging the
  document, with `vi.resetModules()` in `beforeEach`. Arrange:
  - a `<script src="https://cdn.test/runtime/loader.js?bypass=S">` in the
    document (or set `window.__vpRuntimeBaseUrl`) so URL resolution has an
    anchor;
  - `vi.stubGlobal("fetch", …)` for the kill-switch;
  - assert on `[...document.querySelectorAll("script")].map(s => s.src)` and on
    `window.__vpLoaded` / `window.__vpLoaderStatus`. happy-dom does not execute
    injected `src` scripts, so dispatch `load` manually on the created tag when a
    test needs the next step in the chain.
  - Cases:
    - no config, not admin → **no** child script injected, `__vpLoaderStatus === "loader armed"`.
    - config present → `reskin-player.js` injected exactly once, with the bypass
      query string carried over; `demo-overlays.js` **not yet** injected.
    - after the reskin tag's `load` fires and `window.player` is set →
      `demo-overlays.js` injected, and `__vpLoaded` order is
      `["reskin-player", "demo-overlays"]`.
    - `window.player` never set → `demo-overlays.js` still injected after the
      3s wait (use `vi.useFakeTimers()`), because demo's own safety net owns that
      failure — assert this deliberately so the timeout behaviour is pinned.
    - config appears **after** load (append `<pre data-vp-config>` then flush the
      250ms debounce) → `reskin-player.js` injected.
    - admin URL → `admin-toggle.js` injected; `?view=preview` → not injected.
    - kill-switch `{ enabled: false }` → **nothing** injected (including
      `admin-toggle`), `__vpRuntimeGate === false`,
      `__vpLoaderStatus === "loader: disabled by kill-switch"`.
    - `__vpRuntimeGate` is `true` before the first child tag is appended
      (assert via the order of a spy on `document.head.appendChild`).
    - re-import / re-run with a config already handled → each child appears at
      most once (idempotency).
- **GOTCHA**: happy-dom's `MutationObserver` callbacks are microtask-scheduled;
  `await Promise.resolve()` plus advancing timers is needed before asserting on
  debounced work. Prefer `vi.useFakeTimers()` + `vi.advanceTimersByTime(300)`
  over real waits.
- **VALIDATE**: `bun test runtime-src/tests/loader/` green; whole suite green.

### `[x]` Task 7: UPDATE `runtime-src/tests/common/killswitch.test.ts`

- **ACTION**: Pin the short-circuit contract.
- **IMPLEMENT**: two cases — `window.__vpRuntimeGate = true` → returns true and
  `fetch` is **not** called; `= false` → returns false and `fetch` is not called.
  Delete the flag in `afterEach` so the existing fail-open cases stay honest.
- **VALIDATE**: `bun test runtime-src/tests/common/killswitch.test.ts` green,
  including all pre-existing cases.

### `[x]` Task 8: UPDATE the docs

- **ACTION**: Make the injection instructions match reality; keep the three-tag
  method documented as the fallback.
- **IMPLEMENT**:
  - `docs/learningsuite-enrichment-research.md`: add a `loader.js` row to the
    self-gating table at `:397-401` ("Active when: always — decides what to load")
    and replace the three-tag snippet at `:489-508` with the single loader tag,
    keeping a short "direct injection (debugging / e2e)" note that the three
    bundles remain individually loadable. Document that the bypass secret goes on
    the **loader** URL and is propagated automatically.
  - `docs/feature-context.md`: append the durable items — one tag instead of
    three; `__vpRuntimeGate` contract and why it must be `typeof === "boolean"`;
    query-string propagation as the reason child URLs are built by hand;
    `reskin-player` gated on config-only to preserve the no-player deadline
    telemetry; `admin-toggle` is now kill-switchable.
  - Do **not** rewrite `docs/branch-summary-mm-refactoring.md` (untracked working
    note) or `docs/reskin-player-resilience-analysis.md` (historical analysis).
- **VALIDATE**: `grep -c "runtime/loader.js" docs/learningsuite-enrichment-research.md`
  ≥ 1; no remaining instruction that tells the operator to paste three tags as the
  primary path.

### `[x]` Task 9: REBUILD, run the full validation loop, and add the forward ref

- **ACTION**: Land the generated output and close the loop.
- **IMPLEMENT**:
  - `bun run build:runtime` and commit `public/runtime/loader.js` (the `.js.map`
    is gitignored per existing convention — verify with `git status`).
  - Run every command in **Validation Commands** below.
  - Add a `Forward refs` entry to
    `.claude/PRPs/plans/2026-07-27_e2e-canary_learningsuite-overlay-playwright.plan.md`
    pointing at this plan (bidirectional-reference rule), and note there that the
    canary's `page.route("**/runtime/*.js")` glob already matches `loader.js`,
    while its "no changes to `runtime-src/**`" scope limit predates this plan.
  - Commit as `[FEATURE] Add runtime loader that conditionally injects the three
augment bundles`.
- **GOTCHA**: the drift check fails the build if `public/runtime` is out of sync —
  rebuild **after** the last source edit, not before.
- **VALIDATE**: `git diff --exit-code -- public/runtime` exits 0 after a fresh
  `bun run build:runtime`.

---

## Testing Strategy

Unit tests only, vitest + happy-dom, under `runtime-src/tests/loader/` — matching
the existing layout (`runtime-src/tests/<entry>/…`) and the `vitest.config.ts`
include globs. No browser-mode tests: the loader's whole job is DOM bookkeeping
plus URL construction, both fully observable in happy-dom. End-to-end proof that
the injected chain still mounts belongs to the e2e canary plan.

### Test Matrix

| Test                 | Assertion                                                   | Validates                                                                 | Fails when                                      |
| -------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------- |
| `gates.test.ts`      | `isAdminEditMode` truth table                               | Gate parity with `admin-toggle`'s own `isEditMode()`                      | The predicates drift apart                      |
| "                    | `hasVpConfig` across all three config shapes + invalid JSON | Comment-shaped configs still activate; presence-based, not validity-based | A shape is missed → lesson silently unaugmented |
| "                    | `childUrl` carries the search string                        | The Vercel bypass secret reaches children                                 | Children 401 and nothing mounts                 |
| `loader.test.ts`     | no config + not admin → zero child tags                     | The "page untouched" promise                                              | Loader over-injects                             |
| "                    | config → exactly one `reskin-player.js`                     | Gate + once-only injection                                                | Duplicate observers / CPU peg                   |
| "                    | demo injected only after reskin `load` + `window.player`    | Explicit ordering (fixes the `:1157` race)                                | Demo throws into its safety net                 |
| "                    | demo injected after the 3s player wait times out            | Documented fallback, not a hang                                           | Demo never loads on a slow reskin               |
| "                    | config appended later → reskin injected                     | Lazy gate re-evaluation under React's async render                        | The head-time-only reading of the gate          |
| "                    | kill-switch off → zero child tags, status string            | Single gate covers all three                                              | `admin-toggle` escapes the kill-switch          |
| "                    | `__vpRuntimeGate` set before first append                   | Children never re-fetch the flag                                          | Two `/api/runtime-config` calls remain          |
| `killswitch.test.ts` | flag short-circuit both ways; fail-open unchanged           | The one contract that must not regress                                    | A network error disables a working runtime      |

### Edge Cases Checklist

- [ ] Loader executed in `<head>` before `<body>` exists → observes
      `documentElement`, does not throw
- [ ] Loader injected twice → `resetCleanup` disarms the first run's observers;
      each child still appears at most once
- [ ] A child script 404s / 401s → `onerror` warns; the other children still load
- [ ] `document.currentScript` unavailable (loader injected via `eval` in a
      devtools session) → falls back to the `/runtime/*.js` scan; verify it does
      not resolve to `loader.js` itself in a way that breaks `childUrl`
- [ ] `window.__vpRuntimeBaseUrl` pre-set by a harness (the e2e canary does this)
      → loader honours it and does not overwrite it with a worse value
- [ ] Admin editor navigated to via `pushState` after load → URL poll catches it
- [ ] Config present but no player ever appears → reskin's existing
      `reskin-no-player-after-deadline` telemetry still fires
- [ ] Page with a config but the kill-switch flipped mid-session → no retro-active
      teardown expected (documented, not implemented)

---

## Validation Commands

🔁 **Validation loop:** the plan is not complete until every command below passes (exit 0). On any failure, fix the cause and re-run — loop until all pass. If a check is genuinely impossible, mark it `[f]`, note why in Agent Notes, and move on.

### Level 1: STATIC_ANALYSIS

```bash
bun run lint && bunx tsc --noEmit && bun run typecheck:runtime
```

**EXPECT**: Exit 0.

### Level 2: UNIT_SUITE

```bash
bun test
```

**EXPECT**: All pre-existing tests still green, plus the new
`runtime-src/tests/loader/**` cases and the two new killswitch cases.

### Level 3: BUILD_AND_DRIFT

```bash
bun run build:runtime && git diff --exit-code -- public/runtime
```

**EXPECT**: Exit 0, and `public/runtime/loader.js` present and committed.

### Level 4: LOADER_SHAPE

```bash
node -e 'const s=require("fs").readFileSync("public/runtime/loader.js","utf8");
if(!s.startsWith("/* GENERATED"))throw new Error("banner missing");
if(/^\s*(import|export)\s/m.test(s))throw new Error("not a classic IIFE");
console.log("loader.js ok", s.length, "bytes")'
```

**EXPECT**: Exit 0, size well under 10KB.

### Level 5: MANUAL_VALIDATION (against the deployed preview)

1. Open a **configured** lesson with only
   `<script src=".../runtime/loader.js?x-vercel-protection-bypass=SECRET" defer>`
   injected. Confirm in DevTools → Network that `loader.js`,
   `reskin-player.js` and `demo-overlays.js` load (in that order, each with the
   bypass query string) and `admin-toggle.js` does **not**. Confirm
   `__vpReskinStatus === "reskin attached"`, `__vpDemoStatus === "demo: setup queued"`,
   `__vpLoaded` is `["reskin-player","demo-overlays"]`, and overlays behave as
   before. Confirm `/api/runtime-config` is requested exactly **once**.
2. Open an **unconfigured** page (no video / no config): only `loader.js` in
   Network, no child bundles, page visually untouched.
3. Open `/admin/editor/…`: `admin-toggle.js` loads, banner appears. Switch to
   `?view=preview` via the LS UI and back — no duplicate banners.
4. Flip Edge Config `runtimeConfig.enabled` to `false`, reload a configured
   lesson: no child bundles in Network,
   `__vpLoaderStatus === "loader: disabled by kill-switch"`, native player intact,
   **and the admin banner is gone** in the editor. Flip it back.
5. Re-inject `loader.js` by hand in the console on a mounted page → no duplicated
   overlays, no CPU spike, children not re-added.

---

## Acceptance Criteria

- [ ] **AC1** — Given a page whose URL contains `/admin/editor/` and no
      `?view=preview`, when the loader runs, then `admin-toggle.js` is injected;
      given `?view=preview` or any other path, then it is not.
- [ ] **AC2** — Given a config present in any of the three shapes supported by
      `loadVpConfig()` (script, element, HTML comment), when the loader runs, then
      `reskin-player.js` is injected; given no config, then no bundle is injected
      and the page DOM is unmodified.
- [ ] **AC3** — Given the loader's own URL carries a query string, when a child is
      injected, then the child URL carries the identical query string.
- [ ] **AC4** — Given a config on the page, when `reskin-player.js` has loaded and
      `window.player` is published, then `demo-overlays.js` is injected — and
      never before; `window.__vpLoaded` records the order.
- [ ] **AC5** — Given `reskin-player.js` loads but `window.player` never appears,
      when 3s elapse, then `demo-overlays.js` is injected anyway and the loader
      logs a warning (demo's own safety net owns the outcome).
- [ ] **AC6** — Given the config is added to the DOM after the loader ran (React's
      async render), when the debounced gate re-evaluation fires, then
      `reskin-player.js` is injected.
- [ ] **AC7** — Given `/api/runtime-config` returns `{ enabled: false }`, when the
      loader runs, then **no** child bundle is injected — `admin-toggle` included —
      and `window.__vpLoaderStatus === "loader: disabled by kill-switch"`.
- [ ] **AC8** — Given the loader ran, when a child bundle executes, then that
      child makes **no** request to `/api/runtime-config` (exactly one such
      request per page load); and given no loader (direct injection), then the
      child's own kill-switch fetch still happens and still fails open.
- [ ] **AC9** — Given the loader is injected a second time into a live page, then
      each child bundle remains present at most once and the previous run's
      observers/timers are disarmed.
- [ ] **AC10** — `bun run lint`, `bunx tsc --noEmit`, `bun run typecheck:runtime`
      and `bun test` pass, and `git diff --exit-code -- public/runtime` is clean
      after a fresh `bun run build:runtime`.

---

## Completion Checklist

- [ ] All 9 tasks completed in dependency order
- [ ] Each task validated immediately after completion
- [ ] Level 1: lint + both typechecks pass
- [ ] Level 2: full unit suite green (old count + new tests)
- [ ] Level 3: build + drift check clean, `loader.js` committed
- [ ] Level 4: loader bundle shape verified
- [ ] Level 5: all five manual checks done on the preview deployment
- [ ] AC1–AC10 met
- [ ] `docs/learningsuite-enrichment-research.md` shows the one-tag snippet
- [ ] `docs/feature-context.md` entry appended
- [ ] Forward ref added to the e2e-canary plan
- [ ] Tenant script slot updated (human step) — or explicitly deferred with the
      three tags left in place, which keeps working

---

## Risks and Mitigations

| Risk                                                                           | Likelihood | Impact | Mitigation                                                                                                                                                                                 |
| ------------------------------------------------------------------------------ | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bypass secret not propagated → children 401 and nothing mounts                 | MED        | HIGH   | `childUrl()` re-attaches the loader's search string; unit-tested (AC3); manual check 1 verifies the Network tab                                                                            |
| Extra round-trip delays the reskin, widening the native-controls flash         | MED        | LOW    | Children are injected as soon as the gate passes; the chrome-hiding CSS is applied lazily on first attach either way (`reskin-player/index.ts:74-76`)                                      |
| Gate drifts from a child's own gate (e.g. LS changes the editor path)          | MED        | MED    | Gates are copies of the children's predicates, unit-tested against the same truth table; children keep their own gates so a loader gate can only be _narrower_, never wrong-way-permissive |
| A too-strict loader gate silently suppresses existing deadline telemetry       | MED        | HIGH   | Explicit design rule: gate on config only, never on player presence; covered by the edge-case checklist and AC2                                                                            |
| `document.currentScript` resolution moved after an `await` → base URL wrong    | LOW        | HIGH   | Resolved at module top level (Task 3 gotcha); AC3 test asserts the resulting child URLs                                                                                                    |
| e2e canary breaks because it injects/routes bundles directly                   | MED        | MED    | `page.route("**/runtime/*.js")` already matches `loader.js`; the three bundles remain standalone-injectable; Task 9 adds the cross-reference                                               |
| Kill-switch now able to disable the admin banner (new blast radius)            | LOW        | MED    | Intended and documented; flipping the flag is already an all-embeds action                                                                                                                 |
| Loader itself becomes the single point of failure for all three bundles        | LOW        | HIGH   | It only fails open (no injection = native player, i.e. today's unconfigured-page behaviour); the three-tag method stays documented as the fallback                                         |
| Stale `loader.js` cached by the CDN while children change                      | LOW        | MED    | Loader carries no feature logic beyond gating; children are fetched fresh by name — same caching story as today                                                                            |
| happy-dom cannot execute injected scripts, so tests assert on tags not effects | HIGH       | LOW    | Accepted: effect-level proof is the e2e canary's job; tests dispatch `load` manually to drive the chain                                                                                    |

---

## Questionables

<details>
<summary>Ticket id — used the repo's topic-slug convention (`runtime-loader`)</summary>

Every prior plan uses a topic slug where the naming convention wants a ticket
(`e2e-canary`, `audio-attach`, `resilience`, `perf`). Followed the precedent
rather than inventing an id.

</details>

<details>
<summary>3s player wait, 250ms mutation debounce, 600ms URL poll — where the numbers come from</summary>

The debounce and poll intervals are copied verbatim from
`runtime-src/admin-toggle/index.ts:196-225` and
`runtime-src/reskin-player/index.ts:1165-1172` so the loader adds no new timing
behaviour to reason about. The 3s player wait is new and arbitrary; it exists only
as a backstop, since with the `__vpRuntimeGate` short-circuit `shouldRun()`
resolves synchronously and `window.player` is set during microtask drain — i.e.
before the reskin tag's `load` event fires. If the implementer can show that
guarantee holds in a test, dropping the wait entirely is a legitimate
simplification; the AC5 test pins the current, safer choice.

</details>

<details>
<summary>Why not move the gates *out* of the three bundles</summary>

Tempting (one place per decision) but rejected: the bundles must stay
independently injectable for debugging, for the e2e canary, and as the fallback
if the loader is ever a problem in the tenant. Duplicated predicates are cheap
and unit-tested for parity; a bundle that trusts an external gate is not.

</details>

<details>
<summary>Not fixed here: the bypass secret is still dropped from API calls</summary>

`getRuntimeBaseUrl()` strips the query string (`runtime-url.ts:23-31`), so the
kill-switch and telemetry POSTs go to `…/api/…` without
`x-vercel-protection-bypass`. On a protected deployment that means the kill-switch
fetch 401s and — by design — fails open, and telemetry beacons are dropped. That
is pre-existing behaviour, orthogonal to this plan, and touching it would change
the kill-switch's effective reach. Flagged as a follow-up, not built.

</details>

---

## Agent Notes

### The one behaviour change to be honest about

Consolidating the kill-switch brings `admin-toggle` under it for the first time
(`runtime-src/admin-toggle/index.ts:226` calls `main()` synchronously today).
This is intentional and was confirmed with the user. It also means that on a
protection-enabled deployment where the flag fetch 401s, the admin banner now
depends on fail-open working correctly — which `killswitch.ts` guarantees and the
existing tests pin.

### What makes this refactor safe

Every bundle already tears itself down and re-arms on re-injection via the
`__vp*Cleanup` registry (`runtime-src/common/cleanup.ts`), and every bundle
already re-checks its own gate internally. The loader therefore cannot create a
state the bundles have not already handled — the worst case is that a bundle is
injected on a page where it decides to do nothing, which is exactly today's
behaviour for all three bundles on every page.

### Where the ordering bug actually lives

`runtime-src/demo-overlays/index.ts:1157` calls `window.player.setOverlays([])`
with no existence check; `readyContext()` at `:84-89` waits for a config and a
player element but **not** for `window.player`. The loader fixes the symptom by
sequencing the injections. A more direct fix would be to add `window.player` to
`readyContext()` — deliberately out of scope here (no edits inside the three
entries), and worth raising as a follow-up if the loader ever stops being the
only injection path.

### Things the implementer will probably hit

- happy-dom does not fetch or execute `<script src>`; drive the chain by
  dispatching `new Event("load")` on the tag the loader created.
- `window` state leaks between vitest tests in the same file (happy-dom reuses the
  global). Delete `__vpRuntimeGate`, `__vpLoaded`, `__vpLoaderStatus`,
  `__vpRuntimeBaseUrl` and `player` in `afterEach`, and use `vi.resetModules()`
  so re-importing the loader re-runs its IIFE.
- The loader's own `console.warn` on a failed child load will be noisy in tests —
  stub `console.warn` where it is expected.

### Follow-ups deliberately left out of scope

- Query-string propagation into `runtimeApiUrl()` (see Questionables).
- `window.player` readiness inside `demo-overlays`' own `readyContext()`.
- Minification / hashed filenames for the runtime bundles.
- Loader-level telemetry ("gate never passed on a page that has a video").

---

## Amendments

### 2026-07-28 — implemented (commit `97ad07d`)

Built as planned: `runtime-src/loader/{index,gates}.ts` → `public/runtime/loader.js`
(7,927 bytes), the `__vpRuntimeGate` short-circuit in `common/killswitch.ts`, 24 new
unit tests (135 total, all green), drift check clean, docs switched to the one-tag
snippet. Deviations:

1. **`childUrl()` resolves against `location.href`** so a relative loader URL or a
   relative `__vpRuntimeBaseUrl` override still works. Consequence: an arbitrary
   string is no longer "unparseable", so the Task 5 garbage case asserts on `""`
   and `"http://["`.
2. **`__vpRuntimeBaseUrl` was also added to `global.d.ts`** — the loader writes it,
   so it needs the declaration. The pre-existing cast in `runtime-url.ts` is
   untouched.
3. **AC8's "gate set before the first append"** is proven by asserting exactly one
   `fetch` per page load and then calling `shouldRun()` directly and showing it does
   not fetch — simpler and stronger than spying on `appendChild` order, which needed
   a type assertion.
4. **Level 2's command was wrong in this plan**: `bun test` runs bun's own test
   runner (no happy-dom → `document is not defined`). The project suite is vitest:
   `bun run test`.
5. **Level 5 (manual, live preview) not executed** — needs the LearningSuite tenant,
   a preview deploy and Edge Config access. The five checks stand as written; the
   kill-switch check now also verifies the admin banner disappears.

Test-harness facts worth keeping: happy-dom logs a harmless `NotSupportedError` for
every injected `<script src>` (it never loads them, so tests dispatch `load` by
hand); `window.location.href` is assignable; fake timers must be installed **before**
the loader arms its `window.player` poll or the already-created real interval cannot
be advanced.
