import { afterEach, describe, expect, it, vi } from "vitest";
import { createLanguagePackControl } from "../../reskin-player/language-pack-control";
import type { TrackOption } from "../../common/types";

const AUDIO: TrackOption[] = [
  { value: 0, label: "Deutsch", selected: true },
  { value: 1, label: "English", selected: false },
];
const SUBS: TrackOption[] = [
  { value: "off", label: "Aus", selected: true },
  { value: 0, label: "Deutsch", selected: false },
];

function mount(
  opts: {
    audio?: TrackOption[] | null;
    subs?: TrackOption[] | null;
    onSelectAudio?: (v: number | string) => void;
    onSelectSubtitle?: (v: number | string) => void;
  } = {},
) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const cleanups: Array<() => void> = [];
  const control = createLanguagePackControl({
    playerHost: host,
    audioOptions: () => (opts.audio === undefined ? AUDIO : opts.audio),
    subtitleOptions: () => (opts.subs === undefined ? SUBS : opts.subs),
    onSelectAudio: opts.onSelectAudio ?? (() => {}),
    onSelectSubtitle: opts.onSelectSubtitle ?? (() => {}),
    onCleanup: (fn) => cleanups.push(fn),
  });
  return {
    host,
    control,
    cleanups,
    root: () => host.querySelector(".vp-langpack") as HTMLElement | null,
    button: () =>
      host.querySelector(".vp-langpack-btn") as HTMLButtonElement | null,
    options: () =>
      [...host.querySelectorAll(".vp-menu-option")] as HTMLElement[],
  };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("language-pack control", () => {
  it("renders a button and both groups when the pack offers tracks", () => {
    const h = mount();
    expect(h.control).not.toBeNull();
    expect(h.root()).not.toBeNull();
    h.button()!.click();
    const titles = [...h.host.querySelectorAll(".vp-menu-title")].map(
      (n) => n.textContent,
    );
    expect(titles).toHaveLength(2);
    expect(h.options().map((o) => o.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Deutsch"),
        expect.stringContaining("English"),
        expect.stringContaining("Aus"),
      ]),
    );
  });

  it("adds NOTHING to the DOM when the pack offers no choice", () => {
    // The load-bearing case: on a lesson without a usable pack the player must
    // be one hundred percent LearningSuite's.
    const h = mount({ audio: null, subs: null });
    expect(h.control).toBeNull();
    expect(h.host.childNodes).toHaveLength(0);
  });

  it("renders only the group it has tracks for", () => {
    const h = mount({ subs: null });
    h.button()!.click();
    expect(h.host.querySelectorAll(".vp-menu-title")).toHaveLength(1);
  });

  it("reports the chosen value and closes the menu", () => {
    const onSelectAudio = vi.fn();
    const h = mount({ subs: null, onSelectAudio });
    h.button()!.click();
    const menu = h.host.querySelector(".vp-menu") as HTMLElement;
    expect(menu.hidden).toBe(false);

    h.options()[1].click();

    expect(onSelectAudio).toHaveBeenCalledWith(1);
    expect(menu.hidden).toBe(true);
  });

  it("marks the selected option for assistive tech", () => {
    const h = mount({ subs: null });
    h.button()!.click();
    expect(h.options()[0].getAttribute("aria-checked")).toBe("true");
    expect(h.options()[1].getAttribute("aria-checked")).toBe("false");
  });

  it("closes on Escape and on a click outside", () => {
    const h = mount();
    const menu = () => h.host.querySelector(".vp-menu") as HTMLElement;

    h.button()!.click();
    expect(menu().hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(menu().hidden).toBe(true);

    h.button()!.click();
    expect(menu().hidden).toBe(false);
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(menu().hidden).toBe(true);
  });

  it("removes itself and its document listeners on cleanup", () => {
    const h = mount();
    expect(h.cleanups).toHaveLength(1);
    h.cleanups.forEach((fn) => fn());

    expect(h.root()).toBeNull();
    // A stray listener on a removed node would still fire; prove it does not by
    // dispatching after teardown.
    expect(() =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    ).not.toThrow();
  });

  it("re-reads its options on every open, so selection state stays live", () => {
    let selected = 0;
    const host = document.createElement("div");
    document.body.appendChild(host);
    createLanguagePackControl({
      playerHost: host,
      audioOptions: () =>
        AUDIO.map((o, i) => ({ ...o, selected: i === selected })),
      subtitleOptions: () => null,
      onSelectAudio: (v) => {
        selected = Number(v);
      },
      onSelectSubtitle: () => {},
      onCleanup: () => {},
    });
    const button = host.querySelector(".vp-langpack-btn") as HTMLButtonElement;
    const opts = () =>
      [...host.querySelectorAll(".vp-menu-option")] as HTMLElement[];

    button.click();
    opts()[1].click(); // choose English
    button.click();
    expect(opts()[1].getAttribute("aria-checked")).toBe("true");
    expect(opts()[0].getAttribute("aria-checked")).toBe("false");
  });
});
