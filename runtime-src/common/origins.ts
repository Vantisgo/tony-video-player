// Trusted-origin helpers shared by the cross-frame postMessage bridge and the
// language-pack asset loader. Defaults to same-origin only; the host can opt-in
// extra origins via `window.__vpTrustedOrigins = ['https://…']`.
export function getTrustedOrigins(): Set<string> {
  const extra = (window as unknown as { __vpTrustedOrigins?: unknown })
    .__vpTrustedOrigins;
  const list = Array.isArray(extra)
    ? extra.filter((o): o is string => typeof o === "string")
    : [];
  return new Set<string>([location.origin, ...list]);
}

// Build a predicate that accepts a URL only if its origin is trusted or matches
// the language-pack base URL's origin (the runtime host / CDN).
export function makeAssetOriginChecker(
  baseUrl: string,
  trusted: Set<string>,
): (url: string) => boolean {
  const allowed = new Set(trusted);
  try {
    allowed.add(new URL(baseUrl || location.href, location.href).origin);
  } catch {
    /* ignore unparseable base */
  }
  return (url: string): boolean => {
    try {
      return allowed.has(new URL(url, location.href).origin);
    } catch {
      return false;
    }
  };
}
