import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerApi } from "../../common/types";

// The mount is driven by a permanent, 200ms-debounced MutationObserver plus a
// 50ms-debounced popstate handler, and each mount defers past two animation
// frames. These helpers walk that clock.
const DEBOUNCE_MS = 200;
const POP_DEBOUNCE_MS = 50;

function installPlayerStub(): void {
  const stub: PlayerApi = {
    get current() {
      return 0;
    },
    duration: 100,
    play() {},
    pause() {},
    seek() {},
    on: () => () => {},
  };
  (window as unknown as { player?: PlayerApi }).player = stub;
}

const VALID_CONFIG = {
  phases: [
    {
      id: "p1",
      title: "P1",
      description: "d",
      startTimeSec: 0,
      endTimeSec: 60,
      interventions: [{ id: "i1", label: "1.1", title: "t", t: 4, desc: "d" }],
    },
  ],
  sciences: [],
  audios: [],
  metaSteps: [],
};

function addPlayer(): HTMLElement {
  const host = document.createElement("div");
  host.appendChild(document.createElement("hls-video"));
  document.body.appendChild(host);
  return host;
}

function addConfig(config: unknown): HTMLPreElement {
  const pre = document.createElement("pre");
  pre.setAttribute("data-vp-config", "");
  pre.textContent = JSON.stringify(config);
  document.body.appendChild(pre);
  return pre;
}

const nextFrames = (): Promise<void> =>
  new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

// One debounce tick plus the mount's double-rAF.
async function settle(ms = DEBOUNCE_MS): Promise<void> {
  await new Promise((r) => setTimeout(r, ms + 20));
  await nextFrames();
}

function runCleanups(): void {
  const g = window as unknown as { __vpDemoCleanup?: Array<() => void> };
  if (Array.isArray(g.__vpDemoCleanup))
    g.__vpDemoCleanup.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
  g.__vpDemoCleanup = [];
}

async function load(): Promise<void> {
  await import("../../demo-overlays/index");
  await nextFrames();
}

beforeEach(() => {
  vi.resetModules();
  runCleanups();
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  installPlayerStub();
});

afterEach(() => {
  runCleanups();
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  delete (window as unknown as { player?: PlayerApi }).player;
  vi.restoreAllMocks();
});

describe("initial mount", () => {
  it("mounts when the config and player are already present", async () => {
    addConfig(VALID_CONFIG);
    addPlayer();

    await load();

    expect(document.getElementById("vp-slot-tl")).not.toBeNull();
    expect(document.getElementById("vp-demo-sidebar")).not.toBeNull();
  });

  it("waits, then mounts once a late config and player appear", async () => {
    await load();
    expect(document.getElementById("vp-slot-tl")).toBeNull();

    addConfig(VALID_CONFIG);
    addPlayer();
    await settle();

    expect(document.getElementById("vp-slot-tl")).not.toBeNull();
  });

  it("does not mount without window.player, even with a config and a player element", async () => {
    delete (window as unknown as { player?: PlayerApi }).player;
    addConfig(VALID_CONFIG);
    addPlayer();

    await load();

    expect(document.getElementById("vp-slot-tl")).toBeNull();
  });
});

describe("self-healing", () => {
  it("remounts after the host strips a slot", async () => {
    addConfig(VALID_CONFIG);
    addPlayer();
    await load();

    const before = document.getElementById("vp-slot-tl");
    expect(before).not.toBeNull();
    before?.remove();

    await settle();

    const after = document.getElementById("vp-slot-tl");
    expect(after).not.toBeNull();
    expect(after).not.toBe(before);
  });

  it("remounts after the host strips the sidebar", async () => {
    addConfig(VALID_CONFIG);
    addPlayer();
    await load();

    document.getElementById("vp-demo-sidebar")?.remove();
    await settle();

    expect(document.getElementById("vp-demo-sidebar")).not.toBeNull();
  });

  it("does NOT remount while the config and nodes are unchanged", async () => {
    addConfig(VALID_CONFIG);
    addPlayer();
    await load();

    const slot = document.getElementById("vp-slot-tl");
    // Churn the DOM the way a chatty React host would, without touching ours.
    for (let i = 0; i < 3; i++) {
      const noise = document.createElement("span");
      noise.textContent = `render ${i}`;
      document.body.appendChild(noise);
      await settle();
    }

    // Same element instance: no teardown/remount cycle happened.
    expect(document.getElementById("vp-slot-tl")).toBe(slot);
  });

  it("remounts with new content when the config JSON is edited", async () => {
    const pre = addConfig(VALID_CONFIG);
    addPlayer();
    await load();

    expect(document.getElementById("vp-demo-sidebar")?.textContent).toContain(
      "P1",
    );

    pre.textContent = JSON.stringify({
      ...VALID_CONFIG,
      phases: [{ ...VALID_CONFIG.phases[0], id: "p2", title: "Renamed" }],
    });
    await settle();

    const sidebar = document.getElementById("vp-demo-sidebar");
    expect(sidebar?.textContent).toContain("Renamed");
    expect(sidebar?.textContent).not.toContain("P1");
  });

  it("tears the mount down when the config disappears", async () => {
    const pre = addConfig(VALID_CONFIG);
    addPlayer();
    await load();
    expect(document.getElementById("vp-slot-tl")).not.toBeNull();

    pre.remove();
    await settle();

    expect(document.getElementById("vp-slot-tl")).toBeNull();
    expect(document.getElementById("vp-demo-sidebar")).toBeNull();
  });

  it("re-evaluates on history navigation", async () => {
    await load();
    addConfig(VALID_CONFIG);
    addPlayer();

    // Fire popstate and allow only its own (shorter) debounce plus a scan tick.
    window.dispatchEvent(new Event("popstate"));
    await settle(POP_DEBOUNCE_MS + DEBOUNCE_MS);

    expect(document.getElementById("vp-slot-tl")).not.toBeNull();
  });
});

