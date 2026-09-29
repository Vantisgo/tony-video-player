import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerApi, PlayerEvent } from "../../common/types";
import { QUIZ_CSS } from "../../demo-overlays/styles";

// P5: on compact players the quiz slot moves to <body> and covers the viewport;
// otherwise (full-size player or fullscreen) it stays in the player. The
// player host's box is stubbed (happy-dom has no layout) and the compact
// observer is driven through a fake ResizeObserver.

type BusHandler = (payload: PlayerEvent) => void;
let busHandlers: BusHandler[] = [];

function installPlayerStub(): void {
  busHandlers = [];
  const stub: PlayerApi = {
    get current() {
      return 0;
    },
    duration: 100,
    play() {},
    pause() {},
    seek() {},
    on: (_event, fn) => {
      busHandlers.push(fn);
      return () => {};
    },
  };
  (window as unknown as { player: PlayerApi }).player = stub;
}

function emitTime(t: number): void {
  for (const handler of busHandlers)
    handler({ type: "time", time: t, duration: 100 });
}

const nextFrames = (): Promise<void> =>
  new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly observed: Element[] = [];
  constructor(private readonly cb: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }
  observe(el: Element): void {
    this.observed.push(el);
  }
  unobserve(): void {}
  disconnect(): void {}
  fire(): void {
    this.cb([], this as unknown as ResizeObserver);
  }
}

const CONFIG = {
  phases: [],
  sciences: [],
  audios: [],
  metaSteps: [],
  quiz: {
    quizzes: [
      {
        id: "qz1",
        t: 5,
        questions: [
          {
            id: "q1",
            prompt: "Which question clarifies expectations?",
            options: [
              { id: "a", text: "What should be different at the end?" },
              { id: "b", text: "How long do we have?" },
              { id: "c", text: "What did you do last week?" },
              { id: "d", text: "Which method do you want to try?" },
            ],
            correctOptionId: "a",
          },
        ],
      },
    ],
  },
};

const w = window as unknown as Record<string, unknown> & {
  __vpDemoCleanup?: Array<() => void>;
};

function runCleanups(): void {
  if (Array.isArray(w.__vpDemoCleanup))
    w.__vpDemoCleanup.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
  w.__vpDemoCleanup = [];
}

let hostSize = { width: 390, height: 219 };
let host: HTMLElement;
let video: HTMLVideoElement;
let pre: HTMLPreElement;

async function mount(): Promise<void> {
  installPlayerStub();
  pre = document.createElement("pre");
  pre.setAttribute("data-vp-config", "");
  pre.textContent = JSON.stringify(CONFIG);
  document.body.appendChild(pre);
  host = document.createElement("div");
  host.id = "test-player-host";
  // A real media element, so the playback gate (videoEl.paused) can open.
  video = document.createElement("video");
  video.setAttribute("data-vp-player", "");
  host.appendChild(video);
  document.body.appendChild(host);
  await import("../../demo-overlays/index");
  await nextFrames();
}

const slot = (): HTMLElement =>
  document.getElementById("vp-slot-quiz") as HTMLElement;
const hostObserver = (): FakeResizeObserver =>
  FakeResizeObserver.instances.find((o) => o.observed.includes(host))!;

beforeEach(() => {
  vi.resetModules();
  runCleanups();
  for (const key of ["__vpConfig", "__vpQuiz", "__audioCtrl", "__vpSidebarTab"])
    delete w[key];
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  hostSize = { width: 390, height: 219 };
  FakeResizeObserver.instances.length = 0;
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const { width, height } =
        (this as HTMLElement).id === "test-player-host"
          ? hostSize
          : { width: 0, height: 0 };
      return {
        width,
        height,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    },
  );
});

afterEach(() => {
  runCleanups();
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  delete (document as unknown as { fullscreenElement?: Element })
    .fullscreenElement;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("quiz placement", () => {
  it("AC1: on a compact player the quiz slot is a viewport-fixed child of <body>", async () => {
    await mount();
    expect(slot().parentElement).toBe(document.body);
    expect(slot().getAttribute("data-vp-promoted")).toBe("1");
    expect(slot().style.position).toBe("fixed");
    expect(slot().style.zIndex).toBe("1150");
  });

  it("AC2: returns to the player when the player grows to full size", async () => {
    await mount();
    hostSize = { width: 1200, height: 675 };
    hostObserver().fire();
    expect(slot().parentElement).toBe(host);
    expect(slot().hasAttribute("data-vp-promoted")).toBe(false);
    expect(slot().style.position).toBe("absolute");
    expect(slot().style.zIndex).toBe("20");
  });

  it("AC2: stays in the player while it is fullscreen, and is promoted again after", async () => {
    await mount();
    let fullscreen: Element | null = host;
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fullscreen,
    });
    document.dispatchEvent(new Event("fullscreenchange"));
    expect(slot().parentElement).toBe(host);

    fullscreen = null;
    document.dispatchEvent(new Event("fullscreenchange"));
    expect(slot().parentElement).toBe(document.body);
  });

  it("AC4: keeps keyboard focus in the dialog when the slot moves", async () => {
    await mount();
    await video.play().catch(() => {});
    emitTime(6);
    await nextFrames();
    const card = slot().querySelector(".vp-quiz-card") as HTMLElement | null;
    expect(card, "the quiz break at 5s should be open").not.toBeNull();
    card!.focus();
    expect(document.activeElement).toBe(card);

    hostSize = { width: 1200, height: 675 };
    hostObserver().fire();
    expect(slot().parentElement).toBe(host);
    expect(document.activeElement).toBe(card);
  });

  it("stacks between our sheet (1100) and LearningSuite's overlay layers (1200)", async () => {
    await mount();
    const z = Number(slot().style.zIndex);
    expect(z).toBeGreaterThan(1100);
    expect(z).toBeLessThan(1200);
  });

  it("AC3: shows the answers in one column when promoted", () => {
    expect(QUIZ_CSS).toContain(
      '#vp-slot-quiz[data-vp-promoted="1"] .vp-quiz-options[data-cols="2"] { grid-template-columns:1fr; }',
    );
  });

  it("teardown removes the promoted slot from <body>", async () => {
    await mount();
    expect(slot().parentElement).toBe(document.body);
    pre.remove();
    await new Promise((r) => setTimeout(r, 220));
    await nextFrames();
    expect(document.getElementById("vp-slot-quiz")).toBeNull();
  });
});
