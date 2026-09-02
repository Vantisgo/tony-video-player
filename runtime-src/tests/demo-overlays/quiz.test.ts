import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createQuizController } from "../../demo-overlays/quiz";
import { normalizeQuizConfig } from "../../common/config";
import type { MediaEl, QuizConfig } from "../../common/types";

// happy-dom's <hls-video> is an unknown element with no media methods, so tests
// drive a real <video> whose play/pause/paused are controlled by hand (happy-dom
// resolves neither reliably) and whose duration is fixed.
interface Harness {
  ctrl: ReturnType<typeof createQuizController>;
  media: MediaEl;
  slot: HTMLElement;
  host: HTMLElement;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  setPaused: (v: boolean) => void;
  setAudioActive: (v: boolean) => void;
  teardown: () => void;
  card: () => HTMLElement | null;
  options: () => HTMLButtonElement[];
  optionByState: (state: string) => HTMLButtonElement[];
  flushFrames: () => void;
}

const option = (id: string, text = `answer ${id}`) => ({ id, text });

const baseQuiz = (overrides: Record<string, unknown> = {}) => ({
  quizzes: [
    {
      id: "quiz-1",
      t: 30,
      title: "Kurz-Check",
      questions: [
        {
          id: "q1",
          prompt: "Which statement is true?",
          correctOptionId: "b",
          explanation: "Because b.",
          options: [option("a"), option("b")],
        },
      ],
    },
  ],
  ...overrides,
});

function normalize(raw: Record<string, unknown>): QuizConfig {
  const quiz = normalizeQuizConfig(raw);
  if (!quiz) throw new Error("test fixture failed normalisation");
  return quiz;
}

function setup(raw: Record<string, unknown> = baseQuiz()): Harness {
  document.body.innerHTML = "";
  const host = document.createElement("div");
  const media = document.createElement("video") as unknown as MediaEl;
  media.setAttribute("data-vp-player", "");
  const slot = document.createElement("div");
  slot.id = "vp-slot-quiz";
  const controls = document.createElement("div");
  controls.className = "vp-controls";
  const seekBar = document.createElement("input");
  seekBar.type = "range";
  controls.appendChild(seekBar);
  host.append(media as unknown as Node, slot, controls);
  document.body.appendChild(host);

  let paused = false;
  Object.defineProperty(media, "paused", {
    get: () => paused,
    configurable: true,
  });
  Object.defineProperty(media, "ended", {
    get: () => false,
    configurable: true,
  });
  Object.defineProperty(media, "duration", {
    get: () => 120,
    configurable: true,
  });
  const play = vi.fn(() => {
    paused = false;
    return Promise.resolve();
  });
  const pause = vi.fn(() => {
    paused = true;
  });
  media.play = play as unknown as HTMLMediaElement["play"];
  media.pause = pause as unknown as HTMLMediaElement["pause"];

  let audioActive = false;
  const cleanups: Array<() => void> = [];
  const ctrl = createQuizController({
    quiz: normalize(raw),
    mediaEl: media,
    playerHost: host,
    slot,
    isAudioActive: () => audioActive,
    onCleanup: (fn) => cleanups.push(fn),
  });

  const harness: Harness = {
    ctrl,
    media,
    slot,
    host,
    play,
    pause,
    setPaused: (v) => {
      paused = v;
    },
    setAudioActive: (v) => {
      audioActive = v;
    },
    teardown: () =>
      cleanups
        .splice(0)
        .reverse()
        .forEach((fn) => fn()),
    card: () => slot.querySelector<HTMLElement>("[data-vp-quiz-card]"),
    options: () => [
      ...slot.querySelectorAll<HTMLButtonElement>("[data-vp-quiz-option]"),
    ],
    optionByState: (state) => [
      ...slot.querySelectorAll<HTMLButtonElement>(
        `[data-vp-quiz-option][data-state="${state}"]`,
      ),
    ],
    // render() focuses inside a rAF; fake timers back happy-dom's rAF.
    flushFrames: () => vi.advanceTimersByTime(50),
  };
  live.push(harness);
  return harness;
}

