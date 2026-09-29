import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerApi } from "../../common/types";

// P6: LearningSuite inserts its lesson column next to <main> whenever the window
// crosses 1536px after our mount (spec M15: the player went 553×312 → 317×179).
// The desktop host now watches <main>'s flex parent and hides such siblings,
// restoring them on teardown. Harness: the flex-sibling setup from
// safety-net.test.ts, with <main> and the sidebar given real-looking boxes so
// tryFlexSibling succeeds.

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
  (window as unknown as { player: PlayerApi }).player = stub;
}

function addConfig(): HTMLPreElement {
  const pre = document.createElement("pre");
  pre.setAttribute("data-vp-config", "");
  pre.textContent = JSON.stringify({
    phases: [
      {
        id: "p1",
        title: "Phase",
        description: "d",
        startTimeSec: 0,
        endTimeSec: 60,
        interventions: [],
      },
    ],
    sciences: [],
    audios: [],
    metaSteps: [],
  });
  document.body.appendChild(pre);
  const host = document.createElement("div");
  host.appendChild(document.createElement("hls-video"));
  document.body.appendChild(host);
  return pre;
}

function rect(width: number, height: number, left = 0): DOMRect {
  return {
    width,
    height,
    top: 0,
    left,
    right: left + width,
    bottom: height,
    x: left,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

const nextFrames = (): Promise<void> =>
  new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
// MutationObserver callbacks are delivered as a microtask; a macrotask is a
// safe upper bound.
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

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

let flexParent: HTMLElement;
let main: HTMLElement;

// sized: whether <main> gets a layout box (flex sibling) or not (fixed rail).
async function mount(sized = true): Promise<void> {
  installPlayerStub();
  flexParent = document.createElement("div");
  main = document.createElement("main");
  flexParent.appendChild(main);
  document.body.appendChild(flexParent);
  addConfig();
  if (sized)
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        if (this.tagName === "MAIN") return rect(600, 400);
        if ((this as HTMLElement).id === "vp-demo-sidebar")
          return rect(340, 400, 620);
        return rect(0, 0);
      },
    );
  await import("../../demo-overlays/index");
  await nextFrames();
}

const sidebar = (): HTMLElement =>
  document.getElementById("vp-demo-sidebar") as HTMLElement;

beforeEach(() => {
  vi.resetModules();
  runCleanups();
  delete (window as unknown as Record<string, unknown>).__vpSidebarTab;
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});

afterEach(() => {
  runCleanups();
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  vi.restoreAllMocks();
});

describe("desktop host: siblings inserted next to <main> after mount", () => {
  it("AC1: hides a sibling inserted after mount", async () => {
    await mount();
    expect(sidebar().parentElement).toBe(flexParent);
    const column = document.createElement("div");
    flexParent.appendChild(column);
    await flush();
    expect(column.style.display).toBe("none");
  });

  it("AC2: teardown restores the inserted sibling's original display", async () => {
    await mount();
    const column = document.createElement("div");
    column.style.display = "flex";
    flexParent.appendChild(column);
    await flush();
    expect(column.style.display).toBe("none");
    runCleanups();
    expect(column.style.display).toBe("flex");
  });

  it("a removed and re-inserted sibling stays hidden and still restores its original value", async () => {
    await mount();
    const column = document.createElement("div");
    column.style.display = "flex";
    flexParent.appendChild(column);
    await flush();
    column.remove();
    await flush();
    flexParent.appendChild(column);
    await flush();
    expect(column.style.display).toBe("none");
    runCleanups();
    expect(column.style.display).toBe("flex");
  });

  it("a moved sibling (remove + add records) keeps its first-seen display", async () => {
    await mount();
    const column = document.createElement("div");
    column.style.display = "flex";
    flexParent.appendChild(column);
    await flush();
    flexParent.insertBefore(column, main);
    await flush();
    expect(column.style.display).toBe("none");
    runCleanups();
    expect(column.style.display).toBe("flex");
  });

  it("ignores text nodes and our own sidebar", async () => {
    await mount();
    flexParent.appendChild(document.createTextNode("x"));
    flexParent.appendChild(sidebar());
    await flush();
    expect(sidebar().style.display).toBe("flex");
  });

  it("never hides a <main> or an element wrapping one", async () => {
    await mount();
    const newMain = document.createElement("main");
    const wrapper = document.createElement("div");
    wrapper.appendChild(document.createElement("main"));
    flexParent.append(newMain, wrapper);
    await flush();
    expect(newMain.style.display).toBe("");
    expect(wrapper.style.display).toBe("");
  });

  it("the fixed-rail fallback installs no watcher", async () => {
    await mount(false);
    expect(sidebar().parentElement).toBe(document.body);
    const column = document.createElement("div");
    flexParent.appendChild(column);
    await flush();
    expect(column.style.display).toBe("");
  });

  it("AC4: hiding an inserted sibling does not remount the overlays", async () => {
    await mount();
    const slot = document.getElementById("vp-slot-tl");
    flexParent.appendChild(document.createElement("div"));
    await new Promise((r) => setTimeout(r, 220));
    await nextFrames();
    expect(document.getElementById("vp-slot-tl")).toBe(slot);
  });

  it("stops watching after teardown", async () => {
    await mount();
    runCleanups();
    const column = document.createElement("div");
    flexParent.appendChild(column);
    await flush();
    expect(column.style.display).toBe("");
  });
});
