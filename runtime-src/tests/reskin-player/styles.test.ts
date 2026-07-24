import { afterEach, describe, expect, it } from "vitest";
import { RESKIN_CSS } from "../../reskin-player/styles";

// Build host > hls-video > {media-controls, [slot=ui], plain child} and inject
// RESKIN_CSS, so getComputedStyle reflects the tag-scoped chrome-hiding cascade.
function mountNativeChrome(): {
  host: HTMLElement;
  mediaControls: HTMLElement;
  slotUi: HTMLElement;
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
  host.appendChild(video);
  document.body.appendChild(host);
  return { host, mediaControls, slotUi };
}

afterEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});

describe("RESKIN_CSS native-chrome hiding (F1)", () => {
  it('scopes every native-chrome selector under [data-vp-reskinned="true"]', () => {
    // Each selector fragment that targets the native player must be gated by the
    // success marker — no bare `hls-video …{display:none}` rule may exist.
    const selectorText = RESKIN_CSS.split("{")
      .map((chunk) => chunk.split("}").pop() ?? "")
      .join(",");
    const fragments = selectorText
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.includes("hls-video"));
    expect(fragments.length).toBeGreaterThan(0);
    for (const fragment of fragments)
      expect(fragment.startsWith('[data-vp-reskinned="true"]')).toBe(true);
  });

  it("AC1: native controls stay visible when the marker is absent", () => {
    const { mediaControls, slotUi } = mountNativeChrome();
    expect(getComputedStyle(mediaControls).display).not.toBe("none");
    expect(getComputedStyle(slotUi).display).not.toBe("none");
  });

  it("AC2: native controls are hidden once the host carries the marker", () => {
    const { host, mediaControls, slotUi } = mountNativeChrome();
    host.dataset.vpReskinned = "true";
    expect(getComputedStyle(mediaControls).display).toBe("none");
    expect(getComputedStyle(slotUi).display).toBe("none");
  });

  it("AC3: native controls return after the marker is removed (teardown)", () => {
    const { host, mediaControls } = mountNativeChrome();
    host.dataset.vpReskinned = "true";
    expect(getComputedStyle(mediaControls).display).toBe("none");
    delete host.dataset.vpReskinned;
    expect(getComputedStyle(mediaControls).display).not.toBe("none");
  });
});
