import { getBunnyVideoId, getHlsApi, trackLabel } from "../common/tracks";
import { getTrustedOrigins, makeAssetOriginChecker } from "../common/origins";
import type {
  ExternalAudioTrack,
  ExternalSubtitleTrack,
  LanguagePack,
  MediaEl,
  SubtitleCue,
} from "../common/types";

// Query params the runtime script URL may forward onto same-origin asset
// fetches. Restricted so unrelated params never leak onto subresource requests
// (the Vercel protection-bypass token is the only intentional one).
const FORWARDED_QUERY_PARAMS = new Set(["x-vercel-protection-bypass"]);

export interface LearningSuiteSubtitleTrack {
  kind: "subtitles";
  label: string;
  language: string;
  cues: SubtitleCue[];
}

interface RawAudioTrack {
  id?: string;
  label?: string;
  language?: string;
  lang?: string;
  url?: string;
  offsetMs?: number | string;
  useNative?: boolean;
}

interface RawSubtitleTrack {
  id?: string;
  label?: string;
  language?: string;
  lang?: string;
  url?: string;
  cues?: unknown[];
}

interface RawLanguagePack {
  videoId?: string;
  defaultLanguage?: string;
  audioTracks?: RawAudioTrack[];
  subtitleTracks?: RawSubtitleTrack[];
  baseUrl?: string;
}

// ─── Runtime script URL / base URL resolution ───
export function getRuntimeScriptUrl(): string {
  const override = (window as unknown as { __vpRuntimeBaseUrl?: string })
    .__vpRuntimeBaseUrl;
  if (override) return override;

  const current = document.currentScript as HTMLScriptElement | null;
  const script = current?.src
    ? current
    : [...document.scripts]
        .reverse()
        .find((s) => s.src && /\/runtime\/reskin-player\.js/i.test(s.src));

  return script?.src || "";
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

function resolveUrl(url: string | undefined, baseUrl: string): string {
  if (!url) return "";
  try {
    return new URL(url, baseUrl || location.href).href;
  } catch {
    return String(url);
  }
}

function withRuntimeAssetQuery(
  url: string,
  sourceUrl: string = getRuntimeScriptUrl(),
): string {
  if (!url || !sourceUrl) return url;
  try {
    const source = new URL(sourceUrl, location.href);
    if (!source.search) return url;

    const target = new URL(url, location.href);
    if (target.origin !== source.origin) return url;

    source.searchParams.forEach((value, key) => {
      if (!FORWARDED_QUERY_PARAMS.has(key)) return;
      if (!target.searchParams.has(key)) target.searchParams.set(key, value);
    });
    return target.href;
  } catch {
    return url;
  }
}

// ─── VTT parsing ───
function parseVttTimestamp(value: string | undefined): number {
  const parts = String(value || "")
    .trim()
    .split(":");
  if (parts.length < 2) return NaN;
  const seconds = Number((parts.pop() ?? "").replace(",", "."));
  const minutes = Number(parts.pop());
  const hours = parts.length ? Number(parts.pop()) : 0;
  if (![hours, minutes, seconds].every(Number.isFinite)) return NaN;
  return hours * 3600 + minutes * 60 + seconds;
}

export function parseVtt(text: string): SubtitleCue[] {
  const blocks = String(text || "")
    .replace(/^﻿/, "")
    .replace(/\r/g, "")
    .split("\n\n");

  const cues: SubtitleCue[] = [];
  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length || lines[0].startsWith("WEBVTT")) continue;

    const timingLine = lines.find((line) => line.includes("-->"));
    if (!timingLine) continue;

    const timingIndex = lines.indexOf(timingLine);
    const [fromRaw, rest] = timingLine.split("-->");
    const toRaw = rest?.trim().split(/\s+/)[0];
    const from = parseVttTimestamp(fromRaw);
    const to = parseVttTimestamp(toRaw);
    const cueText = lines
      .slice(timingIndex + 1)
      .join("\n")
      .trim();

    if (cueText && Number.isFinite(from) && Number.isFinite(to)) {
      cues.push({ from, to, text: cueText });
    }
  }
  return cues;
}

