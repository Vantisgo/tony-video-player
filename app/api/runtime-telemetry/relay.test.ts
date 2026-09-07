import { describe, expect, it, vi } from "vitest";
import {
  corsHeaders,
  createRateLimiter,
  forwardToSink,
  parseAllowedOrigins,
  parseTelemetry,
} from "./relay";

describe("parseTelemetry (F6 AC4)", () => {
  it("rejects non-JSON", () => {
    expect(parseTelemetry("not json").ok).toBe(false);
  });

  it("rejects a body missing errorType", () => {
    expect(parseTelemetry(JSON.stringify({ videoId: "v" })).ok).toBe(false);
  });

  it("accepts a valid payload and preserves arbitrary config", () => {
    const result = parseTelemetry(
      JSON.stringify({ errorType: "e", videoId: "v", config: { a: [1, 2] } }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.config).toEqual({ a: [1, 2] });
  });
});

describe("corsHeaders (F6 AC4)", () => {
  it("reflects the origin only when allowlisted", () => {
    const allowed = ["https://app.learningsuite.io"];
    expect(
      corsHeaders("https://app.learningsuite.io", allowed)[
        "Access-Control-Allow-Origin"
      ],
    ).toBe("https://app.learningsuite.io");
    expect(
      corsHeaders("https://evil.example", allowed)[
        "Access-Control-Allow-Origin"
      ],
    ).toBeUndefined();
  });

  it("parses a comma-separated allowlist", () => {
    expect(parseAllowedOrigins("https://a.io, https://b.io ,")).toEqual([
      "https://a.io",
      "https://b.io",
    ]);
  });
});

describe("createRateLimiter (F6 AC5)", () => {
  it("allows up to the limit then blocks within the window", () => {
    const limit = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(limit("ip", 0)).toBe(true);
    expect(limit("ip", 100)).toBe(true);
    expect(limit("ip", 200)).toBe(false); // 3rd within window → blocked
    expect(limit("ip", 1100)).toBe(true); // window elapsed → allowed again
  });

  it("tracks keys independently", () => {
    const limit = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(limit("a", 0)).toBe(true);
    expect(limit("b", 0)).toBe(true);
    expect(limit("a", 0)).toBe(false);
  });
});

describe("forwardToSink (F6 AC4)", () => {
  it("POSTs the payload as JSON to the sink", async () => {
    const fetchImpl = vi.fn<
      (url: string, options: RequestInit) => Promise<Response>
    >(() => Promise.resolve(new Response(null)));
    await forwardToSink(
      "https://sink.example/hook",
      { errorType: "e", videoId: "v", config: null },
      fetchImpl as unknown as typeof fetch,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://sink.example/hook");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body as string)).toMatchObject({
      errorType: "e",
    });
  });

  it("never throws when the sink fetch fails", async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error("down")));
    await expect(
      forwardToSink(
        "https://sink.example/hook",
        { errorType: "e", videoId: "v", config: null },
        fetchImpl as unknown as typeof fetch,
      ),
    ).resolves.toBeUndefined();
  });
});
