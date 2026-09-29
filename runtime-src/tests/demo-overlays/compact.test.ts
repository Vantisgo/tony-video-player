import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isCompact, observeCompact } from "../../demo-overlays/compact";

// The contract for isCompact: every player measured on the live lesson
// (fresh loads, spec M14 corrected) plus the agreed boundaries
// (width < 750 || height < 280).
describe("isCompact", () => {
  it.each([
    [390, 219, "phone portrait"],
    [441, 249, "desktop at 1280"],
    [461, 260, "desktop at 1024"],
    [501, 283, "desktop at 1366"],
    [553, 312, "desktop at 1440"],
    [632, 356, "tablet landscape"],
    [641, 361, "desktop at 1600"],
    [708, 399, "tablet portrait"],
    [732, 413, "phone landscape"],
  ])("%i×%i (%s) is compact", (width, height) => {
    expect(isCompact(width, height)).toBe(true);
  });

  it.each([
    [752, 424, "desktop at 1920"],
    [1200, 675, "a wide player"],
  ])("%i×%i (%s) is full size", (width, height) => {
    expect(isCompact(width, height)).toBe(false);
  });

  it("switches at a width of 750", () => {
    expect(isCompact(749, 421)).toBe(true);
    expect(isCompact(750, 422)).toBe(false);
  });

  it("switches at a height of 280, whatever the width", () => {
    expect(isCompact(800, 279)).toBe(true);
    expect(isCompact(800, 280)).toBe(false);
  });
});

// Controllable ResizeObserver, as in tests/reskin-player/discovery.test.ts.
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly observed: Element[] = [];
  disconnected = false;
  constructor(private readonly cb: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }
  observe(el: Element): void {
    this.observed.push(el);
  }
  unobserve(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
  fire(): void {
    this.cb([], this as unknown as ResizeObserver);
  }
}

// The observer's own behaviour, independent of the rule: `classify` is
// injected as "narrower than 500".
const narrow = (w: number): boolean => w < 500;

function sized(width: number, height: number): HTMLElement {
  const el = document.createElement("div");
  let box = { width, height };
  el.getBoundingClientRect = () =>
    ({
      ...box,
      top: 0,
      left: 0,
      right: box.width,
      bottom: box.height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  (el as unknown as { resize(w: number, h: number): void }).resize = (w, h) => {
    box = { width: w, height: h };
  };
  return el;
}
const resize = (el: HTMLElement, w: number, h: number): void =>
  (el as unknown as { resize(w: number, h: number): void }).resize(w, h);

describe("observeCompact", () => {
  let cleanups: Array<() => void>;
  const onCleanup = (fn: () => void): void => {
    cleanups.push(fn);
  };

  beforeEach(() => {
    cleanups = [];
    FakeResizeObserver.instances.length = 0;
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies the initial state once and observes the target", () => {
    const el = sized(390, 219);
    const apply = vi.fn();
    const current = observeCompact(el, apply, onCleanup, narrow);
    expect(apply.mock.calls).toEqual([[true]]);
    expect(current()).toBe(true);
    expect(FakeResizeObserver.instances[0]!.observed).toEqual([el]);
  });

  it("applies again only when the state changes", () => {
    const el = sized(390, 219);
    const apply = vi.fn();
    const current = observeCompact(el, apply, onCleanup, narrow);
    const ro = FakeResizeObserver.instances[0]!;

    resize(el, 420, 236);
    ro.fire();
    expect(apply).toHaveBeenCalledTimes(1);

    resize(el, 800, 450);
    ro.fire();
    expect(apply.mock.calls).toEqual([[true], [false]]);
    expect(current()).toBe(false);
  });

  it("treats an unsized box as not compact", () => {
    const apply = vi.fn();
    observeCompact(sized(0, 0), apply, onCleanup, () => true);
    expect(apply.mock.calls).toEqual([[false]]);
  });

  it("disconnects on cleanup", () => {
    observeCompact(sized(390, 219), vi.fn(), onCleanup, narrow);
    cleanups.forEach((fn) => fn());
    expect(FakeResizeObserver.instances[0]!.disconnected).toBe(true);
  });

  it("falls back to window resize without ResizeObserver", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const el = sized(390, 219);
    const apply = vi.fn();
    observeCompact(el, apply, onCleanup, narrow);
    resize(el, 800, 450);
    window.dispatchEvent(new Event("resize"));
    expect(apply.mock.calls).toEqual([[true], [false]]);
    cleanups.forEach((fn) => fn());
  });
});
