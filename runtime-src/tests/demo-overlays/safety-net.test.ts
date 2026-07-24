import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerApi } from "../../common/types";

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
    setOverlays() {},
  };
  (window as unknown as { player: PlayerApi }).player = stub;
}

// A `<pre data-vp-config>` + a player host, matching demo-overlays' gate.
function addConfig(config: unknown): void {
  const pre = document.createElement("pre");
  pre.setAttribute("data-vp-config", "");
  pre.textContent = JSON.stringify(config);
  document.body.appendChild(pre);
  const host = document.createElement("div");
  host.appendChild(document.createElement("hls-video"));
  document.body.appendChild(host);
}

function rect(width: number, height: number): DOMRect {
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
}

const nextFrames = (): Promise<void> =>
  new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

const VALID_CONFIG = {
  phases: [
    {
      id: "p1",
      title: "P1",
      description: "d",
      startTimeSec: 0,
      endTimeSec: 60,
      interventions: [],
    },
  ],
  sciences: [],
  audios: [],
  metaSteps: [],
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
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  vi.restoreAllMocks();
});

describe("demo applySetup rollback (F2)", () => {
  it("AC2: a throw during setup removes the slots + sidebar it mounted", async () => {
    installPlayerStub();
    // Empty phases: mounting reaches `phases[0].id` and throws AFTER the slots
    // and sidebar are created — the catch must restore the host DOM.
    addConfig({ phases: [], sciences: [], audios: [], metaSteps: [] });

    await import("../../demo-overlays/index");
    await nextFrames();

    expect(document.getElementById("vp-demo-sidebar")).toBeNull();
    expect(document.getElementById("vp-slot-tl")).toBeNull();
    expect(document.getElementById("vp-slot-br")).toBeNull();
  });
});

describe("demo flex-sibling precondition (F3)", () => {
  it("AC2: an unsized <main> skips the invasive reshuffle (siblings untouched, fixed rail used)", async () => {
    installPlayerStub();
    const flexParent = document.createElement("div");
    const main = document.createElement("main");
    const sibling = document.createElement("div");
    sibling.className = "other-content";
    flexParent.append(main, sibling);
    document.body.appendChild(flexParent);
    addConfig(VALID_CONFIG);
    // happy-dom reports a zero box for <main> → precondition fails.

    await import("../../demo-overlays/index");
    await nextFrames();

    // The sibling was never hidden, and the sidebar mounted via the fixed rail.
    expect(sibling.style.display).not.toBe("none");
    const sidebar = document.getElementById("vp-demo-sidebar");
    expect(sidebar).not.toBeNull();
    expect(sidebar?.parentElement).toBe(document.body);
  });

  it("AC3: a normal (sized) layout still mounts the sidebar as a flex sibling", async () => {
    installPlayerStub();
    const flexParent = document.createElement("div");
    const main = document.createElement("main");
    flexParent.appendChild(main);
    document.body.appendChild(flexParent);
    addConfig(VALID_CONFIG);

    // Sized main + a sidebar box that fits to its right, inside the viewport.
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        if (this.tagName === "MAIN") return rect(600, 400);
        if ((this as HTMLElement).id === "vp-demo-sidebar") {
          const r = rect(340, 400);
          return { ...r, left: 620, right: 960, x: 620 } as DOMRect;
        }
        return rect(0, 0);
      },
    );

    await import("../../demo-overlays/index");
    await nextFrames();

    const sidebar = document.getElementById("vp-demo-sidebar");
    expect(sidebar).not.toBeNull();
    expect(sidebar?.parentElement).toBe(flexParent);
  });
});
