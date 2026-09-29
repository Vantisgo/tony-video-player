import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerApi, PlayerEvent } from "../../common/types";

// The science and meta pills promise to open a sidebar tab. Below 1024px no
// sidebar is installed, and before this fix `__vpSidebarTab` still pointed at
// the detached <aside>, so "Öffnen" was a dead tap (spec M1, measured on the
// live tenant 2026-09-29). These tests pin the rule: the open affordance exists
// exactly when a sidebar does.

type BusHandler = (payload: PlayerEvent) => void;
let busHandlers: BusHandler[] = [];
let currentTime = 0;

function installPlayerStub(): void {
  currentTime = 0;
  busHandlers = [];
  const stub: PlayerApi = {
    get current() {
      return currentTime;
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
  currentTime = t;
  for (const handler of busHandlers)
    handler({ type: "time", time: t, duration: 100 });
}

function setupConfigDom(config: unknown): HTMLPreElement {
  const pre = document.createElement("pre");
  pre.setAttribute("data-vp-config", "");
  pre.textContent = JSON.stringify(config);
  document.body.appendChild(pre);
  const host = document.createElement("div");
  host.appendChild(document.createElement("hls-video"));
  document.body.appendChild(host);
  return pre;
}

const nextFrames = (): Promise<void> =>
  new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

const happyDOM = (): { setViewport(v: { width: number }): void } =>
  (
    window as unknown as {
      happyDOM: { setViewport(v: { width: number }): void };
    }
  ).happyDOM;

// Coaching content (so a sidebar exists on desktop), one science moment at
// t=10 (pill active 10–15s) and one meta step at t=2 (pill active 2–7s).
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
    {
      id: "s1",
      name: "Psychological Safety",
      description: "About safety.",
      timestampsSec: [10],
    },
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

async function mount(): Promise<HTMLPreElement> {
  installPlayerStub();
  const pre = setupConfigDom(CONFIG);
  await import("../../demo-overlays/index");
  await nextFrames();
  return pre;
}

const sciencePill = (): HTMLElement | null =>
  document.querySelector('#vp-slot-tr [data-overlay-action="science"]');
const metaPill = (): HTMLElement | null =>
  document.querySelector('#vp-slot-br [data-overlay-action="meta"]');
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
});

afterEach(() => {
  runCleanups();
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  happyDOM().setViewport({ width: 1024 });
});

describe("pill open affordances", () => {
  it("AC1+AC2: offers no open action below 1024px", async () => {
    // Narrow BEFORE the import: happy-dom's matchMedia listener does not fire
    // on the first flip away from an already-true query.
    happyDOM().setViewport({ width: 390 });
    await mount();

    expect(typeof w.__vpSidebarTab).toBe("undefined");

    emitTime(11);
    const sci = sciencePill();
    expect(sci).not.toBeNull();
    expect(document.querySelector("#vp-slot-tr button")).toBeNull();
    expect(sci!.style.cursor).toBe("default");
    expect(sci!.onclick).toBeNull();

    emitTime(3);
    const meta = metaPill();
    expect(meta).not.toBeNull();
    expect(meta!.hasAttribute("title")).toBe(false);
    expect(meta!.style.cursor).toBe("default");
    expect(meta!.onclick).toBeNull();
  });

  it("AC3: the science pill opens the Science Corner tab on desktop", async () => {
    await mount();
    expect(typeof w.__vpSidebarTab).toBe("function");

    emitTime(11);
    const button = document.querySelector(
      "#vp-slot-tr button",
    ) as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(sciencePill()!.style.cursor).toBe("pointer");

    button!.click();
    expect(panel("science").style.display).toBe("");
    expect(panel("coaching").style.display).toBe("none");
  });

  it("AC3: the meta pill opens the meta tab on desktop", async () => {
    await mount();

    emitTime(3);
    const meta = metaPill();
    expect(meta).not.toBeNull();
    expect(meta!.getAttribute("title")).not.toBeNull();

    meta!.click();
    expect(panel("meta").style.display).toBe("");
    expect(panel("coaching").style.display).toBe("none");
  });

  it("AC4: removes __vpSidebarTab when the mount is torn down", async () => {
    const pre = await mount();
    expect(typeof w.__vpSidebarTab).toBe("function");

    // Removing the config makes readyContext() null on the next debounced scan
    // (200ms), which tears the mount down and runs its cleanups.
    pre.remove();
    await new Promise((r) => setTimeout(r, 220));
    await nextFrames();

    expect(document.getElementById("vp-slot-tl")).toBeNull();
    expect(typeof w.__vpSidebarTab).toBe("undefined");
  });
});
