import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerApi, PlayerEvent } from "../../common/types";
import {
  AUDIO_CSS,
  PILL_CSS,
  QUIZ_CSS,
  SECTION_CSS,
} from "../../demo-overlays/styles";

// Compact overlays at mount level (P4). The player host's box is stubbed to the
// measured sizes (390×219 phone → compact; 1200×675 → full) and the observer is
// driven through a fake ResizeObserver, because happy-dom has no layout and its
// ResizeObserver never fires.

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

// Two phases so the section pill exists; a science moment at 10s.
const CONFIG = {
  phases: [
    {
      id: "p1",
      title: "Phase One",
      description: "d1",
      startTimeSec: 0,
      endTimeSec: 60,
      interventions: [
        { id: "i1", label: "1.1", title: "Iv1", t: 4, desc: "x" },
      ],
    },
    {
      id: "p2",
      title: "Phase Two",
      description: "d2",
      startTimeSec: 60,
      endTimeSec: 120,
      interventions: [
        { id: "i2", label: "2.1", title: "Iv2", t: 65, desc: "y" },
      ],
    },
  ],
  sciences: [
    { id: "s1", name: "Safety", description: "About.", timestampsSec: [10] },
  ],
  audios: [],
  metaSteps: [],
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

async function mount(): Promise<HTMLElement> {
  installPlayerStub();
  const pre = document.createElement("pre");
  pre.setAttribute("data-vp-config", "");
  pre.textContent = JSON.stringify(CONFIG);
  document.body.appendChild(pre);
  const host = document.createElement("div");
  host.id = "test-player-host";
  host.appendChild(document.createElement("hls-video"));
  document.body.appendChild(host);
  await import("../../demo-overlays/index");
  await nextFrames();
  return host;
}

const hostObserver = (host: HTMLElement): FakeResizeObserver =>
  FakeResizeObserver.instances.find((o) => o.observed.includes(host))!;

const slots = (): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>(".vp-slot"),
];

const happyDOM = (): { setViewport(v: { width: number }): void } =>
  (
    window as unknown as {
      happyDOM: { setViewport(v: { width: number }): void };
    }
  ).happyDOM;

