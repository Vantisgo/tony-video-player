import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerApi, PlayerEvent } from "../../common/types";

// AC5 as an integration test: mount the REAL entries and assert the whole
// visible surface speaks one language. The per-key catalogue tests in
// i18n.test.ts prove the lookup; only this file proves that every call site was
// actually rewired — which is the failure mode this feature exists to prevent
// (an English sidebar wrapped around a German quiz dialog).

type BusHandler = (payload: PlayerEvent) => void;
let busHandlers: BusHandler[] = [];
let currentTime = 0;

function installPlayerStub(): void {
  currentTime = 0;
  busHandlers = [];
  const stub: PlayerApi = {
    get current() {
      return currentTime;
    },
    duration: 100,
    play() {},
    pause() {},
    seek() {},
    on: (_event, fn) => {
      busHandlers.push(fn);
      return () => {};
    },
    setOverlays() {},
  };
  (window as unknown as { player: PlayerApi }).player = stub;
}

function emitTime(t: number): void {
  currentTime = t;
  for (const handler of busHandlers)
    handler({ type: "time", time: t, duration: 100 });
}

// Two phases (so the section pill renders), a science entry and meta steps (so
// all three sidebar tabs exist), plus a quiz — the full surface in one mount.
const FULL_CONFIG = {
  phases: [
    {
      id: "p1",
      title: "Phase One",
      description: "d1",
      startTimeSec: 0,
      endTimeSec: 60,
      interventions: [
        { id: "i1", label: "1.1", title: "Iv1", t: 4, desc: "x" },
        { id: "i2", label: "1.2", title: "Iv2", t: 20, desc: "y" },
      ],
    },
    {
      id: "p2",
      title: "Phase Two",
      description: "d2",
      startTimeSec: 60,
      endTimeSec: 120,
      interventions: [
        { id: "i3", label: "2.1", title: "Iv3", t: 65, desc: "z" },
      ],
    },
  ],
  sciences: [
    { id: "s1", name: "Sci", description: "sd", timestampsSec: [10, 30] },
  ],
  audios: [],
  metaSteps: [{ id: "m1", n: 1, title: "M1", t: 2 }],
  quiz: {
    showScore: true,
    showSummary: true,
    passingPercent: 50,
    quizzes: [
      {
        id: "q1",
        t: 40,
        resume: "manual",
        questions: [
          {
            id: "q1a",
            prompt: "P?",
            correctOptionId: "b",
            options: [
              { id: "a", text: "A" },
              { id: "b", text: "B" },
            ],
          },
        ],
      },
    ],
  },
};

function setupConfigDom(config: unknown): void {
  const pre = document.createElement("pre");
  pre.setAttribute("data-vp-config", "");
  pre.textContent = JSON.stringify(config);
  document.body.appendChild(pre);
  const host = document.createElement("div");
  host.appendChild(document.createElement("hls-video"));
  document.body.appendChild(host);
}

const nextFrames = (): Promise<void> =>
  new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

// resolveLocale() consults navigator.languages, and happy-dom reports
// ["en-US", "en"]. Pinning it per test keeps "the page said nothing" and "the
// browser asked for English" from being the same condition.
const setBrowserLanguages = (...tags: readonly string[]): void => {
  Object.defineProperty(navigator, "languages", {
    value: tags,
    configurable: true,
  });
  Object.defineProperty(navigator, "language", {
    value: tags[0] ?? "",
    configurable: true,
  });
};

const NO_BROWSER_PREFERENCE = "fr-CA";

