import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerApi, PlayerEvent } from "../../common/types";

type BusHandler = (payload: PlayerEvent) => void;
let busHandlers: BusHandler[] = [];
let currentTime = 0;

// Stub the window.player API that demo-overlays consumes from reskin-player.
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

// A real <video> marked with the [data-vp-player] contract, so the controller
// drives an actual HTMLMediaElement (pause on cue, resume on end) instead of the
// unknown <hls-video> element the render tests use.
function setupConfigDom(config: unknown): HTMLVideoElement {
  const pre = document.createElement("pre");
  pre.setAttribute("data-vp-config", "");
  pre.textContent = JSON.stringify(config);
  document.body.appendChild(pre);
  const host = document.createElement("div");
  const video = document.createElement("video");
  video.setAttribute("data-vp-player", "");
  host.appendChild(video);
  document.body.appendChild(host);
  return video;
}

// What the platform renders in place of `{{asset:…}}`: a freshly signed GCS URL.
const SIGNED_HREF =
  "https://storage.googleapis.com/ls-prod/courses/steps/cmrz0mmse1i4xbu01ps23bygk?X-Goog-Expires=604800";

const nextFrames = (): Promise<void> =>
  new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

interface AudioCtrlProbe {
  state: "idle" | "playing" | "paused";
  mode: "tts" | "file";
  audioTime: number;
  audioEl: HTMLAudioElement | null;
}

const ctrl = (): AudioCtrlProbe =>
  (window as unknown as { __audioCtrl?: AudioCtrlProbe }).__audioCtrl!;

const audioConfig = (
  audio: Record<string, unknown>,
  assets?: Record<string, string>,
) => ({
  phases: [
    {
      id: "p1",
      title: "Phase One",
      description: "d1",
      startTimeSec: 0,
      endTimeSec: 60,
      interventions: [],
    },
  ],
  sciences: [],
  audios: [audio],
  metaSteps: [],
  ...(assets ? { assets } : {}),
});

const CUE = {
  id: "a1",
  t: 2,
  dur: 20,
  title: "Voice-Over: Intro",
  voice: "Fred",
  script: "Gesprochener Text",
};

// Mount the runtime and drive the video to the cue's trigger time.
async function mountAndTrigger(config: unknown): Promise<{
  video: HTMLVideoElement;
  audio: HTMLAudioElement;
  slot: HTMLElement;
}> {
  installPlayerStub();
  const video = setupConfigDom(config);
  await import("../../demo-overlays/index");
  await nextFrames();
  // The learner was watching, so the video is playing when the cue fires.
  await video.play();
  emitTime(2);
  return {
    video,
    audio: document.querySelector("audio") as HTMLAudioElement,
    slot: document.getElementById("vp-slot-lt") as HTMLElement,
  };
}

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
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});

