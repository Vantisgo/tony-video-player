// UI copy for reskin-player's control shell and track menus. Import as `tr` —
// `t` is the entry's name for the current playback time:
//   import { t as tr } from "../common/i18n/player";
//
// Visible control labels stay SHORT: .vp-controls is a grid whose seek slider
// absorbs every extra character. The precise term belongs in the matching
// `player.aria.*` label, which is what a screen reader announces.
import { createT, type Locale } from "./core";

const EN = {
  // Control aria-labels — the accessibility surface
  // Track menus: used for both the button's aria-label and the menu heading
  "player.tracks.audio": "Audio tracks",
  "player.tracks.subtitles": "Subtitles",
  "player.langpack.button": "Language",
  "player.langpack.aria": "Audio and subtitle language",
  // Visible control labels
  "player.label.current": "Current",
  "player.label.off": "Off",
  // Fallback names for unlabelled tracks
  "player.track.audio": "Audio",
  "player.track.subtitle": "Subtitle",
  // Track-button tooltips
  // External-audio drift badge
  "player.drift.badge": "Audio {offset}s",
  "player.drift.ahead": "External audio is ahead of the video timeline",
  "player.drift.behind": "External audio is behind the video timeline",
} as const;

export type PlayerKey = keyof typeof EN;

// Annotated, not inferred: omitting a key here is a compile error.
const DE: Record<PlayerKey, string> = {
  "player.tracks.audio": "Tonspuren",
  "player.tracks.subtitles": "Untertitel",
  "player.langpack.button": "Sprache",
  "player.langpack.aria": "Ton- und Untertitelsprache",
  "player.label.current": "Aktuell",
  "player.label.off": "Aus",
  "player.track.audio": "Tonspur",
  "player.track.subtitle": "Untertitel",
  "player.drift.badge": "Audio {offset}s",
  "player.drift.ahead": "Externes Audio läuft dem Video voraus",
  "player.drift.behind": "Externes Audio läuft dem Video nach",
};

export const MESSAGES: Record<Locale, Record<PlayerKey, string>> = {
  en: EN,
  de: DE,
};

export const t = createT(MESSAGES);
