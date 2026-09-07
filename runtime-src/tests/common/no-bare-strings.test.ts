import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// A lint-style guard, not a behaviour test: it reads the four entry sources as
// text and asserts that the copy which moved into common/i18n.ts has not crept
// back inline. Half-fixing this feature — one label left hardcoded — reproduces
// the exact bug it set out to remove, and nothing else would catch that.
//
// The list is EXPLICIT (the string inventory), never a heuristic sweep over all
// quoted strings: the entries are full of CSS declarations, selectors and data
// attributes that any such heuristic would flag forever.

// Paths are resolved against this file, not process.cwd(), so the guard works
// regardless of where vitest is invoked from.
const source = (relative: string): string =>
  readFileSync(new URL(relative, import.meta.url), "utf8");

// Standalone comment lines are dropped before scanning. Comments legitimately
// name the UI they explain ("Sidebar (Coaching / Science / Meta Structure)"),
// and forbidding that would push developers into writing worse comments.
const code = (relative: string): string =>
  source(relative)
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return (
        !trimmed.startsWith("//") &&
        !trimmed.startsWith("*") &&
        !trimmed.startsWith("/*")
      );
    })
    .join("\n");

// Copy distinctive enough to guard on its own.
const COPY = [
  // demo-overlays
  "Course Section",
  "Starting soon",
  "Meta Structure",
  "Master Steps",
  "Erwähnungen",
  "Interventionen",
  // quiz
  "Frage überspringen",
  "Video fortsetzen",
  "Nochmal ansehen",
  "Bestanden",
  "richtig beantwortet",
  "answered correctly",
  "Schließen",
  // reskin-player — the control bar's copy went with the bar on 2026-09-07;
  // what is left is the language-pack control and the drift badge.
  "Audio tracks",
  "Ton- und Untertitelsprache",
  "Audio and subtitle language",
  "External audio is ahead",
  "External audio is behind",
  // admin-toggle
  "Advanced Video Modus aktivieren",
  "Code-Block hinzufügen",
  // Fragment, not the whole heading: step 2 also covers portraits now, and the
  // guard is about where the copy lives, not how it is worded.
  "Voice-Over-Dateien",
  "Sprecher-Portraits",
  "Prompt an LLM",
  "Prompt kopieren",
  "Kopiert",
  "enable Annotation",
  "edit Annotation",
];

// Words too generic to guard bare (they collide with identifiers, CSS values and
// data attributes), listed in the exact syntactic form they had before moving
// into the catalogue.
const CONTEXTUAL = [
  // demo-overlays — HTML text nodes and title attributes
  ">Open<",
  ">Interventions<",
  '"Coaching"',
  '"Science"',
  '"Intro"',
  '"Playing"',
  '"Paused"',
  'title="-10s"',
  'title="+10s"',
  'title="Skip"',
  ">by $",
  ">Step $",
  "} completed`",
  "interventions</span>",
  "mentions</span>",
  "${dur}m",
  // reskin-player — control labels, menu markers and track fallbacks
  ">Play<",
  ">Audio<",
  ">Sound<",
  ">Full<",
  ">CC<",
  '"Current"',
  '"Off"',
  '"Muted"',
  '"Subtitle"',
  '"Subtitles"',
  '"Mute"',
  '"Fullscreen"',
  '"Pause"',
  '"Play"',
];

// Copy this feature deliberately REPLACED rather than translated. It must not
// come back inline, but it is no longer in the catalogue either, so it is
// excluded from the "the catalogue still has it" assertion below.
const RETIRED = [
  // The end-of-video score screen is "Auswertung" — prompt.ts's own term.
  "Zusammenfassung",
];

const ENTRIES = [
  "../../demo-overlays/index.ts",
  "../../demo-overlays/quiz.ts",
  "../../reskin-player/index.ts",
  "../../admin-toggle/index.ts",
];

describe("no bare UI strings in the runtime entries", () => {
  for (const entry of ENTRIES) {
    it(`keeps ${entry.replace("../../", "")} free of inline copy`, () => {
      const body = code(entry);
      for (const literal of [...COPY, ...CONTEXTUAL, ...RETIRED]) {
        expect(
          body,
          `${entry} still contains ${JSON.stringify(literal)}`,
        ).not.toContain(literal);
      }
    });
  }

  it("keeps the catalogues the only home for that copy", () => {
    // The inverse assertion: if a catalogue lost a string, the guard above would
    // still pass while the UI regressed to a missing-message key.
    const catalogues = [
      "../../common/i18n/demo.ts",
      "../../common/i18n/player.ts",
      "../../common/i18n/admin.ts",
    ]
      .map(source)
      .join("\n");
    for (const literal of COPY) {
      expect(
        catalogues,
        `no common/i18n/* catalogue contains ${JSON.stringify(literal)}`,
      ).toContain(literal);
    }
  });

  it("leaves admin-toggle/prompt.ts out of scope", () => {
    // The LLM prompt is model instruction text, not UI, and it already tells the
    // model to keep the source material's language. Deliberately not translated.
    const prompt = source("../../admin-toggle/prompt.ts");
    expect(prompt).toContain("Sprache des Materials");
    expect(prompt).not.toContain("common/i18n");
  });
});
