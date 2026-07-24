import { describe, expect, it } from "vitest";
import { formatTime } from "./format";

describe("formatTime", () => {
  it("formats seconds as m:ss with zero-padding", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(5)).toBe("0:05");
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(3599)).toBe("59:59");
  });

  it("clamps negatives to 0:00", () => {
    expect(formatTime(-10)).toBe("0:00");
  });

  it("returns 0:00 for non-finite input", () => {
    expect(formatTime(NaN)).toBe("0:00");
    expect(formatTime(Infinity)).toBe("0:00");
  });

  it("truncates fractional seconds", () => {
    expect(formatTime(9.9)).toBe("0:09");
  });
});
