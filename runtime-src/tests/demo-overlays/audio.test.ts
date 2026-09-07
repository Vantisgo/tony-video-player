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
  active: { id: string } | null;
}

const ctrl = (): AudioCtrlProbe =>
  (window as unknown as { __audioCtrl?: AudioCtrlProbe }).__audioCtrl!;

// Mirrors MAX_CUE_REPAUSES in demo-overlays/index.ts. Duplicated rather than
// imported: the runtime keeps it module-private, and a test that reads the
// production constant would pass for any value it happened to hold.
const MAX_REPAUSES = 3;

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
    installPlayerStub();
    const video = setupConfigDom(audioConfig({ ...CUE, asset: SIGNED_HREF }));
    await import("../../demo-overlays/index");
    await nextFrames();
    // The learner was watching before the cue came due. This has to happen
    // BEFORE the stub goes in: the stub replaces play() on the prototype, so
    // installing it first would block the video too, leaving it paused — and a
    // paused player means no cue fires at all (see the playback gate in
    // recomputeActive), which is not what this test is about.
    await video.play();
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(() =>
      Promise.reject(new Error("blocked")),
    );
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

// A cue authored at t:0 used to play the moment the runtime mounted, because
// recomputeActive() also runs once at mount with the player's current time and
// maybeTriggerAudio's window test (`t >= a.t && t < a.t + 1.0`) is satisfied by
// 0. Measured on the live tenant before the fix: a 119s voice-over 35s in,
// while the video sat paused at 0:00 having never been played.
describe("audio cue: playback-start gate", () => {
  const CUE_AT_ZERO = { ...CUE, t: 0 };

  // Same as mountAndTrigger, but stops before playing: this is the state the
  // learner is actually in when the page finishes loading.
  async function mountOnly(config: unknown): Promise<{
    video: HTMLVideoElement;
    slot: HTMLElement;
  }> {
    installPlayerStub();
    const video = setupConfigDom(config);
    await import("../../demo-overlays/index");
    await nextFrames();
    return {
      video,
      slot: document.getElementById("vp-slot-lt") as HTMLElement,
    };
  }

  function emitPlay(t: number): void {
    for (const handler of busHandlers) handler({ type: "play", time: t });
  }

  it("injects the white-space reset itself, surviving the owned-id sweep", async () => {
    // Deliberately a MOUNT-level test. The SLOT_CSS cases in render.test.ts
    // append the stylesheet by hand, so they prove the rule's content but not
    // its wiring — and the wiring is what broke: the first cut used the id
    // `vp-slot-style`, which matches the `vp-slot-` prefix the defensive sweep
    // filters on, so the runtime deleted its own stylesheet a few lines after
    // injecting it. Asserting the computed value under a pre-wrap ancestor is
    // what closes that hole.
    const host = document.createElement("div");
    host.style.whiteSpace = "pre-wrap";
    document.body.appendChild(host);
    installPlayerStub();
    const pre = document.createElement("pre");
    pre.setAttribute("data-vp-config", "");
    pre.textContent = JSON.stringify(audioConfig(CUE_AT_ZERO));
    host.appendChild(pre);
    const playerHost = document.createElement("div");
    const video = document.createElement("video");
    video.setAttribute("data-vp-player", "");
    playerHost.appendChild(video);
    host.appendChild(playerHost);
    await import("../../demo-overlays/index");
    await nextFrames();

    expect(document.getElementById("__vp-slot-style")).not.toBeNull();
    const slot = document.getElementById("vp-slot-lt") as HTMLElement;
    expect(slot.className).toBe("vp-slot");
    expect(getComputedStyle(slot).whiteSpace).toBe("normal");
  });

  it("leaves a t:0 cue idle at mount, with the video never played", async () => {
    const { video, slot } = await mountOnly(audioConfig(CUE_AT_ZERO));

    expect(video.paused).toBe(true);
    expect(ctrl().state).toBe("idle");
    expect(slot.dataset.kind).toBeFalsy();
  });

  it("still renders the passive pills while paused at t:0", async () => {
    // Proves only the two trigger calls are gated, not all of recomputeActive.
    // renderMetaStep has no call site outside recomputeActive, so an early
    // return would leave this pill empty on a lesson nobody has started.
    const config = {
      ...audioConfig(CUE_AT_ZERO),
      metaSteps: [{ id: "m1", n: 1, title: "Ankommen", t: 0 }],
    };
    await mountOnly(config);

    const metaSlot = document.getElementById("vp-slot-br") as HTMLElement;
    expect(metaSlot.dataset.kind).toBe("meta");
    expect(metaSlot.textContent).toContain("Ankommen");
    // ...while the cue itself is still holding.
    expect(ctrl().state).toBe("idle");
  });

  it("fires the t:0 cue on the first play and pauses the video for it", async () => {
    const { video, slot } = await mountOnly(audioConfig(CUE_AT_ZERO));
    await video.play();
    emitPlay(0);

    expect(ctrl().state).toBe("playing");
    expect(slot.dataset.kind).toBe("audio");
    // The pre-roll: the video the learner just started is paused again for the
    // duration of the cue.
    expect(video.paused).toBe(true);
  });

  // Measured on the live tenant (2026-09-07): our pause() is never the call that
  // fails — it returns with paused === true every time. LearningSuite's own
  // React player owns a "should be playing" state and re-asserts it ~3ms later
  // (`vendor.js` → play(), from React's unstable_runWithPriority, alongside its
  // resume-position seek), which silently undoes the pre-roll. Mid-lesson cues
  // are unaffected because they pause from a `time` event, long after the host
  // has settled; only the t:0 pre-roll pauses inside the host's own
  // play-handling tick, and there the host wins.
  //
  // So the contract is not "pause once on activate" but "the video stays paused
  // for as long as a cue is live" — an invariant this runtime has to re-assert,
  // because on a third-party page it does not own the element.
  it("re-pauses the video when the host re-asserts play under a live cue", async () => {
    const { video } = await mountOnly(audioConfig(CUE_AT_ZERO));
    await video.play();
    emitPlay(0);
    expect(ctrl().state).toBe("playing");
    expect(video.paused).toBe(true);

    // The host, three milliseconds later.
    await video.play();
    emitPlay(0);

    // The cue is untouched — this must not restart or skip it — and the video
    // is paused again.
    expect(ctrl().state).toBe("playing");
    expect(ctrl().active?.id).toBe(CUE.id);
    expect(video.paused).toBe(true);
  });

  it("stops re-pausing after three attempts instead of fighting forever", async () => {
    // The cap exists for a host that re-asserts play on EVERY pause it did not
    // initiate. The tenant does it once, so three is margin, not a fit — but
    // uncapped this becomes a pause/play war at ~60ms and the learner gets a
    // stuttering or wedged player. Degrading to "the voice-over talks over a
    // running video" is the deliberate lesser evil.
    const { video } = await mountOnly(audioConfig(CUE_AT_ZERO));
    await video.play();
    emitPlay(0);
    expect(video.paused).toBe(true);

    for (let i = 0; i < MAX_REPAUSES; i += 1) {
      await video.play();
      emitPlay(0);
      expect(video.paused).toBe(true);
    }

    // The fourth is one too many: we stop fighting and leave the video running.
    await video.play();
    emitPlay(0);
    expect(video.paused).toBe(false);
    // Degraded, not broken — the cue is still playing and its card still up.
    expect(ctrl().state).toBe("playing");
    expect(
      (document.getElementById("vp-slot-lt") as HTMLElement).dataset.kind,
    ).toBe("audio");
  });

  it("gives each cue its own budget rather than three for the lesson", async () => {
    // The budget is keyed on which cue is live. Were it keyed only on "some cue
    // is live", a first cue that exhausted the cap would leave every later cue
    // in the lesson defenceless.
    const { video } = await mountOnly({
      ...audioConfig({ ...CUE_AT_ZERO, asset: SIGNED_HREF }),
      audios: [
        { ...CUE_AT_ZERO, asset: SIGNED_HREF },
        { ...CUE, id: "a2", t: 5, asset: SIGNED_HREF },
      ],
    });
    await video.play();
    emitPlay(0);
    for (let i = 0; i < MAX_REPAUSES + 1; i += 1) {
      await video.play();
      emitPlay(0);
    }
    expect(video.paused).toBe(false); // first cue's budget spent

    // End it (file mode, so `ended` is the real exit) and let the second fire.
    const audio = document.getElementById("vp-audio-el") as HTMLAudioElement;
    audio.dispatchEvent(new Event("ended"));
    expect(ctrl().state).toBe("idle");
    emitTime(5);
    expect(ctrl().active?.id).toBe("a2");

    await video.play();
    emitPlay(5);
    expect(video.paused).toBe(true);
  });

  it("resumes the video after the pre-roll with no second press", async () => {
    // File mode on purpose: the cue has to end via the element's `ended` event,
    // and onAudioEnded is guarded on mode === "file". A TTS cue ends on its
    // SpeechSynthesis utterance instead, which happy-dom never fires.
    const { video } = await mountOnly(
      audioConfig({ ...CUE_AT_ZERO, asset: SIGNED_HREF }),
    );
    await video.play();
    emitPlay(0);
    expect(video.paused).toBe(true);

    const audio = document.getElementById("vp-audio-el") as HTMLAudioElement;
    audio.dispatchEvent(new Event("ended"));

    expect(ctrl().state).toBe("idle");
    expect(video.paused).toBe(false);
    expect(video.currentTime).toBe(0);
  });

  // The gate sits above BOTH controllers, so a quiz break authored at t:0 is
  // covered by the same rule. It lives here rather than in quiz.test.ts because
  // it exercises the gate in recomputeActive, not the quiz state machine — and
  // quiz.test.ts drives createQuizController directly, with no mount harness.
  const QUIZ_AT_ZERO = {
    quizzes: [
      {
        id: "quiz-1",
        t: 0,
        title: "Kurz-Check",
        questions: [
          {
            id: "q1",
            prompt: "Which statement is true?",
            correctOptionId: "b",
            explanation: "Because b.",
            options: [
              { id: "a", text: "answer a" },
              { id: "b", text: "answer b" },
            ],
          },
        ],
      },
    ],
  };

  const quizCtrl = () =>
    (window as unknown as { __vpQuiz?: { isActive(): boolean } }).__vpQuiz;

  it("leaves a quiz authored at t:0 closed at mount", async () => {
    // The audio cue is parked at t:50 so this case is purely about the quiz.
    await mountOnly({
      ...audioConfig({ ...CUE, t: 50 }),
      quiz: QUIZ_AT_ZERO,
    });

    const quizSlot = document.getElementById("vp-slot-quiz") as HTMLElement;
    expect(quizCtrl()?.isActive()).toBe(false);
    expect(quizSlot.innerHTML).toBe("");
  });

  it("opens the t:0 quiz once the learner presses play", async () => {
    const { video } = await mountOnly({
      ...audioConfig({ ...CUE, t: 50 }),
      quiz: QUIZ_AT_ZERO,
    });
    await video.play();
    emitPlay(0);

    expect(quizCtrl()?.isActive()).toBe(true);
  });

  it("re-pauses the video when the host re-asserts play under an open quiz", async () => {
    // Same race, same guard: the quiz pauses the same element from the same
    // gated call site, so a break authored at t:0 loses to the host exactly as
    // the voice-over did.
    const { video } = await mountOnly({
      ...audioConfig({ ...CUE, t: 50 }),
      quiz: QUIZ_AT_ZERO,
    });
    await video.play();
    emitPlay(0);
    expect(quizCtrl()?.isActive()).toBe(true);
    expect(video.paused).toBe(true);

    await video.play();
    emitPlay(0);

    expect(quizCtrl()?.isActive()).toBe(true);
    expect(video.paused).toBe(true);
  });

  it("keeps the gate open once playback has started, across a pause", async () => {
    // The latch is one-way. If a pause re-closed it, pausing mid-lesson would
    // swallow every cue that came due afterwards.
    const { video, slot } = await mountOnly(audioConfig({ ...CUE, t: 5 }));
    await video.play();
    emitPlay(0);
    video.pause();
    emitTime(5);

    expect(ctrl().state).toBe("playing");
    expect(slot.dataset.kind).toBe("audio");
  });
});

