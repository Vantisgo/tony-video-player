import { describe, expect, it } from "vitest";
import { esc } from "../../common/escape";

describe("esc", () => {
  it("neutralizes an XSS payload into inert text", () => {
    const out = esc('<img src=x onerror="alert(1)">');
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("escapes all five significant characters", () => {
    expect(esc(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("coerces null/undefined to empty string", () => {
    expect(esc(null)).toBe("");
    expect(esc(undefined)).toBe("");
  });

  it("coerces numbers to their string form", () => {
    expect(esc(42)).toBe("42");
  });

  it("leaves safe text untouched", () => {
    expect(esc("Einführung 1.2")).toBe("Einführung 1.2");
  });
});
