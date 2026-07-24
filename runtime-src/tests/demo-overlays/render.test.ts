import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerApi, PlayerEvent } from "../../common/types";

type BusHandler = (payload: PlayerEvent) => void;
let busHandlers: BusHandler[] = [];
let currentTime = 0;

// Stub the window.player API that demo-overlays consumes from reskin-player.
// `on` captures the bus handler so tests can drive time events directly.
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
    setOverlays() {},
  };
  (window as unknown as { player: PlayerApi }).player = stub;
}

function emitTime(t: number): void {
  currentTime = t;
  for (const handler of busHandlers)
    handler({ type: "time", time: t, duration: 100 });
}

function setupConfigDom(config: unknown): void {
  const pre = document.createElement("pre");
  pre.setAttribute("data-vp-config", "");
  pre.textContent = JSON.stringify(config);
  document.body.appendChild(pre);
  const host = document.createElement("div");
  host.appendChild(document.createElement("hls-video"));
  document.body.appendChild(host);
}

const nextFrames = (): Promise<void> =>
  new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

const PAYLOAD = '<img src=x onerror="window.__xss=1">';

const TWO_PHASE_CONFIG = {
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
  sciences: [],
  audios: [],
  metaSteps: [
    { id: "m1", n: 1, title: "M1", t: 2 },
    { id: "m2", n: 2, title: "M2", t: 65 },
  ],
};

beforeEach(() => {
  vi.resetModules();
  const g = window as unknown as Record<string, unknown> & {
    __vpDemoCleanup?: Array<() => void>;
  };
  if (Array.isArray(g.__vpDemoCleanup))
    g.__vpDemoCleanup.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
  g.__vpDemoCleanup = [];
  for (const key of [
    "__vpConfig",
    "__vpExpandedPhase",
    "__vpActivePhase",
    "__vpActiveIntervention",
    "__vpActiveMeta",
    "__vpHighlightedScience",
    "__audioCtrl",
  ])
    delete g[key];
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});

describe("demo-overlays rendering", () => {
  it("escapes a malicious config value instead of injecting an element", async () => {
    (window as unknown as { __xss?: number }).__xss = 0;
    installPlayerStub();

    // textContent assignment keeps the payload as literal text (as LearningSuite
    // stores a pasted <pre> block), not parsed HTML.
    setupConfigDom({
      phases: [
        {
          id: "p1",
          title: PAYLOAD,
          description: "desc",
          startTimeSec: 0,
          endTimeSec: 60,
          interventions: [
            { id: "i1", label: "1.1", title: PAYLOAD, t: 4, desc: "d" },
          ],
        },
      ],
      sciences: [],
      audios: [],
      metaSteps: [],
    });

    // Importing the entry runs main(); config + <hls-video> are present so it
    // defers setup two animation frames.
    await import("../../demo-overlays/index");
    await nextFrames();

    const sidebar = document.getElementById("vp-demo-sidebar");
    expect(sidebar).not.toBeNull();
    // The payload must not have become a real <img> element…
    expect(sidebar?.querySelector('img[src="x"]')).toBeNull();
    // …and must be present as escaped literal text.
    expect(sidebar?.textContent).toContain("<img src=x");
    expect((window as unknown as { __xss?: number }).__xss).toBe(0);
  });

  it("does not rebuild the coaching/meta panels while their signature is unchanged", async () => {
    installPlayerStub();
    setupConfigDom(TWO_PHASE_CONFIG);
    await import("../../demo-overlays/index");
    await nextFrames();

    const coaching = document.querySelector(
      '[data-panel="coaching"]',
    ) as HTMLElement;
    const meta = document.querySelector('[data-panel="meta"]') as HTMLElement;

    // t=5: active intervention (i1) and meta (m1) become active → both rebuild.
    emitTime(5);
    const coachingNode = coaching.firstElementChild;
    const metaNode = meta.firstElementChild;
    expect(coachingNode).not.toBeNull();
    expect(metaNode).not.toBeNull();

    // t=6: same phase / intervention / meta → no rebuild, nodes preserved.
    emitTime(6);
    expect(coaching.firstElementChild).toBe(coachingNode);
    expect(meta.firstElementChild).toBe(metaNode);

    // t=70: crosses into phase 2 and meta step 2 → both rebuild.
    emitTime(70);
    expect(coaching.firstElementChild).not.toBe(coachingNode);
    expect(meta.firstElementChild).not.toBe(metaNode);
  });
});
