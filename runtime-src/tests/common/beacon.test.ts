import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const BASE = "https://cdn.example.com/runtime/";
const EXPECTED_URL = "https://cdn.example.com/api/runtime-telemetry";

// Fresh module per test so beacon's per-session dedup Set resets.
async function loadBeacon() {
  return import("../../common/beacon");
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("capConfig (F6 AC6)", () => {
  it("passes a normal config through unchanged", async () => {
    const { capConfig } = await loadBeacon();
    const cfg = { phases: [{ id: "p1" }] };
    expect(capConfig(cfg)).toBe(cfg);
  });

  it("truncates an oversized config to a marker", async () => {
    const { capConfig, MAX_CONFIG_BYTES } = await loadBeacon();
    const big = { blob: "x".repeat(MAX_CONFIG_BYTES + 100) };
    expect(capConfig(big)).toEqual({
      __truncated: true,
      bytes: expect.any(Number),
    });
  });

  it("handles an unserializable config", async () => {
    const { capConfig } = await loadBeacon();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(capConfig(circular)).toEqual({ __unserializable: true });
  });
});

describe("report (F6)", () => {
  it("AC6: sends exactly { errorType, videoId, config } and no more", async () => {
    // sendBeacon returns false → falls back to fetch, whose body we can read.
    vi.stubGlobal("navigator", { sendBeacon: vi.fn(() => false) });
    const fetchSpy = vi.fn<
      (url: string, options: RequestInit) => Promise<{ ok: boolean }>
    >(() => Promise.resolve({ ok: true }));
    vi.stubGlobal("fetch", fetchSpy);

    const { report } = await loadBeacon();
    report(BASE, {
      errorType: "attach-error",
      videoId: "vid-1",
      config: { a: 1 },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe(EXPECTED_URL);
    const body = JSON.parse(options.body as string);
    expect(Object.keys(body).sort()).toEqual([
      "config",
      "errorType",
      "videoId",
    ]);
    expect(body).toMatchObject({
      errorType: "attach-error",
      videoId: "vid-1",
      config: { a: 1 },
    });
  });

  it("AC1: dedups — one beacon per (errorType, videoId) per session", async () => {
    const sendBeacon = vi.fn<(url: string, blob?: Blob) => boolean>(() => true);
    vi.stubGlobal("navigator", { sendBeacon });
    const { report } = await loadBeacon();

    const payload = { errorType: "attach-error", videoId: "v", config: null };
    report(BASE, payload);
    report(BASE, payload);
    report(BASE, payload);

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.calls[0][0]).toBe(EXPECTED_URL);
  });

  it("does nothing when the origin is unknown (empty base)", async () => {
    const sendBeacon = vi.fn(() => true);
    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal("navigator", { sendBeacon });
    vi.stubGlobal("fetch", fetchSpy);

    const { report } = await loadBeacon();
    report("", { errorType: "x", videoId: "y", config: null });

    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
