import { describe, expect, it } from "vitest";
import { edgeConfigItemUrl, resolveFlag } from "./config-flag";

describe("resolveFlag (F5)", () => {
  it("defaults to enabled when the value is missing/malformed (fail open)", () => {
    expect(resolveFlag(undefined)).toEqual({
      enabled: true,
      minHostVersion: null,
    });
    expect(resolveFlag("nonsense")).toEqual({
      enabled: true,
      minHostVersion: null,
    });
    expect(resolveFlag({})).toEqual({ enabled: true, minHostVersion: null });
  });

  it("AC4: disables ONLY on an explicit enabled:false", () => {
    expect(resolveFlag({ enabled: false }).enabled).toBe(false);
    expect(resolveFlag({ enabled: true }).enabled).toBe(true);
    expect(resolveFlag({ enabled: "false" }).enabled).toBe(true); // not the boolean
  });

  it("carries minHostVersion when it is a string", () => {
    expect(resolveFlag({ minHostVersion: "1.2.3" }).minHostVersion).toBe(
      "1.2.3",
    );
    expect(resolveFlag({ minHostVersion: 5 }).minHostVersion).toBeNull();
  });
});

describe("edgeConfigItemUrl", () => {
  it("builds the item Read-API URL, preserving the token query", () => {
    expect(
      edgeConfigItemUrl(
        "https://edge-config.vercel.com/ecfg_abc?token=secret",
        "runtimeConfig",
      ),
    ).toBe(
      "https://edge-config.vercel.com/ecfg_abc/item/runtimeConfig?token=secret",
    );
  });

  it("returns null for a missing or unparseable connection string", () => {
    expect(edgeConfigItemUrl(undefined, "runtimeConfig")).toBeNull();
    expect(edgeConfigItemUrl("not a url", "runtimeConfig")).toBeNull();
  });
});
