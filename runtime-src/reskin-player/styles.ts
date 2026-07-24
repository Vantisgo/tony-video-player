// CSS injected to hide the native Vidstack/Mux chrome and style the custom
// controls shell, overlays, subtitles and track menus.
export const RESKIN_CSS = `
      [data-vp-reskinned="true"] hls-video > *:not([slot="media"]) { display: none !important; }
      [data-vp-reskinned="true"] hls-video [slot="ui"], [data-vp-reskinned="true"] hls-video [slot="layer"] { display: none !important; }
      [data-vp-reskinned="true"] hls-video media-controls, [data-vp-reskinned="true"] hls-video media-poster, [data-vp-reskinned="true"] hls-video media-play-button,
      [data-vp-reskinned="true"] hls-video media-gesture, [data-vp-reskinned="true"] hls-video media-time-display, [data-vp-reskinned="true"] hls-video media-volume-slider,
      [data-vp-reskinned="true"] hls-video media-time-slider, [data-vp-reskinned="true"] hls-video media-fullscreen-button,
      [data-vp-reskinned="true"] hls-video media-captions-button, [data-vp-reskinned="true"] hls-video media-menu { display: none !important; }
      [data-vp-reskinned="true"] > [class*="PlayerControlsAbsoluteContainer"] { display: none !important; pointer-events: none !important; }
      .vp-shell { position: absolute; inset: 0; pointer-events: none; font: 14px system-ui, sans-serif; color: #fff; z-index: 5; }
      .vp-shell > * { pointer-events: auto; }
      .vp-overlay-layer { position: absolute; inset: 0 0 60px 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
      .vp-overlay-layer > * { pointer-events: auto; }
      .vp-subtitle-layer { position: absolute; left: 8%; right: 8%; bottom: 58px; display: flex; justify-content: center; pointer-events: none; z-index: 6; }
      .vp-subtitle-layer[hidden] { display: none !important; }
      .vp-subtitle-cue { max-width: 100%; padding: 6px 10px; border-radius: 6px; background: rgba(0,0,0,.72); color: #fff; font: 600 16px/1.35 system-ui, sans-serif; text-align: center; text-shadow: 0 1px 2px rgba(0,0,0,.75); box-decoration-break: clone; -webkit-box-decoration-break: clone; }
      .vp-sync-badge { position: absolute; right: 12px; bottom: 56px; z-index: 7; padding: 4px 7px; border-radius: 6px; background: rgba(180, 83, 9, .92); color: #fff; font: 600 12px/1.2 system-ui, sans-serif; letter-spacing: 0; pointer-events: none; box-shadow: 0 8px 24px rgba(0,0,0,.28); }
      .vp-sync-badge[hidden] { display: none !important; }
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
