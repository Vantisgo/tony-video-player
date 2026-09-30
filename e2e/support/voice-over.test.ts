import { describe, expect, it } from "vitest";
import { pickVoiceOver } from "./voice-over";

// The canary lesson's first two cues as its page carried them on 2026-09-30
// (run 36710063490): text-to-speech era, a spoken `script` and no `asset`.
// Since the runtime dropped text-to-speech it skips every one of them, and the
// phone canary waited 20s for a card that could never mount.
const a1 = {
  id: "a1",
  t: 45,
  dur: 10,
  title: "Voice-Over: Warum Erwartungsklärung?",
  voice: "Coach-Stimme",
  script:
    "Bevor wir inhaltlich einsteigen, lohnt es sich immer, kurz zu fragen: Was soll am Ende dieser Stunde anders sein?",
};
const a2 = {
  id: "a2",
  t: 255,
  dur: 12,
  title: "Voice-Over: Blockaden als Information",
  voice: "Coach-Stimme",
  script: "Blockaden sind keine Feinde des Fortschritts – sie sind Hinweise.",
};

// The shape an expanded `{{asset:…}}` placeholder arrives in.
const SIGNED_URL =
  "https://storage.googleapis.com/learningsuite-prod-de-storage/courses/steps/voiceover-phase-1?X-Goog-Signature=d498a9";

describe("pickVoiceOver", () => {
  it("reports the text-to-speech era cues as unplayable instead of seeking to one", () => {
    expect(pickVoiceOver([a1, a2])).toEqual({
      kind: "unplayable",
      skipped: [
        { id: "a1", reason: "no-asset" },
        { id: "a2", reason: "no-asset" },
      ],
    });
  });

  it("passes over a cue without audio to the first one the runtime will play", () => {
    expect(pickVoiceOver([a1, { ...a2, asset: SIGNED_URL }])).toEqual({
      kind: "playable",
      id: "a2",
      t: 255,
    });
  });

  it("resolves a bare key through the config's assets table", () => {
    expect(
      pickVoiceOver([{ ...a1, asset: "intro" }], { intro: SIGNED_URL }),
    ).toEqual({ kind: "playable", id: "a1", t: 45 });
  });

  it("counts an asset the runtime refuses as unplayable, with its reason", () => {
    expect(
      pickVoiceOver([
        { ...a1, asset: "{{asset:voiceover-phase-1}}" },
        { ...a2, asset: "intro" },
      ]),
    ).toEqual({
      kind: "unplayable",
      skipped: [
        { id: "a1", reason: "unexpanded" },
        { id: "a2", reason: "missing" },
      ],
    });
  });

  it("is none for a lesson without voice-over cues", () => {
    expect(pickVoiceOver([])).toEqual({ kind: "none" });
  });
});
