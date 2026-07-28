import { afterEach, describe, expect, it, vi } from "vitest";
import { shouldRun } from "../../common/killswitch";

const BASE = "https://cdn.example.com/runtime/";

function stubFetch(impl: () => Promise<unknown>): void {
  vi.stubGlobal("fetch", vi.fn(impl));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // happy-dom reuses the global window between tests — the loader's verdict must
  // not leak into the fail-open cases below.
  delete window.__vpRuntimeGate;
});

describe("shouldRun (F5 kill-switch)", () => {
  it("AC2: fails open when the fetch rejects (network/CSP block)", async () => {
    stubFetch(() => Promise.reject(new Error("blocked")));
    expect(await shouldRun(BASE)).toBe(true);
  });

  it("AC2: fails open on a non-OK response", async () => {
    stubFetch(() => Promise.resolve({ ok: false, json: async () => ({}) }));
    expect(await shouldRun(BASE)).toBe(true);
  });

  it("fails open (and does not fetch) when the origin is unknown", async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ enabled: false }) }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    expect(await shouldRun("")).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("AC1/AC4: returns false only when the flag is explicitly disabled", async () => {
    stubFetch(() =>
      Promise.resolve({ ok: true, json: async () => ({ enabled: false }) }),
    );
    expect(await shouldRun(BASE)).toBe(false);
  });

  it("returns true when the flag is enabled", async () => {
    stubFetch(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ enabled: true, minHostVersion: null }),
      }),
    );
    expect(await shouldRun(BASE)).toBe(true);
  });

  it("honours a verdict the loader already published, without fetching", async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ enabled: false }) }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    window.__vpRuntimeGate = true;
    expect(await shouldRun(BASE)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("honours a published `false` verdict, without fetching", async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ enabled: true }) }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    window.__vpRuntimeGate = false;
    expect(await shouldRun(BASE)).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
