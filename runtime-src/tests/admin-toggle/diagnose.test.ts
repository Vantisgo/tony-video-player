import { describe, expect, it, vi } from "vitest";
import { diagnoseEmbed } from "../../admin-toggle/diagnose";

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

const keys = (code: string): string[] =>
  (diagnoseEmbed(code) ?? []).map((f) => f.key);

describe("diagnoseEmbed: which embeds are ours", () => {
  it.each([
    pre("{}"),
    '<PRE DATA-VP-CONFIG="">{}</PRE>',
    '<pre title="a > b" data-vp-config>{}</pre>',
    "```html\n" + pre("{}") + "\n```",
  ])("diagnoses %j", (code) => {
    expect(diagnoseEmbed(code)).not.toBeNull();
  });

  it.each([
    '<iframe src="https://example.com"></iframe>',
    '{ "phases": [] }',
    "<pre data-vp-config-backup>{}</pre>",
    '<pre title="data-vp-config">{}</pre>',
    "<!-- <pre data-vp-config>{}</pre> -->",
  ])("leaves %j alone", (code) => {
    expect(diagnoseEmbed(code)).toBeNull();
  });
});

describe("diagnoseEmbed: the block", () => {
  it("accepts a valid <pre data-vp-config> block", () => {
    expect(diagnoseEmbed(pre(JSON.stringify(VALID)))).toEqual([]);
  });

  it("flags fences around an otherwise valid block, and still checks the JSON", () => {
    expect(keys("```html\n" + pre(JSON.stringify(VALID)) + "\n```")).toEqual([
      "admin.diag.fencesHtml",
    ]);
  });

  it("does not mistake backticks inside a JSON string for a fence", () => {
    expect(
      diagnoseEmbed(
        pre(JSON.stringify({ ...VALID, phases: [{ title: "```" }] })),
      ),
    ).toEqual([]);
  });

  it("flags an element the runtime would read instead of the block", () => {
    expect(
      diagnoseEmbed(
        '<p data-vp-config>{ broken</p><pre data-vp-config>{"phases":[]}</pre>',
      ),
    ).toEqual([
      expect.objectContaining({
        key: "admin.diag.precededHtml",
        vars: { tag: "p" },
      }),
    ]);
  });

  it("flags an empty block", () => {
    expect(keys(pre("  "))).toEqual(["admin.diag.emptyHtml"]);
  });
});

describe("diagnoseEmbed: JSON errors", () => {
  it("points at the line and column of a syntax error, with the line as context", () => {
    const [finding] = diagnoseEmbed(
      pre('{\n  "phases": []\n  "audios": []\n}'),
    )!;

    expect(finding.key).toBe("admin.diag.jsonAtHtml");
    expect(finding.vars).toMatchObject({
      line: 3,
      column: 3,
      snippet: '"audios": []',
    });
  });

  it("counts characters instead of lines for single-line code, as the editor stores it", () => {
    const [finding] = diagnoseEmbed(
      '<pre data-vp-config>{ "phases": [] "audios": [] }</pre>',
    )!;

    expect(finding.key).toBe("admin.diag.jsonAtCharHtml");
    expect(finding.vars).toMatchObject({ column: 16 });
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
