import { type AssetFailure, resolveAssetUrl } from "../common/assets";
import { resetCleanup, pushCleanup } from "../common/cleanup";
import { esc } from "../common/escape";
// Aliased to `tr`: `t` is this file's name for the current playback time.
import { t as tr } from "../common/i18n/demo";
import { formatTime as fmt } from "../common/format";
import { type ConfigHit, loadVpConfig, parseVpConfig } from "../common/config";
import { findPlayers, resolveHost } from "../common/player";
import { activeInterventionId } from "../common/interventions";
import { getBunnyVideoId } from "../common/tracks";
import { getRuntimeBaseUrl } from "../common/runtime-url";
import { shouldRun } from "../common/killswitch";
import { report } from "../common/beacon";
import type { Audio, Phase, VpConfig } from "../common/types";
import {
  DEFAULT_AUDIOS,
  DEFAULT_META_STEPS,
  DEFAULT_PHASES,
  DEFAULT_SCIENCES,
} from "./data";
import {
  ANIM_CSS,
  AUDIO_CSS,
  QUIZ_CSS,
  SECTION_CSS,
  SLOT_CSS,
  T,
} from "./styles";
import { createQuizController } from "./quiz";

const CLEANUP_KEY = "__vpDemoCleanup";
const AUDIO_EL_ID = "vp-audio-el";

// How many times a single cue will re-park a video the host has restarted
// underneath it. See enforceCuePause() for why this is capped and not endless.
const MAX_CUE_REPAUSES = 3;

// Stacking against LearningSuite's own chrome. Their control container is
// full-bleed over the player and its inner stack computes to z-index 11
// (measured on the tenant, 2026-09-07). While the runtime hid their chrome this
// did not matter; since it no longer hides it, anything of ours that must be
// clickable has to sit ABOVE 11 — at 8 their gesture layer swallowed every
// click meant for the voice-over card's transport buttons.
//
// The quiz scrim is a modal and must cover our own overlays too, so it gets its
// own higher value. NOTE it has to be passed as makeSlot's `zIndex` argument:
// a `z-index` inside the `posCss` string is overridden by the declaration
// makeSlot appends after it, which is how the scrim silently sat at the default
// for as long as it has existed.
// How far the position must move before a seek counts as "the learner (or the
// host) went somewhere else" rather than HLS re-buffering in place. hls.js fires
// seeking/seeked for its own gap-jumping and stall recovery, and those land on
// essentially the same position.
const SEEK_EPSILON_SEC = 1.5;

const SLOT_Z = 15;
const QUIZ_SLOT_Z = 20;

// Inline SVG for the voice-over transport, replacing the emoji glyphs (▶ ⏸ ⏭)
// and the 🎙️ badge: emoji render differently per platform and cannot take
// `currentColor`. Paths are lucide's, the icon set the reference player uses.
// Static markup with no config data in it, so there is nothing to escape here.
// Play and pause are BOTH rendered; AUDIO_CSS picks between them off the card's
// `[data-playing]`, which is what lets the per-timeupdate path swap the icon
// with a single attribute write.
const ICON_PLAY =
  '<svg class="vp-audio-icon-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
const ICON_PAUSE =
  '<svg class="vp-audio-icon-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
const ICON_SKIP =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><polygon points="5 4 15 12 5 20 5 4" fill="currentColor" stroke="none"/><line x1="19" y1="5" x2="19" y2="19"/></svg>';
const ICON_MIC =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 11a7 7 0 0 1-14 0"/><line x1="12" y1="18" x2="12" y2="22"/></svg>';

// Our own origin (the injected <script>'s), resolved synchronously — used for
// the kill-switch + telemetry API calls.
const runtimeBaseUrl = getRuntimeBaseUrl();

function reportFailure(errorType: string): void {
  const player = findPlayers()[0];
  report(runtimeBaseUrl, {
    errorType,
    videoId: player
      ? getBunnyVideoId(player.src || player.getAttribute?.("src"))
      : "",
    config: loadVpConfig()?.data ?? null,
  });
}

// One entry per `resolveAssetUrl` failure. Separate errorTypes on purpose: the
// three have different fixes (fix the embed block / fix the key / fix the URL),
// and a single `audio-asset-error` would force reading the beacon's config back
// to tell them apart. `unexpanded` is the highest-signal one — it means the whole
// block is mis-configured, so no cue on the page will find its audio.
const ASSET_FAILURES: Record<
  AssetFailure,
  { errorType: string; hint: string }
> = {
  unexpanded: {
    errorType: "audio-asset-unexpanded",
    hint: 'the {{asset:…}} placeholder was not expanded — check that the "Code einbetten" block uses "In Seite anzeigen" (not "In Pop-Up anzeigen") and that the asset still exists',
  },
  missing: {
    errorType: "audio-asset-missing",
    hint: "no matching key in config.assets",
  },
  insecure: {
    errorType: "audio-asset-insecure",
    hint: "resolved to a non-https URL; refused",
  },
};

interface AudioController {
  state: "idle" | "playing" | "paused";
  // "file" plays the cue's uploaded asset and takes its clock from the
  // element's timeupdate; "tts" speaks `script` on a simulated clock.
  mode: "tts" | "file";
  active: Audio | null;
  audioTime: number;
  videoResumeTime: number;
  triggered: Set<string>;
  audioEl: HTMLAudioElement | null;
  _tickHandle: ReturnType<typeof setTimeout> | null;
  activate(a: Audio, videoT: number): void;
  togglePlay(): void;
  end(opts?: { resume?: boolean }): void;
  skip(): void;
  seekRel(delta: number): void;
  _speak(a: Audio): void;
  isActive(): boolean;
  _scheduleTick(): void;
  _render(): void;
}

interface VpDemoWindow {
  __vpConfig?: { source: string; data: VpConfig };
  __vpHighlightedScience?: string | null;
  __vpSidebarTab?: (name: string) => void;
  __vpExpandedPhase?: string | null;
  __vpActivePhase?: string | null;
  __vpActiveIntervention?: string | null;
  __vpActiveMeta?: string | null;
  __audioCtrl?: AudioController;
}

const w = window as unknown as VpDemoWindow;

// One mounted overlay set. `cleanups` is MOUNT-scoped — distinct from the
// process-level CLEANUP_KEY registry, which owns the permanent watchers and must
// survive a remount (conflating the two makes a remount kill the observer that
// triggers remounts).
interface MountState {
  cleanups: Array<() => void>;
  raw: string;
  disposed: boolean;
  // False once the host has torn our DOM out from under us, or the player we
  // mounted against is gone — the signal to rebuild.
  checkAlive: () => boolean;
}

// Ids of every node a mount can create, for the safety-net sweep.
const OWNED_NODE_IDS = [
  "vp-slot-tl",
  "vp-slot-tr",
  "vp-slot-br",
  "vp-slot-lt",
  "vp-slot-quiz",
  "vp-demo-sidebar",
  "vp-anim-style",
  "__vp-slot-style",
  "__vp-section-style",
  "__vp-audio-style",
  "__vp-quiz-style",
  AUDIO_EL_ID,
];

