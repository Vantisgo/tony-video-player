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

export function getRuntimeBaseUrl(): string {
  const scriptUrl = getRuntimeScriptUrl();
  if (!scriptUrl) return "";
  try {
    return new URL(".", scriptUrl).href;
  } catch {
    return scriptUrl;
  }
}

// Build an absolute URL to one of our API routes from the runtime base URL.
// Returns "" when the base is unknown (caller then fails open / no-ops).
export function runtimeApiUrl(baseUrl: string, path: string): string {
  if (!baseUrl) return "";
  try {
    return new URL(path, baseUrl).href;
  } catch {
    return "";
  }
}
