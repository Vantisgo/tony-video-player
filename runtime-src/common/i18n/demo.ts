// UI copy for demo-overlays (sidebar, video pills, voice-over banner) and the
// quiz dialogs it hosts. Import the lookup as `tr` — `t` is the entry's name
// for the current playback time:  import { t as tr } from "../common/i18n/demo";
import { createT, type Locale } from "./core";

const EN = {
  // Sidebar tabs
  "demo.tab.coaching": "Coaching",
  "demo.tab.science": "Science",
  "demo.tab.meta": "Meta Structure",
  // Section pill (video overlay, top-left)
  "demo.section.eyebrow": "Course Section",
  "demo.section.intro": "Intro",
  "demo.section.empty": "Starting soon...",
  "demo.section.progress": "{done} of {total} completed",
  // Science pill + panel
  "demo.science.label": "Science:",
  "demo.science.open": "Open",
  "demo.science.mentions": "{count} mentions",
  // Coaching panel
  "demo.phase.interventions": "Interventions",
  "demo.phase.count": "{count} interventions",
  "demo.phase.duration": "{min}m",
  // Meta structure
  "demo.meta.heading": "7 Master Steps",
  "demo.meta.step": "Step {n} / {total}",
  "demo.meta.openTitle": "Open Meta Structure",
  // Voice-over banner
  "demo.audio.by": "by {voice}",
  "demo.audio.playing": "Playing",
  "demo.audio.paused": "Paused",
  "demo.audio.back": "-10s",
  "demo.audio.playPause": "Play/Pause",
  "demo.audio.forward": "+10s",
  "demo.audio.skip": "Skip",
  "demo.audio.avatarAlt": "Voice-over speaker",
  // Quiz
  "quiz.action.skip": "Skip question",
  "quiz.action.continue": "Continue",
  "quiz.action.resume": "Resume video",
  "quiz.action.close": "Close",
  "quiz.action.restart": "Watch again",
  "quiz.summary.heading": "Summary",
  "quiz.summary.score": "{pct}% answered correctly",
  "quiz.summary.passed": "Passed",
  "quiz.summary.failed": "Not passed",
} as const;

export type DemoKey = keyof typeof EN;

// The German column reuses admin-toggle/prompt.ts's house vocabulary
// ("Sektionen des Coaching-Bogens", "Master-Schritt"-Pills, "7 Master
// Steps"-Style, "Auswertung") so the admin prompt and the learner UI agree.
// "Intervention" is fixed — CONTEXT.md forbids "Interaction".
// Annotated, not inferred: omitting a key here is a compile error.
const DE: Record<DemoKey, string> = {
  "demo.tab.coaching": "Coaching",
  "demo.tab.science": "Wissenschaft",
  "demo.tab.meta": "Master-Schritte",
  "demo.section.eyebrow": "Sektion",
  "demo.section.intro": "Intro",
  "demo.section.empty": "Startet in Kürze …",
  "demo.section.progress": "{done} von {total} erledigt",
  "demo.science.label": "Wissenschaft:",
  "demo.science.open": "Öffnen",
  "demo.science.mentions": "{count} Erwähnungen",
  "demo.phase.interventions": "Interventionen",
  "demo.phase.count": "{count} Interventionen",
  "demo.phase.duration": "{min} Min.",
  "demo.meta.heading": "7 Master Steps",
  "demo.meta.step": "Schritt {n} / {total}",
  "demo.meta.openTitle": "Master-Schritte öffnen",
  "demo.audio.by": "von {voice}",
  "demo.audio.playing": "Spielt",
  "demo.audio.paused": "Pausiert",
  "demo.audio.back": "-10s",
  "demo.audio.playPause": "Wiedergabe/Pause",
  "demo.audio.forward": "+10s",
  "demo.audio.skip": "Überspringen",
  "demo.audio.avatarAlt": "Stimme des Voice-Overs",
  // Was "Continue" in the otherwise-German quiz UI — an intended copy fix.
  "quiz.action.skip": "Frage überspringen",
  "quiz.action.continue": "Weiter",
  "quiz.action.resume": "Video fortsetzen",
  "quiz.action.close": "Schließen",
  "quiz.action.restart": "Nochmal ansehen",
  "quiz.summary.heading": "Auswertung",
  "quiz.summary.score": "{pct}% richtig beantwortet",
  "quiz.summary.passed": "Bestanden",
  "quiz.summary.failed": "Nicht bestanden",
};

export const MESSAGES: Record<Locale, Record<DemoKey, string>> = {
  en: EN,
  de: DE,
};

export const t = createT(MESSAGES);