describe("idempotency", () => {
  it("a second run leaves exactly one of each node", async () => {
    addConfig(VALID_CONFIG);
    addPlayer();
    await load();

    vi.resetModules();
    await load();
    await settle();

    for (const id of ["vp-slot-tl", "vp-slot-tr", "vp-demo-sidebar"]) {
      expect(document.querySelectorAll(`#${id}`)).toHaveLength(1);
    }
  });

  it("running the process cleanups stops the watcher and removes the mount", async () => {
    addConfig(VALID_CONFIG);
    addPlayer();
    await load();
    expect(document.getElementById("vp-slot-tl")).not.toBeNull();

    runCleanups();
    expect(document.getElementById("vp-demo-sidebar")).toBeNull();

    // The observer is gone, so further mutations must not resurrect a mount.
    document.body.appendChild(document.createElement("span"));
    await settle();
    expect(document.getElementById("vp-slot-tl")).toBeNull();
  });
});

describe("conditional mounting", () => {
  it("renders no sample content and no sidebar for an empty config", async () => {
    addConfig({ phases: [], sciences: [], audios: [], metaSteps: [] });
    addPlayer();
    await load();

    expect(document.getElementById("vp-demo-sidebar")).toBeNull();
    expect(document.getElementById("vp-slot-quiz")).toBeNull();
  });

  it("renders the built-in sample data only under demo: true", async () => {
    addConfig({ demo: true });
    addPlayer();
    await load();

    const sidebar = document.getElementById("vp-demo-sidebar");
    expect(sidebar).not.toBeNull();
    // All three tabs, because every DEFAULT_* section has content.
    expect(sidebar?.querySelectorAll("[data-panel]")).toHaveLength(3);
  });

  it("creates only the tabs whose section has content", async () => {
    addConfig({
      phases: [],
      sciences: [
        { id: "s1", name: "n", description: "d", timestampsSec: [22] },
      ],
      audios: [],
      metaSteps: [],
    });
    addPlayer();
    await load();

    const sidebar = document.getElementById("vp-demo-sidebar");
    expect(sidebar).not.toBeNull();
    const panels = [...(sidebar?.querySelectorAll("[data-panel]") ?? [])].map(
      (p) => p.getAttribute("data-panel"),
    );
    expect(panels).toEqual(["science"]);
  });

  it("creates the quiz slot and styles only when a quiz is configured", async () => {
    addConfig({
      ...VALID_CONFIG,
      quiz: {
        quizzes: [
          {
            id: "q",
            t: 10,
            questions: [
              {
                id: "q1",
                prompt: "p",
                correctOptionId: "b",
                options: [
                  { id: "a", text: "a" },
                  { id: "b", text: "b" },
                ],
              },
            ],
          },
        ],
      },
    });
    addPlayer();
    await load();

    expect(document.getElementById("vp-slot-quiz")).not.toBeNull();
    expect(document.getElementById("__vp-quiz-style")).not.toBeNull();
  });

  it("omits the quiz slot when the quiz config is invalid", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    addConfig({
      ...VALID_CONFIG,
      // correctOptionId names no option, so the question — and the break — drop.
      quiz: {
        quizzes: [
          {
            id: "q",
            t: 10,
            questions: [
              {
                id: "q1",
                prompt: "p",
                correctOptionId: "zzz",
                options: [{ id: "a", text: "a" }],
              },
            ],
          },
        ],
      },
    });
    addPlayer();
    await load();

    expect(document.getElementById("vp-slot-tl")).not.toBeNull();
    expect(document.getElementById("vp-slot-quiz")).toBeNull();
  });
});
