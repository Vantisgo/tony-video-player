import { describe, expect, it } from "vitest";
import { resolveAssetUrl } from "../../common/assets";

// A rendered `{{asset:…}}` expansion, shortened but structurally faithful: the
// platform signs it per request, so it always arrives absolute and https.
const SIGNED =
  "https://storage.googleapis.com/learningsuite-prod-de-storage-x/courses/steps/cmticqnwy0bvoby01b1ha22nl?X-Goog-Algorithm=GOOG4-HMAC-SHA256&X-Goog-Expires=532800&X-Goog-Signature=100880ec";

describe("resolveAssetUrl: inline placeholder (the authored default)", () => {
  it("uses an expanded placeholder as the URL directly", () => {
    expect(resolveAssetUrl(SIGNED)).toEqual({ url: SIGNED, failure: null });
  });

  it("keeps the signed query string byte-for-byte", () => {
    // The signature is invalidated by any rewrite, so this is the whole contract.
    expect(resolveAssetUrl(SIGNED).url).toContain("&X-Goog-Signature=100880ec");
  });

  it("tolerates surrounding whitespace from the rendered <pre>", () => {
    expect(resolveAssetUrl(`\n  ${SIGNED}\n`).url).toBe(SIGNED);
  });

  it("accepts any other https URL (our own CDN, preview pages)", () => {
    expect(resolveAssetUrl("https://cdn.example.test/intro.mp3").url).toBe(
      "https://cdn.example.test/intro.mp3",
    );
  });
});

describe("resolveAssetUrl: assets table (reuse / host-agnostic config)", () => {
  it("resolves a bare key through the table", () => {
    expect(resolveAssetUrl("intro", { intro: SIGNED })).toEqual({
      url: SIGNED,
      failure: null,
    });
  });

  it("lets one asset serve several keys", () => {
    const table = { intro: SIGNED, outro: SIGNED };
    expect(resolveAssetUrl("intro", table).url).toBe(SIGNED);
    expect(resolveAssetUrl("outro", table).url).toBe(SIGNED);
  });

  it("reports a key that is not in the table", () => {
    expect(resolveAssetUrl("intro", { outro: SIGNED })).toEqual({
      url: "",
      failure: "missing",
    });
  });

  it("treats an empty table entry as missing, not as a valid empty URL", () => {
    expect(resolveAssetUrl("intro", { intro: "   " }).failure).toBe("missing");
  });

  it("reports a leftover authoring marker as missing, so it beacons", () => {
    // An earlier prompt version had the model emit "TODO-ASSET-EINFUEGEN" for the
    // admin to replace by hand. Configs authored that way still exist; an
    // unreplaced marker must show up in telemetry rather than vanish.
    expect(resolveAssetUrl("TODO-ASSET-EINFUEGEN").failure).toBe("missing");
  });
});

describe("resolveAssetUrl: unexpanded placeholder", () => {
  it("reports a raw placeholder rather than treating it as a key", () => {
    expect(resolveAssetUrl("{{asset:2025-12-22-at-00-22-27-intro}}")).toEqual({
      url: "",
      failure: "unexpanded",
    });
  });

  it("reports a placeholder that arrived with surrounding text", () => {
    expect(resolveAssetUrl(" {{asset:intro}} ").failure).toBe("unexpanded");
  });

  it("reports a placeholder stored in the table too", () => {
    expect(resolveAssetUrl("intro", { intro: "{{asset:intro}}" }).failure).toBe(
      "unexpanded",
    );
  });
});

describe("resolveAssetUrl: non-https values are refused", () => {
  it("refuses http", () => {
    expect(resolveAssetUrl("http://example.test/intro.mp3")).toEqual({
      url: "",
      failure: "insecure",
    });
  });

  it("refuses javascript: and data: rather than passing them to a media src", () => {
    expect(resolveAssetUrl("javascript:alert(1)").failure).toBe("insecure");
    expect(resolveAssetUrl("data:audio/mpeg;base64,AAAA").failure).toBe(
      "insecure",
    );
  });

  it("refuses an insecure table value without mislabelling it as missing", () => {
    expect(
      resolveAssetUrl("intro", { intro: "http://example.test/a.mp3" }).failure,
    ).toBe("insecure");
  });
});

describe("resolveAssetUrl: no reference at all", () => {
  it.each([undefined, null, "", "   "])(
    "returns an empty URL and no failure for %p",
    (reference) => {
      // A cue may deliberately carry no audio file — that is TTS by design, not
      // a misconfiguration, so it must not warn or beacon.
      expect(resolveAssetUrl(reference)).toEqual({ url: "", failure: null });
    },
  );

  it("defaults the table so a config without `assets` still resolves inline", () => {
    expect(resolveAssetUrl(SIGNED).url).toBe(SIGNED);
  });
});
