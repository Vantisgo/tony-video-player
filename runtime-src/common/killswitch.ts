import { runtimeApiUrl } from "./runtime-url";

// Remote kill-switch. The runtime is injected into third-party pages and cannot
// be hot-patched per embed, so before it mutates the page it asks our own API
// whether it should run. Flipping the flag (Vercel Edge Config, read by
// app/api/runtime-config) disables every embed on next load with no redeploy.
//
// CRITICAL: this must FAIL OPEN. A network error, timeout, blocked request, or
// unknown origin must never disable a working runtime — only an explicit
// `{ enabled: false }` does.
const FLAG_PATH = "/api/runtime-config";
const TIMEOUT_MS = 3000;

// Everything the endpoint tells the runtime, from ONE request. `devProbe` gates
// the local-dev probe in loader/local-runtime.ts: that probe makes learners'
// browsers issue a local-network request, so it needs an off-switch that does
// not require a redeploy — the same reason `enabled` exists.
export interface RuntimeFlags {
  enabled: boolean;
  devProbe: boolean;
}

// Both flags fail OPEN, for the same reason and by the same rule: only an
// explicit `false` turns something off.
const FAIL_OPEN: RuntimeFlags = { enabled: true, devProbe: true };

const readFlags = (data: unknown): RuntimeFlags => {
  const o =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  return { enabled: o.enabled !== false, devProbe: o.devProbe !== false };
};

export async function fetchRuntimeFlags(
  baseUrl: string,
): Promise<RuntimeFlags> {
  const url = runtimeApiUrl(baseUrl, FLAG_PATH);
  if (!url) return FAIL_OPEN; // unknown origin → can't ask → run

  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), TIMEOUT_MS)
    : null;
  try {
    const res = await fetch(url, {
      credentials: "omit",
      signal: controller?.signal,
    });
    if (!res.ok) return FAIL_OPEN;
    return readFlags(await res.json());
  } catch {
    return FAIL_OPEN; // network / timeout / CSP block → fail open
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function shouldRun(baseUrl: string): Promise<boolean> {
  // loader.js asks once per page load and publishes the verdict, so the bundles
  // it injects skip this request. `typeof` — not truthiness — so an explicit
  // `false` is honoured, and an absent flag still fetches: a bundle injected on
  // its own (debugging, e2e) keeps its own kill-switch.
  if (typeof window.__vpRuntimeGate === "boolean")
    return window.__vpRuntimeGate;

  return (await fetchRuntimeFlags(baseUrl)).enabled;
}
