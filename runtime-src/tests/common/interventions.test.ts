import { describe, expect, it } from "vitest";
import { activeInterventionId } from "../../common/interventions";
import type { Intervention } from "../../common/types";

// Mirrors lib/active-intervention.test.ts case for case — the two implementations
// of this rule must not drift apart.
const iv = (
  id: string,
  t: number,
  end?: number | null | string,
): Intervention =>
  ({
    id,
    label: id,
    title: id,
    t,
    desc: "",
    ...(end === undefined ? {} : { end }),
  }) as Intervention;

describe("activeInterventionId", () => {
  it("returns null when nothing has started", () => {
    expect(activeInterventionId([iv("a", 10)], 0)).toBeNull();
    expect(activeInterventionId([], 100)).toBeNull();
  });

  it("is active within its bounded time frame, start inclusive and end exclusive", () => {
    const list = [iv("bounded", 10, 20)];

    expect(activeInterventionId(list, 9.99)).toBeNull();
    expect(activeInterventionId(list, 10)).toBe("bounded");
    expect(activeInterventionId(list, 19.99)).toBe("bounded");
    expect(activeInterventionId(list, 20)).toBeNull();
    expect(activeInterventionId(list, 100)).toBeNull();
  });

  it("treats an end equal to the start as never active", () => {
    expect(activeInterventionId([iv("zero", 10, 10)], 10)).toBeNull();
  });

  it("keeps missing and null end times open-ended", () => {
    expect(activeInterventionId([iv("missing", 10)], 100)).toBe("missing");
    expect(activeInterventionId([iv("null", 10, null)], 100)).toBe("null");
  });

  it("treats a non-numeric end as absent rather than trusting the type", () => {
    expect(activeInterventionId([iv("bad", 10, "soon")], 100)).toBe("bad");
    expect(activeInterventionId([iv("nan", 10, Number.NaN)], 100)).toBe("nan");
    expect(
      activeInterventionId([iv("inf", 10, Number.POSITIVE_INFINITY)], 100),
    ).toBe("inf");
  });

  it("does not reactivate an older intervention when the latest one has ended", () => {
    const list = [iv("older", 10), iv("latest", 20, 30)];

    expect(activeInterventionId(list, 25)).toBe("latest");
    expect(activeInterventionId(list, 30)).toBeNull();
    expect(activeInterventionId(list, 99)).toBeNull();
  });

  it("picks the latest started intervention regardless of input order", () => {
    const sorted = [iv("first", 10), iv("second", 20), iv("third", 30)];
    const shuffled = [iv("third", 30), iv("first", 10), iv("second", 20)];

    for (const t of [10, 15, 20, 25, 30, 90]) {
      expect(activeInterventionId(shuffled, t)).toBe(
        activeInterventionId(sorted, t),
      );
    }
    expect(activeInterventionId(shuffled, 25)).toBe("second");
    expect(activeInterventionId(shuffled, 90)).toBe("third");
  });

  it("lets a later bounded intervention supersede an earlier open-ended one", () => {
    const list = [iv("open", 10), iv("bounded", 20, 25)];

    expect(activeInterventionId(list, 15)).toBe("open");
    expect(activeInterventionId(list, 22)).toBe("bounded");
    // The bounded one has ended and the open one does not come back.
    expect(activeInterventionId(list, 26)).toBeNull();
  });

  it("does not mutate the input array", () => {
    const list = [iv("third", 30), iv("first", 10)];
    const snapshot = list.map((i) => i.id);
    activeInterventionId(list, 40);
    expect(list.map((i) => i.id)).toEqual(snapshot);
  });
});
