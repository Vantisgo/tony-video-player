import type { Audio, MetaStep, Phase, Science, VpConfig } from "./types";

// NOTE: no schema library here on purpose. This code is bundled verbatim into a
// script injected on a third-party page, so bundle size matters — pulling zod in
// added ~50KB. Strict schema validation belongs in the future content-service
// endpoint (server-side), not in the injected runtime. Here we stay tolerant of
// partially-filled configs (see parseVpConfig) and rely on escaping at render
// time for safety.

// ─── Loader: find the config on the page (three shapes, first hit wins) ───
export interface ConfigHit {
  source: "script" | "element" | "comment";
  data: unknown;
}

export function loadVpConfig(): ConfigHit | null {
  const script = document.querySelector(
    'script[type="application/json"][data-vp-config]',
  );
  if (script?.textContent?.trim()) {
    try {
      return { source: "script", data: JSON.parse(script.textContent.trim()) };
    } catch (e) {
      console.warn("[vp] config <script> parse failed", e);
    }
  }

  const el = document.querySelector("[data-vp-config]:not(script)");
  if (el?.textContent?.trim()) {
    try {
      return { source: "element", data: JSON.parse(el.textContent.trim()) };
    } catch (e) {
      console.warn("[vp] config element parse failed", e);
    }
  }

  const tw = document.createTreeWalker(
    document.body || document.documentElement,
    NodeFilter.SHOW_COMMENT,
  );
  let n: Node | null;
  while ((n = tw.nextNode())) {
    const v = n.nodeValue || "";
    const m = v.match(/VP_CONFIG\s*([\s\S]*?)\s*VP_CONFIG/);
    if (m) {
      try {
        return { source: "comment", data: JSON.parse(m[1]) };
      } catch (e) {
        console.warn("[vp] config <!--comment--> parse failed", e);
      }
    }
  }
  return null;
}

// ─── Parse: return typed sections, tolerant of partial configs ───
// A section is used when present as an array (even empty), exactly like the
// original per-section `Array.isArray(...)` guard; absent / non-array sections
// come back undefined so the caller falls back to defaults. A present-but-
// wrong-typed section is logged (it will fall back) — XSS is already handled by
// escaping at render time.
export function parseVpConfig(raw: unknown): Partial<VpConfig> {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const section = <T>(key: keyof VpConfig): T[] | undefined => {
    if (!(key in obj)) return undefined;
    if (Array.isArray(obj[key])) return obj[key] as T[];
    console.warn(`[vp] config.${key} is not an array; falling back to default`);
    return undefined;
  };

  return {
    phases: section<Phase>("phases"),
    sciences: section<Science>("sciences"),
    audios: section<Audio>("audios"),
    metaSteps: section<MetaStep>("metaSteps"),
  };
}