beforeEach(() => {
  vi.resetModules();
  runCleanups();
  for (const key of [
    "__vpConfig",
    "__vpSidebarTab",
    "__vpExpandedPhase",
    "__vpExpandedIntervention",
    "__vpExpandedScience",
    "__vpActivePhase",
    "__vpActiveIntervention",
    "__vpActiveMeta",
    "__vpHighlightedScience",
    "__audioCtrl",
  ])
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
  delete (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  happyDOM().setViewport({ width: 1024 });
});

describe("compact overlays", () => {
  it("AC1: marks every slot compact on a phone-sized player and widens the voice-over slot", async () => {
    const host = await mount();
    expect(slots().length).toBeGreaterThanOrEqual(4);
    for (const slot of slots())
      expect(slot.getAttribute("data-vp-compact")).toBe("1");
    const lt = document.getElementById("vp-slot-lt")!;
    expect(lt.style.left).toBe("14px");
    expect(lt.style.width).toBe("auto");

    // Grown to full size: the attribute goes, the 320px card comes back.
    hostSize = { width: 1200, height: 675 };
    hostObserver(host).fire();
    for (const slot of slots())
      expect(slot.hasAttribute("data-vp-compact")).toBe(false);
    expect(lt.style.width).toBe("320px");
    expect(lt.style.left).toBe("");
  });

  it("styles the pills by class so compact CSS can vary them", async () => {
    await mount();
    emitTime(11);
    const pill = document.querySelector(
      '#vp-slot-tr [data-overlay-action="science"]',
    ) as HTMLElement;
    expect(pill.classList.contains("vp-sci-pill")).toBe(true);
    expect(pill.getAttribute("style")).toBeNull();
    expect(pill.dataset.canOpen).toBe("1");
    expect(pill.querySelector(".vp-sci-open")).not.toBeNull();
    expect(document.getElementById("__vp-pill-style")).not.toBeNull();
  });

  it("AC4: a compact section-pill tap opens Coaching in the desktop sidebar", async () => {
    await mount();
    // Switch away first, so the assertion proves the tap switched back.
    (
      window as unknown as { __vpSidebarTab: (k: string) => void }
    ).__vpSidebarTab("science");
    (document.querySelector(".vp-section-pill") as HTMLElement).click();
    expect(
      (document.querySelector('[data-panel="coaching"]') as HTMLElement).style
        .display,
    ).toBe("");
  });

  it("AC4: a compact section-pill tap opens the sheet on a phone", async () => {
    happyDOM().setViewport({ width: 390 });
    vi.stubGlobal("scrollTo", vi.fn());
    await mount();
    (document.querySelector(".vp-section-pill") as HTMLElement).click();
    expect(document.getElementById("vp-demo-sidebar")?.dataset.open).toBe("1");
  });

  it("AC5: on a full-size touch player a tap pins the section pill, and a second unpins it", async () => {
    hostSize = { width: 1200, height: 675 };
    Object.defineProperty(navigator, "maxTouchPoints", {
      configurable: true,
      value: 5,
    });
    await mount();
    const pill = document.querySelector(".vp-section-pill") as HTMLElement;
    pill.click();
    expect(pill.dataset.pinned).toBe("1");
    pill.click();
    expect(pill.dataset.pinned).toBe("");
  });

  it("AC5: with a mouse, a tap on a full-size player does not pin", async () => {
    hostSize = { width: 1200, height: 675 };
    await mount();
    const pill = document.querySelector(".vp-section-pill") as HTMLElement;
    pill.click();
    expect(pill.dataset.pinned).toBeUndefined();
  });
});

// Removes every `@media (hover:hover) { … }` block (brace-balanced), so what is
// left is the CSS that applies on touch screens too.
function withoutHoverMedia(source: string): string {
  // Comments are not rules (SECTION_CSS explains ":hover" in one).
  const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
  let out = "";
  let i = 0;
  const marker = "@media (hover:hover)";
  for (;;) {
    const at = css.indexOf(marker, i);
    if (at === -1) return out + css.slice(i);
    out += css.slice(i, at);
    let j = css.indexOf("{", at) + 1;
    let depth = 1;
    while (depth > 0 && j < css.length) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    i = j;
  }
}

describe("P4 CSS contract", () => {
  it.each([
    ["SECTION_CSS", SECTION_CSS],
    ["AUDIO_CSS", AUDIO_CSS],
    ["QUIZ_CSS", QUIZ_CSS],
    ["PILL_CSS", PILL_CSS],
  ])("%s applies :hover only under (hover:hover)", (_name, css) => {
    expect(withoutHoverMedia(css)).not.toContain(":hover");
  });

  it("the helper really strips the hover blocks", () => {
    expect(withoutHoverMedia("a{}@media (hover:hover){b:hover{c:d}}e{}")).toBe(
      "a{}e{}",
    );
  });

  it.each([
    [
      SECTION_CSS,
      '.vp-slot[data-vp-compact="1"] .vp-section-pill .vp-sec-expanded { display:none; }',
    ],
    [SECTION_CSS, "max-width:calc(100% - 112px)"],
    [
      AUDIO_CSS,
      '.vp-slot[data-vp-compact="1"] .vp-audio-btn[data-action="audio-back"]',
    ],
    [
      AUDIO_CSS,
      '.vp-slot[data-vp-compact="1"] .vp-audio-btn { min-width:40px; min-height:40px;',
    ],
    [PILL_CSS, '.vp-slot[data-vp-compact="1"] .vp-sci-open { min-height:40px;'],
    [PILL_CSS, '.vp-slot[data-vp-compact="1"] .vp-meta-divider'],
  ])("carries the compact rule %#", (css, rule) => {
    expect(css).toContain(rule);
  });
});
