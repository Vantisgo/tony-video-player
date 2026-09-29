import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerApi } from "../../common/types";
import { RESKIN_CSS } from "../../reskin-player/styles";

// LearningSuite's own control container is full-bleed over the player and its
// inner stack computes to z-index 11 (measured on the tenant, 2026-09-07). While
// the runtime hid their chrome this did not matter; now that it does not, every
// interactive overlay of ours has to sit ABOVE that layer or their gesture layer
// swallows the click. This is exactly how the voice-over card's transport
// buttons became unclickable — the click landed on their MuiStack instead.
//
// happy-dom does no hit-testing (it returns 0 from every getBoundingClientRect),
// so the ordering itself is what is assertable here; the click behaviour is a
// browser check.
const HOST_CONTROLS_Z = 11;

function installPlayerStub(): void {
  const stub: PlayerApi = {
    get current() {
      return 0;
    },
    duration: 100,
    play() {},
    pause() {},
    seek() {},
    on: () => () => {},
  };
  (window as unknown as { player: PlayerApi }).player = stub;
}

function addConfig(): void {
  const pre = document.createElement("pre");
  pre.setAttribute("data-vp-config", "");
  pre.textContent = JSON.stringify({
    phases: [],
    sciences: [],
    audios: [{ id: "a1", t: 0, dur: 5, title: "T", voice: "V", script: "S" }],
    metaSteps: [],
    quiz: {
      quizzes: [
        {
          id: "q1",
          t: 10,
          title: "Q",
          questions: [
            {
              id: "q1a",
              prompt: "P",
              correctOptionId: "a",
              explanation: "E",
              options: [
                { id: "a", text: "a" },
                { id: "b", text: "b" },
              ],
            },
          ],
        },
      ],
    },
  });
  document.body.appendChild(pre);
  const host = document.createElement("div");
  const video = document.createElement("video");
  video.setAttribute("data-vp-player", "");
  host.appendChild(video);
  document.body.appendChild(host);
}

const nextFrames = (): Promise<void> =>
  new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

const z = (id: string): number =>
  Number(
    (document.getElementById(id) as HTMLElement | null)?.style.zIndex ?? "NaN",
  );

beforeEach(() => {
  // Each case re-imports the entry to get a fresh mount.
  vi.resetModules();
  const g = window as unknown as { __vpDemoCleanup?: Array<() => void> };
  if (Array.isArray(g.__vpDemoCleanup))
    g.__vpDemoCleanup.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
  g.__vpDemoCleanup = [];
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});

describe("overlay stacking against the host's control layer", () => {
  it("puts every interactive slot above LearningSuite's controls layer", async () => {
    installPlayerStub();
    addConfig();
    await import("../../demo-overlays/index");
    await nextFrames();

    for (const id of [
      "vp-slot-tl",
      "vp-slot-tr",
      "vp-slot-br",
      "vp-slot-lt",
      "vp-slot-quiz",
    ]) {
      expect(document.getElementById(id), `${id} did not mount`).not.toBeNull();
      expect(
        z(id),
        `#${id} sits at or below LearningSuite's controls layer (z-index ` +
          `${HOST_CONTROLS_Z}), so clicks on it land on their player instead`,
      ).toBeGreaterThan(HOST_CONTROLS_Z);
    }
  });

  it("keeps the quiz scrim above the pill and card slots", async () => {
    installPlayerStub();
    addConfig();
    await import("../../demo-overlays/index");
    await nextFrames();

    // The scrim is a modal: it must cover our own overlays as well as theirs.
    for (const id of ["vp-slot-tl", "vp-slot-tr", "vp-slot-br", "vp-slot-lt"])
      expect(z("vp-slot-quiz")).toBeGreaterThan(z(id));
  });

  it("puts the language-pack control above the host's controls layer too", () => {
    const rule = RESKIN_CSS.split("\n").find((l) =>
      l.includes(".vp-langpack {"),
    );
    expect(rule, ".vp-langpack rule missing").toBeTruthy();
    const match = /z-index:\s*(\d+)/.exec(rule as string);
    expect(match, ".vp-langpack has no z-index").toBeTruthy();
    expect(
      Number(match![1]),
      "the language-pack control sits at or below LearningSuite's controls " +
        `layer (z-index ${HOST_CONTROLS_Z}), so its menu cannot be clicked`,
    ).toBeGreaterThan(HOST_CONTROLS_Z);
  });
});
