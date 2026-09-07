import type { Audio, MetaStep, Phase, Science } from "../common/types";

// Defaults used when a config section is absent (e.g. authoring stage).
export const DEFAULT_PHASES: Phase[] = [
  {
    id: "p1",
    title: "Model-Based Framing & Agency Priming",
    description:
      "Vorbereitende Phase: das mentale Modell der Klientin wird sichtbar gemacht und neu gerahmt.",
    startTimeSec: 0,
    endTimeSec: 60,
    interventions: [
      {
        id: "i11",
        label: "1.1",
        title: "Model-Based Self-Localization",
        t: 4,
        desc: "Klientin verortet sich im eigenen Modell der Situation.",
      },
      {
        id: "i12",
        label: "1.2",
        title: "Playful Inconsistency Highlighting",
        t: 18,
        desc: "Spielerisch werden Widersprüche im Selbstbild herausgehoben.",
      },
      {
        id: "i13",
        label: "1.3",
        title: "Audience-Directed Meta-Framing",
        t: 35,
        desc: "Re-Framing durch Adressierung der mentalen Beobachter.",
      },
      {
        id: "i14",
        label: "1.4",
        title: "Metaphor Deconstruction",
        t: 50,
        desc: "Trennung metaphorischer Sprache von physiologischer Realität.",
      },
    ],
  },
  {
    id: "p2",
    title: "From Symptom Story to Process Control",
    description:
      "Übergang von der Story über das Symptom zu konkreter Steuerung des Prozesses.",
    startTimeSec: 60,
    endTimeSec: 120,
    interventions: [
      {
        id: "i21",
        label: "2.1",
        title: "Rapport and Emotional Safety",
        t: 64,
        desc: "Aufbau eines emotional sicheren Containers.",
      },
      {
        id: "i22",
        label: "2.2",
        title: "Testing the Pattern",
        t: 78,
        desc: "Vorsichtiges Re-Entry, um das Muster zu prüfen.",
      },
      {
        id: "i23",
        label: "2.3",
        title: "You Create the Pattern",
        t: 96,
        desc: "Klientin erkennt sich als aktive Erzeugerin.",
      },
    ],
  },
  {
    id: "p3",
    title: "Practice & Commitment",
    description:
      "Konsolidierung und konkreter Mikro-Vorsatz für die nächsten 24 Stunden.",
    startTimeSec: 120,
    endTimeSec: 152,
    interventions: [
      {
        id: "i31",
        label: "3.1",
        title: "Future Pacing",
        t: 128,
        desc: "Mentale Vorwegnahme der erfolgreichen Umsetzung.",
      },
      {
        id: "i32",
        label: "3.2",
        title: "Mikro-Commitment",
        t: 142,
        desc: "Kleinster Schritt, sofort umsetzbar.",
      },
    ],
  },
];

export const DEFAULT_SCIENCES: Science[] = [
  {
    id: "s1",
    name: "Polyvagal Theory",
    description: "Autonome Nervensystem-Zustände als Erklärungsrahmen.",
    timestampsSec: [22, 86],
  },
  {
    id: "s2",
    name: "Six Human Needs",
    description: "Modell intrinsischer Motivationen.",
    timestampsSec: [70, 105],
  },
  {
    id: "s3",
    name: "Interoception",
    description: "Wahrnehmung innerer Körpersignale.",
    timestampsSec: [40],
  },
];

export const DEFAULT_AUDIOS: Audio[] = [
  {
    id: "a1",
    t: 30,
    dur: 9,
    title: "Voice-Over: Klarheit als Werkzeug",
    voice: "Dr. Frederik Hümmeke",
    script:
      "Klarheit ist nicht nur eine Eigenschaft. Sie ist ein wiederholbares Werkzeug, mit dem du im Alltag wirken kannst.",
  },
  {
    id: "a2",
    t: 115,
    dur: 8,
    title: "Voice-Over: Reflexionsimpuls",
    voice: "Dr. Frederik Hümmeke",
    script:
      "Halte einen Moment inne. Frage dich: wo handle ich heute schon klar, und wo zögere ich noch?",
  },
];

export const DEFAULT_META_STEPS: MetaStep[] = [
  { id: "m1", n: 1, title: "Self-Localization", t: 4 },
  { id: "m2", n: 2, title: "Pattern Visibility", t: 25 },
  { id: "m3", n: 3, title: "Agency Reframe", t: 60 },
  { id: "m4", n: 4, title: "Decoding Need", t: 90 },
  { id: "m5", n: 5, title: "Process Control", t: 110 },
  { id: "m6", n: 6, title: "Future Pacing", t: 128 },
  { id: "m7", n: 7, title: "Mikro-Commitment", t: 142 },
];
