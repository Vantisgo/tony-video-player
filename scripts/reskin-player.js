(() => {
  const styleId = '__custom-player-style';
  if (!document.getElementById(styleId)) {
    const s = document.createElement('style');
    s.id = styleId;
    s.textContent = `
      hls-video > *:not([slot="media"]) { display: none !important; }
      hls-video [slot="ui"], hls-video [slot="layer"] { display: none !important; }
      hls-video media-controls, hls-video media-poster, hls-video media-play-button,
      hls-video media-gesture, hls-video media-time-display, hls-video media-volume-slider,
      hls-video media-time-slider, hls-video media-fullscreen-button,
      hls-video media-captions-button, hls-video media-menu { display: none !important; }
      .vp-shell { position: absolute; inset: 0; pointer-events: none; font: 14px system-ui, sans-serif; color: #fff; z-index: 5; }
      .vp-shell > * { pointer-events: auto; }
      .vp-overlay-layer { position: absolute; inset: 0 0 60px 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
      .vp-overlay-layer > * { pointer-events: auto; }
      .vp-controls { position: absolute; left: 0; right: 0; bottom: 0; padding: 8px 12px; background: linear-gradient(transparent, rgba(0,0,0,.7)); display: grid; grid-template-columns: auto 1fr auto auto auto auto; gap: 10px; align-items: center; }
      .vp-controls button { background: none; border: 0; color: #fff; cursor: pointer; padding: 6px 8px; border-radius: 4px; font-size: 14px; }
      .vp-controls button:hover { background: rgba(255,255,255,.15); }
      .vp-seek { width: 100%; }
      .vp-time { font-variant-numeric: tabular-nums; opacity: .85; min-width: 100px; text-align: center; }
    `;
    document.head.appendChild(s);
  }

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
    }),
  };
  window.player = api;

  function attach(hlsEl) {
    if (hlsEl.__vpAttached) return;
    // The <hls-video> custom element itself forwards the HTMLMediaElement API
    // (.play, .pause, .currentTime, .duration, events). Works whether the
    // <video> is in light DOM (slotted) or default shadow DOM.
    if (typeof hlsEl.play !== 'function' || !('currentTime' in hlsEl)) return;
    hlsEl.__vpAttached = true;

    videoEl = hlsEl;
    const host = hlsEl.parentElement;
    if (!host) return;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

    const shell = document.createElement('div');
    shell.className = 'vp-shell';
    shell.innerHTML = `
      <div class="vp-overlay-layer" data-vp-overlays></div>
      <div class="vp-controls">
        <button data-vp="playpause" aria-label="Play/Pause">Play</button>
        <input  data-vp="seek" class="vp-seek" type="range" min="0" max="0" step="0.1" value="0" />
        <span   data-vp="time" class="vp-time">0:00 / 0:00</span>
        <button data-vp="captions" aria-label="Captions">CC</button>
        <button data-vp="mute" aria-label="Mute">Sound</button>
        <button data-vp="fs" aria-label="Fullscreen">Full</button>
      </div>
    `;
    host.appendChild(shell);

    const $ = (sel) => shell.querySelector(`[data-vp="${sel}"]`);
    const overlayLayer = shell.querySelector('[data-vp-overlays]');

    const fmt = s => { if (!isFinite(s)) return '0:00'; s = Math.max(0, s|0); return `${(s/60)|0}:${String(s%60).padStart(2,'0')}`; };

    $('playpause').onclick = () => videoEl.paused ? videoEl.play() : videoEl.pause();
    $('seek').oninput = (e) => { videoEl.currentTime = +e.target.value; };
    $('mute').onclick = () => { videoEl.muted = !videoEl.muted; $('mute').textContent = videoEl.muted ? 'Muted' : 'Sound'; };
    $('fs').onclick = () => {
      if (!document.fullscreenElement) host.requestFullscreen?.();
      else document.exitFullscreen?.();
    };
    $('captions').onclick = () => {
      const tracks = videoEl.textTracks;
      let any = false;
      for (const t of tracks) { if (t.mode === 'showing') { t.mode = 'disabled'; any = true; break; } }
      if (!any && tracks.length) tracks[0].mode = 'showing';
    };

    const onMeta = () => { $('seek').max = videoEl.duration || 0; };
    const onTime = () => {
      $('seek').value = videoEl.currentTime;
      $('time').textContent = `${fmt(videoEl.currentTime)} / ${fmt(videoEl.duration)}`;
      const t = videoEl.currentTime;
      for (const o of overlays) {
        const should = t >= o.from && t < o.to;
        const isActive = activeOverlays.has(o.id);
        if (should && !isActive) {
          activeOverlays.add(o.id);
          const wrap = document.createElement('div');
          wrap.dataset.vpOverlay = o.id;
          wrap.innerHTML = o.render?.({ time: t, duration: videoEl.duration }) ?? '';
          overlayLayer.appendChild(wrap);
          bus.emit('any', { type: 'overlay-show', id: o.id, time: t });
        } else if (!should && isActive) {
          activeOverlays.delete(o.id);
          overlayLayer.querySelector(`[data-vp-overlay="${o.id}"]`)?.remove();
          bus.emit('any', { type: 'overlay-hide', id: o.id, time: t });
        }
      }
      bus.emit('any', { type: 'time', time: t, duration: videoEl.duration });
    };
    const onPlay  = () => { $('playpause').textContent = 'Pause'; bus.emit('any', { type: 'play',  time: videoEl.currentTime }); };
    const onPause = () => { $('playpause').textContent = 'Play';  bus.emit('any', { type: 'pause', time: videoEl.currentTime }); };
    const onEnded = () => bus.emit('any', { type: 'ended', time: videoEl.currentTime });

    videoEl.addEventListener('loadedmetadata', onMeta);
    videoEl.addEventListener('timeupdate', onTime);
    videoEl.addEventListener('play',  onPlay);
    videoEl.addEventListener('pause', onPause);
    videoEl.addEventListener('ended', onEnded);
    if (!Number.isNaN(videoEl.duration)) onMeta();
  }

  const scan = () => document.querySelectorAll('hls-video').forEach(attach);
  scan();
  new MutationObserver(scan).observe(document.body, { subtree: true, childList: true });
  for (const m of ['pushState', 'replaceState']) {
    const o = history[m]; history[m] = function () { const r = o.apply(this, arguments); setTimeout(scan, 50); return r; };
  }
  window.addEventListener('popstate', () => setTimeout(scan, 50));

  return 'reskin attached';
})();
