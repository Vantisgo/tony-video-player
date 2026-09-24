// Pure resolution of the runtime kill-switch flag, testable without Edge Config.
// Fail-open by construction: only an explicit `enabled: false` disables the
// runtime; anything else (missing/malformed value) resolves to enabled.

export interface RuntimeFlag {
  enabled: boolean;
  minHostVersion: string | null;
  // Whether loader.js may probe http://localhost for a developer's dev server
  // (runtime-src/loader/local-runtime.ts). That probe makes learners' browsers
  // issue a local-network request, so it needs an off-switch that does not
  // require a redeploy — same rationale as `enabled`, same fail-open rule.
  devProbe: boolean;
}

export function resolveFlag(raw: unknown): RuntimeFlag {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return {
      enabled: o.enabled !== false,
      minHostVersion:
        typeof o.minHostVersion === "string" ? o.minHostVersion : null,
      devProbe: o.devProbe !== false,
    };
  }
  return { enabled: true, minHostVersion: null, devProbe: true };
}

// Build the Edge Config Read-API URL for a single item from the `EDGE_CONFIG`
// connection string (`https://edge-config.vercel.com/<id>?token=<token>`),
// preserving the auth token query. Returns null if the string is unparseable.
// (We read via fetch rather than the @vercel/edge-config SDK to avoid a runtime
// dependency — the SDK is a thin wrapper over this same endpoint.)
export function edgeConfigItemUrl(
  connectionString: string | undefined,
  key: string,
): string | null {
  if (!connectionString) return null;
  try {
    const url = new URL(connectionString);
    url.pathname = `${url.pathname.replace(/\/$/, "")}/item/${key}`;
    return url.toString();
  } catch {
    return null;
  }
}
