import { createBus } from "../common/bus";
import { pushCleanup, resetCleanup } from "../common/cleanup";
import { listToArray } from "../common/dom";
import { getTrustedOrigins } from "../common/origins";
import { getBunnyVideoId, getHlsApi, trackLabel } from "../common/tracks";
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
  document.querySelectorAll("hls-video").forEach((el) => {
    delete (el as MediaEl).__vpAttached;
  });

  const styleId = "__custom-player-style";
  const styleEl =
    document.getElementById(styleId) || document.createElement("style");
  styleEl.id = styleId;
  styleEl.textContent = RESKIN_CSS;
  if (!styleEl.parentNode) document.head.appendChild(styleEl);

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

  function attach(hlsEl: MediaEl): void {
    if (hlsEl.__vpAttached) return;
    // Gate: only re-skin when this lesson has Advanced Video Modus turned on.
    if (!document.querySelector("[data-vp-config]")) return;
    if (typeof hlsEl.play !== "function" || !("currentTime" in hlsEl)) return;
    hlsEl.__vpAttached = true;

    const mediaEl = hlsEl;
    if (!videoEl || videoEl.getBoundingClientRect().width === 0)
      videoEl = mediaEl;
    const host = hlsEl.parentElement;
    if (!host) return;
    (host as HTMLElement).dataset.vpReskinned = "true";
    if (getComputedStyle(host).position === "static")
      (host as HTMLElement).style.position = "relative";

    const shell = document.createElement("div");
    shell.className = "vp-shell";
    shell.innerHTML = `
      <div class="vp-overlay-layer" data-vp-overlays></div>
      <div class="vp-subtitle-layer" data-vp-subtitles hidden></div>
      <div class="vp-sync-badge" data-vp-sync-drift hidden></div>
      <div class="vp-controls">
        <button data-vp="playpause" aria-label="Play/Pause">Play</button>
        <input  data-vp="seek" class="vp-seek" type="range" min="0" max="0" step="0.1" value="0" />
        <span   data-vp="time" class="vp-time">0:00 / 0:00</span>
        <div class="vp-menu-wrap" data-vp-track-menu="audio">
          <button data-vp="audio" aria-label="Audio tracks" aria-haspopup="menu" aria-expanded="false" disabled>Audio</button>
          <div data-vp-menu="audio" class="vp-menu" role="menu" hidden></div>
        </div>
        <div class="vp-menu-wrap" data-vp-track-menu="captions">
          <button data-vp="captions" aria-label="Subtitles" aria-haspopup="menu" aria-expanded="false" disabled>CC</button>
          <div data-vp-menu="captions" class="vp-menu" role="menu" hidden></div>
        </div>
        <button data-vp="mute" aria-label="Mute">Sound</button>
        <button data-vp="fs" aria-label="Fullscreen">Full</button>
      </div>
    `;
    host.appendChild(shell);

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
          current.textContent = "Current";
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
        label: trackLabel(track, index, "Audio"),
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
        label: trackLabel(track, index, "Audio"),
        selected:
          selectedIndex === index || (selectedIndex < 0 && !!track.default),
      }));
    }

    function getRenditionAudioOptions(): TrackOption[] | null {
      const renditions = listToArray(mediaEl.audioRenditions);
      if (renditions.length <= 1) return null;
      return renditions.map((track, index) => ({
        value: index,
        label: trackLabel(track, index, "Audio"),
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
        label: trackLabel(track, index, "Audio"),
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
      syncDriftBadge.textContent = `Audio ${sign}${Math.abs(driftSeconds).toFixed(1)}s`;
      syncDriftBadge.title =
        driftSeconds > 0
          ? "External audio is ahead of the video timeline"
          : "External audio is behind the video timeline";
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
      muteBtn.textContent = audibleMuted ? "Muted" : "Sound";
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
      muteBtn.textContent = audibleMuted ? "Muted" : "Sound";

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
          label: "Off",
          selected: !tracks.some((track) => track.mode === "showing"),
        },
      ];
      tracks.forEach((track, index) => {
        options.push({
          value: index,
          label: trackLabel(track, index, "Subtitle"),
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
          label: "Off",
          selected: selectedIndex < 0 || !display,
        },
      ];
      tracks.forEach((track, index) => {
        options.push({
          value: index,
          label: trackLabel(track, index, "Subtitle"),
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
          label: "Off",
          selected: learningSuiteSubtitleIndex < 0,
        },
      ];
      tracks.forEach((track, index) => {
        options.push({
          value: index,
          label: trackLabel(track, index, "Subtitle"),
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
        { value: "off", label: "Off", selected: externalSubtitleIndex < 0 },
      ];
      tracks.forEach((track, index) => {
        options.push({
          value: index,
          label: trackLabel(track, index, "Subtitle"),
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
        ? "No alternate audio tracks available"
        : `Audio: ${(audioState.options.find((o) => o.selected) || audioState.options[0]).label}`;
      renderMenu(audioMenu, "Audio tracks", audioState.options, (value) =>
        setAudioTrack(audioState.source, value),
      );
      if (audioBtn.disabled) audioMenu.hidden = true;

      const subtitleState = getSubtitleMenuState();
      captionsBtn.disabled = subtitleState.options.length <= 1;
      captionsBtn.title = captionsBtn.disabled
        ? "No subtitles available"
        : `Subtitles: ${(subtitleState.options.find((o) => o.selected) || subtitleState.options[0]).label}`;
      renderMenu(captionsMenu, "Subtitles", subtitleState.options, (value) =>
        setSubtitleTrack(subtitleState.source, value),
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
      muteBtn.textContent = audibleMuted ? "Muted" : "Sound";
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
      playPauseBtn.textContent = "Pause";
      syncExternalAudio();
      bus.emit("any", { type: "play", time: mediaEl.currentTime });
    };
    const onPause = () => {
      playPauseBtn.textContent = "Play";
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
      muteBtn.textContent = audibleMuted ? "Muted" : "Sound";
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
    pushCleanup(CLEANUP_KEY, () => {
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
    });
    updateTrackMenus();
    if (!Number.isNaN(mediaEl.duration)) onMeta();
  }

  const scan = () => {
    document
      .querySelectorAll("hls-video")
      .forEach((el) => attach(el as MediaEl));
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

  return "reskin attached";
}

(window as unknown as { __vpReskinStatus?: string }).__vpReskinStatus = main();
