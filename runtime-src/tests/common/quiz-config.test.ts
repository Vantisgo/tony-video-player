import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeQuizConfig } from "../../common/config";

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const option = (id: string) => ({ id, text: `answer ${id}` });

const question = (overrides: Record<string, unknown> = {}) => ({
  id: "q1",
  prompt: "Which statement is true?",
  correctOptionId: "b",
  options: [option("a"), option("b")],
  ...overrides,
});

const quizBreak = (overrides: Record<string, unknown> = {}) => ({
  id: "quiz-1",
  t: 45,
  questions: [question()],
  ...overrides,
});

const config = (overrides: Record<string, unknown> = {}) => ({
  quizzes: [quizBreak()],
  ...overrides,
});

describe("normalizeQuizConfig — rejection", () => {
  it("returns null for absent, non-object, and array input", () => {
    expect(normalizeQuizConfig(undefined)).toBeNull();
    expect(normalizeQuizConfig(null)).toBeNull();
    expect(normalizeQuizConfig("quiz")).toBeNull();
    expect(normalizeQuizConfig(42)).toBeNull();
    expect(normalizeQuizConfig([])).toBeNull();
  });

  it("returns null when quizzes is missing or not an array", () => {
    expect(normalizeQuizConfig({})).toBeNull();
    expect(normalizeQuizConfig({ quizzes: "nope" })).toBeNull();
  });

  it("returns null for an empty quizzes array", () => {
    expect(normalizeQuizConfig({ quizzes: [] })).toBeNull();
  });
});

describe("normalizeQuizConfig — defaults and clamping", () => {
  it("applies documented defaults for a minimal config", () => {
    const result = normalizeQuizConfig(config());

    expect(result).not.toBeNull();
    expect(result?.feedbackDurationSec).toBe(3);
    expect(result?.showScore).toBe(false);
    expect(result?.showSummary).toBe(false);
    expect(result?.passingPercent).toBeNull();
    expect(result?.quizzes).toHaveLength(1);
  });

  it("clamps feedbackDurationSec into 0.5–10 and falls back to 3", () => {
    expect(
      normalizeQuizConfig(config({ feedbackDurationSec: 0.1 }))
        ?.feedbackDurationSec,
    ).toBe(0.5);
    expect(
      normalizeQuizConfig(config({ feedbackDurationSec: 99 }))
        ?.feedbackDurationSec,
    ).toBe(10);
    expect(
      normalizeQuizConfig(config({ feedbackDurationSec: "x" }))
        ?.feedbackDurationSec,
    ).toBe(3);
  });

  it("clamps passingPercent into 0–100 and defaults to null", () => {
    expect(
      normalizeQuizConfig(config({ passingPercent: -5 }))?.passingPercent,
    ).toBe(0);
    expect(
      normalizeQuizConfig(config({ passingPercent: 500 }))?.passingPercent,
    ).toBe(100);
    expect(
      normalizeQuizConfig(config({ passingPercent: "x" }))?.passingPercent,
    ).toBeNull();
    expect(normalizeQuizConfig(config())?.passingPercent).toBeNull();
  });

  it("treats showScore and showSummary as strict booleans", () => {
    const truthy = normalizeQuizConfig(
      config({ showScore: "yes", showSummary: 1 }),
    );
    expect(truthy?.showScore).toBe(false);
    expect(truthy?.showSummary).toBe(false);

    const real = normalizeQuizConfig(
      config({ showScore: true, showSummary: true }),
    );
    expect(real?.showScore).toBe(true);
    expect(real?.showSummary).toBe(true);
  });

  it("defaults resume to auto and preserves manual", () => {
    expect(normalizeQuizConfig(config())?.quizzes[0].resume).toBe("auto");
    expect(
      normalizeQuizConfig(
        config({ quizzes: [quizBreak({ resume: "manual" })] }),
      )?.quizzes[0].resume,
    ).toBe("manual");
    expect(
      normalizeQuizConfig(
        config({ quizzes: [quizBreak({ resume: "nonsense" })] }),
      )?.quizzes[0].resume,
    ).toBe("auto");
  });

  it("defaults title and explanation to empty strings", () => {
    const result = normalizeQuizConfig(config());
    expect(result?.quizzes[0].title).toBe("");
    expect(result?.quizzes[0].questions[0].explanation).toBe("");
  });
});

