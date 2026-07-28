// loader — the single script injected into the LearningSuite tenant. It resolves
// our own origin (carrying its query string, i.e. the deployment-protection
// bypass secret, over to every child URL), asks the kill-switch once, then
// injects each augment bundle only when that bundle's gate passes. A page whose
// gates never pass downloads nothing beyond this file and is left untouched.
//
// The three bundles keep their own gates and their own idempotency, so they stay
// injectable on their own (debugging, e2e) — this loader is additive.
import { pushCleanup, resetCleanup } from "../common/cleanup";
import { shouldRun } from "../common/killswitch";
import { getRuntimeBaseUrl, getRuntimeScriptUrl } from "../common/runtime-url";
import { childUrl, ENTRIES, hasVpConfig, isAdminEditMode } from "./gates";
import type { Entry } from "./gates";

const CLEANUP_KEY = "__vpLoaderCleanup";
const PLAYER_WAIT_MS = 3000;
const PLAYER_POLL_MS = 50;
const SCAN_DEBOUNCE_MS = 250;
const URL_POLL_MS = 600;

// Resolved at module top level on purpose: document.currentScript is only valid
// while this script executes synchronously. Resolving after the kill-switch
// await would fall back to the script scan in runtime-url.ts, which would then
// match loader.js itself.
const scriptUrl = getRuntimeScriptUrl();
const baseUrl = getRuntimeBaseUrl();

function loaded(): string[] {
  return (window.__vpLoaded ??= []);
}

// Inject a bundle at most once. Never rejects — a child that fails to load must
// not stop the others.
function inject(entry: Entry): Promise<void> {
  const done = loaded();
  if (done.indexOf(entry) !== -1) return Promise.resolve();

  const src = childUrl(scriptUrl, entry);
  if (!src) {
    console.warn("[vp loader] cannot resolve a URL for", entry);
    return Promise.resolve();
  }

  done.push(entry);
  return new Promise<void>((resolve) => {
    const el = document.createElement("script");
    el.src = src;
    // Preserves execution order relative to other dynamically inserted scripts.
    el.async = false;
    el.onload = () => resolve();
    el.onerror = () => {
      console.warn("[vp loader] failed to load", src);
      resolve();
    };
    (document.head || document.documentElement).appendChild(el);
    pushCleanup(CLEANUP_KEY, () => el.remove());
  });
}

// demo-overlays dereferences window.player unconditionally, so it is injected
// only once reskin-player has published it. On timeout we inject anyway: demo's
// own safety net owns that failure, and staying silent would hide it.
function waitForPlayer(timeoutMs: number): Promise<void> {
  if (window.player) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const started = Date.now();
    const id = setInterval(() => {
      if (window.player) {
        clearInterval(id);
        resolve();
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        clearInterval(id);
        console.warn(
          "[vp loader] window.player never appeared; loading demo-overlays anyway",
        );
        resolve();
      }
    }, PLAYER_POLL_MS);
    pushCleanup(CLEANUP_KEY, () => clearInterval(id));
  });
}

function main(): string {
  // Idempotency: disarm a previous run's observers and timers before arming new
  // ones. window.__vpLoaded is deliberately NOT reset — a bundle already
  // executing must not be injected a second time.
  resetCleanup(CLEANUP_KEY);

  let reskinChainStarted = false;

  function applyGates(): void {
    if (isAdminEditMode(location)) void inject("admin-toggle");
    if (reskinChainStarted || !hasVpConfig()) return;
    reskinChainStarted = true;
    void inject("reskin-player")
      .then(() => waitForPlayer(PLAYER_WAIT_MS))
      .then(() => inject("demo-overlays"));
  }

  // Gates are re-evaluated on DOM and URL changes, not just once: LearningSuite
  // renders the [data-vp-config] block via React after head scripts run, and
  // navigates the editor with pushState. Same intervals as admin-toggle.
  let scanPending: ReturnType<typeof setTimeout> | 0 = 0;
  function scheduleApply(): void {
    if (scanPending) return;
    scanPending = setTimeout(() => {
      scanPending = 0;
      applyGates();
      if (loaded().length === ENTRIES.length) disarm();
    }, SCAN_DEBOUNCE_MS);
  }

  const mo = new MutationObserver(scheduleApply);
  mo.observe(document.body || document.documentElement, {
    subtree: true,
    childList: true,
  });

  let lastHref = location.href;
  const checkUrl = (): void => {
    if (location.href === lastHref) return;
    lastHref = location.href;
    applyGates();
  };
  window.addEventListener("popstate", checkUrl);
  const urlPollId = setInterval(checkUrl, URL_POLL_MS);

  function disarm(): void {
    mo.disconnect();
    if (scanPending) {
      clearTimeout(scanPending);
      scanPending = 0;
    }
    window.removeEventListener("popstate", checkUrl);
    clearInterval(urlPollId);
  }
  pushCleanup(CLEANUP_KEY, disarm);

  applyGates();

  return "loader armed";
}

// Kill-switch gate: asked once here, published for the children (see
// common/killswitch.ts). Fails open, so a fetch failure never disables a working
// runtime — only an explicit `{ enabled: false }` does.
void (async () => {
  const allowed = await shouldRun(baseUrl);
  window.__vpRuntimeGate = allowed;
  // Set before the first child is injected, otherwise children race the loader
  // and fetch the flag themselves. An existing value (e2e harness) wins.
  if (!window.__vpRuntimeBaseUrl && baseUrl)
    window.__vpRuntimeBaseUrl = baseUrl;
  window.__vpLoaderStatus = allowed
    ? main()
    : "loader: disabled by kill-switch";
})();
