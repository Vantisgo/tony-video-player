// loader — the single script injected into the LearningSuite tenant. It resolves
// our own origin (carrying its query string, i.e. the deployment-protection
// bypass secret, over to every child URL), asks the kill-switch once, then
// injects each augment bundle only when that bundle's gate passes. A page whose
// gates never pass downloads nothing beyond this file and is left untouched.
//
// The three bundles keep their own gates and their own idempotency, so they stay
// injectable on their own (debugging, e2e) — this loader is additive.
import { pushCleanup, resetCleanup } from "../common/cleanup";
import { fetchRuntimeFlags } from "../common/killswitch";
import { getRuntimeBaseUrl, getRuntimeScriptUrl } from "../common/runtime-url";
import { childUrl, ENTRIES, hasVpConfig, isAdminEditMode } from "./gates";
import type { Entry } from "./gates";
import { LOCAL_LOADER_URL, probeLocalRuntime } from "./local-runtime";

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
// `base` is the local loader URL when a dev server answered, "" otherwise. It is
// passed to childUrl() in place of our own script URL, so the deployed path and
// the local path share one construction (and the local one carries no bypass
// query, which it does not need).
function inject(entry: Entry, base: string): Promise<void> {
  const done = loaded();
  if (done.indexOf(entry) !== -1) return Promise.resolve();

  const src = childUrl(base || scriptUrl, entry);
  if (!src) {
    console.warn("[vp loader] cannot resolve a URL for", entry);
    return Promise.resolve();
  }

  done.push(entry);
  return new Promise<void>((resolve) => {
    const el = document.createElement("script");
    el.src = src;
    // MANDATORY for a loopback origin: Chrome fetches a no-CORS script from
    // http://localhost, discards the response and fires NEITHER load NOR error,
    // which would leave this promise unsettled forever and stall the chain below
    // with nothing in the console. Production is https and unaffected.
    if (src.startsWith("http://")) el.crossOrigin = "anonymous";
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

function main(probeAllowed: boolean): string {
  // Idempotency: disarm a previous run's observers and timers before arming new
  // ones. window.__vpLoaded is deliberately NOT reset — a bundle already
  // executing must not be injected a second time.
  resetCleanup(CLEANUP_KEY);

  let reskinChainStarted = false;
  let basePromise: Promise<string> | null = null;

  // Resolved once per page, on first use, and only from inside a passing gate —
  // so a page that loads no bundle never touches the local network. All three
  // children then share one verdict: a local reskin-player against a deployed
  // demo-overlays would be version skew that reads like a runtime bug.
  function runtimeBase(): Promise<string> {
    if (!probeAllowed) return Promise.resolve("");
    return (basePromise ??= probeLocalRuntime().then((local) => {
      window.__vpLocalRuntime = local ? "local" : "deployed";
      if (!local) return "";
      console.info("[vp loader] local dev runtime detected; using it");
      // Point the children's kill-switch and telemetry at the dev server too:
      // the same `bun dev` serves /api/runtime-config and /api/runtime-telemetry,
      // so a developer's beacons stay out of production. Read as a *script* URL
      // (see common/runtime-url.ts), hence the loader URL rather than a bare dir.
      window.__vpRuntimeBaseUrl = LOCAL_LOADER_URL;
      return LOCAL_LOADER_URL;
    }));
  }

  function applyGates(): void {
    if (isAdminEditMode(location))
      void runtimeBase().then((base) => inject("admin-toggle", base));
    if (reskinChainStarted || !hasVpConfig()) return;
    reskinChainStarted = true;
    void runtimeBase().then((base) =>
      inject("reskin-player", base)
        .then(() => waitForPlayer(PLAYER_WAIT_MS))
        .then(() => inject("demo-overlays", base)),
    );
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
  // The two override signals mean different things and must not be merged:
  // a pre-set __vpRuntimeGate is a verdict already fetched (skip the request),
  // while a pre-set __vpRuntimeBaseUrl only pins where bundles come from — the
  // e2e preview harness sets it and still wants the real kill-switch.
  const basePinned = !!window.__vpRuntimeBaseUrl;
  const gate = window.__vpRuntimeGate;
  const flags =
    typeof gate === "boolean"
      ? { enabled: gate, devProbe: false }
      : await fetchRuntimeFlags(baseUrl);

  // Never probe over a harness's explicit choice of origin.
  const probeAllowed = flags.devProbe && !basePinned;

  window.__vpRuntimeGate = flags.enabled;
  // Set before the first child is injected, otherwise children race the loader
  // and fetch the flag themselves. An existing value (e2e harness) wins.
  if (!window.__vpRuntimeBaseUrl && baseUrl)
    window.__vpRuntimeBaseUrl = baseUrl;
  window.__vpLoaderStatus = flags.enabled
    ? main(probeAllowed)
    : "loader: disabled by kill-switch";
})();
