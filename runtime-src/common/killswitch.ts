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

export async function shouldRun(baseUrl: string): Promise<boolean> {
  const url = runtimeApiUrl(baseUrl, FLAG_PATH);
  if (!url) return true; // unknown origin → can't ask → run

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
    if (!res.ok) return true; // fail open
    const data: unknown = await res.json();
    return !isDisabled(data);
  } catch {
    return true; // network / timeout / CSP block → fail open
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isDisabled(data: unknown): boolean {
  return (
    !!data &&
    typeof data === "object" &&
    (data as { enabled?: unknown }).enabled === false
  );
}