// Controllers register capture-phase listeners on `document`, which outlives any
// single test — a harness left un-torn-down would keep intercepting clicks in
// later tests. Track and dispose them all rather than trusting each test to.
const live: Harness[] = [];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  live.splice(0).forEach((h) => h.teardown());
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("quiz activation", () => {
  it("opens the dialog and pauses the video when a break's time is crossed", () => {
    const h = setup();

    expect(h.ctrl.onTime(29)).toBe(false);
    expect(h.ctrl.isActive()).toBe(false);

    expect(h.ctrl.onTime(30.2)).toBe(true);
    expect(h.ctrl.mode).toBe("question");
    expect(h.pause).toHaveBeenCalled();

    const card = h.card();
    expect(card).not.toBeNull();
    expect(card?.getAttribute("role")).toBe("dialog");
    expect(card?.getAttribute("aria-modal")).toBe("true");
    expect(h.slot.dataset.mode).toBe("question");
    h.teardown();
  });

  it("renders the eyebrow, prompt, options and skip affordance", () => {
    const h = setup();
    h.ctrl.onTime(30.2);

    expect(h.slot.querySelector(".vp-quiz-eyebrow")?.textContent).toBe(
      "Kurz-Check",
    );
    expect(h.slot.querySelector("#vp-quiz-prompt")?.textContent).toBe(
      "Which statement is true?",
    );
    expect(h.options()).toHaveLength(2);
    expect(h.slot.querySelector("[data-vp-quiz-skip]")).not.toBeNull();
    h.teardown();
  });

  it("does not re-activate a completed break", () => {
    const h = setup();
    h.ctrl.onTime(30.2);
    h.options()[1].click();
    vi.advanceTimersByTime(3000);
    expect(h.ctrl.isActive()).toBe(false);

    h.ctrl.onTime(31);
    expect(h.ctrl.isActive()).toBe(false);
    h.teardown();
  });

  it("never ambushes a learner who is seeking", () => {
    const h = setup();
    h.media.dispatchEvent(new Event("seeking"));

    expect(h.ctrl.onTime(60)).toBe(false);
    expect(h.ctrl.isActive()).toBe(false);

    h.media.currentTime = 10;
    h.media.dispatchEvent(new Event("seeked"));
    expect(h.ctrl.onTime(30.5)).toBe(true);
    h.teardown();
  });

  it("ignores backwards time deltas and non-finite times", () => {
    const h = setup();
    // Establish previousTime with a tick that crosses nothing (the break is at 30).
    expect(h.ctrl.onTime(10)).toBe(false);
    expect(h.ctrl.onTime(5)).toBe(false);
    expect(h.ctrl.onTime(Number.NaN)).toBe(false);
    expect(h.ctrl.isActive()).toBe(false);
    h.teardown();
  });

  it("fires a break already behind the very first time sample", () => {
    // previousTime starts below zero, so the first tick's window covers the whole
    // timeline: mounting (or resuming) past a break opens it immediately rather
    // than skipping it. Documented because it is load-bearing for resume-at-
    // position playback, and surprising.
    const h = setup();
    expect(h.ctrl.onTime(60)).toBe(true);
    expect(h.ctrl.mode).toBe("question");
    h.teardown();
  });

  it("yields to an active voice-over cue", () => {
    const h = setup();
    h.setAudioActive(true);
    expect(h.ctrl.onTime(30.2)).toBe(false);
    expect(h.ctrl.isActive()).toBe(false);
    h.teardown();
  });
});

