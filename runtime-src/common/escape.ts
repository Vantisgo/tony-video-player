// Escape a value before it goes into innerHTML. The enrichment config is
// untrusted input rendered in the LearningSuite origin, so every interpolated
// config value must pass through here to prevent stored XSS.
const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const esc = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ENTITIES[c] ?? c);
