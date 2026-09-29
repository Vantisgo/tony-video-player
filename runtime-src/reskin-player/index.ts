import { createBus } from "../common/bus";
import { pushCleanup, resetCleanup } from "../common/cleanup";
// Aliased to `tr`: `t` is this file's name for the current playback time.
import { t as tr } from "../common/i18n/player";
import { getTrustedOrigins } from "../common/origins";
import { getBunnyVideoId, trackLabel } from "../common/tracks";
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
  PlayerApi,
  PlayerEvent,
  TrackOption,
} from "../common/types";
import {
  createLanguagePackControl,
  type LanguagePackControl,
} from "./language-pack-control";
import { createSilencer } from "./silence";
import { RESKIN_CSS } from "./styles";
import { getTrackDiagnostics, loadLanguagePackForMedia } from "./language-pack";

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
    // No control bar: LearningSuite's own chrome is no longer hidden and owns
    // play/pause, seeking, time, volume, captions, speed and fullscreen. What
    // remains are the two passive layers the host cannot provide — external
    // (language-pack) subtitles and the external-audio drift badge.
    shell.innerHTML = `
      <div class="vp-subtitle-layer" data-vp-subtitles hidden></div>
      <div class="vp-sync-badge" data-vp-sync-drift hidden></div>
    `;
    host.appendChild(shell);
    undo.push(() => shell.remove());

    const subtitleLayer = shell.querySelector(
      "[data-vp-subtitles]",
    ) as HTMLElement;
    const syncDriftBadge = shell.querySelector(
      "[data-vp-sync-drift]",
    ) as HTMLElement;
    // Precondition: bail (→ rollback) before wiring handlers if the shell
    // template didn't produce its required nodes (a future host/template break).
    if (!subtitleLayer || !syncDriftBadge)
      throw new Error("[vp] reskin shell is missing required nodes");
    const setActive = () => {
      videoEl = mediaEl;
    };
    let externalLanguagePack: LanguagePack | null = null;
    let externalAudioIndex = -1;
    let externalSubtitleIndex = -1;
    let renderedCueText = "";
    let externalAudioSyncTimer: ReturnType<typeof setInterval> | null = null;
    let disposed = false;
    const externalAudio = new Audio();
    externalAudio.preload = "metadata";
    const silencer = createSilencer(mediaEl);
    shell.dataset.vpAudioSource = "native";
    shell.dataset.vpAudioTrack = "native";
    shell.dataset.vpSubtitleSource = "off";
    shell.dataset.vpSubtitleTrack = "off";

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
      silencer.restore();
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
      // The video is silenced in our own audio graph, never with `mediaEl.muted`
      // — the host reverts that write within ~600ms (see silence.ts). The dub
      // instead mirrors whatever the host's own mute/volume controls say.
      silencer.silence();
      externalAudio.muted = !!mediaEl.muted;
      externalAudio.volume = Number.isFinite(mediaEl.volume)
        ? mediaEl.volume
        : 1;

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

    // Only the language pack's own cues render here. LearningSuite renders its
    // own subtitles through its own CC control, which this runtime no longer
    // hides — the two are independent sources and either can be switched off.
    function renderActiveSubtitle(time: number): void {
      renderSubtitleCue(
        externalSubtitleIndex >= 0
          ? externalLanguagePack?.subtitleTracks?.[externalSubtitleIndex]
          : null,
        time,
      );
    }

    function setExternalSubtitleTrack(value: number | string): void {
      if (value === "off") {
        externalSubtitleIndex = -1;
        shell.dataset.vpSubtitleSource = "off";
        shell.dataset.vpSubtitleTrack = "off";
        renderActiveSubtitle(mediaEl.currentTime || 0);
        return;
      }
      const index = Number(value);
      if (!Number.isInteger(index)) return;
      externalSubtitleIndex = index;
      shell.dataset.vpSubtitleSource = "external";
      shell.dataset.vpSubtitleTrack =
        externalLanguagePack?.subtitleTracks?.[index]?.id || String(index);
      renderActiveSubtitle(mediaEl.currentTime || 0);
    }

    // Created only once a pack actually resolves for this video, so a lesson
    // without one gets no controls of ours at all. The pack resolves AFTER
    // attachInner has returned, so `disposed` is the guard against a teardown
    // that already ran leaving an orphan node behind.
    let langpackControl: LanguagePackControl | null = null;
    function mountLanguagePackControl(): void {
      if (disposed || langpackControl) return;
      langpackControl = createLanguagePackControl({
        playerHost: host as HTMLElement,
        audioOptions: getExternalAudioOptions,
        subtitleOptions: getExternalSubtitleOptions,
        onSelectAudio: setExternalAudioTrack,
        onSelectSubtitle: setExternalSubtitleTrack,
        onCleanup: (fn) => pushCleanup(CLEANUP_KEY, fn),
      });
    }

    loadLanguagePackForMedia(mediaEl).then((pack) => {
      if (disposed || !pack) return;
      externalLanguagePack = pack;
      shell.dataset.vpLanguagePack =
        pack.videoId ||
        getBunnyVideoId(mediaEl?.src || mediaEl?.getAttribute?.("src"));
      mountLanguagePackControl();
      renderActiveSubtitle(mediaEl.currentTime || 0);
    });

    const onTime = () => {
      const t = mediaEl.currentTime;
      renderActiveSubtitle(t);
      bus.emit("any", { type: "time", time: t, duration: mediaEl.duration });
    };
    const onPlay = () => {
      setActive();
      syncExternalAudio();
      bus.emit("any", { type: "play", time: mediaEl.currentTime });
    };
    const onPause = () => {
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
    // The host owns mute and volume now. Mirror whatever it decides onto the
    // dub, so its own controls drive the track the learner is actually hearing.
    // The video itself is silenced by the gain node, not by `muted` — see
    // silence.ts for why writing `mediaEl.muted` here would be pointless.
    const onVolumeChange = () => {
      if (externalAudioIndex < 0) return;
      externalAudio.muted = !!mediaEl.muted;
      externalAudio.volume = Number.isFinite(mediaEl.volume)
        ? mediaEl.volume
        : 1;
    };

    shell.addEventListener("pointerdown", setActive);
    shell.addEventListener("focusin", setActive);
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
    const teardown = () => {
      disposed = true;
      langpackControl?.destroy();
      langpackControl = null;
      silencer.dispose();
      clearExternalAudioSyncTimer();
      externalAudio.pause();
      externalAudio.removeAttribute("src");
      externalAudio.load();
      shell.removeEventListener("pointerdown", setActive);
      shell.removeEventListener("focusin", setActive);
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

    // Post-attach self-verification: if OUR SHELL collapsed to a zero box over a
    // *visible* player (a host change removed the positioning context), the
    // mount is broken — tear down. Previously this measured `.vp-overlay-layer`,
    // which no longer exists; the shell is the equivalent anchor and is what the
    // subtitle layer and drift badge are positioned against.
    // An off-screen player (both boxes zero) is left for a later scan.
    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(() => {
        if (disposed) return;
        const mediaBox = mediaEl.getBoundingClientRect();
        if (mediaBox.width <= 0 || mediaBox.height <= 0) return;
        const layerBox = shell.getBoundingClientRect();
        if (layerBox.width > 0 && layerBox.height > 0) return;
        console.error(
          "[vp] reskin shell has a zero box over a visible player; rolling back",
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
