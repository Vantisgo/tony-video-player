import { afterEach, describe, expect, it } from "vitest";
import type { PlayerApi } from "../common/types";

// Stub the window.player API that demo-overlays consumes from reskin-player.
function installPlayerStub(): void {
  const stub: PlayerApi = {
    current: 0,
    duration: 100,
    play() {},
    pause() {},
    seek() {},
    on: () => () => {},
    setOverlays() {},
  };
  (window as unknown as { player: PlayerApi }).player = stub;
}

const nextFrames = (): Promise<void> =>
  new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

const PAYLOAD = '<img src=x onerror="window.__xss=1">';

afterEach(() => {
  document.body.innerHTML = "";
});

describe("demo-overlays rendering", () => {
  it("escapes a malicious config value instead of injecting an element", async () => {
    (window as unknown as { __xss?: number }).__xss = 0;
    installPlayerStub();

    // textContent assignment keeps the payload as literal text (as LearningSuite
    // stores a pasted <pre> block), not parsed HTML.
    const pre = document.createElement("pre");
    pre.setAttribute("data-vp-config", "");
    pre.textContent = JSON.stringify({
      phases: [
        {
          id: "p1",
          title: PAYLOAD,
          description: "desc",
          startTimeSec: 0,
          endTimeSec: 60,
          interventions: [
            { id: "i1", label: "1.1", title: PAYLOAD, t: 4, desc: "d" },
          ],
        },
      ],
      sciences: [],
      audios: [],
      metaSteps: [],
    });
    document.body.appendChild(pre);
    const host = document.createElement("div");
    const video = document.createElement("hls-video");
    host.appendChild(video);
    document.body.appendChild(host);

    // Importing the entry runs main(); config + <hls-video> are present so it
    // defers setup two animation frames.
    await import("./index");
    await nextFrames();

    const sidebar = document.getElementById("vp-demo-sidebar");
    expect(sidebar).not.toBeNull();
    // The payload must not have become a real <img> element…
    expect(sidebar?.querySelector('img[src="x"]')).toBeNull();
    // …and must be present as escaped literal text.
    expect(sidebar?.textContent).toContain("<img src=x");
    expect((window as unknown as { __xss?: number }).__xss).toBe(0);
  });
});
