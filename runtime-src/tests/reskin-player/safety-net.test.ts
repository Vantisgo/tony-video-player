import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SRC =
  "https://vz.example.com/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/playlist.m3u8";

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

interface VideoHandle {
  host: HTMLElement;
  video: HTMLElement & { __vpAttached?: boolean };
}

function setupDom(): VideoHandle {
  const cfg = document.createElement("pre");
  cfg.setAttribute("data-vp-config", "");
  cfg.textContent = "{}";
  document.body.appendChild(cfg);

  const host = document.createElement("div");
  const video = document.createElement("hls-video");
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
  return { host, video: video as HTMLElement & { __vpAttached?: boolean } };
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

function runCleanup(): void {
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
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: false, json: async () => null })),
  );
});

afterEach(() => {
  runCleanup();
  (
    window as unknown as { __vpReskinCleanup?: Array<() => void> }
  ).__vpReskinCleanup = [];
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("reskin attach rollback (F2)", () => {
  it("AC1: a throw after the shell mounts rolls back every host mutation", async () => {
    const { host, video } = setupDom();
    // Fault: a throwing DOM accessor on the media element. The silencer resolves
    // the inner <video> through `shadowRoot` while attachInner runs — after the
    // marker and shell are mounted — so this exercises the same
    // "host surface broke mid-attach" path the old audioTracks fault did.
    // (audioTracks itself is no longer read: the native/HLS track menus that
    // used it were deleted on 2026-09-07.)
    Object.defineProperty(video, "shadowRoot", {
      configurable: true,
      get() {
        throw new Error("host shadowRoot blew up");
      },
    });

    await import("../../reskin-player/index");
    await Promise.resolve();

    expect(document.querySelector(".vp-shell")).toBeNull();
    expect(host.dataset.vpReskinned).toBeUndefined();
    expect(video.__vpAttached).toBeUndefined();
  });
});

describe("reskin shell precondition (F3)", () => {
  it("AC1: a missing required shell node bails with no chrome hidden and no partial shell", async () => {
    const { host, video } = setupDom();
    const original = Element.prototype.querySelector;
    vi.spyOn(Element.prototype, "querySelector").mockImplementation(function (
      this: Element,
      selector: string,
    ) {
      if (selector === "[data-vp-subtitles]") return null;
      return original.call(this, selector) as Element | null;
    });

    await import("../../reskin-player/index");
    await Promise.resolve();

    expect(document.querySelector(".vp-shell")).toBeNull();
    expect(host.dataset.vpReskinned).toBeUndefined();
    expect(video.__vpAttached).toBeUndefined();
  });
});

describe("reskin post-attach self-verification (F4)", () => {
  it("AC1: tears down when the shell has a zero box over a visible player", async () => {
    const { host, video } = setupDom();
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        if (this.tagName === "HLS-VIDEO") return rect(640, 360);
        if ((this as HTMLElement).classList?.contains("vp-shell"))
          return rect(0, 0);
        return rect(0, 0);
      },
    );

    await import("../../reskin-player/index");
    await nextFrames();

    expect(document.querySelector(".vp-shell")).toBeNull();
    expect(host.dataset.vpReskinned).toBeUndefined();
    expect(video.__vpAttached).toBeUndefined();
  });

  it("AC2: does NOT tear down an off-screen player (both boxes zero)", async () => {
    setupDom();
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      () => rect(0, 0),
    );

    await import("../../reskin-player/index");
    await nextFrames();

    // Off-screen: attached, waiting to be laid out — not torn down.
    expect(document.querySelector(".vp-shell")).not.toBeNull();
  });

  it("AC3: a correctly-sized shell passes verification (no teardown)", async () => {
    setupDom();
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        if (this.tagName === "HLS-VIDEO") return rect(640, 360);
        if ((this as HTMLElement).classList?.contains("vp-shell"))
          return rect(640, 300);
        return rect(0, 0);
      },
    );

    await import("../../reskin-player/index");
    await nextFrames();

    expect(document.querySelector(".vp-shell")).not.toBeNull();
  });
});
