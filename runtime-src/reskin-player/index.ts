import { createBus } from "../common/bus";
import { pushCleanup, resetCleanup } from "../common/cleanup";
import { listToArray } from "../common/dom";
import { esc } from "../common/escape";
// Aliased to `tr`: `t` is this file's name for the current playback time.
import { t as tr } from "../common/i18n/player";
import { getTrustedOrigins } from "../common/origins";
import { getBunnyVideoId, getHlsApi, trackLabel } from "../common/tracks";
import {
  type DiscoveryStrategy,
  findPlayers,
  resolveHost,
  scanPlayers,
} from "../common/player";
import { getRuntimeBaseUrl } from "../common/runtime-url";
import { shouldRun } from "../common/killswitch";
import { report } from "../common/beacon";
import { loadVpConfig } from "../common/config";
import type {
  ExternalAudioTrack,
  LanguagePack,
  MediaEl,
  OverlaySlot,
  PlayerApi,
  PlayerEvent,
  TrackOption,
} from "../common/types";
import { RESKIN_CSS } from "./styles";
import {
  getLearningSuiteTranscriptTracks,
  getTrackDiagnostics,
  loadLanguagePackForMedia,
} from "./language-pack";

const CLEANUP_KEY = "__vpReskinCleanup";

// Our own origin (the injected <script>'s), resolved synchronously while the
// script executes — used for the kill-switch + telemetry API calls.
const runtimeBaseUrl = getRuntimeBaseUrl();

function reportFailure(errorType: string, videoId: string): void {
  report(runtimeBaseUrl, {
    errorType,
    videoId,
    config: loadVpConfig()?.data ?? null,
  });
}

function ensureReskinStyle(): void {
  const styleId = "__custom-player-style";
  const styleEl =
    document.getElementById(styleId) || document.createElement("style");
  styleEl.id = styleId;
  styleEl.textContent = RESKIN_CSS;
  if (!styleEl.parentNode) document.head.appendChild(styleEl);
}

type AudioSource = "native" | "hls" | "rendition" | "external" | "none";
type SubtitleSource = "external" | "hls" | "native" | "learningSuite" | "none";
interface AudioMenuState {
  source: AudioSource;
  options: TrackOption[];
}
interface SubtitleMenuState {
  source: SubtitleSource;
  options: TrackOption[];
}

