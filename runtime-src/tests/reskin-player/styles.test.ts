import { afterEach, describe, expect, it } from "vitest";
import { RESKIN_CSS } from "../../reskin-player/styles";

// The inverse of what this file used to assert. Until 2026-09-07 RESKIN_CSS
// hid LearningSuite's chrome so our own control bar could replace it; the bar is
// gone and the host's controls — which work, including their subtitles — are
// back. These tests now guard against a hiding rule ever returning.
function mountHostChrome(): {
  host: HTMLElement;
  mediaControls: HTMLElement;
  slotUi: HTMLElement;
  hostBar: HTMLElement;
  subtitleLayer: HTMLElement;
} {
  const style = document.createElement("style");
  style.textContent = RESKIN_CSS;
  document.head.appendChild(style);

  const host = document.createElement("div");
  const video = document.createElement("hls-video");
  const mediaControls = document.createElement("media-controls");
  const slotUi = document.createElement("div");
  slotUi.setAttribute("slot", "ui");
  video.appendChild(mediaControls);
  video.appendChild(slotUi);
  // LearningSuite's real control bar is a MUI box, a direct child of the host.
  const hostBar = document.createElement("div");
  hostBar.className = "PlayerControlsAbsoluteContainer MuiBox-root css-1gauxy4";
  // One of ours, so an "it isn't hidden" assertion cannot pass vacuously on a
  // stylesheet that turned out to be empty.
  const subtitleLayer = document.createElement("div");
  subtitleLayer.className = "vp-subtitle-layer";
  host.append(video, hostBar, subtitleLayer);
  document.body.appendChild(host);
  return { host, mediaControls, slotUi, hostBar, subtitleLayer };
}

afterEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});

describe("RESKIN_CSS leaves the host's chrome alone", () => {
  it("contains no rule that targets the host's player or control bar", () => {
    const selectorText = RESKIN_CSS.split("{")
      .map((chunk) => chunk.split("}").pop() ?? "")
      .join(",");
    const fragments = selectorText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    // Anchor: the stylesheet must still be styling OUR nodes, or this whole
    // file passes on an empty string.
    expect(fragments.some((f) => f.includes(".vp-subtitle-layer"))).toBe(true);
    for (const fragment of fragments) {
      expect(fragment).not.toContain("hls-video");
      expect(fragment).not.toContain("PlayerControlsAbsoluteContainer");
    }
  });

  it("keeps the host's chrome visible even with the marker set", () => {
    const { host, mediaControls, slotUi, hostBar } = mountHostChrome();
    host.dataset.vpReskinned = "true";
    expect(getComputedStyle(mediaControls).display).not.toBe("none");
    expect(getComputedStyle(slotUi).display).not.toBe("none");
    expect(getComputedStyle(hostBar).display).not.toBe("none");
  });

  it("still styles our own layers under the marker", () => {
    const { host, subtitleLayer } = mountHostChrome();
    host.dataset.vpReskinned = "true";
    expect(getComputedStyle(subtitleLayer).position).toBe("absolute");
  });
});