describe("answering", () => {
  it("marks a correct answer and auto-advances after feedbackDurationSec", () => {
    const h = setup(baseQuiz({ feedbackDurationSec: 2 }));
    h.ctrl.onTime(30.2);
    h.options()[1].click();

    expect(h.ctrl.mode).toBe("feedback");
    expect(h.optionByState("correct")).toHaveLength(1);

    vi.advanceTimersByTime(1999);
    expect(h.ctrl.mode).toBe("feedback");
    vi.advanceTimersByTime(2);
    expect(h.ctrl.mode).toBe("idle");
    h.teardown();
  });

  it("holds a wrong answer until Continue is pressed", () => {
    const h = setup(baseQuiz({ feedbackDurationSec: 2 }));
    h.ctrl.onTime(30.2);
    h.options()[0].click();

    expect(h.ctrl.mode).toBe("feedback");
    expect(h.optionByState("wrong")).toHaveLength(1);
    expect(h.optionByState("correct")).toHaveLength(1);

    vi.advanceTimersByTime(10000);
    expect(h.ctrl.mode).toBe("feedback");

    const cont = h.slot.querySelector<HTMLButtonElement>(
      "[data-vp-quiz-feedback-continue]",
    );
    expect(cont).not.toBeNull();
    cont?.click();
    expect(h.ctrl.mode).toBe("idle");
    h.teardown();
  });

  it("shows the inline explanation on the correct option once answered", () => {
    const h = setup();
    h.ctrl.onTime(30.2);
    expect(h.slot.querySelector("[data-vp-quiz-explanation]")).toBeNull();

    h.options()[0].click();
    expect(
      h.slot.querySelector("[data-vp-quiz-explanation]")?.textContent,
    ).toBe("Because b.");
    h.teardown();
  });

  it("disables every option after answering", () => {
    const h = setup();
    h.ctrl.onTime(30.2);
    h.options()[1].click();
    expect(h.options().every((b) => b.disabled)).toBe(true);
    h.teardown();
  });

  it("records a skipped outcome and reveals the correct option", () => {
    const h = setup(baseQuiz({ showSummary: true, showScore: true }));
    h.ctrl.onTime(30.2);
    h.slot.querySelector<HTMLButtonElement>("[data-vp-quiz-skip]")?.click();

    expect(h.optionByState("correct")).toHaveLength(1);
    expect(h.optionByState("wrong")).toHaveLength(0);
    h.teardown();
  });

  it("uses a two-column grid only for exactly four options", () => {
    const four = setup(
      baseQuiz({
        quizzes: [
          {
            id: "quiz-1",
            t: 30,
            questions: [
              {
                id: "q1",
                prompt: "p",
                correctOptionId: "a",
                options: ["a", "b", "c", "d"].map((id) => option(id)),
              },
            ],
          },
        ],
      }),
    );
    four.ctrl.onTime(30.2);
    expect(
      four.slot.querySelector<HTMLElement>("[data-vp-quiz-options]")?.dataset
        .cols,
    ).toBe("2");
    four.teardown();

    const two = setup();
    two.ctrl.onTime(30.2);
    expect(
      two.slot.querySelector<HTMLElement>("[data-vp-quiz-options]")?.dataset
        .cols,
    ).toBe("1");
    two.teardown();
  });
});

describe("timeout countdown", () => {
  const timed = () =>
    baseQuiz({
      quizzes: [
        {
          id: "quiz-1",
          t: 30,
          questions: [
            {
              id: "q1",
              prompt: "p",
              correctOptionId: "b",
              timeoutSec: 10,
              options: [option("a"), option("b")],
            },
          ],
        },
      ],
    });

  it("renders a countdown and records a timeout outcome on expiry", () => {
    const h = setup(timed());
    h.ctrl.onTime(30.2);

    const wrap = h.slot.querySelector<HTMLElement>("[data-vp-quiz-countdown]");
    expect(wrap).not.toBeNull();
    expect(
      wrap?.querySelector("[data-vp-quiz-countdown-num]")?.textContent,
    ).toBe("10");

    vi.advanceTimersByTime(10_050);
    expect(h.ctrl.mode).toBe("feedback");
    expect(h.optionByState("correct")).toHaveLength(1);
    expect(h.optionByState("wrong")).toHaveLength(0);
    h.teardown();
  });

  it("flags the warning state at five seconds or less", () => {
    const h = setup(timed());
    h.ctrl.onTime(30.2);

    vi.advanceTimersByTime(4000);
    expect(
      h.slot.querySelector<HTMLElement>("[data-vp-quiz-countdown]")?.dataset
        .warn,
    ).toBe("0");

    vi.advanceTimersByTime(2000);
    expect(
      h.slot.querySelector<HTMLElement>("[data-vp-quiz-countdown]")?.dataset
        .warn,
    ).toBe("1");
    h.teardown();
  });

  it("still times out when the countdown is visually hidden", () => {
    const h = setup(
      baseQuiz({
        quizzes: [
          {
            id: "quiz-1",
            t: 30,
            questions: [
              {
                id: "q1",
                prompt: "p",
                correctOptionId: "b",
                timeoutSec: 10,
                showCountdown: false,
                options: [option("a"), option("b")],
              },
            ],
          },
        ],
      }),
    );
    h.ctrl.onTime(30.2);
    expect(h.slot.querySelector("[data-vp-quiz-countdown]")).toBeNull();

    vi.advanceTimersByTime(10_050);
    expect(h.ctrl.mode).toBe("feedback");
    h.teardown();
  });
});

