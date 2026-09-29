import { describe, expect, it, vi } from "vitest";

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

describe("reskin-player performance guards", () => {
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
});
