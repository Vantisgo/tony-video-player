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
  "admin.step2.heading": "Upload the voice-over files and speaker portraits",
  "admin.step2.bodyHtml":
    'In the <strong>"Code einbetten"</strong> editor, upload the audio files as <strong>Assets</strong> and copy each reference (of the form <code>{{asset:file-name}}</code>) — you pass them into the prompt in the next step. Portrait images work the same way: upload one per speaker and give the file a name that says whose face it is, so the prompt can match it to the right voice.',
  "admin.step2.noteHtml":
    "No audio files? Just skip this step: the inserts are then read aloud from <code>script</code> via text-to-speech. Without a portrait the card shows the speaker's initials. A swapped-over portrait is nobody's error message, so check the faces in the preview.",
  "admin.step3.heading": "Prompt your LLM, then paste the answer",
  "admin.step3.bodyHtml":
    'Copy the prompt below and hand it to your LLM (ChatGPT, Claude, …) — together with the lesson transcript / script <em>and</em> the asset references from step 2. The answer is a ready-made <code>&lt;pre data-vp-config&gt;</code> block with the references already filled in — paste it verbatim into the "Code einbetten" modal, click <strong>Speichern</strong>, then <strong>Vorschau</strong> at the top to test it.',
  "admin.footer.tipHtml":
    "💡 In the editor, LearningSuite shows the saved code as a raw string. Only <em>Vorschau</em> renders it live — and that is exactly when the Advanced Video Editor appears (re-skin + sidebar + overlays).",
  "admin.diag.toggle": "Show errors in the embedded code below the video",
  "admin.diag.titleError": "The embedded code is not recognised",
  "admin.diag.titleWarning": "The embedded code is recognised, with warnings",
  "admin.diag.ok": "✓ Embedded code recognised",
  "admin.diag.recheck": "Check again",
  "admin.diag.wrapperMissingHtml":
    'No <code>&lt;pre data-vp-config&gt;</code> block found. Wrap the JSON in <code>&lt;pre data-vp-config style="display:none"&gt; … &lt;/pre&gt;</code>.',
  "admin.diag.fencesHtml":
    "The code contains Markdown fences (<code>```</code>). Delete the lines the LLM put around its answer.",
  "admin.diag.commentHtml":
    'LearningSuite removes HTML comments (<code>&lt;!-- VP_CONFIG --&gt;</code>) on save. Use <code>&lt;pre data-vp-config style="display:none"&gt;</code> instead.',
  "admin.diag.scriptTagHtml":
    'LearningSuite removes <code>&lt;script&gt;</code> tags on save. Use <code>&lt;pre data-vp-config style="display:none"&gt;</code> instead.',
  "admin.diag.wrapperTagHtml":
    "LearningSuite does not keep <code>&lt;{tag} data-vp-config&gt;</code>. Only <code>&lt;pre data-vp-config&gt;</code> survives.",
  "admin.diag.emptyHtml":
    "The <code>&lt;pre data-vp-config&gt;</code> block is empty.",
  "admin.diag.jsonAtHtml":
    "JSON error in line {line}, column {column} of the block: {message}<br><code>{snippet}</code>",
  "admin.diag.jsonHtml": "The JSON is invalid: {message}",
  "admin.diag.smartQuotesHtml":
    'The JSON contains typographic quotes (“ ” „). JSON only accepts straight quotes (<code>"</code>).',
  "admin.diag.notObjectHtml":
    "The JSON must be an object <code>{ … }</code>, not <code>{kind}</code>.",
  "admin.diag.noSectionsHtml":
    "None of the sections <code>phases</code>, <code>sciences</code>, <code>audios</code>, <code>metaSteps</code> or <code>quiz</code> was found, so nothing would be shown.",
  "admin.diag.notArrayHtml":
    "<code>{key}</code> must be a list <code>[ … ]</code>. The section is ignored.",
  "admin.diag.unknownKeyHtml":
    "Unknown section <code>{key}</code> is ignored. A typo?",
  "admin.diag.quizInvalidHtml":
    "<code>quiz</code> contains no valid question and is ignored. The browser console names the entries it dropped.",
  "admin.diag.audioNoAssetHtml":
    "Voice-over <code>{id}</code> has no <code>asset</code>, so no audio file will play.",
  "admin.diag.audioAssetUnknownHtml":
    "The <code>asset</code> of voice-over <code>{id}</code> is neither a <code>{{asset:…}}</code> reference, an https URL nor a key in <code>assets</code>.",
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
  "admin.step2.heading": "Voice-Over-Dateien und Sprecher-Portraits hochladen",
  "admin.step2.bodyHtml":
    'Lade im <strong>"Code einbetten"</strong>-Editor die Audio-Dateien als <strong>Assets</strong> hoch und kopiere jeden Verweis (Form <code>{{asset:datei-name}}</code>) — du gibst sie im nächsten Schritt mit in den Prompt. Portrait-Bilder funktionieren genauso: eines pro Stimme, und benenne die Datei nach der Person, damit der Prompt sie der richtigen Stimme zuordnen kann.',
  "admin.step2.noteHtml":
    "Ohne Audio-Dateien einfach überspringen: die Einschübe werden dann per Text-to-Speech aus <code>script</code> vorgelesen. Ohne Portrait zeigt die Karte die Initialen der Stimme. Ein vertauschtes Portrait meldet niemand — prüf die Gesichter in der Vorschau.",
  "admin.step3.heading": "Prompt an LLM, dann Antwort einfügen",
  "admin.step3.bodyHtml":
    'Kopiere den folgenden Prompt und gib ihn an dein LLM (ChatGPT, Claude, …) — zusammen mit dem Lektions-Transkript / Drehbuch <em>und</em> den Asset-Verweisen aus Schritt 2. Die Antwort ist ein fertiger <code>&lt;pre data-vp-config&gt;</code>-Block mit bereits eingesetzten Verweisen — paste ihn 1:1 in das "Code einbetten"-Modal, klicke <strong>Speichern</strong>, dann oben auf <strong>Vorschau</strong> zum Testen.',
  "admin.footer.tipHtml":
    "💡 Im Editor zeigt LearningSuite den gespeicherten Code als Roh-String. Erst die <em>Vorschau</em> rendert ihn live — und genau dann erscheint der Advanced Video Editor (Re-Skin + Sidebar + Overlays).",
  "admin.diag.toggle": "Fehler im eingebetteten Code unter dem Video anzeigen",
  "admin.diag.titleError": "Der eingebettete Code wird nicht erkannt",
  "admin.diag.titleWarning":
    "Der eingebettete Code wird erkannt – mit Hinweisen",
  "admin.diag.ok": "✓ Eingebetteter Code erkannt",
  "admin.diag.recheck": "Erneut prüfen",
  "admin.diag.wrapperMissingHtml":
    'Kein <code>&lt;pre data-vp-config&gt;</code>-Block gefunden. Das JSON muss in <code>&lt;pre data-vp-config style="display:none"&gt; … &lt;/pre&gt;</code> stehen.',
  "admin.diag.fencesHtml":
    "Der Code enthält Markdown-Zäune (<code>```</code>). Lösche die Zeilen, die das LLM um seine Antwort gesetzt hat.",
  "admin.diag.commentHtml":
    'LearningSuite entfernt HTML-Kommentare (<code>&lt;!-- VP_CONFIG --&gt;</code>) beim Speichern. Verwende stattdessen <code>&lt;pre data-vp-config style="display:none"&gt;</code>.',
  "admin.diag.scriptTagHtml":
    'LearningSuite entfernt <code>&lt;script&gt;</code>-Tags beim Speichern. Verwende stattdessen <code>&lt;pre data-vp-config style="display:none"&gt;</code>.',
  "admin.diag.wrapperTagHtml":
    "LearningSuite übernimmt <code>&lt;{tag} data-vp-config&gt;</code> nicht. Nur <code>&lt;pre data-vp-config&gt;</code> bleibt erhalten.",
  "admin.diag.emptyHtml":
    "Der <code>&lt;pre data-vp-config&gt;</code>-Block ist leer.",
  "admin.diag.jsonAtHtml":
    "JSON-Fehler in Zeile {line}, Spalte {column} des Blocks: {message}<br><code>{snippet}</code>",
  "admin.diag.jsonHtml": "Das JSON ist ungültig: {message}",
  "admin.diag.smartQuotesHtml":
    'Das JSON enthält typografische Anführungszeichen (“ ” „). JSON akzeptiert nur gerade Anführungszeichen (<code>"</code>).',
  "admin.diag.notObjectHtml":
    "Das JSON muss ein Objekt <code>{ … }</code> sein, nicht <code>{kind}</code>.",
  "admin.diag.noSectionsHtml":
    "Keiner der Abschnitte <code>phases</code>, <code>sciences</code>, <code>audios</code>, <code>metaSteps</code> oder <code>quiz</code> gefunden – es würde nichts angezeigt.",
  "admin.diag.notArrayHtml":
    "<code>{key}</code> muss eine Liste <code>[ … ]</code> sein. Der Abschnitt wird ignoriert.",
  "admin.diag.unknownKeyHtml":
    "Unbekannter Abschnitt <code>{key}</code> wird ignoriert. Tippfehler?",
  "admin.diag.quizInvalidHtml":
    "<code>quiz</code> enthält keine gültige Frage und wird ignoriert. Die Browser-Konsole nennt die verworfenen Einträge.",
  "admin.diag.audioNoAssetHtml":
    "Voice-Over <code>{id}</code> hat kein <code>asset</code> – es wird keine Audio-Datei abgespielt.",
  "admin.diag.audioAssetUnknownHtml":
    "Das <code>asset</code> von Voice-Over <code>{id}</code> ist weder ein <code>{{asset:…}}</code>-Verweis noch eine https-URL noch ein Schlüssel in <code>assets</code>.",
};

export const MESSAGES: Record<Locale, Record<AdminKey, string>> = {
  en: EN,
  de: DE,
};

export const t = createT(MESSAGES);