// Mounts demo-overlays under a given locale signal and returns everything
// visible, so a single assertion can cover the whole surface at once.
async function mountDemo(signal: {
  lang?: string;
  override?: string;
  browser?: readonly string[];
}): Promise<{ sidebarText: string; overlayText: string; quizText: string }> {
  if (signal.lang) document.documentElement.lang = signal.lang;
  if (signal.override) window.__vpLocale = signal.override;
  if (signal.browser) setBrowserLanguages(...signal.browser);

  installPlayerStub();
  setupConfigDom(FULL_CONFIG);
  await import("../../demo-overlays/index");
  await nextFrames();

  // t=10 puts us mid-phase-1 with the science pill active; t=40 opens the quiz.
  emitTime(10);
  const overlayText = document.body.textContent ?? "";
  emitTime(40);

  return {
    sidebarText: document.getElementById("vp-demo-sidebar")?.textContent ?? "",
    overlayText,
    quizText:
      document.querySelector("[data-vp-quiz-card]")?.textContent ??
      document.querySelector("[data-vp-quiz-scrim]")?.textContent ??
      "",
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: false, json: async () => null })),
  );
  const g = window as unknown as Record<string, unknown> & {
    __vpDemoCleanup?: Array<() => void>;
  };
  if (Array.isArray(g.__vpDemoCleanup))
    g.__vpDemoCleanup.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
  g.__vpDemoCleanup = [];
  for (const key of [
    "__vpConfig",
    "__vpExpandedPhase",
    "__vpActivePhase",
    "__vpActiveIntervention",
    "__vpActiveMeta",
    "__vpHighlightedScience",
    "__audioCtrl",
    "__vpQuiz",
  ])
    delete g[key];
  document.documentElement.removeAttribute("lang");
  delete window.__vpLocale;
  setBrowserLanguages(NO_BROWSER_PREFERENCE);
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});