describe("audio cue: file mode", () => {
  it("plays the inline expanded placeholder, pauses the video, and shows the banner", async () => {
    const { video, audio, slot } = await mountAndTrigger(
      audioConfig({ ...CUE, asset: SIGNED_HREF }),
    );

    expect(audio).not.toBeNull();
    expect(audio.getAttribute("src")).toBe(SIGNED_HREF);
    // No `crossorigin`: the signed GCS URL plays in no-cors mode.
    expect(audio.hasAttribute("crossorigin")).toBe(false);
    expect(audio.paused).toBe(false);
    expect(video.paused).toBe(true);
    expect(ctrl().mode).toBe("file");
    expect(slot.dataset.kind).toBe("audio");
  });

  it("drives the progress clock from the element's real playback time", async () => {
    const { audio, slot } = await mountAndTrigger(
      audioConfig({ ...CUE, asset: SIGNED_HREF }),
    );

    audio.currentTime = 7;
    audio.dispatchEvent(new Event("timeupdate"));

    expect(ctrl().audioTime).toBe(7);
    const fill = slot.querySelector("[data-fill]") as HTMLElement;
    expect(fill.style.width).toBe("35%");
  });

  it("caps the progress clock at the configured duration", async () => {
    const { audio } = await mountAndTrigger(
      audioConfig({ ...CUE, asset: SIGNED_HREF }),
    );

    audio.currentTime = 99;
    audio.dispatchEvent(new Event("timeupdate"));

    expect(ctrl().audioTime).toBe(20);
  });

  it("ends the cue and resumes the video when the file finishes", async () => {
    const { video, audio, slot } = await mountAndTrigger(
      audioConfig({ ...CUE, asset: SIGNED_HREF }),
    );

    audio.dispatchEvent(new Event("ended"));

    expect(ctrl().state).toBe("idle");
    expect(ctrl().mode).toBe("tts");
    expect(audio.hasAttribute("src")).toBe(false);
    expect(video.paused).toBe(false);
    expect(video.currentTime).toBe(2);
    expect(slot.dataset.kind).toBe("");
    expect(slot.innerHTML).toBe("");
  });

  it("seeks the real audio element from the ±10s controls", async () => {
    const { audio, slot } = await mountAndTrigger(
      audioConfig({ ...CUE, asset: SIGNED_HREF }),
    );

    audio.currentTime = 1;
    audio.dispatchEvent(new Event("timeupdate"));
    (slot.querySelector('[data-action="audio-fwd"]') as HTMLElement).click();

    expect(audio.currentTime).toBe(11);
    expect(ctrl().audioTime).toBe(11);
  });

  it("re-arms the cue after a rewind past its trigger", async () => {
    const { audio, slot } = await mountAndTrigger(
      audioConfig({ ...CUE, asset: SIGNED_HREF }),
    );
    audio.dispatchEvent(new Event("ended"));
    expect(audio.hasAttribute("src")).toBe(false);

    // Rewind before t - 0.5 clears `triggered`, so crossing t plays it again.
    emitTime(0);
    emitTime(2);

    expect(audio.getAttribute("src")).toBe(SIGNED_HREF);
    expect(ctrl().mode).toBe("file");
    expect(slot.dataset.kind).toBe("audio");
  });

  it("pauses and resumes the real audio element from the play/pause control", async () => {
    const { audio, slot } = await mountAndTrigger(
      audioConfig({ ...CUE, asset: SIGNED_HREF }),
    );
    const playPause = slot.querySelector(
      '[data-action="audio-playpause"]',
    ) as HTMLElement;

    playPause.click();
    expect(ctrl().state).toBe("paused");
    expect(audio.paused).toBe(true);

    playPause.click();
    expect(ctrl().state).toBe("playing");
    expect(audio.paused).toBe(false);
  });

  it("resolves an asset key through the config's assets table", async () => {
    const { audio, video } = await mountAndTrigger(
      audioConfig({ ...CUE, asset: "intro" }, { intro: SIGNED_HREF }),
    );

    expect(audio.getAttribute("src")).toBe(SIGNED_HREF);
    expect(ctrl().mode).toBe("file");
    expect(video.paused).toBe(true);
  });

  it("plays the same asset for two cues that share one table key", async () => {
    const config = {
      phases: [],
      sciences: [],
      metaSteps: [],
      assets: { sting: SIGNED_HREF },
      audios: [
        { ...CUE, id: "a1", t: 2, asset: "sting" },
        { ...CUE, id: "a2", t: 40, asset: "sting" },
      ],
    };
    const { audio, slot } = await mountAndTrigger(config);
    expect(audio.getAttribute("src")).toBe(SIGNED_HREF);

    // First cue ends, second cue fires later and resolves the same key again.
    audio.dispatchEvent(new Event("ended"));
    expect(audio.hasAttribute("src")).toBe(false);
    emitTime(40);

    expect(audio.getAttribute("src")).toBe(SIGNED_HREF);
    expect(slot.dataset.activeAudio).toBe("a2");
  });

  it("keeps a single <audio> element and listener set across re-injection", async () => {
    await mountAndTrigger(audioConfig({ ...CUE, asset: SIGNED_HREF }));

    vi.resetModules();
    await import("../../demo-overlays/index");
    await nextFrames();

    expect(document.querySelectorAll("audio")).toHaveLength(1);
  });
});

