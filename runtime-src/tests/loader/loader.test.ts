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
  // Disarm any loader a previous test left running. Deleting __vpLoaderCleanup
  // without running it orphans that instance's MutationObserver and URL poll,
  // which then keep firing against this test's DOM and inject children of their
  // own — with their own (stale) runtime-origin verdict. Real re-injection is
  // safe because main() calls resetCleanup() first; only the harness leaks.
  const pending = w().__vpLoaderCleanup;
  if (Array.isArray(pending))
    pending.forEach((fn) => {
      try {
        (fn as () => void)();
      } catch {
        /* a half-armed instance may throw; the point is to stop it */
      }
    });

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

describe("loader local-first runtime", () => {
  const HANDSHAKE = "http://localhost:3000/runtime/dev-handshake.json";
  const localChild = (entry: string): string =>
    `http://localhost:3000/runtime/${entry}.js`;

  // The probe is skipped whenever __vpRuntimeBaseUrl is pinned (a harness has
  // already chosen the origin), which the shared beforeEach does. These tests
  // therefore unpin it and leave a real <script> tag for the loader's own URL
  // scan to find — the resolution path a deployed tenant actually takes.
  function unpinOrigin(): void {
    delete w().__vpRuntimeBaseUrl;
    const tag = document.createElement("script");
    tag.src = LOADER_URL;
    document.head.appendChild(tag);
  }

  // fetch serves double duty here: the kill-switch flag and the handshake.
  function answerHandshake(body: unknown | null): void {
    fetchSpy.mockImplementation((url: string) => {
      if (String(url) === HANDSHAKE) {
        if (body === null) return Promise.reject(new TypeError("failed"));
        return Promise.resolve({ ok: true, json: async () => body });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ enabled: true }),
      });
    });
  }

  it("loads every child from the dev server when the handshake answers", async () => {
    unpinOrigin();
    answerHandshake({ vpDevRuntime: true });
    document.body.innerHTML = CONFIG_HTML;

    await runLoader();
    await vi.waitFor(() => expect(tagFor("reskin-player")).toBeDefined());
    expect(tagFor("reskin-player")?.src).toBe(localChild("reskin-player"));
    expect(w().__vpLocalRuntime).toBe("local");

    publishPlayer();
    tagFor("reskin-player")?.dispatchEvent(new Event("load"));
    await vi.waitFor(() => expect(tagFor("demo-overlays")).toBeDefined());

    // All-or-nothing: a local reskin against a deployed demo-overlays would be
    // version skew that reads like a runtime bug.
    expect(tagFor("demo-overlays")?.src).toBe(localChild("demo-overlays"));
  });

  it("sets crossorigin on a local child, without which Chrome never fires an event", async () => {
    unpinOrigin();
    answerHandshake({ vpDevRuntime: true });
    document.body.innerHTML = CONFIG_HTML;

    await runLoader();
    await vi.waitFor(() => expect(tagFor("reskin-player")).toBeDefined());

    expect(tagFor("reskin-player")?.crossOrigin).toBe("anonymous");
  });

  it("points the children's kill-switch and telemetry at the dev server too", async () => {
    unpinOrigin();
    answerHandshake({ vpDevRuntime: true });
    document.body.innerHTML = CONFIG_HTML;

    await runLoader();
    await vi.waitFor(() => expect(w().__vpLocalRuntime).toBe("local"));

    expect(w().__vpRuntimeBaseUrl).toBe(
      "http://localhost:3000/runtime/loader.js",
    );
  });

  it("falls back to the deployed origin when nothing answers", async () => {
    unpinOrigin();
    answerHandshake(null); // dead port
    document.body.innerHTML = CONFIG_HTML;

    await runLoader();
    await vi.waitFor(() => expect(tagFor("reskin-player")).toBeDefined());

    expect(tagFor("reskin-player")?.src).toBe(child("reskin-player"));
    expect(tagFor("reskin-player")?.crossOrigin).toBeFalsy();
    expect(w().__vpLocalRuntime).toBe("deployed");
  });

  it("falls back when a foreign server answers without the marker", async () => {
    unpinOrigin();
    answerHandshake({ hello: "world" });
    document.body.innerHTML = CONFIG_HTML;

    await runLoader();
    await vi.waitFor(() => expect(tagFor("reskin-player")).toBeDefined());

    expect(tagFor("reskin-player")?.src).toBe(child("reskin-player"));
  });

  it("does not probe at all on a page where no gate passes", async () => {
    unpinOrigin();
    answerHandshake({ vpDevRuntime: true });
    // No config, not the editor → nothing is injected, so nothing is asked of
    // the local network. This is the property that keeps a learner's browser
    // from touching localhost on every page view.
    await runLoader();

    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(urls).not.toContain(HANDSHAKE);
    // __vpLoaded, not injectedSrcs(): unpinOrigin() puts a loader tag in the
    // document itself, which is not an injection.
    expect(w().__vpLoaded ?? []).toEqual([]);
  });

  it("probes once per page even though the gates re-run", async () => {
    unpinOrigin();
    answerHandshake({ vpDevRuntime: true });
    document.body.innerHTML = CONFIG_HTML;
    await runLoader();
    await vi.waitFor(() => expect(tagFor("reskin-player")).toBeDefined());

    // An editor navigation re-evaluates the gates; the verdict is memoized.
    window.location.href = "http://localhost:3000/admin/editor/abc";
    await vi.waitFor(() => expect(tagFor("admin-toggle")).toBeDefined());

    const probes = fetchSpy.mock.calls.filter(
      (c) => String(c[0]) === HANDSHAKE,
    );
    expect(probes).toHaveLength(1);
    expect(tagFor("admin-toggle")?.src).toBe(localChild("admin-toggle"));
  });

  it("skips the probe when devProbe is off (no redeploy needed to stop it)", async () => {
    unpinOrigin();
    fetchSpy.mockImplementation((url: string) =>
      String(url) === HANDSHAKE
        ? Promise.resolve({
            ok: true,
            json: async () => ({ vpDevRuntime: true }),
          })
        : Promise.resolve({
            ok: true,
            json: async () => ({ enabled: true, devProbe: false }),
          }),
    );
    document.body.innerHTML = CONFIG_HTML;

    await runLoader();
    await vi.waitFor(() => expect(tagFor("reskin-player")).toBeDefined());

    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(urls).not.toContain(HANDSHAKE);
    expect(tagFor("reskin-player")?.src).toBe(child("reskin-player"));
  });

  it("skips the probe when a harness pinned the origin, but still asks the flag", async () => {
    // The shared beforeEach pins __vpRuntimeBaseUrl — the e2e preview case,
    // which routes /runtime/*.js itself and must not be overridden.
    answerHandshake({ vpDevRuntime: true });
    document.body.innerHTML = CONFIG_HTML;

    await runLoader();
    await vi.waitFor(() => expect(tagFor("reskin-player")).toBeDefined());

    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(urls).not.toContain(HANDSHAKE);
    expect(urls.some((u) => u.includes("/api/runtime-config"))).toBe(true);
    expect(tagFor("reskin-player")?.src).toBe(child("reskin-player"));
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
