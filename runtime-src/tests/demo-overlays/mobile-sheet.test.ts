import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerApi, PlayerEvent } from "../../common/types";

// The mobile sheet host (spec P3). Mounted at a 390×844 viewport with the
// player host's box stubbed to the live lesson's measurements (spec M9: player
// 315–534, document 950px tall → max scroll 106), because happy-dom has no
// layout.

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

const happyDOM = (): {
  setViewport(v: { width: number; height?: number }): void;
} =>
  (
    window as unknown as {
      happyDOM: { setViewport(v: { width: number; height?: number }): void };
    }
  ).happyDOM;

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
  ],
  sciences: [
    { id: "s1", name: "Safety", description: "About.", timestampsSec: [10] },
  ],
  audios: [],
  metaSteps: [{ id: "m1", n: 1, title: "Kontakt", t: 2 }],
};

const w = window as unknown as Record<string, unknown> & {
  __vpDemoCleanup?: Array<() => void>;
  __vpSidebarTab?: (name: string) => void;
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

// The player host's box. Mutable so the follow test can move the player.
let hostRect = { top: 315, bottom: 534 };

function rect(top: number, bottom: number, width = 390): DOMRect {
  return {
    top,
    bottom,
    left: 0,
    right: width,
    width,
    height: bottom - top,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

let host: HTMLElement;
let pre: HTMLPreElement;
let scrollTo: ReturnType<typeof vi.fn>;

async function mount(): Promise<void> {
  installPlayerStub();
  pre = document.createElement("pre");
  pre.setAttribute("data-vp-config", "");
  pre.textContent = JSON.stringify(CONFIG);
  document.body.appendChild(pre);
  host = document.createElement("div");
  host.id = "test-player-host";
  host.appendChild(document.createElement("hls-video"));
  document.body.appendChild(host);
  await import("../../demo-overlays/index");
  await nextFrames();
}

const sheet = (): HTMLElement =>
  document.getElementById("vp-demo-sidebar") as HTMLElement;
const tabBar = (): HTMLElement | null =>
  document.getElementById("vp-mobile-tabs");
const tabButton = (key: string): HTMLButtonElement =>
  document.querySelector(`[data-sheet-tab="${key}"]`) as HTMLButtonElement;
const panel = (key: string): HTMLElement =>
  document.querySelector(`[data-panel="${key}"]`) as HTMLElement;

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
  // Narrow BEFORE the import: happy-dom's matchMedia listener does not fire on
  // the first flip away from an already-true query.
  happyDOM().setViewport({ width: 390, height: 844 });
  hostRect = { top: 315, bottom: 534 };
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      return (this as HTMLElement).id === "test-player-host"
        ? rect(hostRect.top, hostRect.bottom)
        : rect(0, 0, 0);
    },
  );
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    get: () => 950,
  });
  scrollTo = vi.fn();
  vi.stubGlobal("scrollTo", scrollTo);
});

afterEach(() => {
  runCleanups();
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  delete (document.documentElement as unknown as { scrollHeight?: number })
    .scrollHeight;
  delete (document as unknown as { fullscreenElement?: Element })
    .fullscreenElement;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  happyDOM().setViewport({ width: 1024, height: 768 });
});

