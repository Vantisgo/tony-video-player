(() => {
  // Idempotency: tear down anything from a previous run before setting up.
  // Without this, re-injecting accumulates MutationObservers and history
  // wrappers, which pegs the renderer at 100% CPU.
  if (Array.isArray(window.__vpReskinCleanup)) {
    for (const fn of window.__vpReskinCleanup) { try { fn(); } catch {} }
  }
  window.__vpReskinCleanup = [];
  document.querySelectorAll('.vp-shell').forEach(el => el.remove());
  document.querySelectorAll('hls-video').forEach(el => { delete el.__vpAttached; });

  const styleId = '__custom-player-style';
  const s = document.getElementById(styleId) || document.createElement('style');
  s.id = styleId;
  s.textContent = `
      hls-video > *:not([slot="media"]) { display: none !important; }
      hls-video [slot="ui"], hls-video [slot="layer"] { display: none !important; }
      hls-video media-controls, hls-video media-poster, hls-video media-play-button,
      hls-video media-gesture, hls-video media-time-display, hls-video media-volume-slider,
      hls-video media-time-slider, hls-video media-fullscreen-button,
      hls-video media-captions-button, hls-video media-menu { display: none !important; }
      [data-vp-reskinned="true"] > [class*="PlayerControlsAbsoluteContainer"] { display: none !important; pointer-events: none !important; }
      .vp-shell { position: absolute; inset: 0; pointer-events: none; font: 14px system-ui, sans-serif; color: #fff; z-index: 5; }
      .vp-shell > * { pointer-events: auto; }
      .vp-overlay-layer { position: absolute; inset: 0 0 60px 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
      .vp-overlay-layer > * { pointer-events: auto; }
      .vp-subtitle-layer { position: absolute; left: 8%; right: 8%; bottom: 58px; display: flex; justify-content: center; pointer-events: none; z-index: 6; }
      .vp-subtitle-layer[hidden] { display: none !important; }
      .vp-subtitle-cue { max-width: 100%; padding: 6px 10px; border-radius: 6px; background: rgba(0,0,0,.72); color: #fff; font: 600 16px/1.35 system-ui, sans-serif; text-align: center; text-shadow: 0 1px 2px rgba(0,0,0,.75); box-decoration-break: clone; -webkit-box-decoration-break: clone; }
      .vp-controls { position: absolute; left: 0; right: 0; bottom: 0; padding: 8px 12px; background: linear-gradient(transparent, rgba(0,0,0,.7)); display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto auto auto auto; gap: 10px; align-items: center; }
      .vp-controls button { background: none; border: 0; color: #fff; cursor: pointer; padding: 6px 8px; border-radius: 4px; font-size: 14px; }
      .vp-controls button:hover { background: rgba(255,255,255,.15); }
      .vp-controls button:disabled { cursor: default; opacity: .42; }
      .vp-controls button:disabled:hover { background: none; }
      .vp-seek { width: 100%; }
      .vp-time { font-variant-numeric: tabular-nums; opacity: .85; min-width: 100px; text-align: center; }
      .vp-menu-wrap { position: relative; display: inline-flex; }
      .vp-menu { position: absolute; right: 0; bottom: calc(100% + 8px); min-width: 190px; max-width: min(260px, 70vw); max-height: 240px; overflow: auto; padding: 6px; background: rgba(17, 17, 20, .96); border: 1px solid rgba(255,255,255,.16); border-radius: 8px; box-shadow: 0 16px 40px rgba(0,0,0,.38); color: #fff; pointer-events: auto; }
      .vp-menu[hidden] { display: none !important; }
      .vp-menu-title { padding: 6px 8px 5px; font-size: 11px; font-weight: 700; line-height: 1.2; text-transform: uppercase; color: rgba(255,255,255,.58); }
      .vp-menu-option { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 7px 8px; border: 0; border-radius: 6px; background: transparent; color: #fff; font: 13px system-ui, sans-serif; text-align: left; }
      .vp-menu-option:hover { background: rgba(255,255,255,.12); }
      .vp-menu-option[aria-checked="true"] { background: rgba(255,255,255,.18); }
      .vp-menu-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .vp-menu-current { flex-shrink: 0; font-size: 11px; color: rgba(255,255,255,.62); }
    `;
  if (!s.parentNode) document.head.appendChild(s);

  const bus = (() => {
    const ls = new Map();
    return {
      on:  (e, fn) => { (ls.get(e) ?? ls.set(e, new Set()).get(e)).add(fn); return () => ls.get(e)?.delete(fn); },
      emit:(e, p) => ls.get(e)?.forEach(fn => { try { fn(p); } catch (err) { console.error(err); }}),
    };
  })();

  window.addEventListener('message', (ev) => {
    const m = ev.data;
    if (!m || typeof m !== 'object' || m.__source !== 'sidepanel') return;
    if (m.type === 'seek')  api.seek(m.time);
    if (m.type === 'play')  api.play();
    if (m.type === 'pause') api.pause();
  });
  bus.on('any', (p) => {
    document.querySelectorAll('iframe').forEach(f => {
      try { f.contentWindow?.postMessage({ __source: 'player', ...p }, '*'); } catch {}
    });
  });

  const overlays = [];
  let activeOverlays = new Set();

  let videoEl = null;
  const api = {
    get current() { return videoEl?.currentTime ?? 0; },
    get duration() { return videoEl?.duration ?? 0; },
    play()  { videoEl?.play(); },
    pause() { videoEl?.pause(); },
    seek(t) { if (videoEl) videoEl.currentTime = t; },
    on: bus.on,
    setOverlays: (next) => { overlays.length = 0; overlays.push(...next); },
    _diag: () => ({
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

  function listToArray(list) {
    if (!list) return [];
    try { return Array.from(list); }
    catch {
      const out = [];
      for (let i = 0; i < (list.length || 0); i++) out.push(list[i]);
      return out;
    }
  }

  function getLanguageName(code) {
    if (!code) return '';
    try {
      if (typeof Intl !== 'undefined' && Intl.DisplayNames) {
        const name = new Intl.DisplayNames([navigator.language || 'en'], { type: 'language' }).of(code);
        if (name) return name;
      }
    } catch {}
    return code.toUpperCase();
  }

  function trackLabel(track, index, fallback) {
    const raw = track?.label || track?.name || track?.title || '';
    const language = track?.language || track?.lang || track?.srclang || '';
    const langName = getLanguageName(language);
    if (raw) return raw;
    if (langName) return langName;
    return `${fallback} ${index + 1}`;
  }

  function getHlsApi(mediaEl) {
    const api = mediaEl?.api;
    return api && typeof api === 'object' ? api : null;
  }

  function getBunnyVideoId(url) {
    if (!url) return '';
    const m = String(url).match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/playlist\.m3u8/i);
    return m?.[1] || '';
  }

  function getRuntimeScriptUrl() {
    if (window.__vpRuntimeBaseUrl) return window.__vpRuntimeBaseUrl;

    const script = document.currentScript?.src
      ? document.currentScript
      : [...document.scripts].reverse().find(s => s.src && /\/runtime\/reskin-player\.js/i.test(s.src));

    return script?.src || '';
  }

  function getRuntimeBaseUrl() {
    const scriptUrl = getRuntimeScriptUrl();
    if (!scriptUrl) return '';
    try { return new URL('.', scriptUrl).href; } catch {}
    return scriptUrl;
  }

  function resolveUrl(url, baseUrl) {
    if (!url) return '';
    try { return new URL(url, baseUrl || location.href).href; }
    catch { return String(url); }
  }

  function withRuntimeAssetQuery(url, sourceUrl = getRuntimeScriptUrl()) {
    if (!url || !sourceUrl) return url;

    try {
      const source = new URL(sourceUrl, location.href);
      if (!source.search) return url;

      const target = new URL(url, location.href);
      if (target.origin !== source.origin) return url;

      source.searchParams.forEach((value, key) => {
        if (!target.searchParams.has(key)) target.searchParams.set(key, value);
      });
      return target.href;
    } catch {
      return url;
    }
  }

  function parseVttTimestamp(value) {
    const parts = String(value || '').trim().split(':');
    if (parts.length < 2) return NaN;
    const seconds = Number(parts.pop().replace(',', '.'));
    const minutes = Number(parts.pop());
    const hours = parts.length ? Number(parts.pop()) : 0;
    if (![hours, minutes, seconds].every(Number.isFinite)) return NaN;
    return hours * 3600 + minutes * 60 + seconds;
  }

  function parseVtt(text) {
    const normalized = String(text || '')
      .replace(/^\uFEFF/, '')
      .replace(/\r/g, '')
      .split('\n\n');

    const cues = [];
    for (const block of normalized) {
      const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
      if (!lines.length || lines[0].startsWith('WEBVTT')) continue;

      const timingLine = lines.find(line => line.includes('-->'));
      if (!timingLine) continue;

      const timingIndex = lines.indexOf(timingLine);
      const [fromRaw, rest] = timingLine.split('-->');
      const toRaw = rest?.trim().split(/\s+/)[0];
      const from = parseVttTimestamp(fromRaw);
      const to = parseVttTimestamp(toRaw);
      const cueText = lines.slice(timingIndex + 1).join('\n').trim();

      if (cueText && Number.isFinite(from) && Number.isFinite(to)) {
        cues.push({ from, to, text: cueText });
      }
    }

    return cues;
  }

  const languagePackCache = new Map();

  async function normalizeLanguagePack(raw, manifestUrl) {
    if (!raw || typeof raw !== 'object') return null;

    const baseUrl = manifestUrl || getRuntimeBaseUrl();
    const audioTracks = Array.isArray(raw.audioTracks)
      ? raw.audioTracks.map((track, index) => ({
          id: track.id || track.language || `audio-${index + 1}`,
          label: track.label || trackLabel(track, index, 'Audio'),
          language: track.language || track.lang || '',
          url: withRuntimeAssetQuery(resolveUrl(track.url, baseUrl), baseUrl),
          offsetMs: Number(track.offsetMs || 0),
          useNative: !!track.useNative,
        })).filter(track => track.url || track.useNative)
      : [];

    const subtitleTracks = Array.isArray(raw.subtitleTracks)
      ? await Promise.all(raw.subtitleTracks.map(async (track, index) => {
          const url = withRuntimeAssetQuery(resolveUrl(track.url, baseUrl), baseUrl);
          let cues = Array.isArray(track.cues) ? track.cues.map(normalizeTranscriptCue).filter(Boolean) : [];

          if (!cues.length && url) {
            try {
              const text = await fetch(url).then(r => r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`)));
              cues = parseVtt(text);
            } catch (err) {
              console.warn('[vp] subtitle load failed', url, err);
            }
          }

          return {
            id: track.id || track.language || `subtitle-${index + 1}`,
            label: track.label || trackLabel(track, index, 'Subtitle'),
            language: track.language || track.lang || '',
            url,
            cues,
          };
        }))
      : [];

    return {
      videoId: raw.videoId || '',
      defaultLanguage: raw.defaultLanguage || audioTracks[0]?.language || audioTracks[0]?.id || '',
      audioTracks,
      subtitleTracks: subtitleTracks.filter(track => track.cues.length),
    };
  }

  async function loadLanguagePackForMedia(mediaEl) {
    const videoId = getBunnyVideoId(mediaEl?.src || mediaEl?.getAttribute?.('src'));
    if (!videoId) return null;
    if (languagePackCache.has(videoId)) return languagePackCache.get(videoId);

    const override = window.__vpLanguagePacks?.[videoId];
    if (override) {
      const pack = await normalizeLanguagePack(override, override.baseUrl || getRuntimeBaseUrl());
      languagePackCache.set(videoId, pack);
      return pack;
    }

    const manifestUrl = withRuntimeAssetQuery(resolveUrl(`language-packs/${videoId}/manifest.json`, getRuntimeBaseUrl()));
    const promise = fetch(manifestUrl)
      .then(r => r.ok ? r.json() : null)
      .then(data => data ? normalizeLanguagePack(data, manifestUrl) : null)
      .catch(() => null);

    languagePackCache.set(videoId, promise);
    const pack = await promise;
    languagePackCache.set(videoId, pack);
    return pack;
  }

  function normalizeTranscriptCue(cue) {
    const text = String(cue?.text || '').trim();
    const from = Number(cue?.from);
    const to = Number(cue?.to);
    if (!text || !Number.isFinite(from) || !Number.isFinite(to)) return null;
    return {
      text,
      from: from / 1000,
      to: Math.max(from, to) / 1000,
    };
  }

  function getLearningSuiteTranscriptTracks(mediaEl) {
    const videoId = getBunnyVideoId(mediaEl?.src || mediaEl?.getAttribute?.('src'));
    if (!videoId) return [];

    const cache = window.__APOLLO_CLIENT__?.cache?.extract?.();
    if (!cache || typeof cache !== 'object') return [];

    for (const value of Object.values(cache)) {
      if (value?.__typename !== 'StepFile' || !value.transcript) continue;

      const downloadableRef = value.downloadable?.__ref;
      const downloadable = downloadableRef ? cache[downloadableRef] : null;
      if (getBunnyVideoId(downloadable?.url) !== videoId) continue;

      const translations = Array.isArray(value.transcript.translations)
        ? value.transcript.translations
        : [];

      return translations
        .map((translation, index) => {
          const lang = translation?.lang || value.transcript?.sourceLanguage || '';
          const cues = Array.isArray(translation?.text)
            ? translation.text.map(normalizeTranscriptCue).filter(Boolean)
            : [];

          return {
            kind: 'subtitles',
            label: trackLabel({ language: lang }, index, 'Subtitle'),
            language: lang,
            cues,
          };
        })
        .filter(track => track.cues.length);
    }

    return [];
  }

  function getTrackDiagnostics(mediaEl) {
    if (!mediaEl) return null;
    const hls = getHlsApi(mediaEl);
    const videoId = getBunnyVideoId(mediaEl?.src || mediaEl?.getAttribute?.('src'));
    const cachedLanguagePack = languagePackCache.get(videoId);
    const languagePack = cachedLanguagePack && typeof cachedLanguagePack.then !== 'function' ? cachedLanguagePack : null;
    return {
      nativeAudioTracks: mediaEl.audioTracks?.length ?? null,
      nativeTextTracks: mediaEl.textTracks?.length ?? null,
      hlsAudioTracks: Array.isArray(hls?.audioTracks) ? hls.audioTracks.length : null,
      hlsAudioTrack: typeof hls?.audioTrack === 'number' ? hls.audioTrack : null,
      hlsSubtitleTracks: Array.isArray(hls?.subtitleTracks) ? hls.subtitleTracks.length : null,
      hlsSubtitleTrack: typeof hls?.subtitleTrack === 'number' ? hls.subtitleTrack : null,
      audioRenditions: mediaEl.audioRenditions?.length ?? null,
      learningSuiteSubtitleTracks: getLearningSuiteTranscriptTracks(mediaEl).length,
      externalAudioTracks: languagePack?.audioTracks?.length ?? 0,
      externalSubtitleTracks: languagePack?.subtitleTracks?.length ?? 0,
    };
  }

  function attach(hlsEl) {
    if (hlsEl.__vpAttached) return;
    // Gate: only re-skin when this lesson has Advanced Video Modus turned on,
    // i.e. a <pre data-vp-config> (or equivalent) is present on the page.
    // No config → leave the native LS player completely alone.
    if (!document.querySelector('[data-vp-config]')) return;
    // The <hls-video> custom element itself forwards the HTMLMediaElement API
    // (.play, .pause, .currentTime, .duration, events). Works whether the
    // <video> is in light DOM (slotted) or default shadow DOM.
    if (typeof hlsEl.play !== 'function' || !('currentTime' in hlsEl)) return;
    hlsEl.__vpAttached = true;

    const mediaEl = hlsEl;
    if (!videoEl || videoEl.getBoundingClientRect().width === 0) videoEl = mediaEl;
    const host = hlsEl.parentElement;
    if (!host) return;
    host.dataset.vpReskinned = 'true';
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

    const shell = document.createElement('div');
    shell.className = 'vp-shell';
    shell.innerHTML = `
      <div class="vp-overlay-layer" data-vp-overlays></div>
      <div class="vp-subtitle-layer" data-vp-subtitles hidden></div>
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

    const $ = (sel) => shell.querySelector(`[data-vp="${sel}"]`);
    const overlayLayer = shell.querySelector('[data-vp-overlays]');
    const subtitleLayer = shell.querySelector('[data-vp-subtitles]');
    const audioMenu = shell.querySelector('[data-vp-menu="audio"]');
    const captionsMenu = shell.querySelector('[data-vp-menu="captions"]');
    const setActive = () => { videoEl = mediaEl; };
    let learningSuiteSubtitleIndex = -1;
    let externalLanguagePack = null;
    let externalAudioIndex = -1;
    let externalSubtitleIndex = -1;
    let externalAudioSyncTimer = null;
    let audibleMuted = !!mediaEl.muted;
    let disposed = false;
    const externalAudio = new Audio();
    externalAudio.preload = 'metadata';
    shell.dataset.vpAudioSource = 'native';
    shell.dataset.vpAudioTrack = 'native';
    shell.dataset.vpSubtitleSource = 'off';
    shell.dataset.vpSubtitleTrack = 'off';

    const fmt = s => { if (!isFinite(s)) return '0:00'; s = Math.max(0, s|0); return `${(s/60)|0}:${String(s%60).padStart(2,'0')}`; };

    function closeTrackMenus() {
      audioMenu.hidden = true;
      captionsMenu.hidden = true;
      $('audio').setAttribute('aria-expanded', 'false');
      $('captions').setAttribute('aria-expanded', 'false');
    }

    function toggleTrackMenu(name) {
      const targetMenu = name === 'audio' ? audioMenu : captionsMenu;
      const targetButton = $(name === 'audio' ? 'audio' : 'captions');
      const willOpen = targetMenu.hidden;
      closeTrackMenus();
      if (willOpen && !targetButton.disabled) {
        targetMenu.hidden = false;
        targetButton.setAttribute('aria-expanded', 'true');
      }
    }

    function renderMenu(menu, title, options, onSelect) {
      menu.replaceChildren();
      const heading = document.createElement('div');
      heading.className = 'vp-menu-title';
      heading.textContent = title;
      menu.appendChild(heading);

      for (const option of options) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'vp-menu-option';
        btn.setAttribute('role', 'menuitemradio');
        btn.setAttribute('aria-checked', option.selected ? 'true' : 'false');
        btn.dataset.value = String(option.value);

        const label = document.createElement('span');
        label.className = 'vp-menu-label';
        label.textContent = option.label;
        btn.appendChild(label);

        if (option.selected) {
          const current = document.createElement('span');
          current.className = 'vp-menu-current';
          current.textContent = 'Current';
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

    function getNativeAudioOptions() {
      const tracks = listToArray(mediaEl.audioTracks);
      if (tracks.length <= 1) return null;
      return tracks.map((track, index) => ({
        value: index,
        label: trackLabel(track, index, 'Audio'),
        selected: !!track.enabled,
      }));
    }

    function getHlsAudioOptions() {
      const hls = getHlsApi(mediaEl);
      const tracks = Array.isArray(hls?.audioTracks) ? hls.audioTracks : [];
      if (tracks.length <= 1) return null;
      const selectedIndex = typeof hls.audioTrack === 'number' ? hls.audioTrack : -1;
      return tracks.map((track, index) => ({
        value: index,
        label: trackLabel(track, index, 'Audio'),
        selected: selectedIndex === index || (selectedIndex < 0 && !!track.default),
      }));
    }

    function getRenditionAudioOptions() {
      const renditions = listToArray(mediaEl.audioRenditions);
      if (renditions.length <= 1) return null;
      return renditions.map((track, index) => ({
        value: index,
        label: trackLabel(track, index, 'Audio'),
        selected: !!track.selected || !!track.enabled,
      }));
    }

    function getExternalAudioOptions() {
      const tracks = Array.isArray(externalLanguagePack?.audioTracks) ? externalLanguagePack.audioTracks : [];
      if (tracks.length <= 1) return null;
      return tracks.map((track, index) => ({
        value: index,
        label: trackLabel(track, index, 'Audio'),
        selected: track.useNative ? externalAudioIndex < 0 : externalAudioIndex === index,
      }));
    }

    function getAudioMenuState() {
      const nativeOptions = getNativeAudioOptions();
      if (nativeOptions) return { source: 'native', options: nativeOptions };

      const hlsOptions = getHlsAudioOptions();
      if (hlsOptions) return { source: 'hls', options: hlsOptions };

      const renditionOptions = getRenditionAudioOptions();
      if (renditionOptions) return { source: 'rendition', options: renditionOptions };

      const externalOptions = getExternalAudioOptions();
      if (externalOptions) return { source: 'external', options: externalOptions };

      return { source: 'none', options: [] };
    }

    function getExternalAudioTrack() {
      return externalAudioIndex >= 0 ? externalLanguagePack?.audioTracks?.[externalAudioIndex] : null;
    }

    function expectedExternalAudioTime() {
      const track = getExternalAudioTrack();
      const offset = Number(track?.offsetMs || 0) / 1000;
      return Math.max(0, (mediaEl.currentTime || 0) + offset);
    }

    function clearExternalAudioSyncTimer() {
      if (externalAudioSyncTimer) {
        clearInterval(externalAudioSyncTimer);
        externalAudioSyncTimer = null;
      }
    }

    function ensureExternalAudioSyncTimer() {
      if (externalAudioSyncTimer || externalAudioIndex < 0) return;
      externalAudioSyncTimer = setInterval(() => syncExternalAudio(), 500);
    }

    function stopExternalAudio() {
      clearExternalAudioSyncTimer();
      externalAudio.pause();
      externalAudio.removeAttribute('src');
      externalAudio.load();
      externalAudioIndex = -1;
      mediaEl.muted = audibleMuted;
      $('mute').textContent = audibleMuted ? 'Muted' : 'Sound';
      shell.dataset.vpAudioSource = 'native';
      shell.dataset.vpAudioTrack = 'native';
    }

    function syncExternalAudio(force = false) {
      const track = getExternalAudioTrack();
      if (!track) return;

      const expected = expectedExternalAudioTime();
      if (force || Math.abs((externalAudio.currentTime || 0) - expected) > 0.08) {
        try { externalAudio.currentTime = expected; } catch {}
      }

      externalAudio.playbackRate = mediaEl.playbackRate || 1;
      externalAudio.muted = audibleMuted;
      mediaEl.muted = true;
      $('mute').textContent = audibleMuted ? 'Muted' : 'Sound';

      if (mediaEl.paused || mediaEl.ended) {
        externalAudio.pause();
        clearExternalAudioSyncTimer();
        return;
      }

      ensureExternalAudioSyncTimer();
      const playPromise = externalAudio.play();
      if (playPromise?.catch) playPromise.catch(err => console.warn('[vp] external audio play failed', err));
    }

    function setExternalAudioTrack(value) {
      const index = Number(value);
      const track = externalLanguagePack?.audioTracks?.[index];
      if (!track) return;

      if (track.useNative) {
        stopExternalAudio();
        externalAudioIndex = -1;
        return;
      }

      externalAudioIndex = index;
      shell.dataset.vpAudioSource = 'external';
      shell.dataset.vpAudioTrack = track.id || track.language || String(index);
      if (externalAudio.src !== track.url) {
        externalAudio.src = track.url;
        externalAudio.load();
      }

      syncExternalAudio(true);
    }

    function setAudioTrack(source, value) {
      const index = Number(value);
      if (!Number.isInteger(index)) return;

      if (source !== 'external' && externalAudioIndex >= 0) stopExternalAudio();

      if (source === 'external') {
        setExternalAudioTrack(value);
        return;
      }

      if (source === 'native') {
        listToArray(mediaEl.audioTracks).forEach((track, i) => { track.enabled = i === index; });
        return;
      }

      if (source === 'hls') {
        const hls = getHlsApi(mediaEl);
        if (hls) hls.audioTrack = index;
        return;
      }

      if (source === 'rendition') {
        const rendition = listToArray(mediaEl.audioRenditions)[index];
        try { if (rendition) rendition.selected = true; } catch {}
        const hls = getHlsApi(mediaEl);
        if (hls && Array.isArray(hls.audioTracks) && hls.audioTracks[index]) hls.audioTrack = index;
      }
    }

    function getNativeSubtitleOptions() {
      const tracks = listToArray(mediaEl.textTracks).filter(track => (
        track.kind === 'subtitles' || track.kind === 'captions' || track.kind === 'descriptions'
      ));
      if (!tracks.length) return null;
      const options = [{
        value: 'off',
        label: 'Off',
        selected: !tracks.some(track => track.mode === 'showing'),
      }];
      tracks.forEach((track, index) => {
        options.push({
          value: index,
          label: trackLabel(track, index, 'Subtitle'),
          selected: track.mode === 'showing',
        });
      });
      return options;
    }

    function getHlsSubtitleOptions() {
      const hls = getHlsApi(mediaEl);
      const tracks = Array.isArray(hls?.subtitleTracks) ? hls.subtitleTracks : [];
      if (!tracks.length) return null;
      const selectedIndex = typeof hls.subtitleTrack === 'number' ? hls.subtitleTrack : -1;
      const display = hls.subtitleDisplay !== false;
      const options = [{
        value: 'off',
        label: 'Off',
        selected: selectedIndex < 0 || !display,
      }];
      tracks.forEach((track, index) => {
        options.push({
          value: index,
          label: trackLabel(track, index, 'Subtitle'),
          selected: display && selectedIndex === index,
        });
      });
      return options;
    }

    function getLearningSuiteSubtitleOptions() {
      const tracks = getLearningSuiteTranscriptTracks(mediaEl);
      if (!tracks.length) return null;
      if (learningSuiteSubtitleIndex >= tracks.length) learningSuiteSubtitleIndex = -1;
      const options = [{
        value: 'off',
        label: 'Off',
        selected: learningSuiteSubtitleIndex < 0,
      }];
      tracks.forEach((track, index) => {
        options.push({
          value: index,
          label: trackLabel(track, index, 'Subtitle'),
          selected: learningSuiteSubtitleIndex === index,
        });
      });
      return options;
    }

    function getExternalSubtitleOptions() {
      const tracks = Array.isArray(externalLanguagePack?.subtitleTracks) ? externalLanguagePack.subtitleTracks : [];
      if (!tracks.length) return null;
      if (externalSubtitleIndex >= tracks.length) externalSubtitleIndex = -1;
      const options = [{
        value: 'off',
        label: 'Off',
        selected: externalSubtitleIndex < 0,
      }];
      tracks.forEach((track, index) => {
        options.push({
          value: index,
          label: trackLabel(track, index, 'Subtitle'),
          selected: externalSubtitleIndex === index,
        });
      });
      return options;
    }

    function getSubtitleMenuState() {
      const hlsOptions = getHlsSubtitleOptions();
      if (hlsOptions) return { source: 'hls', options: hlsOptions };

      const nativeOptions = getNativeSubtitleOptions();
      if (nativeOptions) return { source: 'native', options: nativeOptions };

      const externalOptions = getExternalSubtitleOptions();
      if (externalOptions) return { source: 'external', options: externalOptions };

      const learningSuiteOptions = getLearningSuiteSubtitleOptions();
      if (learningSuiteOptions) return { source: 'learningSuite', options: learningSuiteOptions };

      return { source: 'none', options: [] };
    }

    function renderSubtitleCue(track, time) {
      const cue = track?.cues.find(item => time >= item.from && time < item.to);

      subtitleLayer.replaceChildren();
      if (!cue) {
        subtitleLayer.hidden = true;
        return;
      }

      const el = document.createElement('span');
      el.className = 'vp-subtitle-cue';
      el.textContent = cue.text;
      subtitleLayer.appendChild(el);
      subtitleLayer.hidden = false;
    }

    function renderActiveSubtitle(time) {
      if (externalSubtitleIndex >= 0) {
        renderSubtitleCue(externalLanguagePack?.subtitleTracks?.[externalSubtitleIndex], time);
        return;
      }

      const tracks = getLearningSuiteTranscriptTracks(mediaEl);
      const track = learningSuiteSubtitleIndex >= 0 ? tracks[learningSuiteSubtitleIndex] : null;
      renderSubtitleCue(track, time);
    }

    function setSubtitleTrack(source, value) {
      const nativeTracks = listToArray(mediaEl.textTracks).filter(track => (
        track.kind === 'subtitles' || track.kind === 'captions' || track.kind === 'descriptions'
      ));
      nativeTracks.forEach(track => { track.mode = 'disabled'; });

      if (value === 'off') {
        const hls = getHlsApi(mediaEl);
        if (hls) {
          try { hls.subtitleTrack = -1; } catch {}
          try { hls.subtitleDisplay = false; } catch {}
        }
        learningSuiteSubtitleIndex = -1;
        externalSubtitleIndex = -1;
        shell.dataset.vpSubtitleSource = 'off';
        shell.dataset.vpSubtitleTrack = 'off';
        renderActiveSubtitle(mediaEl.currentTime || 0);
        return;
      }

      const index = Number(value);
      if (!Number.isInteger(index)) return;

      learningSuiteSubtitleIndex = -1;
      externalSubtitleIndex = -1;

      if (source === 'hls') {
        const hls = getHlsApi(mediaEl);
        if (hls) {
          try { hls.subtitleDisplay = true; } catch {}
          hls.subtitleTrack = index;
        }
        return;
      }

      if (source === 'external') {
        const hls = getHlsApi(mediaEl);
        if (hls) {
          try { hls.subtitleTrack = -1; } catch {}
          try { hls.subtitleDisplay = false; } catch {}
        }
        externalSubtitleIndex = index;
        shell.dataset.vpSubtitleSource = 'external';
        shell.dataset.vpSubtitleTrack = externalLanguagePack?.subtitleTracks?.[index]?.id || String(index);
        renderActiveSubtitle(mediaEl.currentTime || 0);
        return;
      }

      if (source === 'learningSuite') {
        const hls = getHlsApi(mediaEl);
        if (hls) {
          try { hls.subtitleTrack = -1; } catch {}
          try { hls.subtitleDisplay = false; } catch {}
        }
        learningSuiteSubtitleIndex = index;
        shell.dataset.vpSubtitleSource = 'learningSuite';
        shell.dataset.vpSubtitleTrack = getLearningSuiteTranscriptTracks(mediaEl)[index]?.language || String(index);
        renderActiveSubtitle(mediaEl.currentTime || 0);
        return;
      }

      const track = nativeTracks[index];
      if (track) track.mode = 'showing';
      shell.dataset.vpSubtitleSource = 'native';
      shell.dataset.vpSubtitleTrack = track?.language || track?.label || String(index);
      renderActiveSubtitle(mediaEl.currentTime || 0);
    }

    function updateTrackMenus() {
      bindHlsTrackEvents();

      const audioState = getAudioMenuState();
      const audioButton = $('audio');
      audioButton.disabled = audioState.options.length <= 1;
      audioButton.title = audioButton.disabled
        ? 'No alternate audio tracks available'
        : `Audio: ${(audioState.options.find(o => o.selected) || audioState.options[0]).label}`;
      renderMenu(audioMenu, 'Audio tracks', audioState.options, value => setAudioTrack(audioState.source, value));
      if (audioButton.disabled) audioMenu.hidden = true;

      const subtitleState = getSubtitleMenuState();
      const captionsButton = $('captions');
      captionsButton.disabled = subtitleState.options.length <= 1;
      captionsButton.title = captionsButton.disabled
        ? 'No subtitles available'
        : `Subtitles: ${(subtitleState.options.find(o => o.selected) || subtitleState.options[0]).label}`;
      renderMenu(captionsMenu, 'Subtitles', subtitleState.options, value => setSubtitleTrack(subtitleState.source, value));
      if (captionsButton.disabled) captionsMenu.hidden = true;
    }

    let boundHlsApi = null;
    let unbindHlsTrackEvents = null;
    function bindHlsTrackEvents() {
      const hls = getHlsApi(mediaEl);
      if (hls === boundHlsApi) return;
      if (unbindHlsTrackEvents) unbindHlsTrackEvents();
      boundHlsApi = hls;
      unbindHlsTrackEvents = null;
      const events = window.Hls?.Events;
      if (!hls?.on || !hls?.off || !events) return;
      const eventNames = [
        events.AUDIO_TRACKS_UPDATED,
        events.AUDIO_TRACK_SWITCHED,
        events.SUBTITLE_TRACKS_UPDATED,
        events.SUBTITLE_TRACK_SWITCH,
        events.NON_NATIVE_TEXT_TRACKS_FOUND,
      ].filter(Boolean);
      eventNames.forEach(eventName => hls.on(eventName, updateTrackMenus));
      unbindHlsTrackEvents = () => eventNames.forEach(eventName => {
        try { hls.off(eventName, updateTrackMenus); } catch {}
      });
    }

    function addListListener(list, event, handler) {
      if (!list?.addEventListener) return () => {};
      list.addEventListener(event, handler);
      return () => list.removeEventListener(event, handler);
    }

    loadLanguagePackForMedia(mediaEl).then(pack => {
      if (disposed || !pack) return;
      externalLanguagePack = pack;
      shell.dataset.vpLanguagePack = pack.videoId || getBunnyVideoId(mediaEl?.src || mediaEl?.getAttribute?.('src'));
      updateTrackMenus();
      renderActiveSubtitle(mediaEl.currentTime || 0);
    });

    $('playpause').onclick = () => {
      setActive();
      if (mediaEl.paused) mediaEl.play();
      else mediaEl.pause();
    };
    $('seek').oninput = (e) => { setActive(); mediaEl.currentTime = +e.target.value; };
    $('audio').onclick = (e) => { e.stopPropagation(); setActive(); toggleTrackMenu('audio'); };
    $('captions').onclick = (e) => { e.stopPropagation(); setActive(); toggleTrackMenu('captions'); };
    $('mute').onclick = () => {
      setActive();
      audibleMuted = !audibleMuted;
      if (externalAudioIndex >= 0) {
        mediaEl.muted = true;
        externalAudio.muted = audibleMuted;
      } else {
        mediaEl.muted = audibleMuted;
      }
      $('mute').textContent = audibleMuted ? 'Muted' : 'Sound';
    };
    $('fs').onclick = () => {
      setActive();
      if (!document.fullscreenElement) host.requestFullscreen?.();
      else document.exitFullscreen?.();
    };

    const onMeta = () => { $('seek').max = mediaEl.duration || 0; updateTrackMenus(); };
    const onTime = () => {
      $('seek').value = mediaEl.currentTime;
      $('time').textContent = `${fmt(mediaEl.currentTime)} / ${fmt(mediaEl.duration)}`;
      const t = mediaEl.currentTime;
      syncExternalAudio();
      renderActiveSubtitle(t);
      for (const o of overlays) {
        const should = t >= o.from && t < o.to;
        const isActive = activeOverlays.has(o.id);
        if (should && !isActive) {
          activeOverlays.add(o.id);
          const wrap = document.createElement('div');
          wrap.dataset.vpOverlay = o.id;
          wrap.innerHTML = o.render?.({ time: t, duration: mediaEl.duration }) ?? '';
          overlayLayer.appendChild(wrap);
          bus.emit('any', { type: 'overlay-show', id: o.id, time: t });
        } else if (!should && isActive) {
          activeOverlays.delete(o.id);
          overlayLayer.querySelector(`[data-vp-overlay="${o.id}"]`)?.remove();
          bus.emit('any', { type: 'overlay-hide', id: o.id, time: t });
        }
      }
      bus.emit('any', { type: 'time', time: t, duration: mediaEl.duration });
    };
    const onPlay  = () => { setActive(); $('playpause').textContent = 'Pause'; syncExternalAudio(true); bus.emit('any', { type: 'play',  time: mediaEl.currentTime }); };
    const onPause = () => { $('playpause').textContent = 'Play'; externalAudio.pause(); clearExternalAudioSyncTimer(); bus.emit('any', { type: 'pause', time: mediaEl.currentTime }); };
    const onEnded = () => { externalAudio.pause(); clearExternalAudioSyncTimer(); bus.emit('any', { type: 'ended', time: mediaEl.currentTime }); };
    const onSeeking = () => { if (externalAudioIndex >= 0) externalAudio.pause(); };
    const onSeeked = () => syncExternalAudio(true);
    const onRateChange = () => syncExternalAudio(true);
    const onWaiting = () => { if (externalAudioIndex >= 0) { externalAudio.pause(); clearExternalAudioSyncTimer(); } };
    const onPlaying = () => syncExternalAudio(true);
    const onVolumeChange = () => {
      if (externalAudioIndex >= 0) {
        externalAudio.muted = audibleMuted;
        mediaEl.muted = true;
        return;
      }
      audibleMuted = !!mediaEl.muted;
      $('mute').textContent = audibleMuted ? 'Muted' : 'Sound';
    };
    const onDocumentClick = (e) => { if (!shell.contains(e.target)) closeTrackMenus(); };
    const onDocumentKeydown = (e) => { if (e.key === 'Escape') closeTrackMenus(); };

    const cleanups = [
      addListListener(mediaEl.audioTracks, 'addtrack', updateTrackMenus),
      addListListener(mediaEl.audioTracks, 'removetrack', updateTrackMenus),
      addListListener(mediaEl.audioTracks, 'change', updateTrackMenus),
      addListListener(mediaEl.textTracks, 'addtrack', updateTrackMenus),
      addListListener(mediaEl.textTracks, 'removetrack', updateTrackMenus),
      addListListener(mediaEl.textTracks, 'change', updateTrackMenus),
    ];

    shell.addEventListener('pointerdown', setActive);
    shell.addEventListener('focusin', setActive);
    mediaEl.addEventListener('loadedmetadata', onMeta);
    mediaEl.addEventListener('loadeddata', updateTrackMenus);
    mediaEl.addEventListener('durationchange', onMeta);
    mediaEl.addEventListener('timeupdate', onTime);
    mediaEl.addEventListener('play',  onPlay);
    mediaEl.addEventListener('pause', onPause);
    mediaEl.addEventListener('ended', onEnded);
    mediaEl.addEventListener('seeking', onSeeking);
    mediaEl.addEventListener('seeked', onSeeked);
    mediaEl.addEventListener('ratechange', onRateChange);
    mediaEl.addEventListener('waiting', onWaiting);
    mediaEl.addEventListener('playing', onPlaying);
    mediaEl.addEventListener('volumechange', onVolumeChange);
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onDocumentKeydown);
    window.__vpReskinCleanup.push(() => {
      disposed = true;
      if (unbindHlsTrackEvents) unbindHlsTrackEvents();
      clearExternalAudioSyncTimer();
      externalAudio.pause();
      externalAudio.removeAttribute('src');
      externalAudio.load();
      cleanups.forEach(fn => { try { fn(); } catch {} });
      shell.removeEventListener('pointerdown', setActive);
      shell.removeEventListener('focusin', setActive);
      mediaEl.removeEventListener('loadedmetadata', onMeta);
      mediaEl.removeEventListener('loadeddata', updateTrackMenus);
      mediaEl.removeEventListener('durationchange', onMeta);
      mediaEl.removeEventListener('timeupdate', onTime);
      mediaEl.removeEventListener('play', onPlay);
      mediaEl.removeEventListener('pause', onPause);
      mediaEl.removeEventListener('ended', onEnded);
      mediaEl.removeEventListener('seeking', onSeeking);
      mediaEl.removeEventListener('seeked', onSeeked);
      mediaEl.removeEventListener('ratechange', onRateChange);
      mediaEl.removeEventListener('waiting', onWaiting);
      mediaEl.removeEventListener('playing', onPlaying);
      mediaEl.removeEventListener('volumechange', onVolumeChange);
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onDocumentKeydown);
      shell.remove();
      delete host.dataset.vpReskinned;
      delete hlsEl.__vpAttached;
    });
    updateTrackMenus();
    if (!Number.isNaN(mediaEl.duration)) onMeta();
  }

  const scan = () => document.querySelectorAll('hls-video').forEach(attach);
  scan();
  // Debounced scan so React's chatty re-renders don't trigger a full
  // querySelectorAll on every mutation.
  let scanPending = 0;
  function scheduleScan() {
    if (scanPending) return;
    scanPending = setTimeout(() => { scanPending = 0; scan(); }, 250);
  }
  const mo = new MutationObserver(scheduleScan);
  mo.observe(document.body, { subtree: true, childList: true });
  window.__vpReskinCleanup.push(() => { mo.disconnect(); if (scanPending) clearTimeout(scanPending); });

  // We deliberately do NOT patch history.pushState / replaceState here.
  // Re-injecting the script would otherwise nest the wrapper repeatedly.
  // The MutationObserver above already catches DOM changes from SPA nav.
  const popHandler = () => setTimeout(scheduleScan, 50);
  window.addEventListener('popstate', popHandler);
  window.__vpReskinCleanup.push(() => window.removeEventListener('popstate', popHandler));

  return 'reskin attached';
})();
