import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

// The loader resolves its own URL from window.__vpRuntimeBaseUrl (the same hook
// the e2e harness uses), so the tests can pin the origin AND the bypass query
// string that must reach every child.
const LOADER_URL =
  "https://cdn.example.com/runtime/loader.js?x-vercel-protection-bypass=SECRET";
const child = (entry: string): string =>
  `https://cdn.example.com/runtime/${entry}.js?x-vercel-protection-bypass=SECRET`;

const CONFIG_HTML = '<pre data-vp-config>{"phases":[]}</pre>';

// Deliberately a loose view of window: these are the runtime's dynamic globals,
// created and deleted per test.
const w = (): Record<string, unknown> =>
  window as unknown as Record<string, unknown>;

let fetchSpy: Mock;

function injectedSrcs(): string[] {
  return [...document.querySelectorAll("script[src]")].map(
    (s) => (s as HTMLScriptElement).src,
  );
}

function tagFor(entry: string): HTMLScriptElement | undefined {
  return [...document.querySelectorAll("script[src]")].find((s) =>
    (s as HTMLScriptElement).src.includes(`${entry}.js`),
  ) as HTMLScriptElement | undefined;
}

// The loader runs its IIFE on import, so each scenario arranges the page first
// and then (re-)imports it.
async function runLoader(): Promise<void> {
  vi.resetModules();
  await import("../../loader/index");
  await vi.waitFor(() => expect(typeof w().__vpLoaderStatus).toBe("string"));
}

function publishPlayer(): void {
  w().player = { current: 0 };
}

beforeEach(() => {
  window.location.href = "http://localhost:3000/lesson/xyz";
  document.querySelectorAll("script").forEach((s) => s.remove());
  document.body.innerHTML = "";
  for (const key of [
    "__vpLoaded",
    "__vpLoaderStatus",
    "__vpRuntimeGate",
    "__vpLoaderCleanup",
    "player",
  ])
    delete w()[key];
  w().__vpRuntimeBaseUrl = LOADER_URL;
  fetchSpy = vi.fn(() =>
    Promise.resolve({ ok: true, json: async () => ({ enabled: true }) }),
  );
  vi.stubGlobal("fetch", fetchSpy);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("loader gating (AC2, AC3)", () => {
  it("AC2: injects nothing on a page with no config and no editor URL", async () => {
    document.body.innerHTML = "<div><p>just a lesson</p></div>";
    await runLoader();
    expect(injectedSrcs()).toEqual([]);
    expect(w().__vpLoaderStatus).toBe("loader armed");
    expect(document.body.innerHTML).toBe("<div><p>just a lesson</p></div>");
  });

  it("AC2/AC3: injects reskin-player once, with the bypass query string", async () => {
    document.body.innerHTML = CONFIG_HTML;
    await runLoader();
    expect(injectedSrcs()).toEqual([child("reskin-player")]);
    expect(w().__vpLoaded).toEqual(["reskin-player"]);
  });

  it("AC2: does not inject demo-overlays before reskin-player has loaded", async () => {
    document.body.innerHTML = CONFIG_HTML;
    await runLoader();
    expect(tagFor("demo-overlays")).toBeUndefined();
  });
});

describe("loader ordering (AC4, AC5)", () => {
  it("AC4: injects demo-overlays only after reskin loaded and published window.player", async () => {
    document.body.innerHTML = CONFIG_HTML;
    await runLoader();

    publishPlayer();
    tagFor("reskin-player")?.dispatchEvent(new Event("load"));

    await vi.waitFor(() => expect(tagFor("demo-overlays")).toBeDefined());
    expect(tagFor("demo-overlays")?.src).toBe(child("demo-overlays"));
    expect(w().__vpLoaded).toEqual(["reskin-player", "demo-overlays"]);
  });

  it("AC5: injects demo-overlays anyway (with a warning) when window.player never appears", async () => {
    // Fake timers must be installed before the loader arms its player poll,
    // otherwise the real interval it created cannot be advanced.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    document.body.innerHTML = CONFIG_HTML;
    await runLoader();

    tagFor("reskin-player")?.dispatchEvent(new Event("load"));
    await vi.advanceTimersByTimeAsync(3100);

    expect(tagFor("demo-overlays")).toBeDefined();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("window.player never appeared"),
    );
  });
});

describe("loader lazy re-evaluation (AC6)", () => {
  it("AC6: injects reskin-player when the config appears after the loader ran", async () => {
    await runLoader();
    expect(injectedSrcs()).toEqual([]);

    document.body.insertAdjacentHTML("beforeend", CONFIG_HTML);

    await vi.waitFor(() => expect(tagFor("reskin-player")).toBeDefined());
  });
});

describe("loader admin gate (AC1)", () => {
  it("AC1: injects admin-toggle in the editor's edit view", async () => {
    window.location.href = "http://localhost:3000/admin/editor/abc";
    await runLoader();
    expect(tagFor("admin-toggle")?.src).toBe(child("admin-toggle"));
  });

  it("AC1: injects nothing in the editor's preview view", async () => {
    window.location.href =
      "http://localhost:3000/admin/editor/abc?view=preview";
    await runLoader();
    expect(injectedSrcs()).toEqual([]);
  });
});

describe("loader kill-switch (AC7, AC8)", () => {
  it("AC7: injects nothing at all — admin-toggle included — when the flag is off", async () => {
    // Both gates would pass: editor URL *and* a config on the page.
    window.location.href = "http://localhost:3000/admin/editor/abc";
    document.body.innerHTML = CONFIG_HTML;
    fetchSpy.mockImplementation(() =>
      Promise.resolve({ ok: true, json: async () => ({ enabled: false }) }),
    );
    await runLoader();
    expect(injectedSrcs()).toEqual([]);
    expect(w().__vpRuntimeGate).toBe(false);
    expect(w().__vpLoaderStatus).toBe("loader: disabled by kill-switch");
  });

  it("AC8: publishes the verdict so children make no second flag request", async () => {
    document.body.innerHTML = CONFIG_HTML;
    await runLoader();
    expect(w().__vpRuntimeGate).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const { shouldRun } = await import("../../common/killswitch");
    expect(await shouldRun("https://cdn.example.com/runtime/")).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("loader idempotency (AC9)", () => {
  it("AC9: a second injection re-arms without loading any child twice", async () => {
    document.body.innerHTML = CONFIG_HTML;
    await runLoader();
    publishPlayer();
    tagFor("reskin-player")?.dispatchEvent(new Event("load"));
    await vi.waitFor(() => expect(tagFor("demo-overlays")).toBeDefined());

    await runLoader();

    expect(w().__vpLoaded).toEqual(["reskin-player", "demo-overlays"]);
    expect(
      injectedSrcs().filter((s) => s === child("reskin-player")).length,
    ).toBeLessThanOrEqual(1);
    expect(
      injectedSrcs().filter((s) => s === child("demo-overlays")).length,
    ).toBeLessThanOrEqual(1);
  });
});
