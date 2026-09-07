// Shared types for the runtime augment scripts.

// ─── Enrichment config (authored in the LearningSuite embed block) ───
export interface Intervention {
  id: string;
  label: string;
  title: string;
  t: number;
  // Exclusive end time. The intervention is current on [t, end); without it (or
  // with a non-numeric value) it stays current until the next intervention or
  // the end of the phase. Mirrors the lesson model's `endTimeSec`.
  end?: number | null;
  desc: string;
}

export interface Phase {
  id: string;
  title: string;
  description: string;
  startTimeSec: number;
  endTimeSec: number;
  interventions: Intervention[];
}

export interface Science {
  id: string;
  name: string;
  description: string;
  timestampsSec: number[];
}

export interface Audio {
  id: string;
  t: number;
  dur: number;
  title: string;
  voice: string;
  script: string;
  // Reference to the voice-over uploaded as an asset of the LearningSuite
  // custom-code block. Either the `{{asset:…}}` placeholder the code editor
  // hands out (the platform expands it to a signed URL at render time) or a key
  // into the config's top-level `assets` table. Optional: without it — or when
  // it cannot be resolved — the overlay falls back to speaking `script` via
  // SpeechSynthesis. See ./assets.
  asset?: string;
  // Portrait of whoever is speaking, resolved the same two ways as `asset`.
  // Optional: without it — or when it cannot be resolved — the card falls back
  // to initials derived from `voice`. Unlike `asset`, a failure here is purely
  // cosmetic and is NEVER beaconed: the `audio-asset-*` errorTypes mean "no cue
  // on this page will find its audio", and a missing portrait must not fire the
  // loudest operator alarm in the system.
  avatar?: string;
}

export interface MetaStep {
  id: string;
  n: number;
  title: string;
  t: number;
}

// ─── Interactive quiz (optional `quiz` section of the enrichment config) ───
// These are POST-normalisation shapes: every optional authoring field has
// already been defaulted by normalizeQuizConfig, so consumers never re-default.
export interface AnswerOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: AnswerOption[];
  correctOptionId: string;
  // "" when the author supplied none.
  explanation: string;
  // null when absent or outside the accepted 5–300s integer range.
  timeoutSec: number | null;
  showCountdown: boolean;
}

export interface QuizBreak {
  id: string;
  t: number;
  // "" when the author supplied none.
  title: string;
  resume: "auto" | "manual";
  questions: QuizQuestion[];
}

export interface QuizConfig {
  feedbackDurationSec: number;
  showScore: boolean;
  showSummary: boolean;
  passingPercent: number | null;
  quizzes: QuizBreak[];
}

export type QuizOutcome = "correct" | "wrong" | "timeout" | "skipped";

export type QuizMode =
  | "idle"
  | "question"
  | "feedback"
  | "awaiting-continue"
  | "summary";

export interface QuizResult {
  quizId: string;
  questionId: string;
  prompt: string;
  selectedOptionId: string | null;
  correctOptionId: string;
  outcome: QuizOutcome;
}

export interface VpConfig {
  phases: Phase[];
  sciences: Science[];
  audios: Audio[];
  metaSteps: MetaStep[];
  // Optional lookup table for `Audio.asset` keys. Only needed when one asset is
  // cued more than once, or to keep a stored config free of host-specific
  // `{{asset:…}}` tokens; a cue may hold its placeholder inline instead.
  assets?: Record<string, string>;
  // Opt-in for the built-in DEFAULT_* sample data. Without it an absent config
  // section renders nothing rather than the demo arc.
  demo?: boolean;
  quiz?: QuizConfig | null;
}

// ─── Player event bus payloads ───
export type PlayerEvent =
  | { type: "time"; time: number; duration: number }
  | { type: "play"; time: number }
  | { type: "pause"; time: number }
  | { type: "ended"; time: number };

// ─── window.player API exposed by reskin-player, consumed by demo-overlays ───
//
// `setOverlays(OverlaySlot[])` was removed on 2026-09-07 along with the
// `.vp-overlay-layer` it fed. Its only production call site ever passed an empty
// array — demo-overlays draws into its own `#vp-slot-*` nodes on the player host
// — so the slot machinery, the `overlay-show`/`overlay-hide` events and the
// layer were all dead weight.
export interface PlayerApi {
  readonly current: number;
  readonly duration: number;
  play(): void;
  pause(): void;
  seek(t: number): void;
  on(event: "any", fn: (payload: PlayerEvent) => void): () => void;
  _diag?: () => unknown;
}

// ─── Media element surfaces (hls-video forwards HTMLMediaElement) ───
export interface HlsTrack {
  label?: string;
  name?: string;
  title?: string;
  language?: string;
  lang?: string;
  srclang?: string;
  default?: boolean;
  enabled?: boolean;
  selected?: boolean;
}

export interface HlsApi {
  audioTracks?: HlsTrack[];
  audioTrack?: number;
  subtitleTracks?: HlsTrack[];
  subtitleTrack?: number;
  subtitleDisplay?: boolean;
  on?: (event: string, fn: (...args: unknown[]) => void) => void;
  off?: (event: string, fn: (...args: unknown[]) => void) => void;
}

// A live track list (AudioTrackList / audioRenditions): array-like and an
// EventTarget (matching the native AudioTrackList the reskin binds to).
export interface MediaTrackList<T> extends ArrayLike<T>, EventTarget {}

// The <hls-video> custom element forwards the standard HTMLMediaElement API and
// adds a few non-standard surfaces (hls.js `api`, `audioTracks`,
// `audioRenditions`). `textTracks` comes from the standard HTMLMediaElement.
export type MediaEl = HTMLMediaElement & {
  api?: HlsApi;
  audioTracks?: MediaTrackList<HlsTrack>;
  audioRenditions?: MediaTrackList<HlsTrack>;
  __vpAttached?: boolean;
};

// ─── Language packs (external dub audio + subtitles) ───
export interface SubtitleCue {
  text: string;
  from: number;
  to: number;
}

export interface ExternalAudioTrack {
  id: string;
  label: string;
  language: string;
  url: string;
  offsetMs: number;
  useNative: boolean;
}

export interface ExternalSubtitleTrack {
  id: string;
  label: string;
  language: string;
  url: string;
  cues: SubtitleCue[];
}

export interface LanguagePack {
  videoId: string;
  defaultLanguage: string;
  audioTracks: ExternalAudioTrack[];
  subtitleTracks: ExternalSubtitleTrack[];
}

// ─── Track menu option model ───
export interface TrackOption {
  value: number | string;
  label: string;
  selected: boolean;
}