// Composition ported from the reference player's audio-overlay.tsx: a compact
// bottom-right card with a portrait, a progress bar above the time row, and a
// labelled Skip. Geometry is NOT asserted here — happy-dom returns 0 from
// getBoundingClientRect()/offsetHeight regardless ("full rendering is out of
// scope", capricorn86/happy-dom#1416), so width/height belong to browser
// validation. What is assertable is structure, escaping and state wiring.
describe("voice-over card", () => {
  const card = () =>
    document.getElementById("vp-slot-lt")?.firstElementChild as HTMLElement;

  it("renders the portrait when `avatar` resolves to an expanded URL", async () => {
    const { slot } = await mountAndTrigger(
      audioConfig({ ...CUE, asset: SIGNED_HREF, avatar: SIGNED_HREF }),
    );

    const img = slot.querySelector(".vp-audio-portrait") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute("src")).toBe(SIGNED_HREF);
    expect(img.getAttribute("alt")).toBeTruthy();
    expect(slot.querySelector(".vp-audio-initials")).toBeNull();
  });

  it("falls back to initials from `voice` when `avatar` is absent", async () => {
    const { slot } = await mountAndTrigger(
      audioConfig({ ...CUE, voice: "Coach-Stimme" }),
    );

    expect(slot.querySelector(".vp-audio-portrait")).toBeNull();
    expect(slot.querySelector(".vp-audio-initials")?.textContent).toBe("CS");
  });

  it("derives one initial from a single-word voice, and a placeholder from none", async () => {
    const single = await mountAndTrigger(
      audioConfig({ ...CUE, voice: "Fred" }),
    );
    expect(single.slot.querySelector(".vp-audio-initials")?.textContent).toBe(
      "F",
    );
  });

  it("does not throw or blank out on a punctuation-only voice", async () => {
    const { slot } = await mountAndTrigger(
      audioConfig({ ...CUE, voice: "..." }),
    );
    expect(slot.querySelector(".vp-audio-initials")?.textContent).toBe("?");
  });

  it("escapes a voice carrying markup instead of parsing it", async () => {
    const { slot } = await mountAndTrigger(
      audioConfig({ ...CUE, voice: "<img src=x onerror=alert(1)>Bo" }),
    );

    expect(slot.querySelector("img")).toBeNull();
    expect(slot.querySelector(".vp-audio-byline")?.textContent).toContain(
      "<img",
    );
  });

  it("falls back to initials for an unusable avatar without raising an audio fault", async () => {
    // A missing portrait is cosmetic. The three `audio-asset-*` errorTypes mean
    // "no cue on this page will find its audio" — the loudest operator alarm in
    // the runtime — so the avatar path must not go anywhere near reportFailure.
    //
    // Asserted through console.warn rather than the beacon, deliberately. A
    // sendBeacon spy cannot see this in-harness: `report()` in common/beacon.ts
    // early-returns when the runtime origin is unknown, which it always is under
    // test (no injected <script src>), so the spy reads zero whatever the code
    // does — a vacuous assertion. Setting `__vpRuntimeBaseUrl` to fix that arms
    // the kill-switch fetch, which then delays main() past nextFrames() and
    // nothing mounts at all. The two warnings ARE distinguishable, and they sit
    // one line away from the reportFailure call each path does or does not make.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { slot } = await mountAndTrigger(
      audioConfig({ ...CUE, asset: SIGNED_HREF, avatar: "{{asset:missing}}" }),
    );

    const messages = warn.mock.calls.map((call) => String(call[0])).join("\n");
    expect(slot.querySelector(".vp-audio-initials")).not.toBeNull();
    expect(messages).toContain("showing initials instead");
    // The audio-fault path — the one that beacons — must not have been entered.
    expect(messages).not.toContain("speaking the script instead");
  });

  it("does raise an audio fault when the AUDIO asset is the broken one", async () => {
    // Control for the case above: the same cue shape with the failure moved to
    // `asset` takes the loud path, so the assertion above is about avatars
    // specifically rather than about warnings being unobservable here.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await mountAndTrigger(audioConfig({ ...CUE, asset: "{{asset:missing}}" }));

    const messages = warn.mock.calls.map((call) => String(call[0])).join("\n");
    expect(messages).toContain("speaking the script instead");
  });

  // The shape admin-toggle's prompt now emits: one portrait per speaker, matched
  // by slug, and the same token allowed on several cues by the same person.
  const twoCues = (
    a1: Record<string, unknown>,
    a2: Record<string, unknown>,
  ) => ({
    ...audioConfig(a1),
    audios: [a1, a2],
  });
  const PORTRAIT_A =
    "https://storage.googleapis.com/ls/portrait-a?X-Goog-Expires=1";
  const PORTRAIT_B =
    "https://storage.googleapis.com/ls/portrait-b?X-Goog-Expires=1";

  it("gives each speaker their own portrait across cues", async () => {
    const { video, slot } = await mountAndTrigger(
      twoCues(
        { ...CUE, t: 2, voice: "Frederik", avatar: PORTRAIT_A },
        { ...CUE, id: "a2", t: 20, voice: "Tony", avatar: PORTRAIT_B },
      ),
    );
    expect(slot.querySelector(".vp-audio-portrait")?.getAttribute("src")).toBe(
      PORTRAIT_A,
    );

    // Skip to the second cue: a different speaker, a different face.
    (slot.querySelector('[data-action="audio-skip"]') as HTMLElement).click();
    video.currentTime = 20;
    emitTime(20);

    expect(slot.querySelector(".vp-audio-portrait")?.getAttribute("src")).toBe(
      PORTRAIT_B,
    );
    expect(slot.querySelector(".vp-audio-byline")?.textContent).toContain(
      "Tony",
    );
  });

  it("accepts the same portrait token on several cues by one speaker", async () => {
    // `avatar` is deliberately exempt from the once-only rule that governs
    // `asset`, so two inserts by the same person keep the same face.
    const { video, slot } = await mountAndTrigger(
      twoCues(
        { ...CUE, t: 2, voice: "Frederik", avatar: PORTRAIT_A },
        {
          ...CUE,
          id: "a2",
          t: 20,
          title: "Voice-Over: Zweiter Einschub",
          voice: "Frederik",
          avatar: PORTRAIT_A,
        },
      ),
    );
    (slot.querySelector('[data-action="audio-skip"]') as HTMLElement).click();
    video.currentTime = 20;
    emitTime(20);

    // The distinct title is what makes this non-vacuous: both cues carry the
    // same portrait URL, so without it the assertion below would also pass if
    // the second cue had never fired at all.
    expect(slot.dataset.activeAudio).toBe("a2");
    expect(slot.querySelector(".vp-audio-title")?.textContent).toContain(
      "Zweiter Einschub",
    );
    expect(slot.querySelector(".vp-audio-portrait")?.getAttribute("src")).toBe(
      PORTRAIT_A,
    );
  });

  it("swaps the transport icon by attribute, without rebuilding the card", async () => {
    const { slot } = await mountAndTrigger(
      audioConfig({ ...CUE, asset: SIGNED_HREF }),
    );
    const before = card();
    expect(before.dataset.playing).toBe("1");
    // Both icons are present at once; CSS decides which shows.
    expect(slot.querySelector(".vp-audio-icon-play")).not.toBeNull();
    expect(slot.querySelector(".vp-audio-icon-pause")).not.toBeNull();

    (
      slot.querySelector('[data-action="audio-playpause"]') as HTMLElement
    ).click();

    expect(card().dataset.playing).toBe("0");
    // Same node: the fast path must not re-render on a state flip, or the
    // per-timeupdate dirty check is pointless.
    expect(card()).toBe(before);
  });

  it("keeps the status label in step with the icon", async () => {
    const { slot } = await mountAndTrigger(
      audioConfig({ ...CUE, asset: SIGNED_HREF }),
    );
    const status = () => slot.querySelector("[data-status]")?.textContent;
    const playing = status();

    (
      slot.querySelector('[data-action="audio-playpause"]') as HTMLElement
    ).click();

    expect(status()).not.toBe(playing);
  });

  it("gives Skip a visible label, not just a title", async () => {
    const { slot } = await mountAndTrigger(
      audioConfig({ ...CUE, asset: SIGNED_HREF }),
    );
    const label = slot.querySelector(".vp-audio-skip-label");
    expect(label?.textContent?.trim()).toBeTruthy();
  });

  it("keeps all four transport hooks wired", async () => {
    const { audio, slot } = await mountAndTrigger(
      audioConfig({ ...CUE, asset: SIGNED_HREF }),
    );
    audio.currentTime = 5;
    audio.dispatchEvent(new Event("timeupdate"));

    (slot.querySelector('[data-action="audio-fwd"]') as HTMLElement).click();
    expect(audio.currentTime).toBe(15);
    (slot.querySelector('[data-action="audio-back"]') as HTMLElement).click();
    expect(audio.currentTime).toBe(5);
    (slot.querySelector('[data-action="audio-skip"]') as HTMLElement).click();
    expect(ctrl().state).toBe("idle");
  });

  it("injects its own stylesheet, outranking the slot reset on specificity", async () => {
    const { slot } = await mountAndTrigger(
      audioConfig({ ...CUE, asset: SIGNED_HREF }),
    );

    expect(document.getElementById("__vp-audio-style")).not.toBeNull();
    // `.vp-audio-card .vp-audio-title` is 0,2,0 and beats `.vp-slot *` (0,1,0)
    // on specificity rather than on stylesheet order — order is invisible to
    // happy-dom, which does not model equal-specificity tiebreaks.
    const title = slot.querySelector(".vp-audio-title") as HTMLElement;
    expect(getComputedStyle(title).whiteSpace).toBe("nowrap");
  });
});
