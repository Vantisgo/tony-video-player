import { afterEach, describe, expect, it } from "vitest";
import { findPlayers, resolveHost, scanPlayers } from "../../common/player";

interface StubMedia {
  play(): void;
  currentTime: number;
  duration: number;
}

// Give an element the HTMLMediaElement surface isMediaEl() checks for.
function makeMediaLike(tag: string): HTMLElement {
  const el = document.createElement(tag);
  const m = el as unknown as StubMedia;
  m.play = () => {};
  m.currentTime = 0;
  m.duration = 100;
  return el;
}

// Force a specific box on one element (happy-dom returns all-zero by default).
function stubBox(el: Element, width: number, height: number): void {
  Object.defineProperty(el, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({
        width,
        height,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
      }) as DOMRect,
  });
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("scanPlayers — discovery (H1)", () => {
  it("AC3 parity: finds today's <hls-video> and reports tag:hls-video", () => {
    const host = document.createElement("div");
    host.appendChild(makeMediaLike("hls-video"));
    document.body.appendChild(host);

    const scan = scanPlayers();
    expect(scan.strategy).toBe("tag:hls-video");
    expect(scan.players).toHaveLength(1);
    expect((scan.players[0] as HTMLElement).tagName).toBe("HLS-VIDEO");
  });

  it("AC1: finds a renamed custom element that forwards the media API (capability)", () => {
    const host = document.createElement("div");
    host.appendChild(makeMediaLike("fancy-player"));
    document.body.appendChild(host);

    const scan = scanPlayers();
    expect(scan.strategy).toBe("capability");
    expect(scan.players).toHaveLength(1);
    expect((scan.players[0] as HTMLElement).tagName).toBe("FANCY-PLAYER");
  });

  it("AC4: returns [] and strategy 'none' when nothing matches", () => {
    document.body.appendChild(document.createElement("div"));
    const scan = scanPlayers();
    expect(scan.strategy).toBe("none");
    expect(findPlayers()).toEqual([]);
  });
});

describe("scanPlayers — shadow DOM (H2 AC2)", () => {
  it("finds a player inside an open shadow root", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    shadow.appendChild(makeMediaLike("hls-video"));

    const scan = scanPlayers();
    expect(scan.strategy).toBe("tag:hls-video");
    expect(scan.players).toHaveLength(1);
  });
});

describe("scanPlayers — contract attribute (H3)", () => {
  it("AC1: [data-vp-player] wins over a competing <hls-video>, regardless of tag", () => {
    const marked = makeMediaLike("fancy-player");
    marked.setAttribute("data-vp-player", "");
    document.body.appendChild(marked);
    const other = document.createElement("div");
    other.appendChild(makeMediaLike("hls-video"));
    document.body.appendChild(other);

    const scan = scanPlayers();
    expect(scan.strategy).toBe("contract");
    expect(scan.players).toHaveLength(1);
    expect((scan.players[0] as HTMLElement).tagName).toBe("FANCY-PLAYER");
  });

  it("AC2: [data-vp-player] on a wrapper resolves the inner media element", () => {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-vp-player", "");
    const inner = makeMediaLike("hls-video");
    wrapper.appendChild(inner);
    document.body.appendChild(wrapper);

    const scan = scanPlayers();
    expect(scan.strategy).toBe("contract");
    expect(scan.players[0]).toBe(inner);
  });

  it("AC3: absent the attribute, discovery falls back to the tag strategy", () => {
    const host = document.createElement("div");
    host.appendChild(makeMediaLike("hls-video"));
    document.body.appendChild(host);
    expect(scanPlayers().strategy).toBe("tag:hls-video");
  });
});

describe("resolveHost (H2)", () => {
  it("AC4 parity: returns the immediate parent when it has a non-zero box", () => {
    const parent = document.createElement("div");
    const media = makeMediaLike("hls-video");
    parent.appendChild(media);
    document.body.appendChild(parent);
    stubBox(parent, 640, 360);

    expect(resolveHost(media)).toBe(parent);
  });

  it("AC1: walks up past a zero-box wrapper to the nearest sized ancestor", () => {
    const sized = document.createElement("div");
    const wrapper = document.createElement("div");
    const media = makeMediaLike("hls-video");
    wrapper.appendChild(media);
    sized.appendChild(wrapper);
    document.body.appendChild(sized);
    stubBox(wrapper, 0, 0);
    stubBox(sized, 640, 360);

    expect(resolveHost(media)).toBe(sized);
  });

  it("falls back to the immediate parent when the whole chain is unsized", () => {
    const parent = document.createElement("div");
    const media = makeMediaLike("hls-video");
    parent.appendChild(media);
    document.body.appendChild(parent);
    // All boxes are zero (happy-dom default) → immediate parent.
    expect(resolveHost(media)).toBe(parent);
  });
});