describe("resume behaviour", () => {
  const twoQuestions = (resume: string) =>
    baseQuiz({
      feedbackDurationSec: 1,
      quizzes: [
        {
          id: "quiz-1",
          t: 30,
          resume,
          questions: [
            {
              id: "q1",
              prompt: "one",
              correctOptionId: "b",
              options: [option("a"), option("b")],
            },
            {
              id: "q2",
              prompt: "two",
              correctOptionId: "b",
              options: [option("a"), option("b")],
            },
          ],
        },
      ],
    });

  it("advances through every question, then resumes automatically", () => {
    const h = setup(twoQuestions("auto"));
    h.ctrl.onTime(30.2);
    expect(h.slot.querySelector("#vp-quiz-prompt")?.textContent).toBe("one");

    h.options()[1].click();
    vi.advanceTimersByTime(1010);
    expect(h.ctrl.mode).toBe("question");
    expect(h.slot.querySelector("#vp-quiz-prompt")?.textContent).toBe("two");

    h.options()[1].click();
    vi.advanceTimersByTime(1010);
    expect(h.ctrl.mode).toBe("idle");
    expect(h.play).toHaveBeenCalled();
    h.teardown();
  });

  it("waits for an explicit resume when resume is manual", () => {
    const h = setup(twoQuestions("manual"));
    h.ctrl.onTime(30.2);
    h.options()[1].click();
    vi.advanceTimersByTime(1010);
    h.options()[1].click();
    vi.advanceTimersByTime(1010);

    expect(h.ctrl.mode).toBe("awaiting-continue");
    expect(h.play).not.toHaveBeenCalled();

    h.slot.querySelector<HTMLButtonElement>("[data-vp-quiz-continue]")?.click();
    expect(h.ctrl.mode).toBe("idle");
    expect(h.play).toHaveBeenCalled();
    h.teardown();
  });

  it("does not start playback when the video was already paused", () => {
    const h = setup();
    h.setPaused(true);
    h.ctrl.onTime(30.2);
    h.options()[1].click();
    vi.advanceTimersByTime(3010);

    expect(h.ctrl.mode).toBe("idle");
    expect(h.play).not.toHaveBeenCalled();
    h.teardown();
  });

  it("chains two breaks at the same time without resuming in between", () => {
    const h = setup(
      baseQuiz({
        feedbackDurationSec: 1,
        quizzes: [
          {
            id: "first",
            t: 30,
            questions: [
              {
                id: "q1",
                prompt: "first question",
                correctOptionId: "b",
                options: [option("a"), option("b")],
              },
            ],
          },
          {
            id: "second",
            t: 30,
            questions: [
              {
                id: "q2",
                prompt: "second question",
                correctOptionId: "b",
                options: [option("a"), option("b")],
              },
            ],
          },
        ],
      }),
    );

    h.ctrl.onTime(30.2);
    expect(h.slot.querySelector("#vp-quiz-prompt")?.textContent).toBe(
      "first question",
    );
    h.options()[1].click();
    vi.advanceTimersByTime(1010);

    expect(h.ctrl.mode).toBe("question");
    expect(h.slot.querySelector("#vp-quiz-prompt")?.textContent).toBe(
      "second question",
    );
    expect(h.play).not.toHaveBeenCalled();

    h.options()[1].click();
    vi.advanceTimersByTime(1010);
    expect(h.ctrl.mode).toBe("idle");
    expect(h.play).toHaveBeenCalledTimes(1);
    h.teardown();
  });
});

