import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VIDEO_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const SRC = `https://vz.example.com/${VIDEO_ID}/playlist.m3u8`;

interface StubMedia {
  play(): void;
  pause(): void;
  currentTime: number;
  duration: number;
  paused: boolean;
  muted: boolean;
  playbackRate: number;
  ended: boolean;
}

// Mount a `[data-vp-config]` gate + a player element of the given tag, wired
// with the minimal media surface attach() needs.
function setupDom(tag: string): HTMLElement {
  const cfg = document.createElement("pre");
  cfg.setAttribute("data-vp-config", "");
  cfg.textContent = "{}";
  document.body.appendChild(cfg);

  const host = document.createElement("div");
  const video = document.createElement(tag);
  video.setAttribute("src", SRC);
  const v = video as unknown as StubMedia;
  v.play = () => {};
  v.pause = () => {};
  v.currentTime = 0;
  v.duration = 100;
  v.paused = true;
  v.muted = false;
  v.playbackRate = 1;
  v.ended = false;
  host.appendChild(video);
  document.body.appendChild(host);
  return host;
}

// Controllable ResizeObserver so tests can fire the callback deterministically.
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly observed: Element[] = [];
  disconnected = false;
  constructor(private readonly cb: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }
  observe(el: Element): void {
    this.observed.push(el);
  }
  unobserve(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
  fire(): void {
    this.cb([], this as unknown as ResizeObserver);
  }
}

function diag(): { discovery: string; hasVideo: boolean } {
  return (
    window as unknown as {
      player: { _diag: () => { discovery: string; hasVideo: boolean } };
    }
  ).player._diag();
}

beforeEach(() => {
  vi.resetModules();
  FakeResizeObserver.instances.length = 0;
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: false, json: async () => null })),
  );
});

afterEach(() => {
  const cleanup = (
    window as unknown as { __vpReskinCleanup?: Array<() => void> }
  ).__vpReskinCleanup;
  if (Array.isArray(cleanup))
    cleanup.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
  (
    window as unknown as { __vpReskinCleanup?: Array<() => void> }
  ).__vpReskinCleanup = [];
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("reskin discovery (H1)", () => {
  it("AC2: _diag().discovery reports the strategy that matched", async () => {
    setupDom("hls-video");
    await import("../../reskin-player/index");
    await Promise.resolve();

    expect(diag().discovery).toBe("tag:hls-video");
  });

  it("AC1: a renamed custom element forwarding the media API is discovered and reskinned", async () => {
    const host = setupDom("fancy-player");
    await import("../../reskin-player/index");
    await Promise.resolve();

    expect(diag().discovery).toBe("capability");
    expect(diag().hasVideo).toBe(true);
    // The custom control shell is mounted in the resolved host.
    expect(host.querySelector(".vp-shell")).not.toBeNull();
  });
});

describe("reskin host anchoring (H2 AC3)", () => {
  it("observes the media element and re-asserts the positioning context on resize", async () => {
    const host = setupDom("hls-video");
    await import("../../reskin-player/index");
    await Promise.resolve();

    const observer = FakeResizeObserver.instances[0];
    expect(observer).toBeDefined();
    expect(observer.observed[0]).toBe(host.querySelector("hls-video"));

    // Simulate a host re-render that reset the positioning context.
    host.style.position = "static";
    observer.fire();
    expect(host.style.position).toBe("relative");
  });

  it("disconnects the ResizeObserver on teardown", async () => {
    setupDom("hls-video");
    await import("../../reskin-player/index");
    await Promise.resolve();

    const observer = FakeResizeObserver.instances[0];
    const cleanup = (
      window as unknown as { __vpReskinCleanup?: Array<() => void> }
    ).__vpReskinCleanup;
    cleanup?.forEach((fn) => fn());
    expect(observer.disconnected).toBe(true);
  });
});
