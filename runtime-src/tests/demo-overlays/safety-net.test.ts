import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerApi } from "../../common/types";

function installPlayerStub(opts: { throwOnSubscribe?: boolean } = {}): void {
  const stub: PlayerApi = {
    get current() {
      return 0;
    },
    duration: 100,
    play() {},
    pause() {},
    seek() {},
    // Fault injection point for the rollback test. It used to be setOverlays(),
    // which ran last in the mount; that member was removed from PlayerApi on
    // 2026-09-07 along with the overlay layer it fed. `on()` inherits the role —
    // it is now the last player-API call in mountInner, so a throw here still
    // guarantees the slots and sidebar already exist and must be swept back up.
    on: () => {
      if (opts.throwOnSubscribe) throw new Error("injected mount failure");
      return () => {};
    },
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
    installPlayerStub({ throwOnSubscribe: true });
    vi.spyOn(console, "error").mockImplementation(() => {});
    addConfig(VALID_CONFIG);

    await import("../../demo-overlays/index");
    await nextFrames();

    expect(document.getElementById("vp-demo-sidebar")).toBeNull();
    expect(document.getElementById("vp-slot-tl")).toBeNull();
    expect(document.getElementById("vp-slot-br")).toBeNull();
  });

  it("an empty config section is no longer a fault — it mounts and renders nothing", async () => {
    installPlayerStub();
    // Previously this threw at `phases[0].id`. Absent sections are now a
    // supported, silent no-op (the DEFAULT_* sample data needs `demo: true`).
    addConfig({ phases: [], sciences: [], audios: [], metaSteps: [] });

    await import("../../demo-overlays/index");
    await nextFrames();

    // Slots still mount (they are invisible when empty), but nothing claims the
    // host layout: with no section content there is no sidebar at all.
    expect(document.getElementById("vp-slot-tl")).not.toBeNull();
    expect(document.getElementById("vp-demo-sidebar")).toBeNull();
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
