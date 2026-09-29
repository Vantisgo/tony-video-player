import type { HlsApi, HlsTrack, MediaEl } from "./types";

export function getLanguageName(code: string | undefined): string {
  if (!code) return "";
  try {
    if (typeof Intl !== "undefined" && Intl.DisplayNames) {
      const name = new Intl.DisplayNames([navigator.language || "en"], {
        type: "language",
      }).of(code);
      if (name) return name;
    }
  } catch {
    /* ignore Intl failures */
  }
  return code.toUpperCase();
}

export function trackLabel(
  track: HlsTrack | undefined,
  index: number,
  fallback: string,
): string {
  const raw = track?.label || track?.name || track?.title || "";
  const language = track?.language || track?.lang || track?.srclang || "";
  const langName = getLanguageName(language);
  if (raw) return raw;
  if (langName) return langName;
  return `${fallback} ${index + 1}`;
}

export function getHlsApi(mediaEl: MediaEl | null | undefined): HlsApi | null {
  const api = mediaEl?.api;
  return api && typeof api === "object" ? api : null;
}

export function getBunnyVideoId(url: string | null | undefined): string {
  if (!url) return "";
  const m = String(url).match(
    /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/playlist\.m3u8/i,
  );
  return m?.[1] || "";
}