describe("keyboard interaction", () => {
  const fourOptions = () =>
    baseQuiz({
      quizzes: [
        {
          id: "quiz-1",
          t: 30,
          questions: [
            {
              id: "q1",
              prompt: "p",
              correctOptionId: "c",
              options: ["a", "b", "c", "d"].map((id) => option(id)),
            },
          ],
        },
      ],
    });

  const key = (init: KeyboardEventInit) =>
    new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });

  it("selects an option by number key from anywhere in the dialog", () => {
    const h = setup(fourOptions());
    h.ctrl.onTime(30.2);

    document.dispatchEvent(key({ key: "3" }));
    expect(h.ctrl.mode).toBe("feedback");
    expect(h.optionByState("correct")[0].dataset.optionId).toBe("c");
    h.teardown();
  });

  it("moves the roving tabindex with arrow keys", () => {
    const h = setup(fourOptions());
    h.ctrl.onTime(30.2);
    const opts = h.options();
    expect(opts[0].tabIndex).toBe(0);

    opts[0].focus();
    opts[0].dispatchEvent(key({ key: "ArrowRight" }));

    expect(h.options()[1].tabIndex).toBe(0);
    expect(h.options()[0].tabIndex).toBe(-1);
    h.teardown();
  });

  it("activates a focused option with Space and keeps the event from the player", () => {
    const h = setup(fourOptions());
    h.ctrl.onTime(30.2);
    const opts = h.options();
    opts[2].focus();

    const windowSpy = vi.fn();
    window.addEventListener("keydown", windowSpy);
    const event = key({ key: " " });
    document.dispatchEvent(event);

    expect(h.ctrl.mode).toBe("feedback");
    expect(event.defaultPrevented).toBe(true);
    expect(windowSpy).not.toHaveBeenCalled();
    window.removeEventListener("keydown", windowSpy);
    h.teardown();
  });

  it("suppresses the player's Space and K shortcuts while a quiz is open", () => {
    const h = setup();
    h.ctrl.onTime(30.2);

    for (const k of [" ", "k", "K"]) {
      const event = key({ key: k });
      document.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
    h.teardown();
  });

  it("traps Tab inside the card", () => {
    const h = setup(fourOptions());
    h.ctrl.onTime(30.2);
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();

    const event = key({ key: "Tab" });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(h.card()?.contains(document.activeElement)).toBe(true);
    h.teardown();
  });

  it("leaves keys alone when focus is in a form field outside the card", () => {
    const h = setup(fourOptions());
    h.ctrl.onTime(30.2);

    const comment = document.createElement("textarea");
    document.body.appendChild(comment);
    comment.focus();

    const event = key({ key: "3" });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(h.ctrl.mode).toBe("question");
    h.teardown();
  });

  it("does not dismiss a question on Escape, but closes the summary", () => {
    const h = setup(baseQuiz({ showSummary: true }));
    h.ctrl.onTime(30.2);
    document.dispatchEvent(key({ key: "Escape" }));
    expect(h.ctrl.mode).toBe("question");

    h.options()[1].click();
    vi.advanceTimersByTime(3010);
    h.ctrl.onEnded();
    expect(h.ctrl.mode).toBe("summary");

    document.dispatchEvent(key({ key: "Escape" }));
    expect(h.ctrl.mode).toBe("idle");
    h.teardown();
  });
});

describe("player controls are inert while a quiz is open", () => {
  it("blocks click and pointerdown on the control bar, and releases after close", () => {
    const h = setup(baseQuiz({ showSummary: true }));
    const seek = document.querySelector<HTMLElement>(".vp-controls input");
    expect(seek).not.toBeNull();

    h.ctrl.onTime(30.2);

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    const pointer = new Event("pointerdown", {
      bubbles: true,
      cancelable: true,
    });
    seek?.dispatchEvent(click);
    seek?.dispatchEvent(pointer);
    expect(click.defaultPrevented).toBe(true);
    expect(pointer.defaultPrevented).toBe(true);

    h.options()[1].click();
    vi.advanceTimersByTime(3010);
    expect(h.ctrl.isActive()).toBe(false);

    const after = new MouseEvent("click", { bubbles: true, cancelable: true });
    seek?.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
    h.teardown();
  });
});

