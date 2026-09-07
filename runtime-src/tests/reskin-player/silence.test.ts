import { afterEach, describe, expect, it } from "vitest";
import {
  createSilencer,
  resolveAudioElement,
  type SilencerGlobals,
} from "../../reskin-player/silence";
import type { MediaEl } from "../../common/types";

// happy-dom has no AudioContext, GainNode or MediaElementAudioSourceNode at all,
// which is exactly why silence.ts takes its Web Audio constructors through an
// injectable seam. These fakes stand in for them; the real graph is a browser
// check (see the media-controls plan's browser-validation step).
class FakeGain {
  gain = { value: 1 };
  connect(): void {}
}
class FakeSource {
  connect(): void {}
}
let created: FakeCtx[] = [];
class FakeCtx {
  state = "running";
  destination = {};
  resumes = 0;
  sources = 0;
  lastGain: FakeGain | null = null;
  constructor() {
    created.push(this);
  }
  createMediaElementSource(): FakeSource {
    this.sources += 1;
    return new FakeSource();
  }
  createGain(): FakeGain {
    this.lastGain = new FakeGain();
    return this.lastGain;
  }
  resume(): Promise<void> {
    this.resumes += 1;
    return Promise.resolve();
  }
}
const withAudio = (): SilencerGlobals =>
  ({ AudioContext: FakeCtx }) as unknown as SilencerGlobals;
const withoutAudio = (): SilencerGlobals => ({});

afterEach(() => {
  created = [];
  document.body.innerHTML = "";
});

describe("resolveAudioElement", () => {
  it("returns the inner <video>, not the custom element wrapping it", () => {
    // Measured on the tenant: <hls-video> is NOT an HTMLMediaElement and its own
    // src is the CDN .m3u8; the inner <video> is the one hls.js hands the MSE
    // blob to, and the only one createMediaElementSource would accept.
    const outer = document.createElement("hls-video");
    const inner = document.createElement("video");
    outer.appendChild(inner);
    expect(resolveAudioElement(outer as unknown as MediaEl)).toBe(inner);
  });

  it("returns a plain <video> as itself", () => {
    const video = document.createElement("video");
    expect(resolveAudioElement(video as unknown as MediaEl)).toBe(video);
  });

  it("returns null when no media element is reachable", () => {
    const outer = document.createElement("hls-video");
    expect(resolveAudioElement(outer as unknown as MediaEl)).toBeNull();
  });
});

describe("silencer: web audio path", () => {
  it("zeroes the gain to silence and restores it", () => {
    const video = document.createElement("video");
    const s = createSilencer(video as unknown as MediaEl, withAudio());

    expect(s.mode).toBe("webaudio");
    const ctx = created[0];
    expect(ctx.lastGain?.gain.value).toBe(1);

    s.silence();
    expect(ctx.lastGain?.gain.value).toBe(0);

    s.restore();
    expect(ctx.lastGain?.gain.value).toBe(1);
  });

  it("builds the graph once per element instance", () => {
    // createMediaElementSource() throws InvalidStateError on a second call for
    // the same element, so the graph is cached against the instance.
    const video = document.createElement("video");
    createSilencer(video as unknown as MediaEl, withAudio());
    createSilencer(video as unknown as MediaEl, withAudio());
    expect(created).toHaveLength(1);
    expect(created[0].sources).toBe(1);
  });

  it("never touches muted — the host would just revert it", () => {
    const video = document.createElement("video");
    const s = createSilencer(video as unknown as MediaEl, withAudio());
    s.silence();
    expect(video.muted).toBe(false);
  });
});

describe("silencer: capped re-assertion fallback", () => {
  it("falls back to muting when Web Audio is unavailable", () => {
    const video = document.createElement("video");
    const s = createSilencer(video as unknown as MediaEl, withoutAudio());
    expect(s.mode).toBe("reassert");
    s.silence();
    expect(video.muted).toBe(true);
    s.restore();
    expect(video.muted).toBe(false);
  });

  it("gives up after three re-assertions rather than fighting forever", () => {
    // happy-dom does not dispatch volumechange from a muted write (verified in
    // its source), so the host's revert is simulated by hand — which is also
    // what stops this test recursing.
    const video = document.createElement("video");
    const s = createSilencer(video as unknown as MediaEl, withoutAudio());
    s.silence();

    const revertAndNotify = (): void => {
      video.muted = false;
      video.dispatchEvent(new Event("volumechange"));
    };
    for (let i = 0; i < 3; i += 1) {
      revertAndNotify();
      expect(video.muted).toBe(true);
    }
    // The fourth is one too many: we stop fighting and leave it unmuted.
    revertAndNotify();
    expect(video.muted).toBe(false);
  });

  it("gives each silence() a fresh budget", () => {
    const video = document.createElement("video");
    const s = createSilencer(video as unknown as MediaEl, withoutAudio());
    s.silence();
    for (let i = 0; i < 4; i += 1) {
      video.muted = false;
      video.dispatchEvent(new Event("volumechange"));
    }
    expect(video.muted).toBe(false);

    s.silence();
    video.muted = false;
    video.dispatchEvent(new Event("volumechange"));
    expect(video.muted).toBe(true);
  });

  it("stops re-asserting once disposed", () => {
    const video = document.createElement("video");
    const s = createSilencer(video as unknown as MediaEl, withoutAudio());
    s.silence();
    s.dispose();
    video.muted = false;
    video.dispatchEvent(new Event("volumechange"));
    expect(video.muted).toBe(false);
  });
});
