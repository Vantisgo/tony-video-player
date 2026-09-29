// Resolve the origin the runtime scripts were served from. The scripts are
// injected into a third-party (LearningSuite) page, so `location.origin` is the
// host — not us. To call our own API (kill-switch, telemetry) we need the origin
// of the injected <script>, taken from `document.currentScript` while the script
// is executing synchronously, with a fallback scan for a `/runtime/<name>.js`.
export function getRuntimeScriptUrl(): string {
  const override = (window as unknown as { __vpRuntimeBaseUrl?: string })
    .__vpRuntimeBaseUrl;
  if (override) return override;

  const current = document.currentScript as HTMLScriptElement | null;
  if (current?.src) return current.src;

  const hit = [...document.scripts]
    .reverse()
    .find((s) => s.src && /\/runtime\/[\w-]+\.js/i.test(s.src));
  return hit?.src || "";
}

// Query params carried from the runtime script URL onto our own requests. A
// protection-enabled Vercel deployment answers anything without the bypass token
// with a login redirect that has no CORS headers, which the browser reports as a
// CORS failure. The token is already public in the page's <script src>, and
// nothing else is forwarded.
export const FORWARDED_QUERY_PARAMS = new Set(["x-vercel-protection-bypass"]);

function forwardQuery(from: URL, to: URL): string {
  from.searchParams.forEach((value, key) => {
    if (FORWARDED_QUERY_PARAMS.has(key) && !to.searchParams.has(key))
      to.searchParams.set(key, value);
  });
  return to.href;
}

// The script's directory, keeping the forwarded params in its query so they
// survive the loader handing it to the children via __vpRuntimeBaseUrl.
export function getRuntimeBaseUrl(): string {
  const scriptUrl = getRuntimeScriptUrl();
  if (!scriptUrl) return "";
  try {
    const script = new URL(scriptUrl, location.href);
    return forwardQuery(script, new URL(".", script));
  } catch {
    return scriptUrl;
  }
}

// Build an absolute URL to one of our API routes from the runtime base URL.
// Returns "" when the base is unknown (caller then fails open / no-ops).
export function runtimeApiUrl(baseUrl: string, path: string): string {
  if (!baseUrl) return "";
  try {
    const base = new URL(baseUrl, location.href);
    return forwardQuery(base, new URL(path, base));
  } catch {
    return "";
  }
}
