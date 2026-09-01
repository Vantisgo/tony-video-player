import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LOCAL_LOADER_URL,
  probeLocalRuntime,
} from "../../loader/local-runtime";

const HANDSHAKE = "http://localhost:3000/runtime/dev-handshake.json";

function stubFetch(impl: (url: string, init?: RequestInit) => unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) =>
      Promise.resolve(impl(url, init)).then((v) => {
        if (v instanceof Error) throw v;
        return v;
      }),
    ),
  );
}

const ok = (body: unknown) => ({ ok: true, json: async () => body });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("probeLocalRuntime: the positive case", () => {
  it("accepts a correctly marked handshake", async () => {
    stubFetch(() => ok({ vpDevRuntime: true }));
    expect(await probeLocalRuntime()).toBe(true);
  });

  it("asks the loopback handshake URL, credential-less and uncached", async () => {
    let seen: [string, RequestInit | undefined] = ["", undefined];
    stubFetch((url, init) => {
      seen = [url, init];
      return ok({ vpDevRuntime: true });
    });
    await probeLocalRuntime();

    expect(seen[0]).toBe(HANDSHAKE);
    // Credentials would send the tenant's cookies to a local server; no-store
    // keeps a stopped dev server from answering out of the HTTP cache.
    expect(seen[1]?.credentials).toBe("omit");
    expect(seen[1]?.cache).toBe("no-store");
  });

  it("hands the loader a script URL, not a bare directory", () => {
    // getRuntimeBaseUrl() computes new URL(".", scriptUrl), and childUrl() the
    // same — a bare origin would resolve children and the API routes one level up.
    expect(LOCAL_LOADER_URL).toBe("http://localhost:3000/runtime/loader.js");
  });
});

describe("probeLocalRuntime: fails closed on anything else", () => {
  it("rejects a dead port (fetch throws)", async () => {
    stubFetch(() => new TypeError("Failed to fetch"));
    expect(await probeLocalRuntime()).toBe(false);
  });

  it("rejects a non-OK response", async () => {
    stubFetch(() => ({ ok: false, json: async () => ({}) }));
    expect(await probeLocalRuntime()).toBe(false);
  });

  it("rejects unparseable JSON", async () => {
    stubFetch(() => ({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    }));
    expect(await probeLocalRuntime()).toBe(false);
  });

  it.each([
    ["a foreign server on port 3000", { something: "else" }],
    ["the marker set to a non-true value", { vpDevRuntime: "yes" }],
    ["the marker missing", {}],
    ["a JSON null body", null],
    ["a JSON array body", []],
  ])("rejects %s", async (_label, body) => {
    // Port 3000 is a very common dev port: "something answered" must never be
    // enough to execute its code on a logged-in lesson page.
    stubFetch(() => ok(body));
    expect(await probeLocalRuntime()).toBe(false);
  });

  it("aborts a server that accepts and then stalls", async () => {
    vi.useFakeTimers();
    stubFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );

    const verdict = probeLocalRuntime();
    await vi.advanceTimersByTimeAsync(500);

    expect(await verdict).toBe(false);
  });
});
