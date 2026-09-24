// Gate predicates for the loader: which of the three augment bundles a page
// actually needs. Each predicate mirrors the gate the corresponding entry
// already applies to itself — the entries keep gating themselves, so a loader
// gate can only ever be narrower, never wrong-way permissive.
import { loadVpConfig } from "../common/config";

export const ENTRIES = [
  "reskin-player",
  "demo-overlays",
  "admin-toggle",
] as const;

export type Entry = (typeof ENTRIES)[number];

// Mirrors admin-toggle's own isEditMode() (admin-toggle/index.ts:164). The
// location is passed in so this stays a pure predicate.
export function isAdminEditMode(loc: {
  pathname: string;
  search: string;
}): boolean {
  if (!loc.pathname.includes("/admin/editor/")) return false;
  return new URLSearchParams(loc.search).get("view") !== "preview";
}

// Presence, not validity: reskin-player gates on a `[data-vp-config]` element
// existing (reskin-player/index.ts:188), so the loader must not be stricter.
// The cheap querySelector runs first — loadVpConfig() walks every comment node
// to support the <!-- VP_CONFIG --> shape, and this predicate runs on a
// debounced mutation loop.
export function hasVpConfig(): boolean {
  if (document.querySelector("[data-vp-config]")) return true;
  return loadVpConfig() !== null;
}

// Build a child bundle URL from the loader's own script URL, re-attaching the
// loader's query string so `?x-vercel-protection-bypass=…` reaches every child
// (a protection-enabled deployment 401s requests without it). Returns "" when
// the loader's URL is unknown or unparseable — the caller then no-ops.
export function childUrl(scriptUrl: string, entry: Entry): string {
  if (!scriptUrl) return "";
  try {
    const self = new URL(scriptUrl, location.href);
    return new URL(entry + ".js" + self.search, new URL(".", self)).href;
  } catch {
    return "";
  }
}
