// Pure resolution of the runtime kill-switch flag, testable without Edge Config.
// Fail-open by construction: only an explicit `enabled: false` disables the
// runtime; anything else (missing/malformed value) resolves to enabled.

export interface RuntimeFlag {
  enabled: boolean;
  minHostVersion: string | null;
}

export function resolveFlag(raw: unknown): RuntimeFlag {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return {
      enabled: o.enabled !== false,
      minHostVersion:
        typeof o.minHostVersion === "string" ? o.minHostVersion : null,
    };
  }
  return { enabled: true, minHostVersion: null };
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
