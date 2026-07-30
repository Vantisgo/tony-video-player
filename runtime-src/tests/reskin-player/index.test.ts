import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A Bunny playlist id/URL that getBunnyVideoId() recognises, so the
// LearningSuite-transcript path is actually reachable in these tests.
const VIDEO_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const SRC = `https://vz.example.com/${VIDEO_ID}/playlist.m3u8`;

// Minimal HTMLMediaElement-ish surface the reskin attach() gate requires.
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

function setupReskinDom(): HTMLElement {
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
  return video;
}

function setApollo(cache: Record<string, unknown>): { extract: () => unknown } {
  const extract = vi.fn(() => cache);
  (
    window as unknown as {
      __APOLLO_CLIENT__?: { cache: { extract: () => unknown } };
    }
  ).__APOLLO_CLIENT__ = { cache: { extract } };
  return { extract };
}

// A StepFile whose downloadable URL matches VIDEO_ID, exposing one transcript
// track with two cues (0–5s "Hallo", 5–10s "Welt").
const APOLLO_CACHE: Record<string, unknown> = {
  "StepFile:1": {
    __typename: "StepFile",
    transcript: {
      sourceLanguage: "de",
      translations: [
        {
          lang: "de",
          text: [
            { text: "Hallo", from: 0, to: 5000 },
            { text: "Welt", from: 5000, to: 10000 },
          ],
        },
      ],
    },
    downloadable: { __ref: "Downloadable:1" },
  },
  "Downloadable:1": { url: SRC },
};

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: false, json: async () => null })),
  );
  delete (window as unknown as { __APOLLO_CLIENT__?: unknown })
    .__APOLLO_CLIENT__;
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

describe("reskin-player performance guards", () => {
  it("does not extract the Apollo cache on timeupdate when no LearningSuite subtitle is selected", async () => {
    const { extract } = setApollo(APOLLO_CACHE);
    const video = setupReskinDom();
    await import("../../reskin-player/index");
    await Promise.resolve();

    // Menu-building during attach may extract once; from here, timeupdate must not.
    const before = (extract as unknown as { mock: { calls: unknown[] } }).mock
      .calls.length;
    for (let i = 0; i < 5; i++) video.dispatchEvent(new Event("timeupdate"));

    expect(extract).toHaveBeenCalledTimes(before);
  });

  it("broadcasts to trusted iframes from a cached target list, not a per-emit DOM scan", async () => {
    setupReskinDom();
    // Append with no `src` attribute so happy-dom never navigates the frame,
    // then expose a trusted src + a spyable contentWindow to the runtime code.
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const post = vi.fn();
    Object.defineProperty(iframe, "src", {
      configurable: true,
      get: () => `${location.origin}/panel`, // same-origin → trusted by default
    });
    Object.defineProperty(iframe, "contentWindow", {
      configurable: true,
      get: () => ({ postMessage: post }),
    });

    await import("../../reskin-player/index");
    await Promise.resolve();

    const qsa = vi.spyOn(document, "querySelectorAll");
    const iframeScansBefore = qsa.mock.calls.filter(
      (c) => c[0] === "iframe",
    ).length;

    const video = document.querySelector("hls-video") as HTMLElement;
    for (let i = 0; i < 5; i++) video.dispatchEvent(new Event("timeupdate"));

    // Parity: the trusted iframe still receives every player message.
    expect(post).toHaveBeenCalled();
    expect(post.mock.calls[0][0]).toMatchObject({
      __source: "player",
      type: "time",
    });
    expect(post.mock.calls[0][1]).toBe(location.origin);
    // Cached: no per-emit querySelectorAll("iframe").
    const iframeScansAfter = qsa.mock.calls.filter(
      (c) => c[0] === "iframe",
    ).length;
    expect(iframeScansAfter).toBe(iframeScansBefore);
  });

  it("does not rewrite the subtitle cue while the displayed cue is unchanged", async () => {
    setApollo(APOLLO_CACHE);
    const video = setupReskinDom() as unknown as StubMedia & HTMLElement;
    await import("../../reskin-player/index");
    await Promise.resolve();

    // Select the LearningSuite subtitle track (option value "0").
    const option = document.querySelector(
      '[data-vp-menu="captions"] .vp-menu-option[data-value="0"]',
    ) as HTMLElement | null;
    expect(option).not.toBeNull();
    option!.click();

    const layer = document.querySelector("[data-vp-subtitles]") as HTMLElement;
    const cue1 = layer.querySelector(".vp-subtitle-cue");
    expect(cue1?.textContent).toBe("Hallo");

    // Still inside the "Hallo" cue → node preserved, no rewrite.
    video.currentTime = 1;
    video.dispatchEvent(new Event("timeupdate"));
    expect(layer.querySelector(".vp-subtitle-cue")).toBe(cue1);

    // Crosses into the "Welt" cue → rewritten.
    video.currentTime = 6;
    video.dispatchEvent(new Event("timeupdate"));
    const cue2 = layer.querySelector(".vp-subtitle-cue");
    expect(cue2).not.toBe(cue1);
    expect(cue2?.textContent).toBe("Welt");
  });
});

describe("reskin-player audio-attachment hiding", () => {
  const SIGNED_BASE =
    "https://storage.googleapis.com/learningsuite-prod-de-storage-x/courses/steps/";

  function addAttachment(text: string, id: string): HTMLAnchorElement {
    const a = document.createElement("a");
    a.setAttribute("href", `${SIGNED_BASE}${id}`);
    a.textContent = text;
    document.body.appendChild(a);
    return a;
  }

  it("hides the lesson's .mp3 attachments once a player is re-skinned, keeping other attachments", async () => {
    setupReskinDom();
    const intro = addAttachment("Intro.mp3", "intro");
    const workbook = addAttachment("Workbook.pdf", "workbook");

    await import("../../reskin-player/index");
    await Promise.resolve();

    expect(document.querySelector("[data-vp-reskinned]")).not.toBeNull();
    expect(intro.style.display).toBe("none");
    expect(workbook.style.display).toBe("");
  });

  it("leaves the attachments untouched when no player is re-skinned", async () => {
    const cfg = document.createElement("pre");
    cfg.setAttribute("data-vp-config", "");
    cfg.textContent = "{}";
    document.body.appendChild(cfg);
    const intro = addAttachment("Intro.mp3", "intro");

    await import("../../reskin-player/index");
    await Promise.resolve();

    expect(document.querySelector("[data-vp-reskinned]")).toBeNull();
    expect(intro.style.display).toBe("");
  });

  it("restores the attachments when the runtime tears down", async () => {
    setupReskinDom();
    const intro = addAttachment("Intro.mp3", "intro");

    await import("../../reskin-player/index");
    await Promise.resolve();
    expect(intro.style.display).toBe("none");

    (
      window as unknown as { __vpReskinCleanup?: Array<() => void> }
    ).__vpReskinCleanup?.forEach((fn) => fn());

    expect(intro.getAttribute("style")).toBe(null);
    expect(document.querySelector("[data-vp-hidden-attachment]")).toBeNull();
  });

  it("hides an .mp3 attachment that LearningSuite renders after the player attached", async () => {
    vi.useFakeTimers();
    try {
      setupReskinDom();
      await import("../../reskin-player/index");
      await vi.advanceTimersByTimeAsync(0);

      const late = addAttachment("Voiceover Phase 1.mp3", "phase");
      expect(late.style.display).toBe("");

      // The MutationObserver-driven rescan is debounced by 250ms.
      await vi.advanceTimersByTimeAsync(300);

      expect(late.style.display).toBe("none");
    } finally {
      vi.useRealTimers();
    }
  });
});
