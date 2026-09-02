// UI copy for admin-toggle's launch button and setup dialog (editor-only).
//
// A key ending in `Html` carries trusted first-party inline markup and is
// interpolated into innerHTML WITHOUT esc(), which would render visible &lt;
// entities. These are compile-time constants, never config or host input.
// tests/common/no-bare-strings.test.ts fails if a non-`Html` key gains a `<`.
//
// The `*Html` bodies keep LearningSuite's own German UI labels ("Code
// einbetten", "In Seite anzeigen", "Speichern", "Vorschau") untranslated on
// purpose: they name buttons the admin is looking at in the host UI, so
// translating them would send the reader hunting for a label that isn't there.
import { createT, type Locale } from "./core";

const EN = {
  "admin.launch.enable": "enable Annotation",
  "admin.launch.edit": "edit Annotation",
  "admin.dialog.title": "Enable Advanced Video Modus",
  "admin.dialog.close": "Close",
  "admin.copy.button": "Copy prompt",
  "admin.copy.done": "✓ Copied",
  "admin.step1.heading": "Add a code block",
  "admin.step1.bodyHtml":
    'Add a <strong>"Code einbetten"</strong> block below the video — in the block sidebar on the left, under <em>Code-Elemente → Code einbetten</em>.',
  "admin.step1.noteHtml":
    'Set the block to <strong>"In Seite anzeigen"</strong> (the default).',
  "admin.step2.heading": "Upload the voice-over files",
  "admin.step2.bodyHtml":
    'In the <strong>"Code einbetten"</strong> editor, upload the audio files as <strong>Assets</strong> and copy each reference (of the form <code>{{asset:file-name}}</code>) — you pass them into the prompt in the next step.',
  "admin.step2.noteHtml":
    "No audio files? Just skip this step: the inserts are then read aloud from <code>script</code> via text-to-speech.",
  "admin.step3.heading": "Prompt your LLM, then paste the answer",
  "admin.step3.bodyHtml":
    'Copy the prompt below and hand it to your LLM (ChatGPT, Claude, …) — together with the lesson transcript / script <em>and</em> the asset references from step 2. The answer is a ready-made <code>&lt;pre data-vp-config&gt;</code> block with the references already filled in — paste it verbatim into the "Code einbetten" modal, click <strong>Speichern</strong>, then <strong>Vorschau</strong> at the top to test it.',
  "admin.footer.tipHtml":
    "💡 In the editor, LearningSuite shows the saved code as a raw string. Only <em>Vorschau</em> renders it live — and that is exactly when the Advanced Video Editor appears (re-skin + sidebar + overlays).",
} as const;

export type AdminKey = keyof typeof EN;

// Annotated, not inferred: omitting a key here is a compile error.
const DE: Record<AdminKey, string> = {
  "admin.launch.enable": "Annotation aktivieren",
  "admin.launch.edit": "Annotation bearbeiten",
  "admin.dialog.title": "Advanced Video Modus aktivieren",
  "admin.dialog.close": "Schließen",
  "admin.copy.button": "Prompt kopieren",
  "admin.copy.done": "✓ Kopiert",
  "admin.step1.heading": "Code-Block hinzufügen",
  "admin.step1.bodyHtml":
    'Füge unter dem Video einen <strong>"Code einbetten"</strong>-Block hinzu — links in der Block-Sidebar unter <em>Code-Elemente → Code einbetten</em>.',
  "admin.step1.noteHtml":
    'Stelle den Block auf <strong>"In Seite anzeigen"</strong> (Standard).',
  "admin.step2.heading": "Voice-Over-Dateien hochladen",
  "admin.step2.bodyHtml":
    'Lade im <strong>"Code einbetten"</strong>-Editor die Audio-Dateien als <strong>Assets</strong> hoch und kopiere jeden Verweis (Form <code>{{asset:datei-name}}</code>) — du gibst sie im nächsten Schritt mit in den Prompt.',
  "admin.step2.noteHtml":
    "Ohne Audio-Dateien einfach überspringen: die Einschübe werden dann per Text-to-Speech aus <code>script</code> vorgelesen.",
  "admin.step3.heading": "Prompt an LLM, dann Antwort einfügen",
  "admin.step3.bodyHtml":
    'Kopiere den folgenden Prompt und gib ihn an dein LLM (ChatGPT, Claude, …) — zusammen mit dem Lektions-Transkript / Drehbuch <em>und</em> den Asset-Verweisen aus Schritt 2. Die Antwort ist ein fertiger <code>&lt;pre data-vp-config&gt;</code>-Block mit bereits eingesetzten Verweisen — paste ihn 1:1 in das "Code einbetten"-Modal, klicke <strong>Speichern</strong>, dann oben auf <strong>Vorschau</strong> zum Testen.',
  "admin.footer.tipHtml":
    "💡 Im Editor zeigt LearningSuite den gespeicherten Code als Roh-String. Erst die <em>Vorschau</em> rendert ihn live — und genau dann erscheint der Advanced Video Editor (Re-Skin + Sidebar + Overlays).",
};

export const MESSAGES: Record<Locale, Record<AdminKey, string>> = {
  en: EN,
  de: DE,
};

export const t = createT(MESSAGES);