describe("summary", () => {
  const threeAcross = () =>
    baseQuiz({
      feedbackDurationSec: 1,
      showScore: true,
      showSummary: true,
      passingPercent: 70,
      quizzes: [
        {
          id: "quiz-1",
          t: 30,
          questions: [
            {
              id: "q1",
              prompt: "one",
              correctOptionId: "b",
              options: [option("a"), option("b")],
            },
            {
              id: "q2",
              prompt: "two",
              correctOptionId: "b",
              options: [option("a"), option("b")],
            },
            {
              id: "q3",
              prompt: "three",
              correctOptionId: "b",
              options: [option("a"), option("b")],
            },
          ],
        },
      ],
    });

  const answerAll = (h: Harness, picks: readonly number[]) => {
    h.ctrl.onTime(30.2);
    for (const pick of picks) {
      h.options()[pick].click();
      if (h.ctrl.mode === "feedback") {
        const cont = h.slot.querySelector<HTMLButtonElement>(
          "[data-vp-quiz-feedback-continue]",
        );
        if (cont) cont.click();
        else vi.advanceTimersByTime(1010);
      }
    }
  };

  it("reports the score, percentage and a pass badge", () => {
    const h = setup(threeAcross());
    answerAll(h, [1, 1, 0]);
    h.ctrl.onEnded();

    expect(h.ctrl.mode).toBe("summary");
    expect(h.slot.querySelector(".vp-quiz-score-big")?.textContent).toBe(
      "2 / 3",
    );
    // The score line now renders from common/i18n; with no `lang` on the test
    // document it resolves to DEFAULT_LOCALE ("en"). The German copy is covered
    // by tests/common/i18n.test.ts.
    expect(h.slot.querySelector(".vp-quiz-score-sub")?.textContent).toBe(
      "67% answered correctly",
    );
    expect(
      h.slot.querySelector<HTMLElement>(".vp-quiz-pass-badge")?.dataset.pass,
    ).toBe("0");
    h.teardown();
  });

  it("marks a passing score", () => {
    const h = setup(threeAcross());
    answerAll(h, [1, 1, 1]);
    h.ctrl.onEnded();

    expect(h.slot.querySelector(".vp-quiz-score-big")?.textContent).toBe(
      "3 / 3",
    );
    expect(
      h.slot.querySelector<HTMLElement>(".vp-quiz-pass-badge")?.dataset.pass,
    ).toBe("1");
    h.teardown();
  });

  it("lists one row per question with its outcome", () => {
    const h = setup(threeAcross());
    answerAll(h, [1, 0, 1]);
    h.ctrl.onEnded();

    const outcomes = [
      ...h.slot.querySelectorAll<HTMLElement>(".vp-quiz-summary-row"),
    ].map((r) => r.dataset.outcome);
    expect(outcomes).toEqual(["correct", "wrong", "correct"]);
    h.teardown();
  });

  it("restarts from the beginning with cleared results", () => {
    const h = setup(threeAcross());
    answerAll(h, [1, 1, 1]);
    h.ctrl.onEnded();

    h.slot.querySelector<HTMLButtonElement>("[data-vp-quiz-restart]")?.click();
    expect(h.ctrl.mode).toBe("idle");
    expect(h.media.currentTime).toBe(0);
    expect(h.play).toHaveBeenCalled();

    // The break is available again, and the fresh attempt has no prior results.
    expect(h.ctrl.onTime(30.2)).toBe(true);
    h.options()[1].click();
    vi.advanceTimersByTime(1010);
    h.options()[1].click();
    vi.advanceTimersByTime(1010);
    h.options()[1].click();
    vi.advanceTimersByTime(1010);
    h.ctrl.onEnded();
    expect(h.slot.querySelector(".vp-quiz-score-big")?.textContent).toBe(
      "3 / 3",
    );
    h.teardown();
  });

  it("omits the summary entirely when showSummary is false", () => {
    const h = setup(baseQuiz({ showSummary: false }));
    h.ctrl.onTime(30.2);
    h.options()[1].click();
    vi.advanceTimersByTime(3010);
    h.ctrl.onEnded();

    expect(h.ctrl.mode).toBe("idle");
    expect(h.slot.innerHTML).toBe("");
    h.teardown();
  });
});

