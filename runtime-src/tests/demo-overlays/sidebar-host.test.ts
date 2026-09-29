import { describe, expect, it } from "vitest";
import { chooseHostMode } from "../../demo-overlays/sidebar-host";

describe("chooseHostMode", () => {
  it.each([
    [true, true, "desktop"],
    [false, true, "sheet"],
    [true, false, "none"],
    [false, false, "none"],
  ] as const)(
    "viewport fits: %s, has content: %s → %s",
    (viewportFits, hasContent, expected) => {
      expect(chooseHostMode(viewportFits, hasContent)).toBe(expected);
    },
  );
});