function main(): string {
  // Idempotency: tear down anything left from a prior run before mounting again.
  resetCleanup(CLEANUP_KEY);

  let generation = 0;
  let currentMount: MountState | null = null;
  let everMounted = false;

  function readyContext(): ConfigHit | null {
    // window.player is installed by reskin-player.js; the mount drives overlays
    // through it, so it is part of "ready", not just the DOM.
    if (!window.player) return null;
    const hit = loadVpConfig();
    if (!hit) return null;
    if (!findPlayers()[0]) return null;
    return hit;
  }

  function teardownMount(): void {
    // Bump unconditionally, even with no active mount: a scheduleMount() may
    // already be waiting on its double-rAF with currentMount still null, and this
    // has to invalidate that too (e.g. script re-injection mid-schedule).
    generation++;
    if (!currentMount) return;
    const mount = currentMount;
    currentMount = null;
    mount.disposed = true;
    for (const fn of mount.cleanups.splice(0).reverse()) {
      try {
        fn();
      } catch {
        /* ignore teardown errors */
      }
    }
  }

  function scheduleMount(): void {
    const gen = ++generation;
    // LearningSuite renders the embed-block config asynchronously via React. When
    // a config <pre>/player has just appeared the host is often still mid-
    // reconciliation and would strip DOM we add to the player host on its next
    // pass, so defer past two animation frames.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (gen !== generation) return; // superseded by a newer schedule or a teardown
        const fresh = readyContext();
        if (!fresh) return;
        mount(fresh);
      }),
    );
  }

  function evaluate(): void {
    const hit = readyContext();
    if (!hit) {
      teardownMount();
      return;
    }
    if (currentMount) {
      const raw = JSON.stringify(hit.data);
      // Nothing changed and our nodes are intact — the overwhelmingly common
      // case on a chatty React host. Do no work.
      if (raw === currentMount.raw && currentMount.checkAlive()) return;
      teardownMount(); // config edited, or the host stripped us — remount fresh
    }
    scheduleMount();
  }

  // ─── Permanent watchers ───
  // Debounced so React's re-renders don't trigger a full re-evaluation per
  // mutation. The 200ms is load-bearing: characterData on a React host is chatty.
  let scanPending: ReturnType<typeof setTimeout> | null = null;
  function scheduleScan(): void {
    if (scanPending) return;
    scanPending = setTimeout(() => {
      scanPending = null;
      evaluate();
    }, 200);
  }

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body || document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
  });
  pushCleanup(CLEANUP_KEY, () => {
    observer.disconnect();
    if (scanPending) clearTimeout(scanPending);
    teardownMount();
  });

  // The editor flips between …/27ZqYKF1 and …?view=preview without reloading, so
  // the mount decision has to be re-made on history navigation too.
  let popTimeout: ReturnType<typeof setTimeout> | null = null;
  const popHandler = (): void => {
    if (popTimeout) clearTimeout(popTimeout);
    popTimeout = setTimeout(() => {
      popTimeout = null;
      scheduleScan();
    }, 50);
  };
  window.addEventListener("popstate", popHandler);
  pushCleanup(CLEANUP_KEY, () => {
    window.removeEventListener("popstate", popHandler);
    if (popTimeout) clearTimeout(popTimeout);
  });

  // No-context deadline: a config is on the page but we never manage to mount
  // (e.g. LearningSuite renamed the player element) — report once (F6).
  if (loadVpConfig()) {
    const deadline = setTimeout(() => {
      if (!everMounted) reportFailure("demo-context-timeout");
    }, 10000);
    pushCleanup(CLEANUP_KEY, () => clearTimeout(deadline));
  }

  evaluate();
  return "demo overlay controller active";

  function mount(cfgHit: ConfigHit): void {
    const mountState: MountState = {
      cleanups: [],
      raw: JSON.stringify(cfgHit.data),
      disposed: false,
      checkAlive: () => true,
    };
    currentMount = mountState;
    // Safety net: if mounting throws part-way, dispose this mount's cleanups and
    // remove any nodes we created, restoring the host DOM (never a half-mounted
    // overlay set + leaked observers). The process-level registry is left alone —
    // it owns the watchers that will retry.
    try {
      mountInner(cfgHit, mountState);
      everMounted = true;
    } catch (err) {
      console.error("[vp demo] setup failed; restoring host", err);
      teardownMount();
      OWNED_NODE_IDS.forEach((id) => document.getElementById(id)?.remove());
      reportFailure("demo-setup-error");
    }
  }

  function mountInner(cfgHit: ConfigHit, mountState: MountState): void {
    const onCleanup = (fn: () => void): void => {
      mountState.cleanups.push(fn);
    };
    console.info(`[vp] config loaded from ${cfgHit.source}`);
    const parsed = parseVpConfig(cfgHit.data);
    // Never silently substitute demo data for an absent category: an embed with
    // no phases must render nothing, not our sample coaching arc. DEFAULT_* only
    // ever applies under the explicit `"demo": true` opt-in.
    const isDemo = parsed.demo === true;
    const phases: Phase[] = parsed.phases ?? (isDemo ? DEFAULT_PHASES : []);
    const sciences = parsed.sciences ?? (isDemo ? DEFAULT_SCIENCES : []);
    const audios = parsed.audios ?? (isDemo ? DEFAULT_AUDIOS : []);
    const metaSteps = parsed.metaSteps ?? (isDemo ? DEFAULT_META_STEPS : []);
    const assets = parsed.assets ?? {};
    const quiz = parsed.quiz ?? null;

    const showSectionOverlay = phases.length > 1; // one phase: Coaching tab is enough
    const showCoachingTab = phases.length > 0;
    const showScienceTab = sciences.length > 0;
    const showMetaTab = metaSteps.length > 0;
    const showSidebar = showCoachingTab || showScienceTab || showMetaTab;
    const showAudio = audios.length > 0;
    const showQuiz = quiz !== null;

    w.__vpConfig = {
      source: cfgHit.source,
      data: { phases, sciences, audios, metaSteps, assets, demo: isDemo, quiz },
    };

    // ─── Injected-slot white-space reset (inject once) ───
    // The id must NOT start with `vp-slot-`: the defensive sweep below filters
    // OWNED_NODE_IDS on that prefix to clear stray slot *elements*, and would
    // delete this stylesheet three lines after it was injected. Hence the
    // `__vp-` prefix, shared with the other two injected stylesheets.
    //
    // Injected FIRST on purpose. `.vp-slot *` is specificity 0,1,0 — exactly
    // tying `.vp-quiz-summary-row-text { white-space:nowrap }` in QUIZ_CSS, so
    // the tie resolves by source order. Landing here keeps it ahead of both
    // SECTION_CSS and QUIZ_CSS, which are remove-then-append and therefore move
    // to the end of <head> on every mount. Higher-specificity rules
    // (.vp-section-pill .vp-sec-title, 0,2,0) and the inline nowrap
    // declarations in the pill markup win regardless.
    if (!document.getElementById("__vp-slot-style")) {
      const s = document.createElement("style");
      s.id = "__vp-slot-style";
      s.textContent = SLOT_CSS;
      document.head.appendChild(s);
    }

    // ─── Animation keyframes (inject once) ───
    if (!document.getElementById("vp-anim-style")) {
      const s = document.createElement("style");
      s.id = "vp-anim-style";
      s.textContent = ANIM_CSS;
      document.head.appendChild(s);
    }

    // ─── Player overlay slots ───
    const player = findPlayers()[0];
    // Captured so checkAlive() can tell "still the same player" from "the host
    // swapped the element under us".
    const mountedPlayer = window.player;
    const mountedMediaEl = player;
    const playerHost = player ? resolveHost(player) : null;
    if (!playerHost) {
      console.warn("[demo] no player host");
      return;
    }
    if (getComputedStyle(playerHost).position === "static")
      playerHost.style.position = "relative";

    // Defensive: clear stray nodes with our ids (e.g. a stale mount from before
    // this controller's own cleanup registry existed). The `vp-slot-` prefix
    // filter is a namespace, not a coincidence — anything else that needs to
    // survive this point must not be named `vp-slot-*` (see __vp-slot-style).
    OWNED_NODE_IDS.filter(
      (id) => id.startsWith("vp-slot-") || id.endsWith("sidebar"),
    ).forEach((id) => document.getElementById(id)?.remove());

    const SLOT_EVENTS = [
      "click",
      "dblclick",
      "mousedown",
      "mouseup",
      "pointerdown",
      "pointerup",
      "touchstart",
      "touchend",
    ];
    function makeSlot(
      id: string,
      posCss: string,
      zIndex = SLOT_Z,
    ): HTMLElement {
      const el = document.createElement("div");
      el.id = id;
      // Carries SLOT_CSS's white-space reset to every slot and its subtree. A
      // class, not five id selectors: a sixth slot added later is covered for
      // free, and it matches the two existing resets (.vp-section-pill,
      // .vp-admin-dialog), which are class-scoped too. The ids stay the public
      // surface — the e2e canary asserts #vp-slot-* and checkAlive() reads them.
      el.className = "vp-slot";
      // z-index 15, not 8: LearningSuite's own control container is full-bleed
      // over the player and its inner stack computes to z-index 11 (measured on
      // the tenant). While the runtime hid their chrome that did not matter;
      // since 2026-09-07 it does not hide it, and at z-index 8 their gesture
      // layer sat on top of every card and pill we own — the voice-over card's
      // transport buttons were unclickable, with the click landing on their
      // player instead. Stays below the quiz scrim's 20, which is a modal and
      // must cover our overlays as well as theirs.
      el.style.cssText = `position:absolute; ${posCss}; pointer-events:none; z-index:${zIndex};`;
      const swallow = (e: Event) => {
        if (e.target !== el) e.stopPropagation();
      };
      SLOT_EVENTS.forEach((ev) => el.addEventListener(ev, swallow));
      playerHost!.appendChild(el);
      // Registering removal is what makes teardownMount() actually restore the
      // host: without it a teardown (config removed, kill-switch, re-injection)
      // would orphan the slots, and only the next mount's defensive id sweep
      // would clean them up.
      onCleanup(() => {
        SLOT_EVENTS.forEach((ev) => el.removeEventListener(ev, swallow));
        el.remove();
      });
      return el;
    }
    const slotTL = makeSlot(
      "vp-slot-tl",
      "top:14px; left:14px; right:14px; max-width:none",
    );
    const slotTR = makeSlot("vp-slot-tr", "top:10px; right:10px;");
    const slotBR = makeSlot("vp-slot-br", "bottom:58px; right:14px;");
    // Keeps the id `vp-slot-lt` even though the voice-over card is no longer a
    // lower third: the e2e canary asserts `#vp-slot-*` by id and checkAlive()
    // reads this one, so renaming buys a tidier name at the cost of both. It
    // now shares the bottom-right corner with slotBR — safe only because
    // recomputeActive's audio branch calls clearMetaPill(), which is therefore
    // load-bearing for layout and not just tidiness.
    const slotLowerThird = makeSlot(
      "vp-slot-lt",
      "right:14px; bottom:58px; width:320px; max-width:calc(100% - 28px);",
    );
    // The quiz scrim covers the whole player, so unlike the (invisible when
    // empty) pill slots this one is only created when there is a quiz to show.
    const slotQuiz = showQuiz
      ? makeSlot(
          "vp-slot-quiz",
          "inset:0; display:flex; align-items:center; justify-content:center;",
          QUIZ_SLOT_Z,
        )
      : null;

    // ─── Section indicator (top-left) ───
    const sectionStyleId = "__vp-section-style";
    document.getElementById(sectionStyleId)?.remove();
    {
      const s = document.createElement("style");
      s.id = sectionStyleId;
      s.textContent = SECTION_CSS;
      document.head.appendChild(s);
    }

    const sectionPill = document.createElement("div");
    sectionPill.className = "vp-section-pill";
    sectionPill.innerHTML = `
    <div class="vp-sec-card">
      <div class="vp-sec-collapsed">
        <span class="vp-sec-title" data-section></span>
        <div class="vp-sec-cur-row" data-cur-row hidden>
          <span style="opacity:.6">›</span>
          <span class="vp-sec-cur-title" data-cur-title></span>
        </div>
      </div>
      <div class="vp-sec-expanded">
        <div class="vp-sec-eyebrow">${esc(tr("demo.section.eyebrow"))}</div>
        <h3 class="vp-sec-h3" data-section-h3></h3>
        <div data-progress-block>
          <div class="vp-sec-bar"><div class="vp-sec-bar-fill" data-bar-fill style="width:0%"></div></div>
          <div class="vp-sec-count" data-count></div>
          <div class="vp-sec-rows" data-rows></div>
        </div>
        <div data-empty hidden style="color:rgba(168,191,186,.72); font-size:13px">${esc(tr("demo.section.empty"))}</div>
      </div>
    </div>`;
    if (showSectionOverlay) slotTL.appendChild(sectionPill);

    const $ = (sel: string): HTMLElement =>
      sectionPill.querySelector(sel) as HTMLElement;
    const sectionRefs = {
      title: $("[data-section]"),
      h3: $("[data-section-h3]"),
      curRow: $("[data-cur-row]"),
      curTitle: $("[data-cur-title]"),
      progress: $("[data-progress-block]"),
      barFill: $("[data-bar-fill]"),
      count: $("[data-count]"),
      rowsHost: $("[data-rows]"),
      empty: $("[data-empty]"),
    };
    let renderedRows: {
      el: HTMLElement;
      dot: HTMLElement;
      titleEl: HTMLElement;
      id: string;
    }[] = [];
    let renderedPhaseId: string | null = null;

    sectionPill.addEventListener("click", (e) => {
      const row = (e.target as HTMLElement).closest(
        "[data-seek]",
      ) as HTMLElement | null;
      if (!row) return;
      e.stopPropagation();
      window.player.seek(Number(row.dataset.seek) + 0.1);
    });

    function renderSection(): void {
      // One phase (or none): the Coaching tab already says everything the pill
      // would, so the video overlay stays off.
      if (!showSectionOverlay) return;
      const t = window.player.current ?? 0;
      const phase = phases.find((p) => t >= p.startTimeSec && t < p.endTimeSec);
      const section = phase?.title ?? tr("demo.section.intro");
      const subs = phase
        ? // `current` honours an optional `end`, so an intervention past its end
          // time falls through to "completed" rather than staying current.
          phase.interventions.map((iv) => ({
            ...iv,
            completed: t > iv.t,
            current: activeInterventionId(phase.interventions, t) === iv.id,
          }))
        : [];
      const cur = subs.find((s) => s.current);
      const completedCount = subs.filter((s) => s.completed).length;

      if (sectionRefs.title.textContent !== section)
        sectionRefs.title.textContent = section;
      sectionRefs.title.title = section;
      if (cur) {
        sectionRefs.curRow.hidden = false;
        if (sectionRefs.curTitle.textContent !== cur.title)
          sectionRefs.curTitle.textContent = cur.title;
        sectionRefs.curTitle.title = cur.title;
      } else {
        sectionRefs.curRow.hidden = true;
      }

      if (sectionRefs.h3.textContent !== section)
        sectionRefs.h3.textContent = section;

      if (subs.length) {
        sectionRefs.progress.hidden = false;
        sectionRefs.empty.hidden = true;
        const pct = (completedCount / subs.length) * 100;
        sectionRefs.barFill.style.width = pct + "%";
        const countTxt = tr("demo.section.progress", {
          done: completedCount,
          total: subs.length,
        });
        if (sectionRefs.count.textContent !== countTxt)
          sectionRefs.count.textContent = countTxt;

        if (renderedPhaseId !== phase!.id) {
          renderedPhaseId = phase!.id;
          sectionRefs.rowsHost.innerHTML = "";
          renderedRows = subs.map((s) => {
            const el = document.createElement("div");
            el.className = "vp-sec-row";
            el.dataset.seek = String(s.t);
            const dot = document.createElement("div");
            dot.className = "vp-sec-dot";
            const titleEl = document.createElement("span");
            titleEl.className = "vp-sec-row-title";
            titleEl.textContent = s.title;
            el.appendChild(dot);
            el.appendChild(titleEl);
            sectionRefs.rowsHost.appendChild(el);
            return { el, dot, titleEl, id: s.id };
          });
        }
        subs.forEach((s, i) => {
          const r = renderedRows[i];
          if (!r) return;
          const state = s.completed
            ? "completed"
            : s.current
              ? "current"
              : "upcoming";
          if (r.el.dataset.state !== state) r.el.dataset.state = state;
          if (r.dot.dataset.state !== state) r.dot.dataset.state = state;
          const cur01 = s.current ? "1" : "0";
          if (r.el.dataset.current !== cur01) r.el.dataset.current = cur01;
        });
      } else {
        sectionRefs.progress.hidden = true;
        sectionRefs.empty.hidden = false;
        renderedPhaseId = null;
        renderedRows = [];
        sectionRefs.rowsHost.innerHTML = "";
      }
    }

    // ─── Science trigger (top-right) ───
    function renderScience(t: number): void {
      let active: (typeof sciences)[number] | null = null;
      for (const sc of sciences)
        for (const ts of sc.timestampsSec)
          if (t >= ts && t < ts + 5) {
            active = sc;
            break;
          }
      if (!active) {
        if (slotTR.dataset.activeSci) {
          slotTR.innerHTML = "";
          slotTR.dataset.activeSci = "";
          w.__vpHighlightedScience = null;
          renderScienceHighlight();
        }
        return;
      }
      if (slotTR.dataset.activeSci === active.id) return;
      slotTR.dataset.activeSci = active.id;
      w.__vpHighlightedScience = active.id;
      renderScienceHighlight();
      slotTR.innerHTML = `
      <div data-overlay-action="science" class="vp-anim-right" style="display:inline-flex; align-items:center; gap:8px; background:linear-gradient(135deg, rgba(50,51,51,.94), rgba(22,79,73,.92)); border:1px solid rgba(0,225,165,.38); border-radius:999px; padding:5px 6px 5px 12px; backdrop-filter:blur(10px); box-shadow:0 10px 24px rgba(0,0,0,.30); color:#f4f7f6; pointer-events:auto; cursor:pointer;">
        <span style="font-size:14px;line-height:1">🧪</span>
        <span style="font:600 12px system-ui; color:#f4f7f6; letter-spacing:.2px">${esc(tr("demo.science.label"))}</span>
        <span style="font:500 12px system-ui; color:rgba(168,191,186,.9); max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${esc(active.name)}</span>
        <button style="background:#00e1a5; color:#062b22; border:0; border-radius:999px; padding:4px 11px; font:600 11.5px system-ui; cursor:pointer; flex-shrink:0; line-height:1.3; pointer-events:auto;">${esc(tr("demo.science.open"))}</button>
      </div>`;
      const openSci = (e: Event) => {
        e.stopPropagation();
        w.__vpSidebarTab?.("science");
      };
      (
        slotTR.querySelector('[data-overlay-action="science"]') as HTMLElement
      ).onclick = openSci;
      (slotTR.querySelector("button") as HTMLElement).onclick = openSci;
    }

    // ─── Audio state machine ───
    const videoEl: HTMLMediaElement | null = findPlayers()[0] ?? null;

    // One persistent, hidden <audio> for the whole run: creating it (and its
    // listeners) inside activate() would stack a fresh element per cue.
    document.getElementById(AUDIO_EL_ID)?.remove();
    const audioEl = document.createElement("audio");
    audioEl.id = AUDIO_EL_ID;
    // No `crossorigin`: a bare media element plays the signed GCS URL in no-cors
    // mode, which needs no CORS headers.
    audioEl.preload = "none";
    audioEl.style.display = "none";
    document.body.appendChild(audioEl);

    // Failure policy for a cue's `asset` reference: **graceful for the learner,
    // loud for the operator.** A learner never sees a diagnostic — every failure
    // degrades to the TTS path, which is why `script` is mandatory on every cue.
    // The operator gets a named console warning plus one deduped beacon.
    //
    // Resolve at cue time rather than at mount: the reference is cheap to
    // resolve and a late-arriving config revision is then picked up for free.
    // Nothing is cached — the signed URL the platform rendered into the config is
    // only ever as old as this page load.
    function resolveAudioUrl(a: Audio): string {
      const { url, failure } = resolveAssetUrl(a.asset, assets);
      if (!failure) return url;
      const { errorType, hint } = ASSET_FAILURES[failure];
      console.warn(
        `[vp] audio cue "${a.id}": ${hint} — speaking the script instead`,
        a.asset,
      );
      reportFailure(errorType);
      return "";
    }

    // The portrait resolves through the same two shapes as `asset`, but QUIETLY:
    // note the absence of reportFailure(). The three `audio-asset-*` errorTypes
    // exist to say "no cue on this page will find its audio" — the loudest
    // operator alarm in the runtime — and a missing picture must never fire it.
    // The learner just gets initials. Operator still gets a named console line.
    function resolveAvatarUrl(a: Audio): string {
      const { url, failure } = resolveAssetUrl(a.avatar, assets);
      if (!failure) return url;
      console.warn(
        `[vp] audio cue "${a.id}": portrait unusable (${failure}) — showing initials instead`,
        a.avatar,
      );
      return "";
    }

    // Up to two letters from `voice`, for the fallback badge. `voice` is
    // untrusted config, so every degenerate input has to yield something
    // renderable: empty, one word, and punctuation-only all have to work.
    function voiceInitials(voice: string): string {
      const letters = String(voice ?? "")
        .split(/[\s\-_.]+/)
        .filter((word) => /\p{L}/u.test(word))
        .slice(0, 2)
        .map((word) => (word.match(/\p{L}/u) as RegExpMatchArray)[0])
        .join("");
      return (letters || "?").toUpperCase();
    }

    // Play the real file when the cue's asset resolves; otherwise (and on any
    // playback failure) speak the script instead.
    function startFile(a: Audio, url: string): void {
      audioCtrl.mode = "file";
      audioEl.src = url;
      try {
        audioEl.currentTime = 0;
      } catch {
        /* ignore */
      }
      const p = audioEl.play();
      if (p && typeof p.catch === "function") p.catch(() => fallbackToTts(a));
    }

    function fallbackToTts(a: Audio): void {
      if (audioCtrl.state === "idle" || audioCtrl.mode !== "file") return;
      audioCtrl.mode = "tts";
      try {
        audioEl.pause();
      } catch {
        /* ignore */
      }
      audioCtrl._speak(a);
      audioCtrl._scheduleTick();
    }

    const audioCtrl: AudioController = {
      state: "idle",
      mode: "tts",
      active: null,
      audioTime: 0,
      videoResumeTime: 0,
      triggered: new Set(),
      audioEl,
      _tickHandle: null,

      activate(a, videoT) {
        if (audioCtrl.state !== "idle") return;
        audioCtrl.state = "playing";
        audioCtrl.active = a;
        audioCtrl.audioTime = 0;
        audioCtrl.videoResumeTime = videoT;
        audioCtrl.triggered.add(a.id);
        try {
          videoEl?.pause();
        } catch {
          /* ignore */
        }
        const url = resolveAudioUrl(a);
        if (url) {
          startFile(a, url);
          audioCtrl._render();
          return;
        }
        audioCtrl.mode = "tts";
        audioCtrl._speak(a);
        audioCtrl._scheduleTick();
      },
      togglePlay() {
        if (audioCtrl.state === "idle") return;
        const pausing = audioCtrl.state === "playing";
        audioCtrl.state = pausing ? "paused" : "playing";
        try {
          if (audioCtrl.mode === "file") {
            if (pausing) audioEl.pause();
            else {
              const p = audioEl.play();
              if (p && typeof p.catch === "function")
                p.catch((err) => console.warn("[vp] audio resume failed", err));
            }
          } else if (pausing) speechSynthesis.pause();
          else speechSynthesis.resume();
        } catch {
          /* ignore */
        }
        audioCtrl._scheduleTick();
        audioCtrl._render();
      },
      end({ resume = true }: { resume?: boolean } = {}) {
        audioCtrl.state = "idle";
        audioCtrl.active = null;
        audioCtrl.audioTime = 0;
        if (audioCtrl._tickHandle) {
          clearTimeout(audioCtrl._tickHandle);
          audioCtrl._tickHandle = null;
        }
        // Also covers a cue that started in file mode and fell back to TTS.
        if (audioEl.hasAttribute("src")) {
          try {
            audioEl.pause();
            audioEl.removeAttribute("src");
            audioEl.load();
          } catch {
            /* ignore */
          }
        }
        audioCtrl.mode = "tts";
        try {
          speechSynthesis.cancel();
        } catch {
          /* ignore */
        }
        slotLowerThird.innerHTML = "";
        slotLowerThird.dataset.kind = "";
        slotLowerThird.dataset.activeAudio = "";
        if (resume) {
          try {
            if (videoEl) {
              videoEl.currentTime = audioCtrl.videoResumeTime;
              videoEl.play();
            }
          } catch {
            /* ignore */
          }
        }
      },
      skip() {
        audioCtrl.end({ resume: true });
      },
      seekRel(delta) {
        if (audioCtrl.state === "idle" || !audioCtrl.active) return;
        const from =
          audioCtrl.mode === "file" ? audioEl.currentTime : audioCtrl.audioTime;
        const next = Math.max(0, Math.min(audioCtrl.active.dur, from + delta));
        audioCtrl.audioTime = next;
        if (audioCtrl.mode === "file") {
          try {
            audioEl.currentTime = next;
          } catch {
            /* ignore */
          }
        }
        audioCtrl._render();
      },
      _speak(a) {
        try {
          if (!("speechSynthesis" in window)) return;
          speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(a.script || a.title);
          u.lang = "de-DE";
          u.rate = 1.0;
          u.pitch = 1.0;
          u.onend = () => {
            if (audioCtrl.state !== "idle") audioCtrl.end({ resume: true });
          };
          speechSynthesis.speak(u);
        } catch {
          /* ignore */
        }
      },
      isActive() {
        return audioCtrl.state !== "idle";
      },
      _scheduleTick() {
        if (audioCtrl._tickHandle) {
          clearTimeout(audioCtrl._tickHandle);
          audioCtrl._tickHandle = null;
        }
        // File mode takes its clock from the element's timeupdate; the simulated
        // clock is TTS-only.
        if (audioCtrl.mode === "file") return;
        if (audioCtrl.state !== "playing") return;
        audioCtrl._tickHandle = setTimeout(() => {
          audioCtrl._tickHandle = null;
          if (audioCtrl.state !== "playing" || !audioCtrl.active) return;
          audioCtrl.audioTime = Math.min(
            audioCtrl.active.dur,
            audioCtrl.audioTime + 0.1,
          );
          if (audioCtrl.audioTime >= audioCtrl.active.dur) {
            audioCtrl.end({ resume: true });
            return;
          }
          audioCtrl._render();
          audioCtrl._scheduleTick();
        }, 100);
      },
      _render() {
        renderAudio();
      },
    };
    w.__audioCtrl = audioCtrl;

    // Quiz breaks. Created after audioCtrl so it can ask whether a voice-over is
    // playing; the media element is injected (never re-queried) so discovery
    // stays the single source of truth for "which element is the player".
    const quizCtrl =
      quiz && slotQuiz && player
        ? createQuizController({
            quiz,
            mediaEl: player,
            playerHost,
            slot: slotQuiz,
            isAudioActive: () => audioCtrl.isActive(),
            onCleanup,
          })
        : null;

    // Wired once, on the persistent element — never inside activate().
    const onAudioTimeUpdate = () => {
      if (
        audioCtrl.state === "idle" ||
        audioCtrl.mode !== "file" ||
        !audioCtrl.active
      )
        return;
      audioCtrl.audioTime = Math.min(audioCtrl.active.dur, audioEl.currentTime);
      audioCtrl._render();
    };
    const onAudioEnded = () => {
      // Only the file clock ends a cue; a TTS cue ends on the utterance.
      if (audioCtrl.state !== "idle" && audioCtrl.mode === "file")
        audioCtrl.end({ resume: true });
    };
    const onAudioError = () => {
      const active = audioCtrl.active;
      if (audioCtrl.state === "idle" || audioCtrl.mode !== "file" || !active)
        return;
      console.warn(
        "[vp] audio load failed; falling back to TTS",
        audioEl.error,
      );
      fallbackToTts(active);
    };
    audioEl.addEventListener("timeupdate", onAudioTimeUpdate);
    audioEl.addEventListener("ended", onAudioEnded);
    // A cue belongs to the position it is anchored to. LearningSuite restores its
    // own saved position on the first press, and that seek can land AFTER a cue
    // has already activated — so the cue is speaking for a moment the learner is
    // no longer at, and `end({resume:true})` would drag them back to it.
    //
    // A deliberate move therefore withdraws the live cue. The anchor is
    // re-pointed at where the seek landed BEFORE ending, so the resume continues
    // from there instead of yanking them back; and it resumes rather than
    // leaving the video parked, because the learner pressed play and a dead
    // press is worse than a cue cut short. The cue stays in `triggered`, so it
    // does not immediately re-fire.
    const onVideoSeeked = () => {
      if (!videoEl || !audioCtrl.isActive()) return;
      const landed = videoEl.currentTime;
      if (!Number.isFinite(landed)) return;
      if (Math.abs(landed - audioCtrl.videoResumeTime) <= SEEK_EPSILON_SEC)
        return;
      audioCtrl.videoResumeTime = landed;
      audioCtrl.end({ resume: true });
    };
    videoEl?.addEventListener("seeked", onVideoSeeked);
    onCleanup(() => videoEl?.removeEventListener("seeked", onVideoSeeked));

    audioEl.addEventListener("error", onAudioError);
    onCleanup(() => {
      audioEl.removeEventListener("timeupdate", onAudioTimeUpdate);
      audioEl.removeEventListener("ended", onAudioEnded);
      audioEl.removeEventListener("error", onAudioError);
      try {
        audioEl.pause();
      } catch {
        /* ignore */
      }
      audioEl.removeAttribute("src");
      audioEl.remove();
    });

    // The click interception that used to live here targeted our own
    // `[data-vp="playpause"]` button, which no longer exists: LearningSuite owns
    // the control bar again. A learner pressing THEIR play button under a live
    // cue is handled by enforceCuePause, which re-parks the video — that needs
    // no hook into their markup and cannot be confused with the host's own
    // re-assertion. The Space shortcut below survives unchanged, because it is a
    // bare document listener with no dependency on the bar.
    const onCaptureKeydown = (e: KeyboardEvent) => {
      if (!audioCtrl.isActive()) return;
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        (document.activeElement as HTMLElement | null)?.isContentEditable
      )
        return;
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        audioCtrl.togglePlay();
      }
    };
    document.addEventListener("keydown", onCaptureKeydown, true);
    onCleanup(() => {
      document.removeEventListener("keydown", onCaptureKeydown, true);
    });

    function maybeTriggerAudio(t: number): void {
      if (audioCtrl.isActive()) return;
      for (const a of audios)
        if (t < a.t - 0.5) audioCtrl.triggered.delete(a.id);
      const due = audios.find(
        (a) => t >= a.t && t < a.t + 1.0 && !audioCtrl.triggered.has(a.id),
      );
      if (due) audioCtrl.activate(due, t);
    }

    // ─── Voice-over card styles ───
    // remove-then-append + onCleanup, the QUIZ_CSS variant: mount-scoped, so it
    // goes away with the mount. Lands after SLOT_CSS in <head>, but the card's
    // `white-space` rules carry two classes so they do not rely on that.
    // The id must not begin with `vp-slot-` — see the sweep above.
    if (showAudio) {
      const audioStyleId = "__vp-audio-style";
      document.getElementById(audioStyleId)?.remove();
      const s = document.createElement("style");
      s.id = audioStyleId;
      s.textContent = AUDIO_CSS;
      document.head.appendChild(s);
      onCleanup(() => document.getElementById(audioStyleId)?.remove());
    }

    // ─── Voice-over card (bottom-right) ───
    function renderAudio(): boolean {
      if (!audioCtrl.isActive() || !audioCtrl.active) {
        if (slotLowerThird.dataset.kind === "audio") {
          slotLowerThird.innerHTML = "";
          slotLowerThird.dataset.kind = "";
          slotLowerThird.dataset.activeAudio = "";
        }
        return false;
      }
      const active = audioCtrl.active;
      const elapsed = audioCtrl.audioTime;
      const pct = Math.min(100, (elapsed / active.dur) * 100);
      const isPlaying = audioCtrl.state === "playing";
      if (slotLowerThird.dataset.activeAudio === active.id) {
        const card = slotLowerThird.firstElementChild as HTMLElement | null;
        const fill = slotLowerThird.querySelector(
          "[data-fill]",
        ) as HTMLElement | null;
        const tEl = slotLowerThird.querySelector(
          "[data-elapsed]",
        ) as HTMLElement | null;
        const stEl = slotLowerThird.querySelector(
          "[data-status]",
        ) as HTMLElement | null;
        if (fill) fill.style.width = pct + "%";
        if (tEl) tEl.textContent = fmt(elapsed);
        // One attribute write swaps the transport icon — AUDIO_CSS owns which of
        // the two inline SVGs is shown. This replaced a `textContent` write,
        // which cannot swap an SVG at all; it is also the cheaper of the two on
        // a path that runs on every `timeupdate` (~4x/s). Re-rendering the card
        // per tick would throw away the dirty check this branch exists for.
        if (card) card.dataset.playing = isPlaying ? "1" : "0";
        // Previously omitted, so the status label went stale after a pause while
        // the icon updated. textContent, so no esc() (it would double-escape).
        if (stEl)
          stEl.textContent = tr(
            isPlaying ? "demo.audio.playing" : "demo.audio.paused",
          );
        return true;
      }
      slotLowerThird.dataset.kind = "audio";
      slotLowerThird.dataset.activeAudio = active.id;
      const portrait = resolveAvatarUrl(active);
      slotLowerThird.innerHTML = `
      <div class="vp-audio-card vp-anim-bottom" data-playing="${isPlaying ? "1" : "0"}">
        <div class="vp-audio-head">
          <div class="vp-audio-avatar">
            ${
              portrait
                ? `<img class="vp-audio-portrait" src="${esc(portrait)}" alt="${esc(tr("demo.audio.avatarAlt"))}">`
                : `<div class="vp-audio-initials">${esc(voiceInitials(active.voice))}</div>`
            }
            <span class="vp-audio-badge">${ICON_MIC}</span>
          </div>
          <div class="vp-audio-meta">
            <div class="vp-audio-title">${esc(active.title)}</div>
            <div class="vp-audio-byline">${esc(tr("demo.audio.by", { voice: active.voice }))}</div>
            <div class="vp-audio-state">
              <span class="vp-audio-dot vp-pulse"></span>
              <span class="vp-audio-status" data-status>${esc(
                tr(isPlaying ? "demo.audio.playing" : "demo.audio.paused"),
              )}</span>
            </div>
          </div>
        </div>
        <div class="vp-audio-progress">
          <div class="vp-audio-bar">
            <div class="vp-audio-fill" data-fill style="width:${pct}%"></div>
          </div>
          <div class="vp-audio-times">
            <span class="vp-audio-time" data-elapsed>${fmt(elapsed)}</span>
            <span class="vp-audio-time">${fmt(active.dur)}</span>
          </div>
        </div>
        <div class="vp-audio-controls">
          <button class="vp-audio-btn" data-action="audio-back" title="${esc(tr("demo.audio.back"))}">−10s</button>
          <button class="vp-audio-btn vp-audio-btn-primary" data-action="audio-playpause" title="${esc(tr("demo.audio.playPause"))}" aria-label="${esc(tr("demo.audio.playPause"))}">${ICON_PLAY}${ICON_PAUSE}</button>
          <button class="vp-audio-btn" data-action="audio-fwd" title="${esc(tr("demo.audio.forward"))}">+10s</button>
          <button class="vp-audio-btn vp-audio-btn-skip" data-action="audio-skip" title="${esc(tr("demo.audio.skip"))}">${ICON_SKIP}<span class="vp-audio-skip-label">${esc(tr("demo.audio.skip"))}</span></button>
        </div>
      </div>`;
      const stop = (e: Event) => e.stopPropagation();
      (
        slotLowerThird.querySelector(
          '[data-action="audio-back"]',
        ) as HTMLElement
      ).onclick = (e) => {
        stop(e);
        audioCtrl.seekRel(-10);
      };
      (
        slotLowerThird.querySelector('[data-action="audio-fwd"]') as HTMLElement
      ).onclick = (e) => {
        stop(e);
        audioCtrl.seekRel(+10);
      };
      (
        slotLowerThird.querySelector(
          '[data-action="audio-playpause"]',
        ) as HTMLElement
      ).onclick = (e) => {
        stop(e);
        audioCtrl.togglePlay();
      };
      (
        slotLowerThird.querySelector(
          '[data-action="audio-skip"]',
        ) as HTMLElement
      ).onclick = (e) => {
        stop(e);
        audioCtrl.skip();
      };
      return true;
    }

    // ─── Meta step fly-in (bottom-right) ───
    function renderMetaStep(t: number): void {
      const active = metaSteps.find((m) => t >= m.t && t < m.t + 5);
      if (!active) {
        if (slotBR.dataset.kind === "meta") {
          slotBR.innerHTML = "";
          slotBR.dataset.kind = "";
        }
        return;
      }
      if (slotBR.dataset.activeMeta === active.id) return;
      slotBR.dataset.kind = "meta";
      slotBR.dataset.activeMeta = active.id;
      slotBR.innerHTML = `
      <div data-overlay-action="meta" class="vp-anim-right" style="display:inline-flex; align-items:center; gap:10px; background:linear-gradient(135deg, rgba(50,51,51,.94), rgba(22,79,73,.92)); border:1px solid rgba(0,225,165,.38); border-radius:999px; padding:5px 14px 5px 5px; backdrop-filter:blur(10px); box-shadow:0 12px 28px rgba(0,0,0,.30); color:#f4f7f6; pointer-events:auto; white-space:nowrap; cursor:pointer;" title="${esc(tr("demo.meta.openTitle"))}">
        <div style="width:28px; height:28px; border-radius:50%; background:#00e1a5; color:#062b22; display:flex; align-items:center; justify-content:center; font:700 13px system-ui; flex-shrink:0">${esc(active.n)}</div>
        <span style="font:600 10.5px system-ui; letter-spacing:.5px; text-transform:uppercase; color:rgba(168,191,186,.82)">${esc(
          tr("demo.meta.step", { n: active.n, total: metaSteps.length }),
        )}</span>
        <span style="width:1px; height:14px; background:rgba(0,225,165,.28)"></span>
        <span style="font:600 13px system-ui; color:#f4f7f6; line-height:1">${esc(active.title)}</span>
      </div>`;
      (
        slotBR.querySelector('[data-overlay-action="meta"]') as HTMLElement
      ).onclick = (e) => {
        e.stopPropagation();
        w.__vpSidebarTab?.("meta");
      };
    }

    // ─── Quiz overlay styles ───
    if (showQuiz) {
      const quizStyleId = "__vp-quiz-style";
      document.getElementById(quizStyleId)?.remove();
      const s = document.createElement("style");
      s.id = quizStyleId;
      s.textContent = QUIZ_CSS;
      document.head.appendChild(s);
      onCleanup(() => document.getElementById(quizStyleId)?.remove());
    }

    // ─── Sidebar (Coaching / Science / Meta Structure) ───
    const sidebar = document.createElement("aside");
    sidebar.id = "vp-demo-sidebar";
    sidebar.style.cssText = `width:380px; flex-shrink:0; background:${T.card}; color:${T.fg}; color-scheme:dark; border-radius:14px; box-shadow:0 8px 24px rgba(0,0,0,.24); font:14px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif; border:1px solid ${T.border}; display:flex; flex-direction:column; overflow:hidden; align-self:flex-start; position:sticky; top:16px; max-height:calc(100vh - 32px);`;
    // Only tabs whose config section has content exist at all — an empty
    // "Science" tab is dead UI, not a placeholder.
    const tabDefs = [
      {
        key: "coaching",
        label: tr("demo.tab.coaching"),
        show: showCoachingTab,
      },
      { key: "science", label: tr("demo.tab.science"), show: showScienceTab },
      { key: "meta", label: tr("demo.tab.meta"), show: showMetaTab },
    ].filter((tab) => tab.show);

    sidebar.innerHTML = `
    <div style="padding:12px 14px 0">
      <div style="display:flex;gap:4px;background:${T.muted};padding:4px;border-radius:10px;">
        ${tabDefs
          .map(
            (tab, i) =>
              `<button data-tab="${esc(tab.key)}" class="vp-tab${i === 0 ? " vp-tab-active" : ""}" style="flex:1;padding:7px 10px;border:0;background:${i === 0 ? T.card : "transparent"};color:${i === 0 ? T.fg : T.mutedFg};border-radius:7px;cursor:pointer;font:${i === 0 ? "600" : "500"} 13px system-ui;${i === 0 ? "box-shadow:0 1px 3px rgba(0,0,0,.28)" : ""}">${esc(tab.label)}</button>`,
          )
          .join("")}
      </div>
    </div>
    <div id="vp-panels" style="flex:1;overflow:auto;min-height:0;padding:14px">
      ${tabDefs
        .map(
          (tab, i) =>
            `<div data-panel="${esc(tab.key)}"${i === 0 ? "" : ' style="display:none"'}></div>`,
        )
        .join("")}
    </div>
  `;

    function detectTopNavHeight(): number {
      let bottom = 0;
      const candidates = document.querySelectorAll(
        'header, nav, [role="banner"], [class*="AppBar"], [class*="Toolbar"], [class*="topbar"], [class*="TopBar"], [class*="navbar"]',
      );
      for (const el of candidates) {
        const cs = getComputedStyle(el);
        if (cs.position !== "fixed" && cs.position !== "sticky") continue;
        const r = el.getBoundingClientRect();
        if (r.top > 6 || r.height > 200 || r.height < 24) continue;
        if (r.bottom > bottom) bottom = r.bottom;
      }
      return bottom;
    }

    const SIDEBAR_W = 340;
    const SIDEBAR_GAP = 16;
    const SIDEBAR_MIN_TOP = 24;

    function applyFixedRightRail(): void {
      const topClear = Math.max(
        SIDEBAR_MIN_TOP,
        Math.ceil(detectTopNavHeight() + 8),
      );
      sidebar.style.position = "fixed";
      sidebar.style.top = topClear + "px";
      sidebar.style.right = SIDEBAR_GAP + "px";
      sidebar.style.bottom = SIDEBAR_GAP + "px";
      sidebar.style.maxHeight = `calc(100vh - ${topClear + SIDEBAR_GAP}px)`;
      sidebar.style.zIndex = "50";
      sidebar.style.width = SIDEBAR_W + "px";
      sidebar.style.alignSelf = "";
      if (sidebar.parentElement !== document.body)
        document.body.appendChild(sidebar);

      const reservePx = SIDEBAR_W + SIDEBAR_GAP * 2;
      const targets = [
        document.querySelector("main"),
        document.querySelector('[class*="MainScroll"]'),
        document.querySelector('[class*="content-scroll"]'),
        document.body,
      ].filter(Boolean) as HTMLElement[];
      for (const t of targets) {
        const prev = t.style.paddingRight;
        t.style.paddingRight = reservePx + "px";
        onCleanup(() => {
          t.style.paddingRight = prev;
        });
      }

      const onResize = () => {
        const next = Math.max(
          SIDEBAR_MIN_TOP,
          Math.ceil(detectTopNavHeight() + 8),
        );
        sidebar.style.top = next + "px";
        sidebar.style.maxHeight = `calc(100vh - ${next + SIDEBAR_GAP}px)`;
      };
      window.addEventListener("resize", onResize);
      onCleanup(() => window.removeEventListener("resize", onResize));
    }

    function tryFlexSibling(): boolean {
      const mainEl = document.querySelector("main") as HTMLElement | null;
      if (!mainEl) return false;
      const flexParent = mainEl.parentElement;
      if (!flexParent) return false;
      // Precondition: only run the invasive sibling reshuffle on a real, laid-out
      // layout. An unsized <main> means the layout isn't ready/valid — fall back
      // to the non-invasive fixed rail instead of mutating a collapsed layout.
      const mainBox = mainEl.getBoundingClientRect();
      if (mainBox.width <= 0 || mainBox.height <= 0) return false;
      const prevDisplays = new Map<HTMLElement, string>();
      [...flexParent.children].forEach((child) => {
        const c = child as HTMLElement;
        if (c !== mainEl && c.id !== "vp-demo-sidebar") {
          prevDisplays.set(c, c.style.display);
          c.style.display = "none";
        }
      });
      const prevParentDisplay = flexParent.style.display;
      const prevParentGap = flexParent.style.gap;
      const prevMainFlex = mainEl.style.flex;
      const prevMainMinWidth = mainEl.style.minWidth;
      if (getComputedStyle(flexParent).display !== "flex")
        flexParent.style.display = "flex";
      flexParent.style.gap = "24px";
      mainEl.style.flex = "1 1 0";
      mainEl.style.minWidth = "0";
      flexParent.appendChild(sidebar);

      const mainRect = mainEl.getBoundingClientRect();
      const sbRect = sidebar.getBoundingClientRect();
      const fitsToRightOfMain = sbRect.left + 5 >= mainRect.right;
      const visibleInViewport =
        sbRect.right <= window.innerWidth + 1 && sbRect.width >= 200;

      if (fitsToRightOfMain && visibleInViewport) return true;

      prevDisplays.forEach((v, child) => {
        child.style.display = v;
      });
      flexParent.style.display = prevParentDisplay;
      flexParent.style.gap = prevParentGap;
      mainEl.style.flex = prevMainFlex;
      mainEl.style.minWidth = prevMainMinWidth;
      return false;
    }

    // Installing the sidebar hides LearningSuite's own right column, so with
    // nothing to show we must not touch the host layout at all.
    if (showSidebar) {
      if (!tryFlexSibling()) applyFixedRightRail();
      onCleanup(() => sidebar.remove());
    }

    function setTab(name: string): void {
      const target = tabDefs.some((tab) => tab.key === name)
        ? name
        : tabDefs[0]?.key;
      if (!target) return;
      sidebar.querySelectorAll(".vp-tab").forEach((b) => {
        const btn = b as HTMLElement;
        const active = btn.dataset.tab === target;
        btn.style.background = active ? T.card : "transparent";
        btn.style.color = active ? T.fg : T.mutedFg;
        btn.style.fontWeight = active ? "600" : "500";
        btn.style.boxShadow = active ? "0 1px 3px rgba(0,0,0,.28)" : "none";
      });
      sidebar.querySelectorAll("[data-panel]").forEach((p) => {
        (p as HTMLElement).style.display =
          p.getAttribute("data-panel") === target ? "" : "none";
      });
    }
    w.__vpSidebarTab = setTab;
    onCleanup(() => {
      delete w.__vpSidebarTab;
    });
    sidebar.querySelectorAll(".vp-tab").forEach((btn) => {
      (btn as HTMLElement).onclick = () =>
        setTab((btn as HTMLElement).dataset.tab!);
    });

    // Coaching panel
    // null when the section has no content and its tab was never created.
    const coachingPanel = sidebar.querySelector<HTMLElement>(
      '[data-panel="coaching"]',
    );
    let coachingSig: string | null = null;
    function renderCoaching(): void {
      if (!coachingPanel) return;
      const sig = `${w.__vpActivePhase}|${w.__vpActiveIntervention}|${w.__vpExpandedPhase}`;
      if (sig === coachingSig) return;
      coachingSig = sig;
      coachingPanel.innerHTML = phases
        .map((p, i) => {
          const open = p.id === w.__vpExpandedPhase;
          const active = p.id === w.__vpActivePhase;
          const dur = Math.round((p.endTimeSec - p.startTimeSec) / 60) || 1;
          return `
        <div style="margin-bottom:10px;border:2px solid ${active ? T.primary : T.border};background:${T.card};border-radius:${T.radius};overflow:hidden;${active ? `box-shadow:0 0 0 4px ${T.primarySoft};` : ""}transition:all .2s">
          <button data-phase-toggle="${esc(p.id)}" style="width:100%;text-align:left;background:none;border:0;padding:12px;cursor:pointer;display:flex;gap:12px;align-items:flex-start">
            <div style="flex-shrink:0;width:36px;height:36px;border-radius:8px;background:${active ? T.primary : T.muted};color:${active ? T.primaryFg : T.mutedFg};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px">${i + 1}</div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <h3 style="margin:0;font:600 14.5px system-ui;color:${active ? T.primary : T.fg}">${esc(p.title)}</h3>
                <span data-seek="${esc(p.startTimeSec)}" style="font:500 11px ui-monospace,monospace;background:${T.muted};color:${T.mutedFg};padding:2px 7px;border-radius:6px;border:1px solid ${T.border};cursor:pointer">${fmt(p.startTimeSec)}</span>
              </div>
              <p style="margin:6px 0 0;color:${T.mutedFg};font-size:13px;line-height:1.5;${open ? "" : "display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden"}">${esc(p.description)}</p>
              ${
                !open
                  ? `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
                <span style="font:500 11px system-ui;background:${T.muted};color:${T.mutedFg};padding:2px 8px;border-radius:999px;border:1px solid ${T.border}">${esc(
                  tr("demo.phase.count", { count: p.interventions.length }),
                )}</span>
                <span style="font:500 11px ui-monospace,monospace;background:transparent;color:${T.mutedFg};padding:2px 8px;border-radius:999px;border:1px solid ${T.border}">⏱ ${esc(
                  tr("demo.phase.duration", { min: dur }),
                )}</span>
              </div>`
                  : ""
              }
            </div>
          </button>
          ${
            open
              ? `<div style="padding:0 12px 12px">
            <div style="border-top:1px solid ${T.border};padding-top:12px">
              <div style="font:600 11px system-ui;letter-spacing:.6px;text-transform:uppercase;color:${T.mutedFg};margin-bottom:8px">${esc(tr("demo.phase.interventions"))}</div>
              <div style="display:grid;gap:6px">
                ${p.interventions
                  .map((iv) => {
                    const ivActive = iv.id === w.__vpActiveIntervention;
                    return `<div data-seek="${esc(iv.t)}" style="padding:9px 11px;border-radius:8px;background:${ivActive ? T.primarySoft : T.neutral};border:1px solid ${ivActive ? T.primaryRing : T.border};cursor:pointer">
                    <div style="display:flex;gap:8px;align-items:baseline">
                      <span style="font:700 11.5px ui-monospace,monospace;color:${ivActive ? T.primary : T.mutedFg};min-width:28px">${esc(iv.label)}</span>
                      <strong style="flex:1;font:600 13px system-ui;color:${T.fg}">${esc(iv.title)}</strong>
                      <span style="font:500 11px ui-monospace,monospace;color:${T.mutedFg}">${fmt(iv.t)}</span>
                    </div>
                    <div style="margin:4px 0 0 36px;color:${T.mutedFg};font-size:12.5px">${esc(iv.desc)}</div>
                  </div>`;
                  })
                  .join("")}
              </div>
            </div>
          </div>`
              : ""
          }
        </div>`;
        })
        .join("");

      coachingPanel.querySelectorAll("[data-phase-toggle]").forEach((b) => {
        const btn = b as HTMLElement;
        btn.onclick = (e) => {
          const seekEl = (e.target as HTMLElement).closest(
            "[data-seek]",
          ) as HTMLElement | null;
          if (seekEl) {
            e.stopPropagation();
            window.player.seek(Number(seekEl.dataset.seek) + 0.1);
            return;
          }
          const id = btn.dataset.phaseToggle!;
          w.__vpExpandedPhase = w.__vpExpandedPhase === id ? null : id;
          renderCoaching();
        };
      });
      coachingPanel.querySelectorAll("[data-seek]").forEach((el) => {
        (el as HTMLElement).onclick = (e) => {
          e.stopPropagation();
          window.player.seek(Number((el as HTMLElement).dataset.seek) + 0.1);
        };
      });
    }
    if (phases.length) w.__vpExpandedPhase = phases[0].id;
    renderCoaching();

    // Science panel
    const sciencePanel = sidebar.querySelector<HTMLElement>(
      '[data-panel="science"]',
    );
    function renderSciencePanel(): void {
      if (!sciencePanel) return;
      sciencePanel.innerHTML = `<div style="display:grid;gap:8px">
      ${sciences
        .map((s) => {
          const hl = w.__vpHighlightedScience === s.id;
          return `<div data-sci-card="${esc(s.id)}" style="border:1px solid ${hl ? T.primary : T.border};border-radius:${T.radius};padding:12px;background:${T.card};${hl ? `box-shadow:0 0 0 4px ${T.primarySoft};` : ""}transition:all .2s">
          <div style="display:flex;align-items:baseline;gap:8px">
            <h3 style="margin:0;font:600 14px system-ui;color:${hl ? T.primary : T.fg};flex:1">${esc(s.name)}</h3>
            <span style="font:500 11px system-ui;background:${T.muted};color:${T.mutedFg};padding:2px 7px;border-radius:999px">${esc(
              tr("demo.science.mentions", { count: s.timestampsSec.length }),
            )}</span>
          </div>
          <p style="margin:6px 0 0;color:${T.mutedFg};font-size:13px;line-height:1.5">${esc(s.description)}</p>
          <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
            ${s.timestampsSec
              .map(
                (t) =>
                  `<span data-seek="${esc(t)}" style="font:500 11.5px ui-monospace,monospace;color:${T.primary};background:${T.primarySoft};padding:3px 8px;border-radius:6px;border:1px solid ${T.primaryRing};cursor:pointer">${fmt(t)}</span>`,
              )
              .join("")}
          </div>
        </div>`;
        })
        .join("")}
    </div>`;
      sciencePanel.querySelectorAll("[data-seek]").forEach((el) => {
        (el as HTMLElement).onclick = () =>
          window.player.seek(Number((el as HTMLElement).dataset.seek) + 0.1);
      });
    }
    function renderScienceHighlight(): void {
      renderSciencePanel();
      const id = w.__vpHighlightedScience;
      if (!id || !sciencePanel) return;
      const card = sciencePanel.querySelector(
        `[data-sci-card="${CSS.escape(id)}"]`,
      );
      if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    renderSciencePanel();

    // Meta Structure panel
    const metaPanel = sidebar.querySelector<HTMLElement>('[data-panel="meta"]');
    let metaSig: string | null = null;
    function renderMeta(): void {
      if (!metaPanel) return;
      const sig = w.__vpActiveMeta ?? "";
      if (sig === metaSig) return;
      metaSig = sig;
      metaPanel.innerHTML = `<div style="font:600 11px system-ui;letter-spacing:.6px;text-transform:uppercase;color:${T.mutedFg};margin-bottom:10px">${esc(tr("demo.meta.heading"))}</div>
      <ol style="list-style:none;padding:0;margin:0;display:grid;gap:6px">
        ${metaSteps
          .map((m) => {
            const active = w.__vpActiveMeta === m.id;
            return `<li data-seek="${esc(m.t)}" style="padding:10px 11px;border-radius:${T.radius};background:${active ? T.primarySoft : T.card};border:1px solid ${active ? T.primaryRing : T.border};cursor:pointer;display:flex;gap:10px;align-items:flex-start">
            <div style="flex-shrink:0;width:28px;height:28px;border-radius:7px;background:${active ? T.primary : T.muted};color:${active ? T.primaryFg : T.mutedFg};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px">${esc(m.n)}</div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;gap:8px;align-items:baseline">
                <strong style="font:600 13.5px system-ui;color:${T.fg};flex:1">${esc(m.title)}</strong>
                <span style="font:500 11px ui-monospace,monospace;color:${T.mutedFg}">${fmt(m.t)}</span>
              </div>
            </div>
          </li>`;
          })
          .join("")}
      </ol>`;
      metaPanel.querySelectorAll("[data-seek]").forEach((el) => {
        (el as HTMLElement).onclick = () =>
          window.player.seek(Number((el as HTMLElement).dataset.seek) + 0.1);
      });
    }
    renderMeta();

    // ─── Time sync ───

    // True once the learner has actually started playback. Nothing time-
    // triggered may fire before that: recomputeActive() also runs once at mount
    // with t = 0 (see the end of this function's section), and a cue or quiz
    // authored at t:0 would otherwise open with no user action at all — measured
    // on the live tenant as a 119s voice-over playing over a paused video.
    //
    // Read from the media element rather than the bus `play` event, for two
    // independent reasons. (a) `paused` is authoritative even when no event is
    // coming: this latch is mount-scoped, so a remount mid-playback resets it to
    // false, and the next bus event is a `time`, not a `play` — an event-armed
    // latch would stay shut and suppress every remaining cue for the rest of the
    // lesson. (b) window.player is a PlayerApi and has no `paused` at all.
    //
    // One-way on purpose: a later pause must NOT re-close it, or pausing
    // mid-lesson would swallow every cue that comes due afterwards.
    let playbackStarted = false;
    function hasPlaybackStarted(): boolean {
      if (playbackStarted) return true;
      if (videoEl && !videoEl.paused) playbackStarted = true;
      return playbackStarted;
    }

    // Keeping the video paused for as long as a cue is live.
    //
    // `activate()`'s pause is not the call that fails — measured on the tenant
    // it returns with `paused === true` every time. LearningSuite's own React
    // player owns a "should be playing" state and re-asserts it ~3ms later
    // (`vendor.js` → play(), from React's unstable_runWithPriority, alongside
    // its resume-position seek), silently undoing the pre-roll. Mid-lesson cues
    // never showed this: they pause from a `time` event, long after the press
    // has settled. Only the t:0 pre-roll pauses inside the host's own
    // play-handling tick, and there the host wins the race.
    //
    // A one-shot pause cannot express "the video stays parked while a cue
    // plays" on a page whose own player also drives the element, so the
    // invariant is re-asserted on every play that arrives under a live cue.
    // Deliberately covers the quiz as well: it pauses the same element from the
    // same gated call site and has the identical race at t:0.
    //
    // Safe against `end({ resume: true })`: that sets `state` to "idle" BEFORE
    // calling `videoEl.play()`, so a resume is never "a play under a live cue".
    let repauses = 0;
    let repausedFor: string | null = null;
    function enforceCuePause(): void {
      // Keyed on WHICH cue is live, not merely on whether one is, so the budget
      // is reset by the next cue itself. Resetting only on a play that arrives
      // with nothing live would leave the budget spent, because the resume in
      // `end({ resume: true })` is not guaranteed to reach us as a bus event
      // before the following cue activates. Quizzes share one token: the
      // controller exposes no id, and two breaks are always separated by the
      // resume in between, which clears the budget through the branch below.
      const live =
        audioCtrl.active?.id ?? (quizCtrl?.isActive() === true ? "quiz" : null);
      if (!live) {
        repauses = 0;
        repausedFor = null;
        return;
      }
      if (live !== repausedFor) {
        repausedFor = live;
        repauses = 0;
      }
      if (!videoEl || videoEl.paused) return;

      // Capped rather than unconditional. The tenant re-asserts play exactly
      // once per press, so three covers the measured behaviour with margin —
      // but a host that fought back on *every* pause would turn an uncapped
      // guard into a pause/play war at ~60ms intervals, and a stuttering (or
      // wedged) player is a worse outcome for the learner than a voice-over
      // that briefly talks over a running video. Past the cap we stop fighting
      // and let the video run: the cue still plays out and its card stays up.
      //
      // The counter is reset per cue by the branch above, so a lesson with many
      // cues gets three attempts each, not three in total.
      if (repauses >= MAX_CUE_REPAUSES) return;
      repauses += 1;
      try {
        videoEl.pause();
      } catch {
        /* ignore */
      }
    }

    function recomputeActive(t: number): void {
      const phase =
        phases.find((p) => t >= p.startTimeSec && t < p.endTimeSec) || null;
      const intervention = phase
        ? activeInterventionId(phase.interventions, t)
        : null;
      let meta: string | null = null;
      for (const m of metaSteps) if (t >= m.t) meta = m.id;

      const phaseChanged = w.__vpActivePhase !== phase?.id;
      w.__vpActivePhase = phase?.id ?? null;
      w.__vpActiveIntervention = intervention;
      w.__vpActiveMeta = meta;
      if (phaseChanged && phase) w.__vpExpandedPhase = phase.id;

      renderCoaching();
      renderMeta();
      renderSection();

      // Priority: an open quiz outranks a voice-over cue, which outranks the
      // passive pills. Asking the quiz first is what keeps a cue from starting
      // underneath an open dialog.
      //
      // Both triggers — and ONLY these two — sit behind the playback gate: they
      // are the only calls here that pause the video or start audio. The five
      // renderers above and below must keep running while paused, because
      // renderSection/renderMetaStep/renderScience have no other call site and
      // the pills would never appear on a lesson the learner has not started.
      //
      // This is also where the t:0 pre-roll happens, with no extra wiring: the
      // bus routes `play` here, bus.emit is synchronous from reskin-player's
      // native `play` listener, and the HTML spec sets `paused` false before
      // queuing that event — so the gate opens and a due t:0 cue fires (pausing
      // the video again) inside the same call stack as the native play, before
      // a frame or a moment of the video's own audio gets out.
      const started = hasPlaybackStarted();
      if (started) quizCtrl?.onTime(t);
      const quizOpen = quizCtrl?.isActive() === true;

      if (started && !quizOpen) maybeTriggerAudio(t);

      if (quizOpen) {
        clearMetaPill();
        clearSciencePill();
      } else if (showAudio && audioCtrl.isActive()) {
        renderAudio();
        clearMetaPill();
        renderScience(t);
      } else {
        renderMetaStep(t);
        renderScience(t);
      }
    }

    function clearMetaPill(): void {
      if (slotBR.dataset.kind !== "meta") return;
      slotBR.innerHTML = "";
      slotBR.dataset.kind = "";
      slotBR.dataset.activeMeta = "";
    }

    function clearSciencePill(): void {
      if (!slotTR.dataset.activeSci) return;
      slotTR.innerHTML = "";
      slotTR.dataset.activeSci = "";
    }

    const offBus = window.player.on("any", (e) => {
      if (mountState.disposed) return;
      if (e.type === "play") quizCtrl?.onPlay();
      if (e.type === "time" || e.type === "play" || e.type === "pause") {
        recomputeActive(e.time ?? window.player.current ?? 0);
        // After recompute, never before: on the learner's own press the cue is
        // activated *by* that recompute, and only then is there an invariant to
        // hold. On the host's re-assertion recompute is a no-op (a live cue
        // makes maybeTriggerAudio early-return) and this is what parks the
        // video again.
        if (e.type === "play") enforceCuePause();
      }
      // `ended` was previously filtered out entirely; end-anchored quiz breaks
      // and the summary both hang off it.
      if (e.type === "ended") quizCtrl?.onEnded();
    });
    if (typeof offBus === "function") onCleanup(offBus);
    recomputeActive(window.player.current ?? 0);

    // The host (React) sometimes strips DOM we appended to the player host on a
    // later reconciliation pass even though the config is unchanged. The
    // debounced watcher calls this each tick to decide whether to remount. Only
    // assert nodes this mount actually created — see the show* flags.
    mountState.checkAlive = () => {
      if (!playerHost.isConnected) return false;
      if (window.player !== mountedPlayer) return false;
      if (findPlayers()[0] !== mountedMediaEl) return false;
      if (!slotTL.isConnected) return false;
      if (!slotTR.isConnected) return false;
      if (!slotBR.isConnected) return false;
      if (!slotLowerThird.isConnected) return false;
      if (showQuiz && !slotQuiz?.isConnected) return false;
      if (showSidebar && !sidebar.isConnected) return false;
      return true;
    };

    console.info("[vp] demo overlays mounted");
  }
}

// Kill-switch gate: ask our own API whether to run before touching the page.
// Fails open (see common/killswitch) so a fetch failure never disables it.
void (async () => {
  const status = (await shouldRun(runtimeBaseUrl))
    ? main()
    : "demo: disabled by kill-switch";
  (window as unknown as { __vpDemoStatus?: string }).__vpDemoStatus = status;
})();
