import { afterEach, describe, expect, it, vi } from "vitest";
import { loadVpConfig, parseVpConfig } from "../../common/config";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

const validConfig = {
  phases: [
    {
      id: "p1",
      title: "Intro",
      description: "d",
      startTimeSec: 0,
      endTimeSec: 60,
      interventions: [{ id: "i1", label: "1.1", title: "t", t: 4, desc: "d" }],
    },
  ],
  sciences: [{ id: "s1", name: "n", description: "d", timestampsSec: [22] }],
  audios: [{ id: "a1", t: 30, dur: 8, title: "t", voice: "v", script: "s" }],
  metaSteps: [{ id: "m1", n: 1, title: "t", t: 4 }],
};

describe("parseVpConfig", () => {
  it("returns typed sections for a valid config", () => {
    const parsed = parseVpConfig(validConfig);
    expect(parsed.phases).toHaveLength(1);
    expect(parsed.sciences?.[0].name).toBe("n");
    expect(parsed.audios?.[0].voice).toBe("v");
    expect(parsed.metaSteps?.[0].n).toBe(1);
  });

  it("returns undefined for absent sections", () => {
    const parsed = parseVpConfig({ phases: validConfig.phases });
    expect(parsed.phases).toHaveLength(1);
    expect(parsed.sciences).toBeUndefined();
    expect(parsed.audios).toBeUndefined();
  });

  it("treats a non-array section as absent (falls back later)", () => {
    const parsed = parseVpConfig({ phases: "nope" });
    expect(parsed.phases).toBeUndefined();
  });

  it("keeps a present-but-empty section as an empty array", () => {
    const parsed = parseVpConfig({ sciences: [] });
    expect(parsed.sciences).toEqual([]);
  });

  it("does not throw on non-object input", () => {
    for (const raw of [null, "x"]) {
      const parsed = parseVpConfig(raw);
      expect(parsed.phases).toBeUndefined();
      expect(parsed.sciences).toBeUndefined();
      expect(parsed.audios).toBeUndefined();
      expect(parsed.metaSteps).toBeUndefined();
      // Non-array sections come back undefined ("absent, use the default"), but
      // demo/quiz are always resolved: no opt-in, no quiz.
      expect(parsed.demo).toBe(false);
      expect(parsed.quiz).toBeNull();
    }
  });

  it("resolves demo only for an explicit boolean true", () => {
    expect(parseVpConfig({}).demo).toBe(false);
    expect(parseVpConfig({ demo: "yes" }).demo).toBe(false);
    expect(parseVpConfig({ demo: true }).demo).toBe(true);
  });

  it("normalises a quiz section and nulls an invalid one", () => {
    expect(parseVpConfig(validConfig).quiz).toBeNull();
    expect(parseVpConfig({ quiz: { quizzes: [] } }).quiz).toBeNull();

    const parsed = parseVpConfig({
      ...validConfig,
      quiz: {
        quizzes: [
          {
            id: "quiz-1",
            t: 45,
            questions: [
              {
                id: "q1",
                prompt: "p",
                correctOptionId: "b",
                options: [
                  { id: "a", text: "a" },
                  { id: "b", text: "b" },
                ],
              },
            ],
          },
        ],
      },
    });
    expect(parsed.quiz?.quizzes).toHaveLength(1);
    expect(parsed.quiz?.feedbackDurationSec).toBe(3);
  });
});

describe("parseVpConfig: assets table", () => {
  it("passes a string table through untouched", () => {
    const assets = { intro: "https://cdn.test/intro.mp3" };
    expect(parseVpConfig({ assets }).assets).toEqual(assets);
  });

  it("leaves assets undefined when the section is absent", () => {
    expect(parseVpConfig({ audios: [] }).assets).toBeUndefined();
  });

  it("ignores a non-object assets section", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      parseVpConfig({ assets: ["https://cdn.test/a.mp3"] }).assets,
    ).toBeUndefined();
    expect(parseVpConfig({ assets: "nope" }).assets).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("drops unusable entries but keeps the rest of the table", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const parsed = parseVpConfig({
      assets: {
        intro: "https://cdn.test/intro.mp3",
        broken: 42,
        empty: "   ",
        "   ": "https://cdn.test/blank-key.mp3",
      },
    });

    // One typo'd entry must not take every voice-over on the page down with it.
    expect(parsed.assets).toEqual({ intro: "https://cdn.test/intro.mp3" });
    expect(warn).toHaveBeenCalled();
  });

  it("trims values so a table entry survives pretty-printed config", () => {
    expect(
      parseVpConfig({ assets: { intro: "  https://cdn.test/intro.mp3  " } })
        .assets,
    ).toEqual({ intro: "https://cdn.test/intro.mp3" });
  });
});

describe("loadVpConfig", () => {
  it("reads a <pre data-vp-config> element", () => {
    const pre = document.createElement("pre");
    pre.setAttribute("data-vp-config", "");
    pre.textContent = JSON.stringify({ phases: [] });
    document.body.appendChild(pre);

    const hit = loadVpConfig();
    expect(hit?.source).toBe("element");
    expect((hit?.data as { phases: unknown[] }).phases).toEqual([]);
  });

  it("prefers a JSON <script> over other shapes", () => {
    const script = document.createElement("script");
    script.setAttribute("type", "application/json");
    script.setAttribute("data-vp-config", "");
    script.textContent = JSON.stringify({ audios: [] });
    document.body.appendChild(script);

    expect(loadVpConfig()?.source).toBe("script");
  });

  it("returns null when no config is present", () => {
    expect(loadVpConfig()).toBeNull();
  });
});
