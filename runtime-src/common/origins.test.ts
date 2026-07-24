import { afterEach, describe, expect, it } from "vitest";
import { getTrustedOrigins, makeAssetOriginChecker } from "./origins";

const setTrusted = (value: unknown): void => {
  (window as unknown as { __vpTrustedOrigins?: unknown }).__vpTrustedOrigins =
    value;
};

afterEach(() => setTrusted(undefined));

describe("getTrustedOrigins", () => {
  it("always includes the current origin", () => {
    expect(getTrustedOrigins().has(location.origin)).toBe(true);
  });

  it("adds host-supplied string origins", () => {
    setTrusted(["https://sidebar.example.com"]);
    expect(getTrustedOrigins().has("https://sidebar.example.com")).toBe(true);
  });

  it("ignores non-array and non-string entries", () => {
    setTrusted([42, null, "https://ok.example.com"]);
    const origins = getTrustedOrigins();
    expect(origins.has("https://ok.example.com")).toBe(true);
    expect(origins.size).toBe(2); // current origin + the one valid string
  });
});

describe("makeAssetOriginChecker", () => {
  it("allows same-origin (relative) URLs", () => {
    const isAllowed = makeAssetOriginChecker(
      location.href,
      getTrustedOrigins(),
    );
    expect(isAllowed("language-packs/x/manifest.json")).toBe(true);
  });

  it("rejects a cross-origin URL that is not trusted", () => {
    const isAllowed = makeAssetOriginChecker(
      location.href,
      getTrustedOrigins(),
    );
    expect(isAllowed("https://evil.example.com/audio.m4a")).toBe(false);
  });

  it("allows an origin present in the trusted set", () => {
    const trusted = new Set([location.origin, "https://cdn.example.com"]);
    const isAllowed = makeAssetOriginChecker(location.href, trusted);
    expect(isAllowed("https://cdn.example.com/pack/audio.m4a")).toBe(true);
  });
});
