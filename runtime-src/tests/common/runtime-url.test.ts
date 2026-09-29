import { afterEach, describe, expect, it } from "vitest";
import { getRuntimeBaseUrl, runtimeApiUrl } from "../../common/runtime-url";

const DEPLOY = "https://preview.vercel.app/runtime/";
const TOKEN = "x-vercel-protection-bypass=secret";

afterEach(() => {
  delete (window as { __vpRuntimeBaseUrl?: string }).__vpRuntimeBaseUrl;
});

describe("runtime URLs on a protection-enabled deployment", () => {
  it("carries the bypass token from the script URL onto API requests", () => {
    window.__vpRuntimeBaseUrl = `${DEPLOY}loader.js?${TOKEN}&utm=x`;
    const base = getRuntimeBaseUrl();

    expect(base).toBe(`${DEPLOY}?${TOKEN}`);
    expect(runtimeApiUrl(base, "/api/runtime-config")).toBe(
      `https://preview.vercel.app/api/runtime-config?${TOKEN}`,
    );
  });

  it("adds no query when the script URL has none", () => {
    window.__vpRuntimeBaseUrl = `${DEPLOY}loader.js`;
    expect(runtimeApiUrl(getRuntimeBaseUrl(), "/api/runtime-config")).toBe(
      "https://preview.vercel.app/api/runtime-config",
    );
  });
});
