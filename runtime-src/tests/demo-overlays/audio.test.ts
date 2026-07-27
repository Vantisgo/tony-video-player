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

const SIGNED_HREF =
  "https://storage.googleapis.com/ls-prod/courses/steps/cmrz0mmse1i4xbu01ps23bygk?X-Goog-Expires=604800";

function addAttachment(text: string, href: string = SIGNED_HREF): void {
  const a = document.createElement("a");
  a.setAttribute("href", href);
  a.textContent = text;
  document.body.appendChild(a);
}

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

const audioConfig = (audio: Record<string, unknown>) => ({
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
  it("plays the resolved attachment, pauses the video, and shows the banner", async () => {
    addAttachment("Intro.mp3");
    const { video, audio, slot } = await mountAndTrigger(
      audioConfig({ ...CUE, audioFile: "Intro.mp3" }),
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
    addAttachment("Intro.mp3");
    const { audio, slot } = await mountAndTrigger(
      audioConfig({ ...CUE, audioFile: "Intro.mp3" }),
    );

    audio.currentTime = 7;
    audio.dispatchEvent(new Event("timeupdate"));

    expect(ctrl().audioTime).toBe(7);
    const fill = slot.querySelector("[data-fill]") as HTMLElement;
    expect(fill.style.width).toBe("35%");
  });

  it("caps the progress clock at the configured duration", async () => {
    addAttachment("Intro.mp3");
    const { audio } = await mountAndTrigger(
      audioConfig({ ...CUE, audioFile: "Intro.mp3" }),
    );

    audio.currentTime = 99;
    audio.dispatchEvent(new Event("timeupdate"));

    expect(ctrl().audioTime).toBe(20);
  });

  it("ends the cue and resumes the video when the file finishes", async () => {
    addAttachment("Intro.mp3");
    const { video, audio, slot } = await mountAndTrigger(
      audioConfig({ ...CUE, audioFile: "Intro.mp3" }),
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
    addAttachment("Intro.mp3");
    const { audio, slot } = await mountAndTrigger(
      audioConfig({ ...CUE, audioFile: "Intro.mp3" }),
    );

    audio.currentTime = 1;
    audio.dispatchEvent(new Event("timeupdate"));
    (slot.querySelector('[data-action="audio-fwd"]') as HTMLElement).click();

    expect(audio.currentTime).toBe(11);
    expect(ctrl().audioTime).toBe(11);
  });

  it("re-arms the cue after a rewind past its trigger", async () => {
    addAttachment("Intro.mp3");
    const { audio, slot } = await mountAndTrigger(
      audioConfig({ ...CUE, audioFile: "Intro.mp3" }),
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
    addAttachment("Intro.mp3");
    const { audio, slot } = await mountAndTrigger(
      audioConfig({ ...CUE, audioFile: "Intro.mp3" }),
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

  it("keeps a single <audio> element and listener set across re-injection", async () => {
    addAttachment("Intro.mp3");
    await mountAndTrigger(audioConfig({ ...CUE, audioFile: "Intro.mp3" }));

    vi.resetModules();
    await import("../../demo-overlays/index");
    await nextFrames();

    expect(document.querySelectorAll("audio")).toHaveLength(1);
  });
});

describe("audio cue: TTS fallback", () => {
  it("stays in TTS mode when no attachment matches, banner still shown", async () => {
    addAttachment("Outro.mp3");
    const { video, audio, slot } = await mountAndTrigger(
      audioConfig({ ...CUE, audioFile: "Intro.mp3" }),
    );

    expect(audio.hasAttribute("src")).toBe(false);
    expect(ctrl().mode).toBe("tts");
    expect(ctrl().state).toBe("playing");
    expect(video.paused).toBe(true);
    expect(slot.dataset.kind).toBe("audio");
  });

  it("stays in TTS mode for a cue without audioFile (existing configs)", async () => {
    addAttachment("Intro.mp3");
    const { audio, slot } = await mountAndTrigger(audioConfig(CUE));

    expect(audio.hasAttribute("src")).toBe(false);
    expect(ctrl().mode).toBe("tts");
    expect(slot.dataset.kind).toBe("audio");
  });

  it("skips a matching attachment whose href is not https", async () => {
    addAttachment("Intro.mp3", "javascript:alert('/courses/steps/x')");
    const { audio } = await mountAndTrigger(
      audioConfig({ ...CUE, audioFile: "Intro.mp3" }),
    );

    expect(audio.hasAttribute("src")).toBe(false);
    expect(ctrl().mode).toBe("tts");
  });

  it("falls back when play() is rejected by the autoplay policy", async () => {
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(() =>
      Promise.reject(new Error("blocked")),
    );
    addAttachment("Intro.mp3");
    installPlayerStub();
    setupConfigDom(audioConfig({ ...CUE, audioFile: "Intro.mp3" }));
    await import("../../demo-overlays/index");
    await nextFrames();
    emitTime(2);
    await nextFrames();

    expect(ctrl().mode).toBe("tts");
    expect(ctrl().state).toBe("playing");
  });

  it("falls back when the element reports a load error", async () => {
    addAttachment("Intro.mp3");
    const { audio, slot } = await mountAndTrigger(
      audioConfig({ ...CUE, audioFile: "Intro.mp3" }),
    );
    expect(ctrl().mode).toBe("file");

    audio.dispatchEvent(new Event("error"));

    expect(ctrl().mode).toBe("tts");
    expect(ctrl().state).toBe("playing");
    expect(audio.paused).toBe(true);
    expect(slot.dataset.kind).toBe("audio");
  });

  it("ignores an audio 'ended' event once the cue fell back to TTS", async () => {
    addAttachment("Intro.mp3");
    const { audio } = await mountAndTrigger(
      audioConfig({ ...CUE, audioFile: "Intro.mp3" }),
    );
    audio.dispatchEvent(new Event("error"));

    audio.dispatchEvent(new Event("ended"));

    expect(ctrl().state).toBe("playing");
  });

  it("clears the audio src when a cue that fell back to TTS ends", async () => {
    addAttachment("Intro.mp3");
    const { audio, slot } = await mountAndTrigger(
      audioConfig({ ...CUE, audioFile: "Intro.mp3" }),
    );
    audio.dispatchEvent(new Event("error"));

    (slot.querySelector('[data-action="audio-skip"]') as HTMLElement).click();

    expect(ctrl().state).toBe("idle");
    expect(audio.hasAttribute("src")).toBe(false);
  });

  it("does not let an ended file cue leave the simulated clock running", async () => {
    addAttachment("Intro.mp3");
    const { audio } = await mountAndTrigger(
      audioConfig({ ...CUE, audioFile: "Intro.mp3" }),
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