// ms-based transcript cue → seconds
export function normalizeTranscriptCue(cue: unknown): SubtitleCue | null {
  const c = (cue ?? {}) as { text?: unknown; from?: unknown; to?: unknown };
  const text = String(c.text ?? "").trim();
  const from = Number(c.from);
  const to = Number(c.to);
  if (!text || !Number.isFinite(from) || !Number.isFinite(to)) return null;
  return { text, from: from / 1000, to: Math.max(from, to) / 1000 };
}

// ─── Language-pack normalization + loading ───
const languagePackCache = new Map<
  string,
  LanguagePack | Promise<LanguagePack | null> | null
>();

async function normalizeLanguagePack(
  raw: unknown,
  manifestUrl: string,
): Promise<LanguagePack | null> {
  if (!raw || typeof raw !== "object") return null;
  const pack = raw as RawLanguagePack;

  const baseUrl = manifestUrl || getRuntimeBaseUrl();
  // Only fetch / play assets from trusted origins. A manifest (or a
  // window.__vpLanguagePacks override) must not point requests at an arbitrary
  // third-party origin.
  const isAllowedAsset = makeAssetOriginChecker(baseUrl, getTrustedOrigins());

  const audioTracks: ExternalAudioTrack[] = Array.isArray(pack.audioTracks)
    ? pack.audioTracks
        .map((track, index) => ({
          id: track.id || track.language || `audio-${index + 1}`,
          label: track.label || trackLabel(track, index, "Audio"),
          language: track.language || track.lang || "",
          url: withRuntimeAssetQuery(resolveUrl(track.url, baseUrl), baseUrl),
          offsetMs: Number(track.offsetMs || 0),
          useNative: !!track.useNative,
        }))
        .filter(
          (track) =>
            track.useNative || (track.url && isAllowedAsset(track.url)),
        )
    : [];

  const subtitleTracks: ExternalSubtitleTrack[] = Array.isArray(
    pack.subtitleTracks,
  )
    ? await Promise.all(
        pack.subtitleTracks.map(async (track, index) => {
          const url = withRuntimeAssetQuery(
            resolveUrl(track.url, baseUrl),
            baseUrl,
          );
          let cues: SubtitleCue[] = Array.isArray(track.cues)
            ? track.cues
                .map(normalizeTranscriptCue)
                .filter((c): c is SubtitleCue => c !== null)
            : [];

          if (!cues.length && url && isAllowedAsset(url)) {
            try {
              const text = await fetch(url).then((r) =>
                r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`)),
              );
              cues = parseVtt(text);
            } catch (err) {
              console.warn("[vp] subtitle load failed", url, err);
            }
          }

          return {
            id: track.id || track.language || `subtitle-${index + 1}`,
            label: track.label || trackLabel(track, index, "Subtitle"),
            language: track.language || track.lang || "",
            url,
            cues,
          };
        }),
      )
    : [];

  return {
    videoId: pack.videoId || "",
    defaultLanguage:
      pack.defaultLanguage ||
      audioTracks[0]?.language ||
      audioTracks[0]?.id ||
      "",
    audioTracks,
    subtitleTracks: subtitleTracks.filter((track) => track.cues.length),
  };
}

export async function loadLanguagePackForMedia(
  mediaEl: MediaEl,
): Promise<LanguagePack | null> {
  const videoId = getBunnyVideoId(
    mediaEl?.src || mediaEl?.getAttribute?.("src"),
  );
  if (!videoId) return null;
  const cached = languagePackCache.get(videoId);
  if (cached !== undefined) return cached;

  const overrides = (
    window as unknown as { __vpLanguagePacks?: Record<string, RawLanguagePack> }
  ).__vpLanguagePacks;
  const override = overrides?.[videoId];
  if (override) {
    const pack = await normalizeLanguagePack(
      override,
      override.baseUrl || getRuntimeBaseUrl(),
    );
    languagePackCache.set(videoId, pack);
    return pack;
  }

  const manifestUrl = withRuntimeAssetQuery(
    resolveUrl(`language-packs/${videoId}/manifest.json`, getRuntimeBaseUrl()),
  );
  const promise = fetch(manifestUrl)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => (data ? normalizeLanguagePack(data, manifestUrl) : null))
    .catch(() => null);

  languagePackCache.set(videoId, promise);
  const pack = await promise;
  languagePackCache.set(videoId, pack);
  return pack;
}

// ─── LearningSuite transcript tracks (from the Apollo cache) ───
interface ApolloStepFile {
  __typename?: string;
  transcript?: {
    translations?: Array<{ lang?: string; text?: unknown[] }>;
    sourceLanguage?: string;
  } | null;
  downloadable?: { __ref?: string } | null;
}

export function getLearningSuiteTranscriptTracks(
  mediaEl: MediaEl,
): LearningSuiteSubtitleTrack[] {
  const videoId = getBunnyVideoId(
    mediaEl?.src || mediaEl?.getAttribute?.("src"),
  );
  if (!videoId) return [];

  const apollo = (
    window as unknown as {
      __APOLLO_CLIENT__?: {
        cache?: { extract?: () => Record<string, unknown> };
      };
    }
  ).__APOLLO_CLIENT__;
  const cache = apollo?.cache?.extract?.();
  if (!cache || typeof cache !== "object") return [];

  for (const value of Object.values(cache)) {
    const entry = value as ApolloStepFile;
    if (entry?.__typename !== "StepFile" || !entry.transcript) continue;

    const downloadableRef = entry.downloadable?.__ref;
    const downloadable = downloadableRef
      ? (cache[downloadableRef] as { url?: string } | undefined)
      : null;
    if (getBunnyVideoId(downloadable?.url) !== videoId) continue;

    const translations = Array.isArray(entry.transcript.translations)
      ? entry.transcript.translations
      : [];

    return translations
      .map((translation, index): LearningSuiteSubtitleTrack => {
        const lang =
          translation?.lang || entry.transcript?.sourceLanguage || "";
        const cues = Array.isArray(translation?.text)
          ? translation.text
              .map(normalizeTranscriptCue)
              .filter((c): c is SubtitleCue => c !== null)
          : [];
        return {
          kind: "subtitles",
          label: trackLabel({ language: lang }, index, "Subtitle"),
          language: lang,
          cues,
        };
      })
      .filter((track) => track.cues.length);
  }

  return [];
}

// ─── Diagnostics ───
export function getTrackDiagnostics(mediaEl: MediaEl | null): unknown {
  if (!mediaEl) return null;
  const hls = getHlsApi(mediaEl);
  const videoId = getBunnyVideoId(
    mediaEl?.src || mediaEl?.getAttribute?.("src"),
  );
  const cached = languagePackCache.get(videoId);
  const languagePack =
    cached && typeof (cached as Promise<unknown>).then !== "function"
      ? (cached as LanguagePack)
      : null;
  return {
    nativeAudioTracks: mediaEl.audioTracks?.length ?? null,
    nativeTextTracks: mediaEl.textTracks?.length ?? null,
    hlsAudioTracks: Array.isArray(hls?.audioTracks)
      ? hls.audioTracks.length
      : null,
    hlsAudioTrack: typeof hls?.audioTrack === "number" ? hls.audioTrack : null,
    hlsSubtitleTracks: Array.isArray(hls?.subtitleTracks)
      ? hls.subtitleTracks.length
      : null,
    hlsSubtitleTrack:
      typeof hls?.subtitleTrack === "number" ? hls.subtitleTrack : null,
    audioRenditions: mediaEl.audioRenditions?.length ?? null,
    learningSuiteSubtitleTracks:
      getLearningSuiteTranscriptTracks(mediaEl).length,
    externalAudioTracks: languagePack?.audioTracks?.length ?? 0,
    externalSubtitleTracks: languagePack?.subtitleTracks?.length ?? 0,
  };
}
