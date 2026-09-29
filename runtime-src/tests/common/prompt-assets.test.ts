import { describe, expect, it } from "vitest";
import { PROMPT_TEXT } from "../../admin-toggle/prompt";

// The prompt is the ONLY thing that teaches an author a config field exists.
// `audios[].avatar` is resolved and rendered by the runtime, but nothing
// validates it and nothing else documents it — so a future edit that drops a
// rule here silently removes the feature from every config authored afterwards.
// These pin the rules that carry real consequences, not the prose around them.
describe("admin prompt: portrait assets", () => {
  it("declares a portrait input section separate from the audio one", () => {
    // Separate sections, not one pooled list: the audio rules below are strict
    // about one-entry-per-asset and single use, and a portrait breaks both.
    expect(PROMPT_TEXT).toContain("Verfügbare Audio-Assets");
    expect(PROMPT_TEXT).toContain("Verfügbare Portrait-Assets");
  });

  it("documents `avatar` in the audios[] schema", () => {
    expect(PROMPT_TEXT).toContain("avatar");
  });

  it("tells the model a portrait must NOT become its own audios[] entry", () => {
    // Load-bearing. The existing rule "für JEDES gelistete Audio-Asset genau
    // einen audios[]-Eintrag anlegen" would otherwise have the model invent a
    // voice-over per uploaded portrait.
    expect(PROMPT_TEXT).toMatch(
      /Portrait-Assets? (erzeugen|erzeugt) KEINEN? eigenen audios\[\]-Eintrag/i,
    );
  });

  it("permits reusing one portrait token across entries, unlike an audio token", () => {
    // Two cues by the same speaker share a face, so `avatar` is explicitly
    // exempt from the "jedes Token höchstens einmal verwenden" rule that
    // governs `asset`.
    expect(PROMPT_TEXT).toContain("höchstens einmal");
    expect(PROMPT_TEXT).toMatch(/avatar[\s\S]{0,400}mehrfach/i);
  });

  it("carries an avatar in the JSON example, not just in prose", () => {
    // A shape to copy beats a description to interpret.
    expect(PROMPT_TEXT).toMatch(/"avatar"\s*:\s*"\{\{asset:/);
  });

  it("still keeps the material's language instruction", () => {
    expect(PROMPT_TEXT).toContain("Sprache des Materials");
  });
});