describe("mobile sheet host", () => {
  it("puts a tab bar with one 44px button per tab directly after the player", async () => {
    await mount();
    const nav = tabBar();
    expect(nav).not.toBeNull();
    expect(nav!.previousElementSibling).toBe(host);
    const labels = [...nav!.querySelectorAll("button")].map(
      (b) => b.textContent,
    );
    expect(labels).toEqual(["Coaching", "Science Corner", "Meta Structure"]);
    expect(tabButton("science").style.minHeight).toBe("44px");
    expect(nav!.getAttribute("aria-label")).toBe("Lesson sections");
  });

  it("starts closed: an inert sheet under <body>", async () => {
    await mount();
    expect(sheet().parentElement).toBe(document.body);
    expect(sheet().inert).toBe(true);
    expect(sheet().dataset.open).toBeUndefined();
    expect(sheet().getAttribute("role")).toBe("dialog");
  });

  it("opens on the tapped tab, docked where the player's bottom will be after scrolling (M9)", async () => {
    await mount();
    tabButton("science").click();

    expect(sheet().dataset.open).toBe("1");
    expect(sheet().inert).toBe(false);
    expect(sheet().style.top).toBe("428px");
    expect(scrollTo).toHaveBeenCalledWith({ top: 106, behavior: "smooth" });
    expect(panel("science").style.display).toBe("");
    expect(panel("coaching").style.display).toBe("none");
    expect(tabButton("science").getAttribute("aria-expanded")).toBe("true");
    expect(tabButton("coaching").getAttribute("aria-expanded")).toBe("false");
  });

  it("closes with ✕ and with Escape, and gives focus back to the opener", async () => {
    await mount();
    const opener = tabButton("coaching");
    opener.focus();
    opener.click();
    const close = sheet().querySelector(".vp-sheet-close") as HTMLButtonElement;
    expect(close.getAttribute("aria-label")).toBe("Close");
    close.click();
    expect(sheet().inert).toBe(true);
    expect(sheet().dataset.open).toBeUndefined();
    expect(document.activeElement).toBe(opener);

    opener.click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(sheet().inert).toBe(true);
  });

  it("opens from the science pill's Open button on a phone", async () => {
    await mount();
    expect(typeof w.__vpSidebarTab).toBe("function");
    emitTime(11);
    const button = document.querySelector(
      "#vp-slot-tr button",
    ) as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    button!.click();
    expect(sheet().dataset.open).toBe("1");
    expect(panel("science").style.display).toBe("");
  });

  it("never scrolls the page for a science moment while the sheet is closed", async () => {
    const proto = Element.prototype as unknown as {
      scrollIntoView?: () => void;
    };
    if (!proto.scrollIntoView) proto.scrollIntoView = () => {};
    const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");
    await mount();
    emitTime(11);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  // 2026-09-30: with 24px of scroll the 45% minimum covered the video's bottom
  // 46px (see sheet-geometry.test.ts). The page's height here grows with the
  // room, as a real layout would.
  it("adds the scroll room a short page lacks while open, and takes it away on close", async () => {
    const room = (): HTMLElement | null =>
      document.getElementById("vp-sheet-room");
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      get: () => 868 + (parseFloat(room()?.style.height ?? "") || 0),
    });
    await mount();

    tabButton("coaching").click();
    expect(room()?.parentElement).toBe(document.body);
    expect(room()!.style.height).toBe("46px");
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 70, behavior: "smooth" });
    expect(sheet().style.top).toBe("464px");

    // Switching tabs re-measures a page that already carries the room.
    tabButton("science").click();
    expect(room()!.style.height).toBe("46px");
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 70, behavior: "smooth" });

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(room()).toBeNull();
  });

  it("adds no scroll room to a page tall enough for the sheet (M9)", async () => {
    await mount();
    tabButton("coaching").click();
    expect(document.getElementById("vp-sheet-room")).toBeNull();
  });

  it("follows the player's bottom while open, within the 45% portrait minimum", async () => {
    await mount();
    tabButton("coaching").click();

    hostRect = { top: 81, bottom: 300 };
    window.dispatchEvent(new Event("scroll"));
    await nextFrames();
    expect(sheet().style.top).toBe("300px");

    hostRect = { top: 481, bottom: 700 };
    window.dispatchEvent(new Event("resize"));
    await nextFrames();
    expect(sheet().style.top).toBe("464px");
  });

  it("moves into the fullscreen element and back", async () => {
    await mount();
    let fullscreen: Element | null = host;
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fullscreen,
    });
    document.dispatchEvent(new Event("fullscreenchange"));
    expect(sheet().parentElement).toBe(host);

    fullscreen = null;
    document.dispatchEvent(new Event("fullscreenchange"));
    expect(sheet().parentElement).toBe(document.body);
  });

  it("stacks above LearningSuite's bottom bar and below its overlay layers", async () => {
    await mount();
    const z = Number(sheet().style.zIndex);
    expect(z).toBeGreaterThan(999);
    expect(z).toBeLessThan(1200);
  });

  it("removes the tab bar and the sheet on teardown", async () => {
    await mount();
    pre.remove();
    await new Promise((r) => setTimeout(r, 220));
    await nextFrames();
    expect(tabBar()).toBeNull();
    expect(document.getElementById("vp-demo-sidebar")).toBeNull();
    expect(() =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    ).not.toThrow();
  });
});
