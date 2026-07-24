// Theme tokens translated from globals.css OKLCH.
export const T = {
  card: "#ffffff",
  fg: "#1f1f25",
  muted: "#f4f4f5",
  mutedFg: "#71717a",
  border: "#e5e7eb",
  primary: "#d97757",
  primaryFg: "#fffaf5",
  primarySoft: "rgba(217,119,87,.10)",
  primaryRing: "rgba(217,119,87,.25)",
  radius: "12px",
} as const;

export const ANIM_CSS = `
      @keyframes vp-slide-in-right { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
      @keyframes vp-slide-in-bottom{ from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      @keyframes vp-fade-in        { from{opacity:0} to{opacity:1} }
      @keyframes vp-pulse          { 0%,100%{opacity:1} 50%{opacity:.4} }
      .vp-anim-right  { animation: vp-slide-in-right .35s ease-out both; }
      .vp-anim-bottom { animation: vp-slide-in-bottom .35s ease-out both; }
      .vp-anim-fade   { animation: vp-fade-in .35s ease-out both; }
      .vp-pulse       { animation: vp-pulse 1.4s infinite; }
    `;

export const SECTION_CSS = `
      .vp-section-pill, .vp-section-pill * { white-space:normal; }
      .vp-section-pill { pointer-events:auto; max-width:min(384px, calc(100% - 28px)); display:block; width:fit-content; }
      .vp-section-pill .vp-sec-title, .vp-section-pill .vp-sec-cur-title { white-space:nowrap; }
      .vp-section-pill .vp-sec-card {
        background:linear-gradient(135deg, rgba(249,115,22,.22), rgba(245,158,11,.22), rgba(234,179,8,.22));
        border:1px solid rgba(253,186,116,.30);
        backdrop-filter:blur(10px);
        box-shadow:0 18px 40px rgba(0,0,0,.35);
        color:#fff7ed; font:500 13px system-ui;
        border-radius:12px; padding:8px 14px;
        transition: padding .3s ease, border-radius .3s ease;
      }
      .vp-section-pill .vp-sec-collapsed { display:flex; flex-direction:column; gap:2px; min-width:0; }
      .vp-section-pill .vp-sec-expanded  { display:none; }
      .vp-section-pill:hover .vp-sec-card,
      .vp-section-pill[data-pinned="1"] .vp-sec-card { border-radius:18px; padding:18px 18px 16px; }
      .vp-section-pill:hover .vp-sec-collapsed,
      .vp-section-pill[data-pinned="1"] .vp-sec-collapsed { display:none; }
      .vp-section-pill:hover .vp-sec-expanded,
      .vp-section-pill[data-pinned="1"] .vp-sec-expanded { display:block; }
      .vp-section-pill .vp-sec-title { font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .vp-section-pill .vp-sec-cur-row { display:flex; align-items:center; gap:6px; color:rgba(254,243,199,.85); min-width:0; }
      .vp-section-pill .vp-sec-cur-title { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .vp-section-pill .vp-sec-cur-row[hidden] { display:none; }
      .vp-section-pill .vp-sec-eyebrow { font:600 11px system-ui; letter-spacing:.6px; text-transform:uppercase; color:rgba(255,237,213,.65); }
      .vp-section-pill .vp-sec-h3 { margin:4px 0 12px; font:700 18px system-ui; color:#fff; line-height:1.25; }
      .vp-section-pill .vp-sec-bar { height:6px; background:rgba(255,255,255,.10); border-radius:999px; overflow:hidden; }
      .vp-section-pill .vp-sec-bar-fill { height:100%; background:linear-gradient(90deg, #fb923c, #fbbf24, #facc15); transition:width .6s ease; }
      .vp-section-pill .vp-sec-count { margin:4px 0 12px; font:500 11px system-ui; color:rgba(255,237,213,.6); }
      .vp-section-pill .vp-sec-rows { display:grid; gap:4px; }
      .vp-section-pill .vp-sec-row { display:flex; gap:10px; align-items:flex-start; padding:6px 8px; border-radius:8px; cursor:pointer; transition:background .2s; }
      .vp-section-pill .vp-sec-row[data-current="1"] { background:rgba(255,255,255,.12); }
      .vp-section-pill .vp-sec-row[data-current="0"]:hover { background:rgba(255,255,255,.06); }
      .vp-section-pill .vp-sec-dot { width:16px; height:16px; border-radius:50%; flex-shrink:0; margin-top:2px; display:flex; align-items:center; justify-content:center; }
      .vp-section-pill .vp-sec-dot[data-state="completed"] { background:#fb923c; }
      .vp-section-pill .vp-sec-dot[data-state="completed"]::after { content:"✓"; color:#fff; font-size:10px; font-weight:700; }
      .vp-section-pill .vp-sec-dot[data-state="current"] { border:2px solid #fb923c; }
      .vp-section-pill .vp-sec-dot[data-state="current"]::after { content:""; width:6px; height:6px; border-radius:50%; background:#fb923c; }
      .vp-section-pill .vp-sec-dot[data-state="upcoming"] { border:1px solid rgba(253,186,116,.4); }
      .vp-section-pill .vp-sec-row-title { flex:1; line-height:1.35; }
      .vp-section-pill .vp-sec-row[data-state="current"]   .vp-sec-row-title { color:#fff; font-weight:500; }
      .vp-section-pill .vp-sec-row[data-state="completed"] .vp-sec-row-title { color:rgba(255,237,213,.6); font-weight:400; }
      .vp-section-pill .vp-sec-row[data-state="upcoming"]  .vp-sec-row-title { color:rgba(255,237,213,.4); font-weight:400; }
    `;
