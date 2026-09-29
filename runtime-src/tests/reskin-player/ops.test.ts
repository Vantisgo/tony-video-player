import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGIN = "https://cdn.example.com";
const SCRIPT_SRC = `${ORIGIN}/runtime/reskin-player.js`;
const TELEMETRY_URL = `${ORIGIN}/api/runtime-telemetry`;

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

let sendBeacon: ReturnType<typeof vi.fn>;

// Resolve the runtime origin via the __vpRuntimeBaseUrl override (avoids
// happy-dom trying to network-load a real <script src>).
function addRuntimeScript(): void {
  (window as unknown as { __vpRuntimeBaseUrl?: string }).__vpRuntimeBaseUrl =
    SCRIPT_SRC;
}

function addConfig(): void {
  const pre = document.createElement("pre");
  pre.setAttribute("data-vp-config", "");
  pre.textContent = JSON.stringify({ phases: [] });
  document.body.appendChild(pre);
}

function addPlayer(faultyAudioTracks = false): HTMLElement {
  const host = document.createElement("div");
  const video = document.createElement("hls-video");
  video.setAttribute(
    "src",
    `${ORIGIN}/vid/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/playlist.m3u8`,
  );
  const v = video as unknown as StubMedia;
  v.play = () => {};
  v.pause = () => {};
  v.currentTime = 0;
  v.duration = 100;
  v.paused = true;
  v.muted = false;
  v.playbackRate = 1;
  v.ended = false;
  // See safety-net.test.ts: the attach-time fault is now a throwing
  // `shadowRoot`, which the silencer touches while resolving the inner <video>.
  // audioTracks is no longer read anywhere in the reskin.
  if (faultyAudioTracks)
    Object.defineProperty(video, "shadowRoot", {
      configurable: true,
      get() {
        throw new Error("host shadowRoot blew up");
      },
    });
  host.appendChild(video);
  document.body.appendChild(host);
  return host;
}

const settle = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

async function beaconBody(): Promise<Record<string, unknown>> {
  const blob = sendBeacon.mock.calls[0][1] as Blob;
  return JSON.parse(await blob.text());
}

function stubFlagFetch(enabled: boolean | "error"): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      enabled === "error"
        ? Promise.resolve({ ok: false, json: async () => ({}) })
        : Promise.resolve({ ok: true, json: async () => ({ enabled }) }),
    ),
  );
}

beforeEach(() => {
  vi.resetModules();
  sendBeacon = vi.fn(() => true);
  vi.stubGlobal("navigator", { language: "en", sendBeacon });
});

afterEach(() => {
  const cleanup = (
    window as unknown as { __vpReskinCleanup?: Array<() => void> }
  ).__vpReskinCleanup;
  if (Array.isArray(cleanup)) cleanup.forEach((fn) => fn());
  (
    window as unknown as { __vpReskinCleanup?: Array<() => void> }
  ).__vpReskinCleanup = [];
  delete (window as unknown as { __vpRuntimeBaseUrl?: string })
    .__vpRuntimeBaseUrl;
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("reskin kill-switch (F5)", () => {
  it("AC1: enabled:false → no shell, no CSS injected, native player untouched", async () => {
    stubFlagFetch(false);
    addRuntimeScript();
    addConfig();
    addPlayer();

    await import("../../reskin-player/index");
    await settle();

    expect(document.querySelector(".vp-shell")).toBeNull();
    expect(document.getElementById("__custom-player-style")).toBeNull();
    expect(
      (window as unknown as { __vpReskinStatus?: string }).__vpReskinStatus,
    ).toBe("reskin disabled by kill-switch");
  });

  it("AC3: a page with config but no player never injects the chrome-hiding CSS", async () => {
    stubFlagFetch("error"); // fail open → runtime runs
    addRuntimeScript();
    addConfig();
    // no player element

    await import("../../reskin-player/index");
    await settle();

    expect(document.getElementById("__custom-player-style")).toBeNull();
  });
});

describe("reskin failure telemetry (F6)", () => {
  it("AC1: a failed attach beacons once with the correct errorType", async () => {
    stubFlagFetch("error");
    addRuntimeScript();
    addConfig();
    addPlayer(true); // shadowRoot getter throws during attach

    await import("../../reskin-player/index");
    await settle();

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.calls[0][0]).toBe(TELEMETRY_URL);
    const body = await beaconBody();
    expect(body.errorType).toBe("reskin-attach-error");
    expect(body).toHaveProperty("videoId");
    expect(body).toHaveProperty("config");
  });

  it("AC2: a successful attach emits no beacon", async () => {
    stubFlagFetch("error");
    addRuntimeScript();
    addConfig();
    addPlayer(); // clean

    await import("../../reskin-player/index");
    await settle();

    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("AC3: no-player-after-deadline beacons only after the grace period, with config present", async () => {
    vi.useFakeTimers();
    stubFlagFetch("error");
    addRuntimeScript();
    addConfig();
    // no player element

    await import("../../reskin-player/index");
    await vi.advanceTimersByTimeAsync(9000);
    expect(sendBeacon).not.toHaveBeenCalled(); // before the deadline

    await vi.advanceTimersByTimeAsync(2000);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const blob = sendBeacon.mock.calls[0][1] as Blob;
    expect(JSON.parse(await blob.text()).errorType).toBe(
      "reskin-no-player-after-deadline",
    );
  });
});