function main(): string {
  // Idempotency: tear down anything from a previous run before setting up.
  resetCleanup(CLEANUP_KEY);
  document.querySelectorAll(".vp-shell").forEach((el) => el.remove());
  findPlayers().forEach((el) => {
    delete el.__vpAttached;
  });

  // Reskin CSS (which hides native chrome under [data-vp-reskinned]) is injected
  // lazily on first attach, so a page with no player is never touched.

  // Origins we trust for cross-frame postMessage. Default = same-origin only.
  const vpTrustedOrigins = getTrustedOrigins();

  const bus = createBus<PlayerEvent>();

  window.addEventListener("message", (ev) => {
    if (!vpTrustedOrigins.has(ev.origin)) return;
    const m = ev.data as {
      __source?: string;
      type?: string;
      time?: unknown;
    } | null;
    if (!m || typeof m !== "object" || m.__source !== "sidepanel") return;
    if (m.type === "seek") {
      if (Number.isFinite(m.time)) api.seek(m.time as number);
    } else if (m.type === "play") api.play();
    else if (m.type === "pause") api.pause();
  });
  // Cache the trusted-iframe target list instead of re-querying the DOM on
  // every bus emit (~4x/s during playback). Rebuilt by scan() when the DOM
  // changes (see the MutationObserver below).
  let iframeTargets: { frame: HTMLIFrameElement; origin: string }[] = [];
  function refreshIframeTargets(): void {
    const next: { frame: HTMLIFrameElement; origin: string }[] = [];
    document.querySelectorAll("iframe").forEach((f) => {
      const frame = f as HTMLIFrameElement;
      let origin: string;
      try {
        origin = new URL(frame.src, location.href).origin;
      } catch {
        return;
      }
      if (!vpTrustedOrigins.has(origin)) return;
      next.push({ frame, origin });
    });
    iframeTargets = next;
  }
  bus.on("any", (p) => {
    for (const { frame, origin } of iframeTargets) {
      try {
        frame.contentWindow?.postMessage({ __source: "player", ...p }, origin);
      } catch {
        /* ignore cross-frame post failures */
      }
    }
  });

  const overlays: OverlaySlot[] = [];
  const activeOverlays = new Set<string>();
  let lastDiscovery: DiscoveryStrategy = "none";
  let reportedDiscovery: DiscoveryStrategy | null = null;
  function noteDiscovery(strategy: DiscoveryStrategy): void {
    lastDiscovery = strategy;
    if (strategy !== reportedDiscovery) {
      reportedDiscovery = strategy;
      console.info(`[vp] player discovery: ${strategy}`);
    }
  }
  const runtimeBuild = "audio-drift-badge-passive";
  const externalAudioWarningThresholdSec = 1;
  const externalAudioSyncIntervalMs = 1000;

  let videoEl: MediaEl | null = null;
  const api: PlayerApi = {
    get current() {
      return videoEl?.currentTime ?? 0;
    },
    get duration() {
      return videoEl?.duration ?? 0;
    },
    play() {
      videoEl?.play();
    },
    pause() {
      videoEl?.pause();
    },
    seek(t) {
      if (videoEl) videoEl.currentTime = t;
    },
    on: bus.on,
    setOverlays: (next) => {
      overlays.length = 0;
      overlays.push(...next);
    },
    _diag: () => ({
      runtime: {
        build: runtimeBuild,
        externalAudioAutoSync: false,
        externalAudioWarningThresholdSec,
      },
      hasVideo: !!videoEl,
      discovery: lastDiscovery,
      currentTime: videoEl?.currentTime,
      duration: videoEl?.duration,
      paused: videoEl?.paused,
      readyState: videoEl?.readyState,
      activeOverlays: [...activeOverlays],
      tracks: getTrackDiagnostics(videoEl),
    }),
  };
  window.player = api;
  (window as unknown as { __vpRuntimeInfo?: unknown }).__vpRuntimeInfo = {
    build: runtimeBuild,
    externalAudioAutoSync: false,
    externalAudioWarningThresholdSec,
  };

  let attachedAny = false;
  function attach(hlsEl: MediaEl): void {
    if (hlsEl.__vpAttached) return;
    // Gate: only re-skin when this lesson has Advanced Video Modus turned on.
    if (!document.querySelector("[data-vp-config]")) return;
    if (typeof hlsEl.play !== "function" || !("currentTime" in hlsEl)) return;
    // Safety net: if augmentation throws part-way, undo every host mutation so
    // the native player is left exactly as we found it (never hidden-chrome +
    // no-controls). The success path is owned by the pushCleanup below.
    const undo: (() => void)[] = [];
    const rollback = (): void => {
      while (undo.length) {
        const fn = undo.pop();
        try {
          fn?.();
        } catch {
          /* ignore rollback errors */
        }
      }
    };
    try {
      attachInner(hlsEl, undo);
    } catch (err) {
      console.error("[vp] reskin attach failed; rolling back", err);
      rollback();
      reportFailure(
        "reskin-attach-error",
        getBunnyVideoId(hlsEl.src || hlsEl.getAttribute?.("src")),
      );
    }
  }

  function attachInner(hlsEl: MediaEl, undo: (() => void)[]): void {
    hlsEl.__vpAttached = true;
    undo.push(() => {
      delete hlsEl.__vpAttached;
    });
    // A player was found and we're attaching — suppresses the no-player deadline.
    attachedAny = true;
    // Inject the reskin CSS now (not at script load) so a page with no player is
    // never touched (F5). Chrome-hiding stays gated on [data-vp-reskinned] (F1).
    ensureReskinStyle();

    const mediaEl = hlsEl;
    if (!videoEl || videoEl.getBoundingClientRect().width === 0)
      videoEl = mediaEl;
    // Non-<hls-video> players (a plain <video> reached via capability discovery)
    // don't match the tag-scoped chrome-hiding CSS; drop their native controls
    // directly. Custom-element internals stay out of reach (documented).
    if (hlsEl.tagName !== "HLS-VIDEO" && "controls" in mediaEl) {
      const prevControls = mediaEl.controls;
      mediaEl.controls = false;
      undo.push(() => {
        mediaEl.controls = prevControls;
      });
    }
    const host = resolveHost(hlsEl);
    if (!host) throw new Error("[vp] no positioning host for player");
    (host as HTMLElement).dataset.vpReskinned = "true";
    undo.push(() => {
      delete (host as HTMLElement).dataset.vpReskinned;
    });
    if (getComputedStyle(host).position === "static")
      (host as HTMLElement).style.position = "relative";

    const shell = document.createElement("div");
    shell.className = "vp-shell";
    shell.innerHTML = `
      <div class="vp-overlay-layer" data-vp-overlays></div>
      <div class="vp-subtitle-layer" data-vp-subtitles hidden></div>
      <div class="vp-sync-badge" data-vp-sync-drift hidden></div>
      <div class="vp-controls">
        <button data-vp="playpause" aria-label="${esc(tr("player.aria.playPause"))}">${esc(tr("player.label.play"))}</button>
        <input  data-vp="seek" class="vp-seek" type="range" min="0" max="0" step="0.1" value="0" />
        <span   data-vp="time" class="vp-time">0:00 / 0:00</span>
        <div class="vp-menu-wrap" data-vp-track-menu="audio">
          <button data-vp="audio" aria-label="${esc(tr("player.tracks.audio"))}" aria-haspopup="menu" aria-expanded="false" disabled>${esc(tr("player.label.audio"))}</button>
          <div data-vp-menu="audio" class="vp-menu" role="menu" hidden></div>
        </div>
        <div class="vp-menu-wrap" data-vp-track-menu="captions">
          <button data-vp="captions" aria-label="${esc(tr("player.tracks.subtitles"))}" aria-haspopup="menu" aria-expanded="false" disabled>${esc(tr("player.label.captions"))}</button>
          <div data-vp-menu="captions" class="vp-menu" role="menu" hidden></div>
        </div>
        <button data-vp="mute" aria-label="${esc(tr("player.aria.mute"))}">${esc(tr("player.label.sound"))}</button>
        <button data-vp="fs" aria-label="${esc(tr("player.aria.fullscreen"))}">${esc(tr("player.label.fullscreen"))}</button>
      </div>
    `;
    host.appendChild(shell);
    undo.push(() => shell.remove());

    const q = <T extends HTMLElement>(sel: string): T =>
      shell.querySelector(`[data-vp="${sel}"]`) as T;
    const playPauseBtn = q<HTMLButtonElement>("playpause");
    const seekInput = q<HTMLInputElement>("seek");
    const timeLabel = q<HTMLSpanElement>("time");
    const audioBtn = q<HTMLButtonElement>("audio");
    const captionsBtn = q<HTMLButtonElement>("captions");
    const muteBtn = q<HTMLButtonElement>("mute");
    const fsBtn = q<HTMLButtonElement>("fs");

    const overlayLayer = shell.querySelector(
      "[data-vp-overlays]",
    ) as HTMLElement;
    const subtitleLayer = shell.querySelector(
      "[data-vp-subtitles]",
    ) as HTMLElement;
    const syncDriftBadge = shell.querySelector(
      "[data-vp-sync-drift]",
    ) as HTMLElement;
    const audioMenu = shell.querySelector(
      '[data-vp-menu="audio"]',
    ) as HTMLElement;
    const captionsMenu = shell.querySelector(
      '[data-vp-menu="captions"]',
    ) as HTMLElement;
    // Precondition: bail (→ rollback) before wiring handlers if the shell
    // template didn't produce its required nodes (a future host/template break).
    if (!playPauseBtn || !seekInput || !timeLabel || !overlayLayer)
      throw new Error("[vp] reskin shell is missing required nodes");
    const setActive = () => {
      videoEl = mediaEl;
    };
    let learningSuiteSubtitleIndex = -1;
    let externalLanguagePack: LanguagePack | null = null;
    let externalAudioIndex = -1;
    let externalSubtitleIndex = -1;
    let renderedCueText = "";
    let externalAudioSyncTimer: ReturnType<typeof setInterval> | null = null;
    let audibleMuted = !!mediaEl.muted;
    let disposed = false;
    const externalAudio = new Audio();
    externalAudio.preload = "metadata";
    shell.dataset.vpAudioSource = "native";
    shell.dataset.vpAudioTrack = "native";
    shell.dataset.vpSubtitleSource = "off";
    shell.dataset.vpSubtitleTrack = "off";

    const fmt = (s: number): string => {
      if (!isFinite(s)) return "0:00";
      const n = Math.max(0, s | 0);
      return `${(n / 60) | 0}:${String(n % 60).padStart(2, "0")}`;
    };

    function closeTrackMenus(): void {
      audioMenu.hidden = true;
      captionsMenu.hidden = true;
      audioBtn.setAttribute("aria-expanded", "false");
      captionsBtn.setAttribute("aria-expanded", "false");
    }

    function toggleTrackMenu(name: "audio" | "captions"): void {
      const targetMenu = name === "audio" ? audioMenu : captionsMenu;
      const targetButton = name === "audio" ? audioBtn : captionsBtn;
      const willOpen = targetMenu.hidden;
      closeTrackMenus();
      if (willOpen && !targetButton.disabled) {
        targetMenu.hidden = false;
        targetButton.setAttribute("aria-expanded", "true");
      }
    }

    function renderMenu(
      menu: HTMLElement,
      title: string,
      options: TrackOption[],
      onSelect: (value: number | string) => void,
    ): void {
      menu.replaceChildren();
      const heading = document.createElement("div");
      heading.className = "vp-menu-title";
      heading.textContent = title;
      menu.appendChild(heading);

      for (const option of options) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "vp-menu-option";
        btn.setAttribute("role", "menuitemradio");
        btn.setAttribute("aria-checked", option.selected ? "true" : "false");
        btn.dataset.value = String(option.value);

        const label = document.createElement("span");
        label.className = "vp-menu-label";
        label.textContent = option.label;
        btn.appendChild(label);

        if (option.selected) {
          const current = document.createElement("span");
          current.className = "vp-menu-current";
          current.textContent = tr("player.label.current");
          btn.appendChild(current);
        }

        btn.onclick = (e) => {
          e.stopPropagation();
          setActive();
          onSelect(option.value);
          closeTrackMenus();
          updateTrackMenus();
        };
        menu.appendChild(btn);
      }
    }

    function getNativeAudioOptions(): TrackOption[] | null {
      const tracks = listToArray(mediaEl.audioTracks);
      if (tracks.length <= 1) return null;
      return tracks.map((track, index) => ({
        value: index,
        label: trackLabel(track, index, tr("player.track.audio")),
        selected: !!track.enabled,
      }));
    }

    function getHlsAudioOptions(): TrackOption[] | null {
      const hls = getHlsApi(mediaEl);
      const tracks = Array.isArray(hls?.audioTracks) ? hls.audioTracks : [];
      if (tracks.length <= 1) return null;
      const selectedIndex =
        typeof hls?.audioTrack === "number" ? hls.audioTrack : -1;
      return tracks.map((track, index) => ({
        value: index,
        label: trackLabel(track, index, tr("player.track.audio")),
        selected:
          selectedIndex === index || (selectedIndex < 0 && !!track.default),
      }));
    }

    function getRenditionAudioOptions(): TrackOption[] | null {
      const renditions = listToArray(mediaEl.audioRenditions);
      if (renditions.length <= 1) return null;
      return renditions.map((track, index) => ({
        value: index,
        label: trackLabel(track, index, tr("player.track.audio")),
        selected: !!track.selected || !!track.enabled,
      }));
    }

    function getExternalAudioOptions(): TrackOption[] | null {
      const tracks = Array.isArray(externalLanguagePack?.audioTracks)
        ? externalLanguagePack.audioTracks
        : [];
      if (tracks.length <= 1) return null;
      return tracks.map((track, index) => ({
        value: index,
        label: trackLabel(track, index, tr("player.track.audio")),
        selected: track.useNative
          ? externalAudioIndex < 0
          : externalAudioIndex === index,
      }));
    }

    function getAudioMenuState(): AudioMenuState {
      const nativeOptions = getNativeAudioOptions();
      if (nativeOptions) return { source: "native", options: nativeOptions };

      const hlsOptions = getHlsAudioOptions();
      if (hlsOptions) return { source: "hls", options: hlsOptions };

      const renditionOptions = getRenditionAudioOptions();
      if (renditionOptions)
        return { source: "rendition", options: renditionOptions };

      const externalOptions = getExternalAudioOptions();
      if (externalOptions)
        return { source: "external", options: externalOptions };

      return { source: "none", options: [] };
    }

    function getExternalAudioTrack(): ExternalAudioTrack | null | undefined {
      return externalAudioIndex >= 0
        ? externalLanguagePack?.audioTracks?.[externalAudioIndex]
        : null;
    }

    function expectedExternalAudioTime(): number {
      const track = getExternalAudioTrack();
      const offset = Number(track?.offsetMs || 0) / 1000;
      return Math.max(0, (mediaEl.currentTime || 0) + offset);
    }

    function clearExternalAudioSyncTimer(): void {
      if (externalAudioSyncTimer) {
        clearInterval(externalAudioSyncTimer);
        externalAudioSyncTimer = null;
      }
    }

    function ensureExternalAudioSyncTimer(): void {
      if (externalAudioSyncTimer || externalAudioIndex < 0) return;
      externalAudioSyncTimer = setInterval(
        () => updateExternalAudioDrift(),
        externalAudioSyncIntervalMs,
      );
    }

    function updateExternalAudioDriftBadge(driftSeconds = 0): void {
      if (
        !syncDriftBadge ||
        externalAudioIndex < 0 ||
        Math.abs(driftSeconds) <= externalAudioWarningThresholdSec
      ) {
        if (syncDriftBadge) syncDriftBadge.hidden = true;
        return;
      }
      const sign = driftSeconds > 0 ? "+" : "-";
      syncDriftBadge.textContent = tr("player.drift.badge", {
        offset: `${sign}${Math.abs(driftSeconds).toFixed(1)}`,
      });
      syncDriftBadge.title = tr(
        driftSeconds > 0 ? "player.drift.ahead" : "player.drift.behind",
      );
      syncDriftBadge.hidden = false;
    }

    function updateExternalAudioDrift(): void {
      const track = getExternalAudioTrack();
      if (!track) {
        updateExternalAudioDriftBadge(0);
        return;
      }
      updateExternalAudioDriftBadge(
        (externalAudio.currentTime || 0) - expectedExternalAudioTime(),
      );
    }

    function stopExternalAudio(): void {
      clearExternalAudioSyncTimer();
      externalAudio.pause();
      externalAudio.removeAttribute("src");
      externalAudio.load();
      externalAudioIndex = -1;
      mediaEl.muted = audibleMuted;
      muteBtn.textContent = tr(
        audibleMuted ? "player.label.muted" : "player.label.sound",
      );
      shell.dataset.vpAudioSource = "native";
      shell.dataset.vpAudioTrack = "native";
      updateExternalAudioDriftBadge(0);
    }

    function syncExternalAudio(force = false): void {
      const track = getExternalAudioTrack();
      if (!track) {
        updateExternalAudioDriftBadge(0);
        return;
      }

      const expected = expectedExternalAudioTime();
      const drift = (externalAudio.currentTime || 0) - expected;

      if (force) {
        try {
          externalAudio.currentTime = expected;
        } catch {
          /* ignore seek errors */
        }
      }
      updateExternalAudioDriftBadge(force ? 0 : drift);

      externalAudio.playbackRate = mediaEl.playbackRate || 1;
      externalAudio.muted = audibleMuted;
      mediaEl.muted = true;
      muteBtn.textContent = tr(
        audibleMuted ? "player.label.muted" : "player.label.sound",
      );

      if (mediaEl.paused || mediaEl.ended) {
        externalAudio.pause();
        clearExternalAudioSyncTimer();
        return;
      }

      ensureExternalAudioSyncTimer();
      if (externalAudio.paused) {
        const playPromise = externalAudio.play();
        if (playPromise?.catch)
          playPromise.catch((err) =>
            console.warn("[vp] external audio play failed", err),
          );
      }
    }

    function setExternalAudioTrack(value: number | string): void {
      const index = Number(value);
      const track = externalLanguagePack?.audioTracks?.[index];
      if (!track) return;

      if (track.useNative) {
        stopExternalAudio();
        externalAudioIndex = -1;
        return;
      }

      externalAudioIndex = index;
      shell.dataset.vpAudioSource = "external";
      shell.dataset.vpAudioTrack = track.id || track.language || String(index);
      if (externalAudio.src !== track.url) {
        externalAudio.src = track.url;
        externalAudio.load();
      }
      syncExternalAudio(true);
    }

    function setAudioTrack(source: AudioSource, value: number | string): void {
      const index = Number(value);
      if (!Number.isInteger(index)) return;

      if (source !== "external" && externalAudioIndex >= 0) stopExternalAudio();

      if (source === "external") {
        setExternalAudioTrack(value);
        return;
      }
      if (source === "native") {
        listToArray(mediaEl.audioTracks).forEach((track, i) => {
          track.enabled = i === index;
        });
        return;
      }
      if (source === "hls") {
        const hls = getHlsApi(mediaEl);
        if (hls) hls.audioTrack = index;
        return;
      }
      if (source === "rendition") {
        const rendition = listToArray(mediaEl.audioRenditions)[index];
        try {
          if (rendition) rendition.selected = true;
        } catch {
          /* ignore */
        }
        const hls = getHlsApi(mediaEl);
        if (hls && Array.isArray(hls.audioTracks) && hls.audioTracks[index])
          hls.audioTrack = index;
      }
    }

    function getNativeSubtitleOptions(): TrackOption[] | null {
      const tracks = listToArray(mediaEl.textTracks).filter(
        (track) =>
          track.kind === "subtitles" ||
          track.kind === "captions" ||
          track.kind === "descriptions",
      );
      if (!tracks.length) return null;
      const options: TrackOption[] = [
        {
          value: "off",
          label: tr("player.label.off"),
          selected: !tracks.some((track) => track.mode === "showing"),
        },
      ];
      tracks.forEach((track, index) => {
        options.push({
          value: index,
          label: trackLabel(track, index, tr("player.track.subtitle")),
          selected: track.mode === "showing",
        });
      });
      return options;
    }

    function getHlsSubtitleOptions(): TrackOption[] | null {
      const hls = getHlsApi(mediaEl);
      const tracks = Array.isArray(hls?.subtitleTracks)
        ? hls.subtitleTracks
        : [];
      if (!tracks.length) return null;
      const selectedIndex =
        typeof hls?.subtitleTrack === "number" ? hls.subtitleTrack : -1;
      const display = hls?.subtitleDisplay !== false;
      const options: TrackOption[] = [
        {
          value: "off",
          label: tr("player.label.off"),
          selected: selectedIndex < 0 || !display,
        },
      ];
      tracks.forEach((track, index) => {
        options.push({
          value: index,
          label: trackLabel(track, index, tr("player.track.subtitle")),
          selected: display && selectedIndex === index,
        });
      });
      return options;
    }

    function getLearningSuiteSubtitleOptions(): TrackOption[] | null {
      const tracks = getLearningSuiteTranscriptTracks(mediaEl);
      if (!tracks.length) return null;
      if (learningSuiteSubtitleIndex >= tracks.length)
        learningSuiteSubtitleIndex = -1;
      const options: TrackOption[] = [
        {
          value: "off",
          label: tr("player.label.off"),
          selected: learningSuiteSubtitleIndex < 0,
        },
      ];
      tracks.forEach((track, index) => {
        options.push({
          value: index,
          label: trackLabel(track, index, tr("player.track.subtitle")),
          selected: learningSuiteSubtitleIndex === index,
        });
      });
      return options;
    }

    function getExternalSubtitleOptions(): TrackOption[] | null {
      const tracks = Array.isArray(externalLanguagePack?.subtitleTracks)
        ? externalLanguagePack.subtitleTracks
        : [];
      if (!tracks.length) return null;
      if (externalSubtitleIndex >= tracks.length) externalSubtitleIndex = -1;
      const options: TrackOption[] = [
        {
          value: "off",
          label: tr("player.label.off"),
          selected: externalSubtitleIndex < 0,
        },
      ];
      tracks.forEach((track, index) => {
        options.push({
          value: index,
          label: trackLabel(track, index, tr("player.track.subtitle")),
          selected: externalSubtitleIndex === index,
        });
      });
      return options;
    }

    function getSubtitleMenuState(): SubtitleMenuState {
      const externalOptions = getExternalSubtitleOptions();
      if (externalOptions)
        return { source: "external", options: externalOptions };

      const hlsOptions = getHlsSubtitleOptions();
      if (hlsOptions) return { source: "hls", options: hlsOptions };

      const nativeOptions = getNativeSubtitleOptions();
      if (nativeOptions) return { source: "native", options: nativeOptions };

      const learningSuiteOptions = getLearningSuiteSubtitleOptions();
      if (learningSuiteOptions)
        return { source: "learningSuite", options: learningSuiteOptions };

      return { source: "none", options: [] };
    }

    function renderSubtitleCue(
      track:
        | { cues: { from: number; to: number; text: string }[] }
        | null
        | undefined,
      time: number,
    ): void {
      const cue = track?.cues.find(
        (item) => time >= item.from && time < item.to,
      );
      const nextText = cue?.text ?? "";
      if (nextText === renderedCueText) return;
      renderedCueText = nextText;

      subtitleLayer.replaceChildren();
      if (!nextText) {
        subtitleLayer.hidden = true;
        return;
      }
      const el = document.createElement("span");
      el.className = "vp-subtitle-cue";
      el.textContent = nextText;
      subtitleLayer.appendChild(el);
      subtitleLayer.hidden = false;
    }

    function renderActiveSubtitle(time: number): void {
      if (externalSubtitleIndex >= 0) {
        renderSubtitleCue(
          externalLanguagePack?.subtitleTracks?.[externalSubtitleIndex],
          time,
        );
        return;
      }
      const track =
        learningSuiteSubtitleIndex >= 0
          ? getLearningSuiteTranscriptTracks(mediaEl)[
              learningSuiteSubtitleIndex
            ]
          : null;
      renderSubtitleCue(track, time);
    }

    function setSubtitleTrack(
      source: SubtitleSource,
      value: number | string,
    ): void {
      const nativeTracks = listToArray(mediaEl.textTracks).filter(
        (track) =>
          track.kind === "subtitles" ||
          track.kind === "captions" ||
          track.kind === "descriptions",
      );
      nativeTracks.forEach((track) => {
        track.mode = "disabled";
      });

      if (value === "off") {
        const hls = getHlsApi(mediaEl);
        if (hls) {
          try {
            hls.subtitleTrack = -1;
          } catch {
            /* ignore */
          }
          try {
            hls.subtitleDisplay = false;
          } catch {
            /* ignore */
          }
        }
        learningSuiteSubtitleIndex = -1;
        externalSubtitleIndex = -1;
        shell.dataset.vpSubtitleSource = "off";
        shell.dataset.vpSubtitleTrack = "off";
        renderActiveSubtitle(mediaEl.currentTime || 0);
        return;
      }

      const index = Number(value);
      if (!Number.isInteger(index)) return;

      learningSuiteSubtitleIndex = -1;
      externalSubtitleIndex = -1;

      if (source === "hls") {
        const hls = getHlsApi(mediaEl);
        if (hls) {
          try {
            hls.subtitleDisplay = true;
          } catch {
            /* ignore */
          }
          hls.subtitleTrack = index;
        }
        return;
      }

      if (source === "external") {
        const hls = getHlsApi(mediaEl);
        if (hls) {
          try {
            hls.subtitleTrack = -1;
          } catch {
            /* ignore */
          }
          try {
            hls.subtitleDisplay = false;
          } catch {
            /* ignore */
          }
        }
        externalSubtitleIndex = index;
        shell.dataset.vpSubtitleSource = "external";
        shell.dataset.vpSubtitleTrack =
          externalLanguagePack?.subtitleTracks?.[index]?.id || String(index);
        renderActiveSubtitle(mediaEl.currentTime || 0);
        return;
      }

      if (source === "learningSuite") {
        const hls = getHlsApi(mediaEl);
        if (hls) {
          try {
            hls.subtitleTrack = -1;
          } catch {
            /* ignore */
          }
          try {
            hls.subtitleDisplay = false;
          } catch {
            /* ignore */
          }
        }
        learningSuiteSubtitleIndex = index;
        shell.dataset.vpSubtitleSource = "learningSuite";
        shell.dataset.vpSubtitleTrack =
          getLearningSuiteTranscriptTracks(mediaEl)[index]?.language ||
          String(index);
        renderActiveSubtitle(mediaEl.currentTime || 0);
        return;
      }

      const track = nativeTracks[index];
      if (track) track.mode = "showing";
      shell.dataset.vpSubtitleSource = "native";
      shell.dataset.vpSubtitleTrack =
        track?.language || track?.label || String(index);
      renderActiveSubtitle(mediaEl.currentTime || 0);
    }

    function updateTrackMenus(): void {
      bindHlsTrackEvents();

      const audioState = getAudioMenuState();
      audioBtn.disabled = audioState.options.length <= 1;
      audioBtn.title = audioBtn.disabled
        ? tr("player.title.noAudio")
        : tr("player.title.audio", {
            track: (
              audioState.options.find((o) => o.selected) ||
              audioState.options[0]
            ).label,
          });
      renderMenu(
        audioMenu,
        tr("player.tracks.audio"),
        audioState.options,
        (value) => setAudioTrack(audioState.source, value),
      );
      if (audioBtn.disabled) audioMenu.hidden = true;

      const subtitleState = getSubtitleMenuState();
      captionsBtn.disabled = subtitleState.options.length <= 1;
      captionsBtn.title = captionsBtn.disabled
        ? tr("player.title.noSubtitles")
        : tr("player.title.subtitles", {
            track: (
              subtitleState.options.find((o) => o.selected) ||
              subtitleState.options[0]
            ).label,
          });
      renderMenu(
        captionsMenu,
        tr("player.tracks.subtitles"),
        subtitleState.options,
        (value) => setSubtitleTrack(subtitleState.source, value),
      );
      if (captionsBtn.disabled) captionsMenu.hidden = true;
    }

    let boundHlsApi: ReturnType<typeof getHlsApi> = null;
    let unbindHlsTrackEvents: (() => void) | null = null;
    function bindHlsTrackEvents(): void {
      const hls = getHlsApi(mediaEl);
      if (hls === boundHlsApi) return;
      if (unbindHlsTrackEvents) unbindHlsTrackEvents();
      boundHlsApi = hls;
      unbindHlsTrackEvents = null;
      const events = (
        window as unknown as { Hls?: { Events?: Record<string, string> } }
      ).Hls?.Events;
      if (!hls?.on || !hls?.off || !events) return;
      const eventNames = [
        events.AUDIO_TRACKS_UPDATED,
        events.AUDIO_TRACK_SWITCHED,
        events.SUBTITLE_TRACKS_UPDATED,
        events.SUBTITLE_TRACK_SWITCH,
        events.NON_NATIVE_TEXT_TRACKS_FOUND,
      ].filter(Boolean);
      eventNames.forEach((eventName) => hls.on?.(eventName, updateTrackMenus));
      unbindHlsTrackEvents = () =>
        eventNames.forEach((eventName) => {
          try {
            hls.off?.(eventName, updateTrackMenus);
          } catch {
            /* ignore */
          }
        });
    }

    function addListListener(
      list: EventTarget | null | undefined,
      event: string,
      handler: () => void,
    ): () => void {
      if (!list) return () => {};
      list.addEventListener(event, handler);
      return () => list.removeEventListener(event, handler);
    }

    loadLanguagePackForMedia(mediaEl).then((pack) => {
      if (disposed || !pack) return;
      externalLanguagePack = pack;
      shell.dataset.vpLanguagePack =
        pack.videoId ||
        getBunnyVideoId(mediaEl?.src || mediaEl?.getAttribute?.("src"));
      updateTrackMenus();
      renderActiveSubtitle(mediaEl.currentTime || 0);
    });

    playPauseBtn.onclick = () => {
      setActive();
      if (mediaEl.paused) mediaEl.play();
      else mediaEl.pause();
    };
    seekInput.oninput = (e) => {
      setActive();
      mediaEl.currentTime = +(e.target as HTMLInputElement).value;
      syncExternalAudio(true);
    };
    audioBtn.onclick = (e) => {
      e.stopPropagation();
      setActive();
      toggleTrackMenu("audio");
    };
    captionsBtn.onclick = (e) => {
      e.stopPropagation();
      setActive();
      toggleTrackMenu("captions");
    };
    muteBtn.onclick = () => {
      setActive();
      audibleMuted = !audibleMuted;
      if (externalAudioIndex >= 0) {
        mediaEl.muted = true;
        externalAudio.muted = audibleMuted;
      } else {
        mediaEl.muted = audibleMuted;
      }
      muteBtn.textContent = tr(
        audibleMuted ? "player.label.muted" : "player.label.sound",
      );
    };
    fsBtn.onclick = () => {
      setActive();
      if (!document.fullscreenElement) host.requestFullscreen?.();
      else document.exitFullscreen?.();
    };

    const onMeta = () => {
      seekInput.max = String(mediaEl.duration || 0);
      updateTrackMenus();
    };
    const onTime = () => {
      seekInput.value = String(mediaEl.currentTime);
      timeLabel.textContent = `${fmt(mediaEl.currentTime)} / ${fmt(mediaEl.duration)}`;
      const t = mediaEl.currentTime;
      renderActiveSubtitle(t);
      for (const o of overlays) {
        const should = t >= o.from && t < o.to;
        const isActive = activeOverlays.has(o.id);
        if (should && !isActive) {
          activeOverlays.add(o.id);
          const wrap = document.createElement("div");
          wrap.dataset.vpOverlay = o.id;
          wrap.innerHTML =
            o.render?.({ time: t, duration: mediaEl.duration }) ?? "";
          overlayLayer.appendChild(wrap);
          bus.emit("any", { type: "overlay-show", id: o.id, time: t });
        } else if (!should && isActive) {
          activeOverlays.delete(o.id);
          overlayLayer.querySelector(`[data-vp-overlay="${o.id}"]`)?.remove();
          bus.emit("any", { type: "overlay-hide", id: o.id, time: t });
        }
      }
      bus.emit("any", { type: "time", time: t, duration: mediaEl.duration });
    };
    const onPlay = () => {
      setActive();
      playPauseBtn.textContent = tr("player.label.pause");
      syncExternalAudio();
      bus.emit("any", { type: "play", time: mediaEl.currentTime });
    };
    const onPause = () => {
      playPauseBtn.textContent = tr("player.label.play");
      externalAudio.pause();
      clearExternalAudioSyncTimer();
      bus.emit("any", { type: "pause", time: mediaEl.currentTime });
    };
    const onEnded = () => {
      externalAudio.pause();
      clearExternalAudioSyncTimer();
      bus.emit("any", { type: "ended", time: mediaEl.currentTime });
    };
    const onSeeking = () => {
      if (externalAudioIndex >= 0) externalAudio.pause();
    };
    const onSeeked = () => syncExternalAudio(true);
    const onRateChange = () => syncExternalAudio();
    const onWaiting = () => updateExternalAudioDrift();
    const onPlaying = () => syncExternalAudio();
    const onVolumeChange = () => {
      if (externalAudioIndex >= 0) {
        externalAudio.muted = audibleMuted;
        mediaEl.muted = true;
        return;
      }
      audibleMuted = !!mediaEl.muted;
      muteBtn.textContent = tr(
        audibleMuted ? "player.label.muted" : "player.label.sound",
      );
    };
    const onDocumentClick = (e: MouseEvent) => {
      if (!shell.contains(e.target as Node)) closeTrackMenus();
    };
    const onDocumentKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTrackMenus();
    };

    const cleanups = [
      addListListener(mediaEl.audioTracks, "addtrack", updateTrackMenus),
      addListListener(mediaEl.audioTracks, "removetrack", updateTrackMenus),
      addListListener(mediaEl.audioTracks, "change", updateTrackMenus),
      addListListener(mediaEl.textTracks, "addtrack", updateTrackMenus),
      addListListener(mediaEl.textTracks, "removetrack", updateTrackMenus),
      addListListener(mediaEl.textTracks, "change", updateTrackMenus),
    ];

    shell.addEventListener("pointerdown", setActive);
    shell.addEventListener("focusin", setActive);
    mediaEl.addEventListener("loadedmetadata", onMeta);
    mediaEl.addEventListener("loadeddata", updateTrackMenus);
    mediaEl.addEventListener("durationchange", onMeta);
    mediaEl.addEventListener("timeupdate", onTime);
    mediaEl.addEventListener("play", onPlay);
    mediaEl.addEventListener("pause", onPause);
    mediaEl.addEventListener("ended", onEnded);
    mediaEl.addEventListener("seeking", onSeeking);
    mediaEl.addEventListener("seeked", onSeeked);
    mediaEl.addEventListener("ratechange", onRateChange);
    mediaEl.addEventListener("waiting", onWaiting);
    mediaEl.addEventListener("playing", onPlaying);
    mediaEl.addEventListener("volumechange", onVolumeChange);
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onDocumentKeydown);
    const teardown = () => {
      disposed = true;
      if (unbindHlsTrackEvents) unbindHlsTrackEvents();
      clearExternalAudioSyncTimer();
      externalAudio.pause();
      externalAudio.removeAttribute("src");
      externalAudio.load();
      cleanups.forEach((fn) => {
        try {
          fn();
        } catch {
          /* ignore */
        }
      });
      shell.removeEventListener("pointerdown", setActive);
      shell.removeEventListener("focusin", setActive);
      mediaEl.removeEventListener("loadedmetadata", onMeta);
      mediaEl.removeEventListener("loadeddata", updateTrackMenus);
      mediaEl.removeEventListener("durationchange", onMeta);
      mediaEl.removeEventListener("timeupdate", onTime);
      mediaEl.removeEventListener("play", onPlay);
      mediaEl.removeEventListener("pause", onPause);
      mediaEl.removeEventListener("ended", onEnded);
      mediaEl.removeEventListener("seeking", onSeeking);
      mediaEl.removeEventListener("seeked", onSeeked);
      mediaEl.removeEventListener("ratechange", onRateChange);
      mediaEl.removeEventListener("waiting", onWaiting);
      mediaEl.removeEventListener("playing", onPlaying);
      mediaEl.removeEventListener("volumechange", onVolumeChange);
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onDocumentKeydown);
      shell.remove();
      delete (host as HTMLElement).dataset.vpReskinned;
      delete hlsEl.__vpAttached;
    };
    pushCleanup(CLEANUP_KEY, teardown);
    // The shell is CSS-anchored to the host (position:absolute; inset:0), so it
    // tracks host resizes without JS. The observer only re-asserts the host's
    // positioning context, which a host re-render can reset to `static`.
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        if (disposed) return;
        if (getComputedStyle(host).position === "static")
          (host as HTMLElement).style.position = "relative";
      });
      ro.observe(mediaEl);
      pushCleanup(CLEANUP_KEY, () => ro.disconnect());
    }
    updateTrackMenus();
    if (!Number.isNaN(mediaEl.duration)) onMeta();

    // Post-attach self-verification: if the overlay layer collapsed to a zero
    // box over a *visible* player (a host change removed the positioning
    // context), the reskin mounted but is broken — tear down so native controls
    // return. An off-screen player (both boxes zero) is left for a later scan.
    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(() => {
        if (disposed) return;
        const mediaBox = mediaEl.getBoundingClientRect();
        if (mediaBox.width <= 0 || mediaBox.height <= 0) return;
        const layerBox = overlayLayer.getBoundingClientRect();
        if (layerBox.width > 0 && layerBox.height > 0) return;
        console.error(
          "[vp] reskin overlay layer has a zero box over a visible player; rolling back",
        );
        teardown();
        reportFailure(
          "reskin-overlay-verification-failed",
          getBunnyVideoId(mediaEl.src || mediaEl.getAttribute?.("src")),
        );
      });
    }
  }

  const scan = () => {
    const { players, strategy } = scanPlayers();
    noteDiscovery(strategy);
    players.forEach((el) => attach(el));
    refreshIframeTargets();
  };
  scan();
  // Debounced scan so React's chatty re-renders don't trigger a full
  // querySelectorAll on every mutation.
  let scanPending: ReturnType<typeof setTimeout> | 0 = 0;
  function scheduleScan(): void {
    if (scanPending) return;
    scanPending = setTimeout(() => {
      scanPending = 0;
      scan();
    }, 250);
  }
  const mo = new MutationObserver(scheduleScan);
  mo.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src"],
  });
  pushCleanup(CLEANUP_KEY, () => {
    mo.disconnect();
    if (scanPending) clearTimeout(scanPending);
  });

  // We deliberately do NOT patch history.pushState / replaceState — the
  // MutationObserver above catches SPA-navigation DOM changes.
  const popHandler = () => setTimeout(scheduleScan, 50);
  window.addEventListener("popstate", popHandler);
  pushCleanup(CLEANUP_KEY, () =>
    window.removeEventListener("popstate", popHandler),
  );

  // No-player deadline: advanced mode is on ([data-vp-config]) but if no player
  // ever attaches and none was even discovered, LearningSuite likely renamed or
  // removed the element — report once after a grace period (F6).
  if (document.querySelector("[data-vp-config]")) {
    const deadline = setTimeout(() => {
      if (!attachedAny && lastDiscovery === "none")
        reportFailure("reskin-no-player-after-deadline", "");
    }, 10000);
    pushCleanup(CLEANUP_KEY, () => clearTimeout(deadline));
  }

  return "reskin attached";
}

// Kill-switch gate: ask our own API whether to run before touching the page.
// Fails open (see common/killswitch) so a fetch failure never disables a working
// runtime.
void (async () => {
  const status = (await shouldRun(runtimeBaseUrl))
    ? main()
    : "reskin disabled by kill-switch";
  (window as unknown as { __vpReskinStatus?: string }).__vpReskinStatus =
    status;
})();