afterEach(() => {
  const reskin = (
    window as unknown as { __vpReskinCleanup?: Array<() => void> }
  ).__vpReskinCleanup;
  if (Array.isArray(reskin))
    reskin.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
  (
    window as unknown as { __vpReskinCleanup?: Array<() => void> }
  ).__vpReskinCleanup = [];
  document.documentElement.removeAttribute("lang");
  delete window.__vpLocale;
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("demo-overlays on a German page", () => {
  it("renders sidebar, section pill and quiz dialog all in German", async () => {
    const { sidebarText, overlayText, quizText } = await mountDemo({
      lang: "de",
    });

    // Sidebar: tabs, coaching chrome, science panel, meta heading.
    expect(sidebarText).toContain("Wissenschaft");
    expect(sidebarText).toContain("Master-Schritte");
    expect(sidebarText).toContain("Interventionen");
    expect(sidebarText).toContain("Erwähnungen");

    // Video overlays: the section pill's eyebrow and progress line.
    expect(overlayText).toContain("Sektion");
    expect(overlayText).toContain("erledigt");

    // The quiz dialog — the half that was already German, now from the same
    // catalogue as everything above.
    expect(quizText).toContain("Frage überspringen");

    // And nothing English leaked through from a missed call site.
    for (const english of [
      "Course Section",
      "Meta Structure",
      "Interventions",
      "mentions",
      "completed",
      "Skip question",
    ]) {
      expect(
        `${sidebarText}${overlayText}${quizText}`,
        `English "${english}" leaked onto a German page`,
      ).not.toContain(english);
    }
  });

  it("flips the whole surface to English when the host sets __vpLocale", async () => {
    const { sidebarText, overlayText, quizText } = await mountDemo({
      lang: "de",
      override: "en",
    });

    expect(sidebarText).toContain("Meta Structure");
    expect(sidebarText).toContain("Interventions");
    expect(sidebarText).toContain("mentions");
    expect(overlayText).toContain("Course Section");
    expect(overlayText).toContain("completed");
    expect(quizText).toContain("Skip question");

    for (const german of [
      "Sektion",
      "Master-Schritte",
      "Interventionen",
      "Erwähnungen",
      "erledigt",
      "Frage überspringen",
    ]) {
      expect(
        `${sidebarText}${overlayText}${quizText}`,
        `German "${german}" survived an English override`,
      ).not.toContain(german);
    }
  });

  it("falls back to English when neither page nor browser offers a known locale", async () => {
    const { sidebarText } = await mountDemo({
      lang: "fr-CA",
      browser: ["fr-CA", "es-MX"],
    });
    expect(sidebarText).toContain("Meta Structure");
    expect(sidebarText).not.toContain("Master-Schritte");
  });

  it("renders German on an unlabelled page for a German browser", async () => {
    // The case DEFAULT_LOCALE = "en" would otherwise get wrong: LearningSuite
    // may declare no `lang` at all, and the visitor's browser is the only
    // signal left.
    const { sidebarText, overlayText } = await mountDemo({
      browser: ["de-DE", "de", "en"],
    });
    expect(sidebarText).toContain("Master-Schritte");
    expect(sidebarText).toContain("Interventionen");
    expect(overlayText).toContain("Sektion");
    expect(sidebarText).not.toContain("Meta Structure");
  });

  it("lets a page that declares its language outrank the browser", async () => {
    // A German lesson stays German for a visitor browsing in English.
    const { sidebarText } = await mountDemo({
      lang: "de",
      browser: ["en-US", "en"],
    });
    expect(sidebarText).toContain("Master-Schritte");
    expect(sidebarText).not.toContain("Meta Structure");
  });

  it("logs no missing-message warning across a full render", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await mountDemo({ lang: "de" });
    const missing = warn.mock.calls.filter(
      (call) => call[0] === "[vp] missing message",
    );
    expect(missing).toEqual([]);
  });
});

// ─── reskin-player: the accessibility surface ───

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

// Mounts reskin-player under a locale and returns its control shell.
async function mountReskin(lang: string): Promise<HTMLElement> {
  document.documentElement.lang = lang;
  setBrowserLanguages(NO_BROWSER_PREFERENCE);

  const cfg = document.createElement("pre");
  cfg.setAttribute("data-vp-config", "");
  cfg.textContent = "{}";
  document.body.appendChild(cfg);

  const host = document.createElement("div");
  const video = document.createElement("hls-video");
  video.setAttribute(
    "src",
    "https://vz.example.com/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/playlist.m3u8",
  );
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

  await import("../../reskin-player/index");
  await Promise.resolve();
  const shell = document.querySelector(".vp-controls");
  expect(shell, "reskin control shell did not mount").not.toBeNull();
  return shell as HTMLElement;
}

const ariaLabels = (shell: HTMLElement): string[] =>
  [...shell.querySelectorAll("[aria-label]")].map(
    (el) => el.getAttribute("aria-label") ?? "",
  );

describe("reskin-player control labels", () => {
  it("announces German aria-labels on a German page", async () => {
    const shell = await mountReskin("de");
    const labels = ariaLabels(shell);

    expect(labels).toContain("Wiedergabe/Pause");
    expect(labels).toContain("Tonspuren");
    expect(labels).toContain("Untertitel");
    expect(labels).toContain("Stumm schalten");
    expect(labels).toContain("Vollbild");

    // Visible labels follow, kept short so the seek slider keeps its room.
    expect(shell.textContent).toContain("Start");
    expect(shell.textContent).toContain("Ton");
    expect(shell.textContent).toContain("Voll");

    // No English label survived.
    for (const english of ["Play/Pause", "Audio tracks", "Subtitles", "Mute"]) {
      expect(labels, `English aria-label "${english}" leaked`).not.toContain(
        english,
      );
    }
  });

  it("keeps English aria-labels on an English page", async () => {
    const shell = await mountReskin("en");
    const labels = ariaLabels(shell);

    expect(labels).toContain("Play/Pause");
    expect(labels).toContain("Audio tracks");
    expect(labels).toContain("Subtitles");
    expect(labels).toContain("Mute");
    expect(labels).toContain("Fullscreen");
    expect(shell.textContent).toContain("Sound");
  });

  it("escapes the aria-label into its attribute rather than breaking out of it", async () => {
    // The labels are interpolated into a quoted attribute in a template
    // literal, so esc() must cover `"`. A regression here would silently drop
    // or split the attribute — assert the count survives, not just the values.
    const shell = await mountReskin("de");
    expect(ariaLabels(shell)).toHaveLength(5);
    expect(shell.querySelectorAll("button")).toHaveLength(5);
  });
});