describe("normalizeQuizConfig — quiz breaks", () => {
  it("drops a break with a missing id, negative t, or non-finite t, and warns", () => {
    expect(
      normalizeQuizConfig({ quizzes: [quizBreak({ id: "" })] }),
    ).toBeNull();
    expect(normalizeQuizConfig({ quizzes: [quizBreak({ t: -1 })] })).toBeNull();
    expect(
      normalizeQuizConfig({ quizzes: [quizBreak({ t: "soon" })] }),
    ).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it("drops a duplicate quiz id, keeping the first", () => {
    const result = normalizeQuizConfig({
      quizzes: [
        quizBreak({ id: "dup", t: 10 }),
        quizBreak({ id: "dup", t: 20, questions: [question({ id: "q2" })] }),
      ],
    });

    expect(result?.quizzes).toHaveLength(1);
    expect(result?.quizzes[0].t).toBe(10);
    expect(warn).toHaveBeenCalled();
  });

  it("drops a break whose questions all fail validation", () => {
    expect(
      normalizeQuizConfig({
        quizzes: [quizBreak({ questions: [question({ prompt: "" })] })],
      }),
    ).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it("sorts breaks ascending by t regardless of input order", () => {
    const result = normalizeQuizConfig({
      quizzes: [
        quizBreak({
          id: "late",
          t: 90,
          questions: [question({ id: "q-late" })],
        }),
        quizBreak({
          id: "early",
          t: 5,
          questions: [question({ id: "q-early" })],
        }),
        quizBreak({ id: "mid", t: 45, questions: [question({ id: "q-mid" })] }),
      ],
    });

    expect(result?.quizzes.map((q) => q.id)).toEqual(["early", "mid", "late"]);
  });
});

describe("normalizeQuizConfig — questions and options", () => {
  it("drops a duplicate question id across breaks and warns", () => {
    const result = normalizeQuizConfig({
      quizzes: [
        quizBreak({ id: "one", t: 10 }),
        quizBreak({ id: "two", t: 20 }),
      ],
    });

    expect(result?.quizzes).toHaveLength(1);
    expect(result?.quizzes[0].id).toBe("one");
    expect(warn).toHaveBeenCalledWith(
      "[vp] ignoring duplicate quiz question id",
      "q1",
    );
  });

  it("drops a question whose correctOptionId names no option", () => {
    expect(
      normalizeQuizConfig({
        quizzes: [
          quizBreak({ questions: [question({ correctOptionId: "zzz" })] }),
        ],
      }),
    ).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it("drops a question with 0 or more than 4 options", () => {
    expect(
      normalizeQuizConfig({
        quizzes: [quizBreak({ questions: [question({ options: [] })] })],
      }),
    ).toBeNull();
    expect(
      normalizeQuizConfig({
        quizzes: [
          quizBreak({
            questions: [
              question({
                options: ["a", "b", "c", "d", "e"].map(option),
              }),
            ],
          }),
        ],
      }),
    ).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it("accepts a single-option question", () => {
    const result = normalizeQuizConfig({
      quizzes: [
        quizBreak({
          questions: [
            question({ options: [option("only")], correctOptionId: "only" }),
          ],
        }),
      ],
    });

    expect(result?.quizzes[0].questions[0].options).toHaveLength(1);
  });

  it("drops duplicate and blank options within a question", () => {
    const result = normalizeQuizConfig({
      quizzes: [
        quizBreak({
          questions: [
            question({
              options: [option("a"), option("a"), { id: "b", text: "  " }],
              correctOptionId: "a",
            }),
          ],
        }),
      ],
    });

    expect(result?.quizzes[0].questions[0].options.map((o) => o.id)).toEqual([
      "a",
    ]);
  });
});

describe("normalizeQuizConfig — timeouts and countdown", () => {
  it("keeps an integer timeout inside 5–300", () => {
    const result = normalizeQuizConfig({
      quizzes: [quizBreak({ questions: [question({ timeoutSec: 15 })] })],
    });
    expect(result?.quizzes[0].questions[0].timeoutSec).toBe(15);
  });

  it("nulls out-of-range and non-integer timeouts, and warns", () => {
    for (const bad of [4, 301, 12.5]) {
      const result = normalizeQuizConfig({
        quizzes: [quizBreak({ questions: [question({ timeoutSec: bad })] })],
      });
      expect(result?.quizzes[0].questions[0].timeoutSec).toBeNull();
    }
    expect(warn).toHaveBeenCalledWith(
      "[vp] ignoring invalid quiz timeout; expected an integer from 5 to 300",
      expect.anything(),
    );
  });

  it("leaves an absent timeout null without warning about it", () => {
    const result = normalizeQuizConfig(config());
    expect(result?.quizzes[0].questions[0].timeoutSec).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("defaults showCountdown to true and honours an explicit false", () => {
    expect(
      normalizeQuizConfig(config())?.quizzes[0].questions[0].showCountdown,
    ).toBe(true);
    const off = normalizeQuizConfig({
      quizzes: [quizBreak({ questions: [question({ showCountdown: false })] })],
    });
    expect(off?.quizzes[0].questions[0].showCountdown).toBe(false);
  });
});
