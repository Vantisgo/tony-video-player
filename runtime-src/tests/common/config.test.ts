import { afterEach, describe, expect, it } from "vitest";
import { loadVpConfig, parseVpConfig } from "../../common/config";

afterEach(() => {
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
    expect(parseVpConfig(null)).toEqual({});
    expect(parseVpConfig("x")).toEqual({});
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
