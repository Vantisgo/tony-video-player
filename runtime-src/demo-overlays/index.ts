import { resolveAttachmentUrl } from "../common/attachments";
import { resetCleanup, pushCleanup } from "../common/cleanup";
import { esc } from "../common/escape";
import { formatTime as fmt } from "../common/format";
import { type ConfigHit, loadVpConfig, parseVpConfig } from "../common/config";
import { findPlayers, resolveHost } from "../common/player";
import { getBunnyVideoId } from "../common/tracks";
import { getRuntimeBaseUrl } from "../common/runtime-url";
import { shouldRun } from "../common/killswitch";
import { report } from "../common/beacon";
import type { Audio, Intervention, Phase, VpConfig } from "../common/types";
import {
  DEFAULT_AUDIOS,
  DEFAULT_META_STEPS,
  DEFAULT_PHASES,
  DEFAULT_SCIENCES,
} from "./data";
import { ANIM_CSS, SECTION_CSS, T } from "./styles";

const CLEANUP_KEY = "__vpDemoCleanup";
const AUDIO_EL_ID = "vp-audio-el";

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

interface AudioController {
  state: "idle" | "playing" | "paused";
  // "file" plays the real attachment audio and takes its clock from the
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

function main(): string {
  // Idempotency: tear down anything left from a prior run before mounting again.
  resetCleanup(CLEANUP_KEY);

  // LearningSuite renders the embed-block config asynchronously via React, after
  // head scripts run. Wait for both the <pre data-vp-config> and an <hls-video>,
  // then defer two animation frames so React has finished reconciling.
  function deferAndApply(hit: ConfigHit): void {
    requestAnimationFrame(() => requestAnimationFrame(() => applySetup(hit)));
  }

  function readyContext(): ConfigHit | null {
    const hit = loadVpConfig();
    if (!hit) return null;
    if (!findPlayers()[0]) return null;
    return hit;
  }

  const initialContext = readyContext();
  if (!initialContext) {
    console.info("[vp] waiting for both <pre data-vp-config> and a player");
    let done = false;
    const watcher = new MutationObserver(() => {
      if (done) return;
      const hit = readyContext();
      if (!hit) return;
      done = true;
      watcher.disconnect();
      deferAndApply(hit);
    });
    watcher.observe(document.body || document.documentElement, {
      subtree: true,
      childList: true,
    });
    pushCleanup(CLEANUP_KEY, () => watcher.disconnect());
    // No-context deadline: if the config is present but the context never becomes
    // ready (player never appears), report once after a grace period (F6).
    if (loadVpConfig()) {
      const deadline = setTimeout(() => {
        if (!done) reportFailure("demo-context-timeout");
      }, 10000);
      pushCleanup(CLEANUP_KEY, () => clearTimeout(deadline));
    }
    return "demo: waiting for config + video";
  }
  deferAndApply(initialContext);
  return "demo: setup queued";

  function applySetup(cfgHit: ConfigHit): void {
    // Safety net: if mounting throws part-way, tear down registered cleanups and
    // remove any nodes we created, restoring the host DOM (never a half-mounted
    // overlay set + leaked observers).
    try {
      applySetupInner(cfgHit);
    } catch (err) {
      console.error("[vp demo] setup failed; restoring host", err);
      resetCleanup(CLEANUP_KEY);
      [
        "vp-slot-tl",
        "vp-slot-tr",
        "vp-slot-br",
        "vp-slot-lt",
        "vp-demo-sidebar",
        "vp-anim-style",
        "__vp-section-style",
        AUDIO_EL_ID,
      ].forEach((id) => document.getElementById(id)?.remove());
      reportFailure("demo-setup-error");
    }
  }

  function applySetupInner(cfgHit: ConfigHit): void {
    console.info(`[vp] config loaded from ${cfgHit.source}`);
    const parsed = parseVpConfig(cfgHit.data);
    const phases: Phase[] = parsed.phases ?? DEFAULT_PHASES;
    const sciences = parsed.sciences ?? DEFAULT_SCIENCES;
    const audios = parsed.audios ?? DEFAULT_AUDIOS;
    const metaSteps = parsed.metaSteps ?? DEFAULT_META_STEPS;
    w.__vpConfig = {
      source: cfgHit.source,
      data: { phases, sciences, audios, metaSteps },
    };

    // ─── Animation keyframes (inject once) ───
    if (!document.getElementById("vp-anim-style")) {
      const s = document.createElement("style");
      s.id = "vp-anim-style";
      s.textContent = ANIM_CSS;
      document.head.appendChild(s);
    }

    // ─── Player overlay slots ───
    const player = findPlayers()[0];
    const playerHost = player ? resolveHost(player) : null;
    if (!playerHost) {
      console.warn("[demo] no player host");
      return;
    }
    if (getComputedStyle(playerHost).position === "static")
      playerHost.style.position = "relative";

    [
      "vp-slot-tl",
      "vp-slot-tr",
      "vp-slot-br",
      "vp-slot-lt",
      "vp-demo-sidebar",
    ].forEach((id) => document.getElementById(id)?.remove());

    function makeSlot(id: string, posCss: string): HTMLElement {
      const el = document.createElement("div");
      el.id = id;
      el.style.cssText = `position:absolute; ${posCss}; pointer-events:none; z-index:8;`;
      const swallow = (e: Event) => {
        if (e.target !== el) e.stopPropagation();
      };
      [
        "click",
        "dblclick",
        "mousedown",
        "mouseup",
        "pointerdown",
        "pointerup",
        "touchstart",
        "touchend",
      ].forEach((ev) => el.addEventListener(ev, swallow));
      playerHost!.appendChild(el);
      return el;
    }
    const slotTL = makeSlot(
      "vp-slot-tl",
      "top:14px; left:14px; right:14px; max-width:none",
    );
    const slotTR = makeSlot("vp-slot-tr", "top:10px; right:10px;");
    const slotBR = makeSlot("vp-slot-br", "bottom:70px; right:14px;");
    const slotLowerThird = makeSlot(
      "vp-slot-lt",
      "left:14px; right:14px; bottom:70px;",
    );

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
        <div class="vp-sec-eyebrow">Course Section</div>
        <h3 class="vp-sec-h3" data-section-h3></h3>
        <div data-progress-block>
          <div class="vp-sec-bar"><div class="vp-sec-bar-fill" data-bar-fill style="width:0%"></div></div>
          <div class="vp-sec-count" data-count></div>
          <div class="vp-sec-rows" data-rows></div>
        </div>
        <div data-empty hidden style="color:rgba(255,237,213,.65); font-size:13px">Starting soon...</div>
      </div>
    </div>`;
    slotTL.appendChild(sectionPill);

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
      const t = window.player.current ?? 0;
      const phase = phases.find((p) => t >= p.startTimeSec && t < p.endTimeSec);
      const section = phase?.title ?? "Intro";
      const subs = phase
        ? phase.interventions.map((iv) => ({
            ...iv,
            completed: t > iv.t,
            current:
              (
                phase.interventions as {
                  findLast?: (
                    fn: (x: Intervention) => boolean,
                  ) => Intervention | undefined;
                }
              ).findLast?.((x) => t >= x.t)?.id === iv.id,
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
        const countTxt = `${completedCount} of ${subs.length} completed`;
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
      <div data-overlay-action="science" class="vp-anim-right" style="display:inline-flex; align-items:center; gap:8px; background:linear-gradient(135deg, rgba(249,115,22,.30), rgba(245,158,11,.30), rgba(234,179,8,.28)); border:1px solid rgba(253,186,116,.35); border-radius:999px; padding:5px 6px 5px 12px; backdrop-filter:blur(10px); box-shadow:0 10px 24px rgba(0,0,0,.30); color:#fff7ed; pointer-events:auto; cursor:pointer;">
        <span style="font-size:14px;line-height:1">🧪</span>
        <span style="font:600 12px system-ui; color:#fff; letter-spacing:.2px">Science:</span>
        <span style="font:500 12px system-ui; color:rgba(255,237,213,.85); max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${esc(active.name)}</span>
        <button style="background:linear-gradient(90deg, #ea580c, #d97706); color:#fff; border:0; border-radius:999px; padding:4px 11px; font:600 11.5px system-ui; cursor:pointer; flex-shrink:0; line-height:1.3; pointer-events:auto;">Open</button>
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

    // Play the real file when the cue names an attachment we can find on the
    // page; otherwise (and on any playback failure) speak the script instead.
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
        // Resolve lazily: the anchor may render late, and its signed URL is
        // re-minted on every page load, so it is never cached.
        const url = resolveAttachmentUrl(a.audioFile);
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
    audioEl.addEventListener("error", onAudioError);
    pushCleanup(CLEANUP_KEY, () => {
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

    const onCaptureClick = (e: MouseEvent) => {
      if (!audioCtrl.isActive()) return;
      const btn =
        (e.target as HTMLElement)?.closest?.('[data-vp="playpause"]') ?? null;
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        audioCtrl.togglePlay();
      }
    };
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
    document.addEventListener("click", onCaptureClick, true);
    document.addEventListener("keydown", onCaptureKeydown, true);
    pushCleanup(CLEANUP_KEY, () => {
      document.removeEventListener("click", onCaptureClick, true);
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

    // ─── Audio overlay (lower-third banner) ───
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
        const fill = slotLowerThird.querySelector(
          "[data-fill]",
        ) as HTMLElement | null;
        const tEl = slotLowerThird.querySelector(
          "[data-elapsed]",
        ) as HTMLElement | null;
        const pp = slotLowerThird.querySelector(
          '[data-action="audio-playpause"]',
        ) as HTMLElement | null;
        if (fill) fill.style.width = pct + "%";
        if (tEl) tEl.textContent = fmt(elapsed);
        if (pp) pp.textContent = isPlaying ? "⏸" : "▶";
        return true;
      }
      slotLowerThird.dataset.kind = "audio";
      slotLowerThird.dataset.activeAudio = active.id;
      slotLowerThird.innerHTML = `
      <div class="vp-anim-bottom" style="display:flex; align-items:center; gap:14px; background:linear-gradient(135deg, rgba(249,115,22,.22), rgba(245,158,11,.22), rgba(234,179,8,.22)); border:1px solid rgba(253,186,116,.30); border-radius:14px; padding:10px 14px; backdrop-filter:blur(10px); box-shadow:0 14px 32px rgba(0,0,0,.35); color:#fff7ed; pointer-events:auto;">
        <div style="position:relative;flex-shrink:0">
          <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#ea580c,#d97706);border:2px solid #fb923c;display:flex;align-items:center;justify-content:center;font:700 14px system-ui;color:#fff">FH</div>
          <div style="position:absolute;right:-3px;bottom:-3px;width:16px;height:16px;border-radius:50%;border:2px solid #fff;background:linear-gradient(135deg,#ea580c,#d97706);display:flex;align-items:center;justify-content:center;font-size:9px">🎙️</div>
        </div>
        <div style="flex:0 0 auto; min-width:0; max-width:35%;">
          <div style="font:700 13.5px system-ui;color:#fff; overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(active.title)}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:1px">
            <span style="font:500 11px system-ui;color:rgba(255,237,213,.7); overflow:hidden;text-overflow:ellipsis;white-space:nowrap">by ${esc(active.voice)}</span>
            <span style="width:4px;height:4px;border-radius:50%;background:#fbbf24" class="vp-pulse"></span>
            <span style="font:500 10.5px system-ui;color:rgba(255,237,213,.55);text-transform:uppercase;letter-spacing:.4px">${isPlaying ? "Playing" : "Paused"}</span>
          </div>
        </div>
        <div style="flex:1; display:flex; align-items:center; gap:10px; min-width:0;">
          <span data-elapsed style="font:500 11px ui-monospace,monospace;color:rgba(255,237,213,.7);min-width:36px">${fmt(elapsed)}</span>
          <div style="flex:1;height:6px;background:rgba(255,255,255,.12);border-radius:999px;overflow:hidden">
            <div data-fill style="width:${pct}%; height:100%; background:linear-gradient(90deg,#fb923c,#fbbf24,#facc15); transition:width .15s linear;"></div>
          </div>
          <span style="font:500 11px ui-monospace,monospace;color:rgba(255,237,213,.7);min-width:36px;text-align:right">${fmt(active.dur)}</span>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button data-action="audio-back" title="-10s" style="background:rgba(255,255,255,.15);color:#fff;border:0;border-radius:8px;padding:7px 10px;font:500 12px system-ui;cursor:pointer">−10s</button>
          <button data-action="audio-playpause" title="Play/Pause" style="background:linear-gradient(90deg,#ea580c,#d97706);color:#fff;border:0;border-radius:8px;padding:7px 12px;font:500 13px system-ui;cursor:pointer;min-width:36px">${isPlaying ? "⏸" : "▶"}</button>
          <button data-action="audio-fwd" title="+10s" style="background:rgba(255,255,255,.15);color:#fff;border:0;border-radius:8px;padding:7px 10px;font:500 12px system-ui;cursor:pointer">+10s</button>
          <button data-action="audio-skip" title="Skip" style="background:rgba(255,255,255,.15);color:#fff;border:0;border-radius:8px;padding:7px 10px;font:500 12px system-ui;cursor:pointer">⏭</button>
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
      <div data-overlay-action="meta" class="vp-anim-right" style="display:inline-flex; align-items:center; gap:10px; background:linear-gradient(135deg, rgba(139,92,246,.22), rgba(168,85,247,.22), rgba(217,70,239,.22)); border:1px solid rgba(196,181,253,.30); border-radius:999px; padding:5px 14px 5px 5px; backdrop-filter:blur(10px); box-shadow:0 12px 28px rgba(0,0,0,.30); color:#f5f3ff; pointer-events:auto; white-space:nowrap; cursor:pointer;" title="Open Meta Structure">
        <div style="width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg, #7c3aed, #9333ea); color:#fff; display:flex; align-items:center; justify-content:center; font:700 13px system-ui; flex-shrink:0">${esc(active.n)}</div>
        <span style="font:600 10.5px system-ui; letter-spacing:.5px; text-transform:uppercase; color:rgba(221,214,254,.75)">Step ${esc(active.n)} / 7</span>
        <span style="width:1px; height:14px; background:rgba(196,181,253,.35)"></span>
        <span style="font:600 13px system-ui; color:#fff; line-height:1">${esc(active.title)}</span>
      </div>`;
      (
        slotBR.querySelector('[data-overlay-action="meta"]') as HTMLElement
      ).onclick = (e) => {
        e.stopPropagation();
        w.__vpSidebarTab?.("meta");
      };
    }

    // ─── Sidebar (Coaching / Science / Meta Structure) ───
    const sidebar = document.createElement("aside");
    sidebar.id = "vp-demo-sidebar";
    sidebar.style.cssText = `width:380px; flex-shrink:0; background:${T.card}; color:${T.fg}; border-radius:14px; box-shadow:0 4px 16px rgba(0,0,0,.06); font:14px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif; border:1px solid ${T.border}; display:flex; flex-direction:column; overflow:hidden; align-self:flex-start; position:sticky; top:16px; max-height:calc(100vh - 32px);`;
    sidebar.innerHTML = `
    <div style="padding:12px 14px 0">
      <div style="display:flex;gap:4px;background:${T.muted};padding:4px;border-radius:10px;">
        <button data-tab="coaching" class="vp-tab vp-tab-active" style="flex:1;padding:7px 10px;border:0;background:${T.card};color:${T.fg};border-radius:7px;cursor:pointer;font:600 13px system-ui;box-shadow:0 1px 2px rgba(0,0,0,.06)">Coaching</button>
        <button data-tab="science"  class="vp-tab" style="flex:1;padding:7px 10px;border:0;background:transparent;color:${T.mutedFg};border-radius:7px;cursor:pointer;font:500 13px system-ui">Science</button>
        <button data-tab="meta"     class="vp-tab" style="flex:1;padding:7px 10px;border:0;background:transparent;color:${T.mutedFg};border-radius:7px;cursor:pointer;font:500 13px system-ui">Meta Structure</button>
      </div>
    </div>
    <div id="vp-panels" style="flex:1;overflow:auto;min-height:0;padding:14px">
      <div data-panel="coaching"></div>
      <div data-panel="science"  style="display:none"></div>
      <div data-panel="meta"     style="display:none"></div>
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
        pushCleanup(CLEANUP_KEY, () => {
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
      pushCleanup(CLEANUP_KEY, () =>
        window.removeEventListener("resize", onResize),
      );
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

    if (!tryFlexSibling()) applyFixedRightRail();

    function setTab(name: string): void {
      sidebar.querySelectorAll(".vp-tab").forEach((b) => {
        const btn = b as HTMLElement;
        const active = btn.dataset.tab === name;
        btn.style.background = active ? T.card : "transparent";
        btn.style.color = active ? T.fg : T.mutedFg;
        btn.style.fontWeight = active ? "600" : "500";
        btn.style.boxShadow = active ? "0 1px 2px rgba(0,0,0,.06)" : "none";
      });
      sidebar.querySelectorAll("[data-panel]").forEach((p) => {
        (p as HTMLElement).style.display =
          p.getAttribute("data-panel") === name ? "" : "none";
      });
    }
    w.__vpSidebarTab = setTab;
    sidebar.querySelectorAll(".vp-tab").forEach((btn) => {
      (btn as HTMLElement).onclick = () =>
        setTab((btn as HTMLElement).dataset.tab!);
    });

    // Coaching panel
    const coachingPanel = sidebar.querySelector(
      '[data-panel="coaching"]',
    ) as HTMLElement;
    let coachingSig: string | null = null;
    function renderCoaching(): void {
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
            <div style="flex-shrink:0;width:36px;height:36px;border-radius:8px;background:${active ? T.primary : T.muted};color:${active ? "#fff" : T.mutedFg};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px">${i + 1}</div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <h3 style="margin:0;font:600 14.5px system-ui;color:${active ? T.primary : T.fg}">${esc(p.title)}</h3>
                <span data-seek="${esc(p.startTimeSec)}" style="font:500 11px ui-monospace,monospace;background:${T.muted};color:${T.mutedFg};padding:2px 7px;border-radius:6px;border:1px solid ${T.border};cursor:pointer">${fmt(p.startTimeSec)}</span>
              </div>
              <p style="margin:6px 0 0;color:${T.mutedFg};font-size:13px;line-height:1.5;${open ? "" : "display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden"}">${esc(p.description)}</p>
              ${
                !open
                  ? `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
                <span style="font:500 11px system-ui;background:${T.muted};color:${T.mutedFg};padding:2px 8px;border-radius:999px;border:1px solid ${T.border}">${p.interventions.length} interventions</span>
                <span style="font:500 11px ui-monospace,monospace;background:transparent;color:${T.mutedFg};padding:2px 8px;border-radius:999px;border:1px solid ${T.border}">⏱ ${dur}m</span>
              </div>`
                  : ""
              }
            </div>
          </button>
          ${
            open
              ? `<div style="padding:0 12px 12px">
            <div style="border-top:1px solid ${T.border};padding-top:12px">
              <div style="font:600 11px system-ui;letter-spacing:.6px;text-transform:uppercase;color:${T.mutedFg};margin-bottom:8px">Interventions</div>
              <div style="display:grid;gap:6px">
                ${p.interventions
                  .map((iv) => {
                    const ivActive = iv.id === w.__vpActiveIntervention;
                    return `<div data-seek="${esc(iv.t)}" style="padding:9px 11px;border-radius:8px;background:${ivActive ? T.primarySoft : T.muted};border:1px solid ${ivActive ? T.primaryRing : T.border};cursor:pointer">
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
    w.__vpExpandedPhase = phases[0].id;
    renderCoaching();

    // Science panel
    const sciencePanel = sidebar.querySelector(
      '[data-panel="science"]',
    ) as HTMLElement;
    function renderSciencePanel(): void {
      sciencePanel.innerHTML = `<div style="display:grid;gap:8px">
      ${sciences
        .map((s) => {
          const hl = w.__vpHighlightedScience === s.id;
          return `<div data-sci-card="${esc(s.id)}" style="border:1px solid ${hl ? T.primary : T.border};border-radius:${T.radius};padding:12px;background:${T.card};${hl ? `box-shadow:0 0 0 4px ${T.primarySoft};` : ""}transition:all .2s">
          <div style="display:flex;align-items:baseline;gap:8px">
            <h3 style="margin:0;font:600 14px system-ui;color:${hl ? T.primary : T.fg};flex:1">${esc(s.name)}</h3>
            <span style="font:500 11px system-ui;background:${T.muted};color:${T.mutedFg};padding:2px 7px;border-radius:999px">${s.timestampsSec.length} mentions</span>
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
      if (!id) return;
      const card = sciencePanel.querySelector(
        `[data-sci-card="${CSS.escape(id)}"]`,
      );
      if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    renderSciencePanel();

    // Meta Structure panel
    const metaPanel = sidebar.querySelector(
      '[data-panel="meta"]',
    ) as HTMLElement;
    let metaSig: string | null = null;
    function renderMeta(): void {
      const sig = w.__vpActiveMeta ?? "";
      if (sig === metaSig) return;
      metaSig = sig;
      metaPanel.innerHTML = `<div style="font:600 11px system-ui;letter-spacing:.6px;text-transform:uppercase;color:${T.mutedFg};margin-bottom:10px">7 Master Steps</div>
      <ol style="list-style:none;padding:0;margin:0;display:grid;gap:6px">
        ${metaSteps
          .map((m) => {
            const active = w.__vpActiveMeta === m.id;
            return `<li data-seek="${esc(m.t)}" style="padding:10px 11px;border-radius:${T.radius};background:${active ? T.primarySoft : T.card};border:1px solid ${active ? T.primaryRing : T.border};cursor:pointer;display:flex;gap:10px;align-items:flex-start">
            <div style="flex-shrink:0;width:28px;height:28px;border-radius:7px;background:${active ? T.primary : T.muted};color:${active ? "#fff" : T.mutedFg};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px">${esc(m.n)}</div>
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
    function recomputeActive(t: number): void {
      const phase =
        phases.find((p) => t >= p.startTimeSec && t < p.endTimeSec) || null;
      let intervention: string | null = null;
      if (phase)
        for (const iv of [...phase.interventions].sort((a, b) => a.t - b.t))
          if (t >= iv.t) intervention = iv.id;
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

      maybeTriggerAudio(t);
      if (audioCtrl.isActive()) {
        renderAudio();
        if (slotBR.dataset.kind === "meta") {
          slotBR.innerHTML = "";
          slotBR.dataset.kind = "";
          slotBR.dataset.activeMeta = "";
        }
      } else {
        renderMetaStep(t);
      }

      renderScience(t);
    }

    window.player.setOverlays([]);
    const offBus = window.player.on("any", (e) => {
      if (
        e.type === "time" ||
        e.type === "overlay-show" ||
        e.type === "overlay-hide" ||
        e.type === "play" ||
        e.type === "pause"
      ) {
        recomputeActive(e.time ?? window.player.current ?? 0);
      }
    });
    if (typeof offBus === "function") pushCleanup(CLEANUP_KEY, offBus);
    recomputeActive(window.player.current ?? 0);
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
