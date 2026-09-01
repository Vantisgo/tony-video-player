// The prompt the admin pastes into their LLM. Single source of truth for the
// wording shown in the dialog — edit here to change it everywhere.
export const PROMPT_TEXT = `Du erstellst eine JSON-Konfiguration für einen erweiterten Video-Player auf einer LearningSuite-Coaching-Lektion.

Anhand des unten gegebenen Lektions-Materials (Transkript, Drehbuch oder Inhaltsbeschreibung) erstellst du das JSON nach folgendem Schema. Verwende die Sprache des Materials (i.d.R. Deutsch).

═══ Schema-Übersicht ═══

{
  "phases":   [ Sektionen des Coaching-Bogens, jeweils mit interventions[] ],
  "sciences": [ Wissenschafts-Pop-Ups, kurze 5-Sekunden-Trigger ],
  "audios":   [ Voice-Over-Banner, pausieren das Video für einen Audio-Einschub ],
  "metaSteps":[ "Master-Schritt"-Pills für den globalen Bogen, ~5s sichtbar ],
  "quiz":     { optionale interaktive Wissensfragen an definierten Video-Unterbrechungen }
}

═══ Felder im Detail ═══

phases[]:
  id            — eindeutiger string, z.B. "p1"
  title         — Phasen-Titel
  description   — 1 Satz
  startTimeSec  — Phase startet ab Sekunde X
  endTimeSec    — Phase endet bei Sekunde Y
  interventions[]:
    id    — eindeutig, z.B. "i11"
    label — kurzer Label, z.B. "1.1"
    title — Titel der Intervention
    t     — Trigger-Zeitpunkt (Sekunde im Video)
    end   — OPTIONAL: Sekunde, bis zu der die Intervention aktuell ist (exklusiv).
            Ohne end bleibt sie aktuell, bis die nächste Intervention beginnt
            oder die Phase endet.
    desc  — 1 Satz Beschreibung

sciences[]:  (Wissenschafts-Pop-Ups, je 5s sichtbar bei jedem Timestamp)
  id, name, description, timestampsSec[]

audios[]:    (Voice-Over-Einschübe; pausieren das Video)
  id, t (Trigger), dur (Dauer in Sek), title, voice (Sprecher-Name), script (gesprochener Text)
  asset  — Asset-Verweis auf die Audio-Datei, ZEICHENGENAU aus der Liste unter
           "Verfügbare Audio-Assets" übernommen (Form: {{asset:datei-name}}).
           Erfinde NIE ein Token und verändere kein Zeichen — ein falsches Token
           bedeutet: keine Audio-Datei. Ist die Liste leer oder passt zu einem
           Einschub kein Asset, lass asset bei diesem Eintrag komplett weg.
  script — MUSS immer gefüllt sein, auch wenn eine Audio-Datei existiert: er ist der
           Text-to-Speech-Fallback und die Textfassung des Einschubs.

quiz: (OPTIONAL; vollständig weglassen, wenn keine Wissensfragen sinnvoll sind)
  feedbackDurationSec — Dauer der Antwort-Rückmeldung; Standard 3
  showScore            — true zeigt in der Auswertung den Punktestand
  showSummary          — true zeigt am Videoende eine Auswertung
  passingPercent       — optionale Bestehensgrenze von 0 bis 100
  quizzes[]:
    id, title, t (Unterbrechungs-Zeitpunkt), resume ("auto" oder "manual")
    questions[]:
      id, prompt, explanation (optional), timeoutSec (optional, mindestens 5), showCountdown
      correctOptionId — id der einzigen richtigen Antwort
      options[]       — 1 bis 4 Objekte mit jeweils id und text

metaSteps[]: (große Phasen-Marker, "7 Master Steps"-Style)
  id, n (Nummer), title, t (Trigger Sek)

═══ Output-Format (NUR DIESES, keine Erklärung davor/danach) ═══

<pre data-vp-config style="display:none">
{
  "phases": [
    {
      "id":"p1", "title":"Einführung", "description":"...",
      "startTimeSec":0, "endTimeSec":60,
      "interventions":[
        { "id":"i11", "label":"1.1", "title":"...", "t":10, "end":25, "desc":"..." }
      ]
    }
  ],
  "sciences": [
    { "id":"s1", "name":"...", "description":"...", "timestampsSec":[22] }
  ],
  "audios": [
    { "id":"a1", "t":30, "dur":8, "title":"Voice-Over: ...", "voice":"...", "script":"...", "asset":"{{asset:datei-name-aus-der-liste}}" }
  ],
  "metaSteps": [
    { "id":"m1", "n":1, "title":"...", "t":4 }
  ],
  "quiz": {
    "feedbackDurationSec":3,
    "showScore":true,
    "showSummary":true,
    "passingPercent":70,
    "quizzes":[
      {
        "id":"q1", "title":"Kurz-Check", "t":45, "resume":"auto",
        "questions":[
          {
            "id":"q1-1", "prompt":"Welche Aussage trifft zu?", "explanation":"...",
            "timeoutSec":15, "showCountdown":true, "correctOptionId":"q1-1-b",
            "options":[
              { "id":"q1-1-a", "text":"..." },
              { "id":"q1-1-b", "text":"..." },
              { "id":"q1-1-c", "text":"..." }
            ]
          }
        ]
      }
    ]
  }
}
</pre>

═══ Anforderungen ═══

- ALLE id-Strings müssen eindeutig sein
- t-Werte (Zeitstempel) realistisch zum Video-Inhalt
- end muss größer als t sein; ohne end bleibt die Intervention offen (bisheriges Verhalten)
- Jede Quizfrage braucht 1–4 Antworten; correctOptionId muss auf genau eine option.id verweisen
- timeoutSec nur verwenden, wenn Zeitdruck didaktisch sinnvoll ist; empfohlen sind mindestens 15 Sekunden
- Sprache des Materials beibehalten
- Für JEDES gelistete Audio-Asset genau einen audios[]-Eintrag anlegen — die Liste ist
  die Vorgabe, wie viele Voice-Over-Einschübe es gibt
- asset-Token zeichengenau kopieren; jedes Token höchstens einmal verwenden
- Zuordnung Asset → Zeitpunkt aus dem Datei-Namen und der Beschreibung ableiten
  (z.B. "…-intro" an den Anfang, "…-phase-1" in Phase 1); title so formulieren, dass die
  Zuordnung beim Drüberlesen prüfbar ist
- Passt zu einem Einschub kein Asset, asset weglassen (dann greift Text-to-Speech)
- Antworte NUR mit dem <pre>-Block (keine Einleitung, keine Schluss-Erklärung)
- Der Block wird 1:1 in den LearningSuite "Code einbetten"-Block eingefügt

═══ Verfügbare Audio-Assets ═══

Ein Asset pro Zeile, Format: {{asset:datei-name}} — optional " — " und eine kurze Notiz,
wohin es gehört. Leer lassen, wenn es keine Voice-Over-Dateien gibt (dann enthält kein
audios[]-Eintrag ein asset-Feld und alles wird per Text-to-Speech vorgelesen).

[FÜGE HIER DIE ASSET-VERWEISE AUS DEM "CODE EINBETTEN"-EDITOR EIN, Z.B.:
{{asset:2025-12-22-at-00-22-27-intro}} — Intro, ganz an den Anfang
{{asset:2025-12-22-at-00-50-40-voiceover-phase-1}} — Phase 1]

═══ Lektions-Material ═══

[FÜGE HIER DAS LEKTIONS-TRANSKRIPT, DREHBUCH ODER DIE INHALTSBESCHREIBUNG EIN]
`;
