import { afterEach, describe, expect, it, vi } from "vitest";
import { shouldRun } from "../../common/killswitch";

const BASE = "https://cdn.example.com/runtime/";

function stubFetch(impl: () => Promise<unknown>): void {
  vi.stubGlobal("fetch", vi.fn(impl));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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
});
