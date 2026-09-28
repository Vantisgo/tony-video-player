import { describe, expect, it, vi } from "vitest";
import { diagnoseEmbed, looksLikeEmbed } from "../../admin-toggle/diagnose";

const pre = (json: string): string =>
  `<pre data-vp-config style="display:none">\n${json}\n</pre>`;

const VALID = {
  phases: [],
  audios: [
    {
      id: "a1",
      t: 2,
      dur: 8,
      title: "T",
      voice: "V",
      asset: "{{asset:intro}}",
    },
  ],
};

const keys = (code: string): string[] => diagnoseEmbed(code).map((f) => f.key);

describe("looksLikeEmbed", () => {
  it.each([
    pre("{}"),
    "<!--VP_CONFIG {} VP_CONFIG-->",
    '```json\n{ "phases": [] }\n```',
  ])("recognises %j as meant to be our config", (value) => {
    expect(looksLikeEmbed(value)).toBe(true);
  });

  it("ignores unrelated inputs", () => {
    expect(looksLikeEmbed("Lektion 3: Einführung")).toBe(false);
  });
});

describe("diagnoseEmbed: the wrapper LearningSuite keeps", () => {
  it("accepts a valid <pre data-vp-config> block", () => {
    expect(diagnoseEmbed(pre(JSON.stringify(VALID)))).toEqual([]);
  });

  it("flags bare JSON without the <pre> wrapper", () => {
    expect(keys(JSON.stringify(VALID))).toEqual([
      "admin.diag.wrapperMissingHtml",
    ]);
  });

  it("names the Markdown fences an LLM put around bare JSON", () => {
    expect(keys("```json\n" + JSON.stringify(VALID) + "\n```")).toEqual([
      "admin.diag.wrapperMissingHtml",
      "admin.diag.fencesHtml",
    ]);
  });

  it("flags fences around an otherwise valid block, and still checks the JSON", () => {
    expect(keys("```html\n" + pre(JSON.stringify(VALID)) + "\n```")).toEqual([
      "admin.diag.fencesHtml",
    ]);
  });

  it("flags the shapes the sanitiser strips", () => {
    const json = JSON.stringify(VALID);
    expect(
      keys(`<script type="application/json" data-vp-config>${json}</script>`),
    ).toEqual(["admin.diag.scriptTagHtml"]);
    expect(keys(`<!--VP_CONFIG ${json} VP_CONFIG-->`)).toEqual([
      "admin.diag.commentHtml",
    ]);
    expect(diagnoseEmbed(`<div data-vp-config>${json}</div>`)).toEqual([
      expect.objectContaining({
        key: "admin.diag.wrapperTagHtml",
        vars: { tag: "div" },
      }),
    ]);
  });

  it("does not mistake backticks inside a JSON string for a fence", () => {
    expect(
      diagnoseEmbed(
        pre(JSON.stringify({ ...VALID, phases: [{ title: "```" }] })),
      ),
    ).toEqual([]);
  });

  it("flags an empty block", () => {
    expect(keys(pre("  "))).toEqual(["admin.diag.emptyHtml"]);
  });
});

describe("diagnoseEmbed: JSON errors", () => {
  it("points at the line and column of a syntax error, with the line as context", () => {
    const [finding] = diagnoseEmbed(
      pre('{\n  "phases": []\n  "audios": []\n}'),
    );

    expect(finding.key).toBe("admin.diag.jsonAtHtml");
    expect(finding.vars).toMatchObject({
      line: 3,
      column: 3,
      snippet: '"audios": []',
    });
  });

  it("names typographic quotes as the likely cause", () => {
    expect(keys(pre("{ “phases”: [] }"))).toContain(
      "admin.diag.smartQuotesHtml",
    );
  });
});

describe("diagnoseEmbed: structure", () => {
  it("requires an object", () => {
    expect(keys(pre("[]"))).toEqual(["admin.diag.notObjectHtml"]);
  });

  it("requires at least one content section", () => {
    expect(keys(pre('{ "assets": {} }'))).toEqual([
      "admin.diag.noSectionsHtml",
    ]);
  });

  it("accepts a demo config without sections", () => {
    expect(keys(pre('{ "demo": true }'))).toEqual([]);
  });

  it("flags a section that is not a list, and an unknown key", () => {
    expect(keys(pre('{ "phases": {}, "audio": [] }'))).toEqual([
      "admin.diag.unknownKeyHtml",
      "admin.diag.notArrayHtml",
    ]);
  });

  it("warns when the quiz would be dropped entirely", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(keys(pre('{ "quiz": { "quizzes": [{ "id": "q1" }] } }'))).toEqual([
      "admin.diag.quizInvalidHtml",
    ]);
    vi.restoreAllMocks();
  });
});

describe("diagnoseEmbed: voice-over assets", () => {
  const withAudio = (audio: Record<string, unknown>, extra = {}) =>
    pre(JSON.stringify({ audios: [{ id: "a1", ...audio }], ...extra }));

  it("warns about a cue without an asset", () => {
    expect(diagnoseEmbed(withAudio({}))).toEqual([
      expect.objectContaining({
        level: "warning",
        key: "admin.diag.audioNoAssetHtml",
        vars: { id: "a1" },
      }),
    ]);
  });

  it("accepts a token, an https URL, and a key of the assets table", () => {
    expect(keys(withAudio({ asset: "{{asset:x}}" }))).toEqual([]);
    expect(keys(withAudio({ asset: "https://cdn.example/a.mp3" }))).toEqual([]);
    expect(
      keys(withAudio({ asset: "intro" }, { assets: { intro: "{{asset:x}}" } })),
    ).toEqual([]);
  });

  it("warns about a reference the runtime would refuse", () => {
    for (const [asset, assets] of [
      ["https://", {}],
      ["http://cdn.example/a.mp3", {}],
      ["intro", { intro: "" }],
      ["intro", { intro: "http://cdn.example/a.mp3" }],
    ] as const)
      expect(keys(withAudio({ asset }, { assets }))).toEqual([
        "admin.diag.audioAssetUnknownHtml",
      ]);
  });

  it("warns about a reference that resolves to nothing", () => {
    expect(keys(withAudio({ asset: "intro" }))).toEqual([
      "admin.diag.audioAssetUnknownHtml",
    ]);
    expect(keys(withAudio({ asset: "constructor" }))).toEqual([
      "admin.diag.audioAssetUnknownHtml",
    ]);
  });
});