describe("end-anchored breaks", () => {
  it("runs a break placed at the very end when playback finishes", () => {
    const h = setup(
      baseQuiz({
        quizzes: [
          {
            id: "closing",
            t: 119.8,
            questions: [
              {
                id: "q1",
                prompt: "closing question",
                correctOptionId: "b",
                options: [option("a"), option("b")],
              },
            ],
          },
        ],
      }),
    );

    h.ctrl.onEnded();
    expect(h.ctrl.mode).toBe("question");
    expect(h.slot.querySelector("#vp-quiz-prompt")?.textContent).toBe(
      "closing question",
    );
    h.teardown();
  });

  it("opens the summary directly when playback ends with no end-anchored break", () => {
    const h = setup(baseQuiz({ showSummary: true }));
    h.ctrl.onEnded();
    expect(h.ctrl.mode).toBe("summary");
    h.teardown();
  });

  it("onPlay clears the ended flag, so a manual break still waits for a resume", () => {
    // videoEnded is observable through advance(): once the video has ended a
    // resume:"manual" break skips awaiting-continue (there is nothing to resume).
    // onPlay() must undo that.
    const h = setup(
      baseQuiz({
        showSummary: false,
        quizzes: [
          {
            id: "quiz-1",
            t: 30,
            resume: "manual",
            questions: [
              {
                id: "q1",
                prompt: "p",
                correctOptionId: "b",
                options: [option("a"), option("b")],
              },
            ],
          },
        ],
      }),
    );

    h.ctrl.onEnded();
    h.ctrl.onPlay();
    expect(h.ctrl.onTime(30.2)).toBe(true);
    h.options()[1].click();
    vi.advanceTimersByTime(3010);

    expect(h.ctrl.mode).toBe("awaiting-continue");
    h.teardown();
  });

  it("a manual break skips the resume prompt once the video has ended", () => {
    const h = setup(
      baseQuiz({
        showSummary: false,
        quizzes: [
          {
            id: "closing",
            t: 119.8,
            resume: "manual",
            questions: [
              {
                id: "q1",
                prompt: "p",
                correctOptionId: "b",
                options: [option("a"), option("b")],
              },
            ],
          },
        ],
      }),
    );

    h.ctrl.onEnded();
    expect(h.ctrl.mode).toBe("question");
    h.options()[1].click();
    vi.advanceTimersByTime(3010);
    expect(h.ctrl.mode).toBe("idle");
    h.teardown();
  });
});

describe("teardown", () => {
  it("destroy() stops the countdown and pending feedback timers", () => {
    const h = setup(
      baseQuiz({
        quizzes: [
          {
            id: "quiz-1",
            t: 30,
            questions: [
              {
                id: "q1",
                prompt: "p",
                correctOptionId: "b",
                timeoutSec: 10,
                options: [option("a"), option("b")],
              },
            ],
          },
        ],
      }),
    );
    h.ctrl.onTime(30.2);
    const before = h.slot.querySelector(
      "[data-vp-quiz-countdown-num]",
    )?.textContent;

    h.ctrl.destroy();
    vi.advanceTimersByTime(20_000);

    expect(
      h.slot.querySelector("[data-vp-quiz-countdown-num]")?.textContent,
    ).toBe(before);
    h.teardown();
  });

  it("cleanup removes the global listeners and the window handle", () => {
    const h = setup();
    h.ctrl.onTime(30.2);
    h.teardown();

    const seek = document.querySelector<HTMLElement>(".vp-controls input");
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    seek?.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
    expect(
      (window as unknown as { __vpQuiz?: unknown }).__vpQuiz,
    ).toBeUndefined();
  });
});