describe("audio cue: TTS fallback", () => {
  it("stays in TTS mode when the asset key is not in the table, banner still shown", async () => {
    const { video, audio, slot } = await mountAndTrigger(
      audioConfig({ ...CUE, asset: "intro" }, { outro: SIGNED_HREF }),
    );

    expect(audio.hasAttribute("src")).toBe(false);
    expect(ctrl().mode).toBe("tts");
    expect(ctrl().state).toBe("playing");
    expect(video.paused).toBe(true);
    expect(slot.dataset.kind).toBe("audio");
  });

  it("stays in TTS mode for a cue with no asset at all (TTS by design)", async () => {
    const { audio, slot } = await mountAndTrigger(audioConfig(CUE));

    expect(audio.hasAttribute("src")).toBe(false);
    expect(ctrl().mode).toBe("tts");
    expect(slot.dataset.kind).toBe("audio");
  });

  it("refuses a non-https asset rather than assigning it to the media src", async () => {
    const { audio } = await mountAndTrigger(
      audioConfig({ ...CUE, asset: "javascript:alert(1)" }),
    );

    expect(audio.hasAttribute("src")).toBe(false);
    expect(ctrl().mode).toBe("tts");
  });

  it("falls back — loudly — when the placeholder was never expanded", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { audio, video, slot } = await mountAndTrigger(
      audioConfig({ ...CUE, asset: "{{asset:2025-12-22-at-00-22-27-intro}}" }),
    );

    // Graceful for the learner: the cue still runs, spoken from `script`.
    expect(audio.hasAttribute("src")).toBe(false);
    expect(ctrl().mode).toBe("tts");
    expect(ctrl().state).toBe("playing");
    expect(video.paused).toBe(true);
    expect(slot.dataset.kind).toBe("audio");
    // Loud for the operator: the cue id and the actionable hint are both named.
    expect(warn).toHaveBeenCalled();
    const message = warn.mock.calls.map((call) => String(call[0])).join("\n");
    expect(message).toContain('audio cue "a1"');
    expect(message).toContain("In Seite anzeigen");
  });

  it("names the cue in the warning when an asset key is missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await mountAndTrigger(audioConfig({ ...CUE, asset: "intro" }));

    const message = warn.mock.calls.map((call) => String(call[0])).join("\n");
    expect(message).toContain('audio cue "a1"');
    expect(message).toContain("config.assets");
  });

  it("falls back when play() is rejected by the autoplay policy", async () => {
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(() =>
      Promise.reject(new Error("blocked")),
    );
    installPlayerStub();
    setupConfigDom(audioConfig({ ...CUE, asset: SIGNED_HREF }));
    await import("../../demo-overlays/index");
    await nextFrames();
    emitTime(2);
    await nextFrames();

    expect(ctrl().mode).toBe("tts");
    expect(ctrl().state).toBe("playing");
  });

  it("falls back when the element reports a load error", async () => {
    const { audio, slot } = await mountAndTrigger(
      audioConfig({ ...CUE, asset: SIGNED_HREF }),
    );
    expect(ctrl().mode).toBe("file");

    audio.dispatchEvent(new Event("error"));

    expect(ctrl().mode).toBe("tts");
    expect(ctrl().state).toBe("playing");
    expect(audio.paused).toBe(true);
    expect(slot.dataset.kind).toBe("audio");
  });

  it("ignores an audio 'ended' event once the cue fell back to TTS", async () => {
    const { audio } = await mountAndTrigger(
      audioConfig({ ...CUE, asset: SIGNED_HREF }),
    );
    audio.dispatchEvent(new Event("error"));

    audio.dispatchEvent(new Event("ended"));

    expect(ctrl().state).toBe("playing");
  });

  it("clears the audio src when a cue that fell back to TTS ends", async () => {
    const { audio, slot } = await mountAndTrigger(
      audioConfig({ ...CUE, asset: SIGNED_HREF }),
    );
    audio.dispatchEvent(new Event("error"));

    (slot.querySelector('[data-action="audio-skip"]') as HTMLElement).click();

    expect(ctrl().state).toBe("idle");
    expect(audio.hasAttribute("src")).toBe(false);
  });

  it("does not let an ended file cue leave the simulated clock running", async () => {
    const { audio } = await mountAndTrigger(
      audioConfig({ ...CUE, asset: SIGNED_HREF }),
    );

    vi.useFakeTimers();
    audio.currentTime = 5;
    audio.dispatchEvent(new Event("timeupdate"));
    vi.advanceTimersByTime(1000);
    vi.useRealTimers();

    // File mode takes its clock from timeupdate only — no simulated advance.
    expect(ctrl().audioTime).toBe(5);
  });
});
