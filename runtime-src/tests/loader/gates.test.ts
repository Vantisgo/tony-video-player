import { afterEach, describe, expect, it } from "vitest";
import { childUrl, hasVpConfig, isAdminEditMode } from "../../loader/gates";

const LOADER_URL = "https://cdn.example.com/runtime/loader.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("isAdminEditMode (AC1)", () => {
  it("matches the admin editor's edit view", () => {
    expect(isAdminEditMode({ pathname: "/admin/editor/abc", search: "" })).toBe(
      true,
    );
    expect(
      isAdminEditMode({ pathname: "/admin/editor/abc", search: "?view=edit" }),
    ).toBe(true);
  });

  it("rejects the preview view and every non-editor path", () => {
    expect(
      isAdminEditMode({
        pathname: "/admin/editor/abc",
        search: "?view=preview",
      }),
    ).toBe(false);
    expect(isAdminEditMode({ pathname: "/lesson/xyz", search: "" })).toBe(
      false,
    );
    expect(isAdminEditMode({ pathname: "/admin/editor", search: "" })).toBe(
      false,
    );
  });
});

describe("hasVpConfig (AC2)", () => {
  it("is false on a page without a config", () => {
    document.body.innerHTML = "<div><p>just a lesson</p></div>";
    expect(hasVpConfig()).toBe(false);
  });

  it("finds the <script type=application/json> shape", () => {
    document.body.innerHTML =
      '<script type="application/json" data-vp-config>{"phases":[]}</script>';
    expect(hasVpConfig()).toBe(true);
  });

  it("finds the element shape", () => {
    document.body.innerHTML = '<pre data-vp-config>{"phases":[]}</pre>';
    expect(hasVpConfig()).toBe(true);
  });

  it("finds the HTML-comment shape", () => {
    document.body.innerHTML = '<!-- VP_CONFIG {"phases":[]} VP_CONFIG -->';
    expect(hasVpConfig()).toBe(true);
  });

  it("is presence-based, not validity-based: invalid JSON still counts", () => {
    document.body.innerHTML = "<pre data-vp-config>{oops</pre>";
    expect(hasVpConfig()).toBe(true);
  });
});

describe("childUrl (AC3)", () => {
  it("carries the loader's query string over to the child", () => {
    expect(
      childUrl(
        `${LOADER_URL}?x-vercel-protection-bypass=SECRET`,
        "reskin-player",
      ),
    ).toBe(
      "https://cdn.example.com/runtime/reskin-player.js?x-vercel-protection-bypass=SECRET",
    );
  });

  it("works without a query string", () => {
    expect(childUrl(LOADER_URL, "demo-overlays")).toBe(
      "https://cdn.example.com/runtime/demo-overlays.js",
    );
  });

  it("resolves relative to the document when given a relative URL", () => {
    expect(childUrl("/runtime/loader.js?b=1", "admin-toggle")).toBe(
      new URL("/runtime/admin-toggle.js?b=1", location.href).href,
    );
  });

  it("returns an empty string when the loader URL is unknown or unparseable", () => {
    expect(childUrl("", "reskin-player")).toBe("");
    expect(childUrl("http://[", "reskin-player")).toBe("");
  });
});
