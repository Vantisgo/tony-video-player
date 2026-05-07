// Demo POC matching the tony-video-player repo:
//   - Section Indicator (top-left of video) — chapter + subchapter, expands on hover
//   - Science Trigger (top-right) — fires on science timestamps
//   - Audio Overlay (bottom-right) — fires on audio segments
//   - Meta Step Fly-in (bottom-right, violet) — when crossing a new master step
//   - Sidebar with Coaching / Science / Meta Structure tabs
(() => {
  // Idempotency: tear down anything left from a prior run before mounting
  // again. Each setup pushes its disconnect into this registry; a re-inject
  // drains it first. Without this, repeated injection stacks event listeners
  // on window.player and pegs the renderer.
  if (Array.isArray(window.__vpDemoCleanup)) {
    for (const fn of window.__vpDemoCleanup) { try { fn(); } catch {} }
  }
  window.__vpDemoCleanup = [];

  // Theme tokens translated from globals.css OKLCH
  const T = {
    card: '#ffffff', fg: '#1f1f25', muted: '#f4f4f5', mutedFg: '#71717a',
    border: '#e5e7eb',
    primary: '#d97757', primaryFg: '#fffaf5',
    primarySoft: 'rgba(217,119,87,.10)', primaryRing: 'rgba(217,119,87,.25)',
    radius: '12px',
  };

  // ─────────── DATA (shape matches the repo) ───────────
  // Defaults are used if no config is found in the page (e.g. authoring stage).
  //
  // To enrich a video, place a JSON config in the LearningSuite "Code einbetten"
  // block on that lesson, set to "In Seite anzeigen", with this exact wrapper:
  //
  //   <pre data-vp-config style="display:none">{...your JSON...}</pre>
  //
  // Why <pre>? LearningSuite sanitises embed-block HTML on student render and
  // strips <script>, hidden <div>s, and unknown attributes. Standard tags like
  // <pre> with `data-*` attributes survive — the textContent stays intact.
  //
  // Loader matches three shapes (first hit wins, in this order):
  //   1) <script type="application/json" data-vp-config>{...}</script>     // works locally / in our own pages
  //   2) <pre|div|span data-vp-config>{...}</...>                          // works through LearningSuite (preferred)
  //   3) <!--VP_CONFIG {...} VP_CONFIG-->                                  // HTML-comment fallback
  const DEFAULT_PHASES = [
    { id:'p1', title:'Model-Based Framing & Agency Priming', description:'Vorbereitende Phase: das mentale Modell der Klientin wird sichtbar gemacht und neu gerahmt.', startTimeSec:0,   endTimeSec:60,
      interventions:[
        { id:'i11', label:'1.1', title:'Model-Based Self-Localization',     t:4,  desc:'Klientin verortet sich im eigenen Modell der Situation.' },
        { id:'i12', label:'1.2', title:'Playful Inconsistency Highlighting',t:18, desc:'Spielerisch werden Widersprüche im Selbstbild herausgehoben.' },
        { id:'i13', label:'1.3', title:'Audience-Directed Meta-Framing',    t:35, desc:'Re-Framing durch Adressierung der mentalen Beobachter.' },
        { id:'i14', label:'1.4', title:'Metaphor Deconstruction',           t:50, desc:'Trennung metaphorischer Sprache von physiologischer Realität.' },
      ]},
    { id:'p2', title:'From Symptom Story to Process Control', description:'Übergang von der Story über das Symptom zu konkreter Steuerung des Prozesses.', startTimeSec:60,  endTimeSec:120,
      interventions:[
        { id:'i21', label:'2.1', title:'Rapport and Emotional Safety', t:64,  desc:'Aufbau eines emotional sicheren Containers.' },
        { id:'i22', label:'2.2', title:'Testing the Pattern',          t:78,  desc:'Vorsichtiges Re-Entry, um das Muster zu prüfen.' },
        { id:'i23', label:'2.3', title:'You Create the Pattern',       t:96,  desc:'Klientin erkennt sich als aktive Erzeugerin.' },
      ]},
    { id:'p3', title:'Practice & Commitment', description:'Konsolidierung und konkreter Mikro-Vorsatz für die nächsten 24 Stunden.', startTimeSec:120, endTimeSec:152,
      interventions:[
        { id:'i31', label:'3.1', title:'Future Pacing',    t:128, desc:'Mentale Vorwegnahme der erfolgreichen Umsetzung.' },
        { id:'i32', label:'3.2', title:'Mikro-Commitment', t:142, desc:'Kleinster Schritt, sofort umsetzbar.' },
      ]},
  ];

  const DEFAULT_SCIENCES = [
    { id:'s1', name:'Polyvagal Theory', description:'Autonome Nervensystem-Zustände als Erklärungsrahmen.', timestampsSec:[22, 86] },
    { id:'s2', name:'Six Human Needs',  description:'Modell intrinsischer Motivationen.',                  timestampsSec:[70, 105] },
    { id:'s3', name:'Interoception',    description:'Wahrnehmung innerer Körpersignale.',                  timestampsSec:[40] },
  ];

  const DEFAULT_AUDIOS = [
    { id:'a1', t:30, dur:9, title:'Voice-Over: Klarheit als Werkzeug', voice:'Dr. Frederik Hümmeke',
      script:'Klarheit ist nicht nur eine Eigenschaft. Sie ist ein wiederholbares Werkzeug, mit dem du im Alltag wirken kannst.' },
    { id:'a2', t:115, dur:8, title:'Voice-Over: Reflexionsimpuls', voice:'Dr. Frederik Hümmeke',
      script:'Halte einen Moment inne. Frage dich: wo handle ich heute schon klar, und wo zögere ich noch?' },
  ];

  const DEFAULT_META_STEPS = [
    { id:'m1', n:1, title:'Self-Localization',  t:4   },
    { id:'m2', n:2, title:'Pattern Visibility', t:25  },
    { id:'m3', n:3, title:'Agency Reframe',     t:60  },
    { id:'m4', n:4, title:'Decoding Need',      t:90  },
    { id:'m5', n:5, title:'Process Control',    t:110 },
    { id:'m6', n:6, title:'Future Pacing',      t:128 },
    { id:'m7', n:7, title:'Mikro-Commitment',   t:142 },
  ];

  function loadVpConfig() {
    // 1) <script type="application/json" data-vp-config>
    const script = document.querySelector('script[type="application/json"][data-vp-config]');
    if (script?.textContent?.trim()) {
      try { return { source: 'script', data: JSON.parse(script.textContent.trim()) }; }
      catch (e) { console.warn('[vp] config <script> parse failed', e); }
    }
    // 2) any element with data-vp-config attribute carrying JSON in textContent
    const el = document.querySelector('[data-vp-config]:not(script)');
    if (el?.textContent?.trim()) {
      try { return { source: 'element', data: JSON.parse(el.textContent.trim()) }; }
      catch (e) { console.warn('[vp] config element parse failed', e); }
    }
    // 3) HTML comment <!--VP_CONFIG ... VP_CONFIG-->. LearningSuite's embed block
    //    sometimes wraps content in a way that strips scripts; comments usually survive.
    const tw = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_COMMENT);
    let n; while ((n = tw.nextNode())) {
      const v = n.nodeValue || '';
      const m = v.match(/VP_CONFIG\s*([\s\S]*?)\s*VP_CONFIG/);
      if (m) {
        try { return { source: 'comment', data: JSON.parse(m[1]) }; }
        catch (e) { console.warn('[vp] config <!--comment--> parse failed', e); }
      }
    }
    return null;
  }

  const cfgHit = loadVpConfig();
  if (!cfgHit) {
    // No <pre data-vp-config> on this page — Advanced Video Modus is OFF.
    // Leave the native LearningSuite player and layout untouched.
    console.info('[vp] no config found on page, advanced editor stays off');
    return 'demo: idle (no config)';
  }
  console.info(`[vp] config loaded from ${cfgHit.source}`);
  const cfg = cfgHit.data;
  // Per-section defaults still kick in for partially-filled configs.
  const phases    = Array.isArray(cfg.phases)    ? cfg.phases    : DEFAULT_PHASES;
  const sciences  = Array.isArray(cfg.sciences)  ? cfg.sciences  : DEFAULT_SCIENCES;
  const audios    = Array.isArray(cfg.audios)    ? cfg.audios    : DEFAULT_AUDIOS;
  const metaSteps = Array.isArray(cfg.metaSteps) ? cfg.metaSteps : DEFAULT_META_STEPS;
  // Expose for diagnostics + future hot-reload
  window.__vpConfig = { source: cfgHit.source, data: { phases, sciences, audios, metaSteps } };

  const fmt = s => { if (!isFinite(s)) return '0:00'; s = Math.max(0, s|0); return `${(s/60)|0}:${String(s%60).padStart(2,'0')}`; };

  // ─────────── ANIMATION KEYFRAMES (inject once) ───────────
  if (!document.getElementById('vp-anim-style')) {
    const s = document.createElement('style');
    s.id = 'vp-anim-style';
    s.textContent = `
      @keyframes vp-slide-in-right { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
      @keyframes vp-slide-in-bottom{ from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      @keyframes vp-fade-in        { from{opacity:0} to{opacity:1} }
      @keyframes vp-pulse          { 0%,100%{opacity:1} 50%{opacity:.4} }
      .vp-anim-right  { animation: vp-slide-in-right .35s ease-out both; }
      .vp-anim-bottom { animation: vp-slide-in-bottom .35s ease-out both; }
      .vp-anim-fade   { animation: vp-fade-in .35s ease-out both; }
      .vp-pulse       { animation: vp-pulse 1.4s infinite; }
    `;
    document.head.appendChild(s);
  }

  // ─────────── PLAYER OVERLAY SLOTS (positioned inside the player host) ───────────
  const playerHost = document.querySelector('hls-video')?.parentElement;
  if (!playerHost) { console.warn('[demo] no player host'); return; }
  if (getComputedStyle(playerHost).position === 'static') playerHost.style.position = 'relative';

  // Clean up prior demo if re-injected
  ['vp-slot-tl','vp-slot-tr','vp-slot-br','vp-slot-lt','vp-demo-sidebar'].forEach(id => document.getElementById(id)?.remove());

  function makeSlot(id, posCss) {
    const el = document.createElement('div');
    el.id = id;
    el.style.cssText = `position:absolute; ${posCss}; pointer-events:none; z-index:8;`;
    // When a click/touch hits a CHILD of this slot (i.e. an actual overlay surface),
    // stop it from bubbling up to the player wrapper which toggles play/pause.
    // The slot itself has pointer-events:none, so empty-area clicks still pass through to the video.
    // Bubble phase only — capture-phase stopPropagation would prevent our own buttons from firing.
    const swallow = (e) => { if (e.target !== el) e.stopPropagation(); };
    ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend'].forEach(ev => {
      el.addEventListener(ev, swallow);
    });
    playerHost.appendChild(el);
    return el;
  }
  const slotTL = makeSlot('vp-slot-tl', 'top:14px; left:14px; right:14px; max-width:none');
  const slotTR = makeSlot('vp-slot-tr', 'top:10px; right:10px;');
  const slotBR = makeSlot('vp-slot-br', 'bottom:70px; right:14px;');
  // Lower-third banner: spans most of the video width above the controls
  const slotLowerThird = makeSlot('vp-slot-lt', 'left:14px; right:14px; bottom:70px;');

  // ─────────── SECTION INDICATOR (top-left) ───────────
  // Mirrors components/video-player/overlays/section-indicator.tsx
  // Hover state is OWNED BY CSS (`:hover`) so it survives DOM updates.
  // The DOM tree is built ONCE; `time` events only patch text/widths/classes.
  const sectionStyleId = '__vp-section-style';
  document.getElementById(sectionStyleId)?.remove();
  {
    const s = document.createElement('style');
    s.id = sectionStyleId;
    s.textContent = `
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
    document.head.appendChild(s);
  }

  const sectionPill = document.createElement('div');
  sectionPill.className = 'vp-section-pill';
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

  // Cache references — built once
  const $ = (sel) => sectionPill.querySelector(sel);
  const sectionRefs = {
    title:    $('[data-section]'),
    h3:       $('[data-section-h3]'),
    curRow:   $('[data-cur-row]'),
    curTitle: $('[data-cur-title]'),
    progress: $('[data-progress-block]'),
    barFill:  $('[data-bar-fill]'),
    count:    $('[data-count]'),
    rowsHost: $('[data-rows]'),
    empty:    $('[data-empty]'),
  };
  // Track row elements to avoid teardown on every tick
  let renderedRows = []; // [{ el, dot, titleEl, id }]
  let renderedPhaseId = null;

  // Click delegation for seek (works on rebuilt rows + on the cur row)
  sectionPill.addEventListener('click', (e) => {
    const row = e.target.closest('[data-seek]');
    if (!row) return;
    e.stopPropagation();
    window.player.seek(+row.dataset.seek + 0.1);
  });

  function renderSection() {
    const t = window.player.current ?? 0;
    const phase = phases.find(p => t >= p.startTimeSec && t < p.endTimeSec);
    const section = phase?.title ?? 'Intro';
    const subs = phase ? phase.interventions.map(iv => ({
      ...iv,
      completed: t > iv.t,
      current: phase.interventions.findLast?.(x => t >= x.t)?.id === iv.id,
    })) : [];
    const cur = subs.find(s => s.current);
    const completedCount = subs.filter(s => s.completed).length;

    // Collapsed view
    if (sectionRefs.title.textContent !== section) sectionRefs.title.textContent = section;
    sectionRefs.title.title = section;
    if (cur) {
      sectionRefs.curRow.hidden = false;
      if (sectionRefs.curTitle.textContent !== cur.title) sectionRefs.curTitle.textContent = cur.title;
      sectionRefs.curTitle.title = cur.title;
    } else {
      sectionRefs.curRow.hidden = true;
    }

    // Expanded view: section title
    if (sectionRefs.h3.textContent !== section) sectionRefs.h3.textContent = section;

    // Expanded view: progress + rows
    if (subs.length) {
      sectionRefs.progress.hidden = false;
      sectionRefs.empty.hidden = true;
      const pct = (completedCount / subs.length) * 100;
      sectionRefs.barFill.style.width = pct + '%';
      const countTxt = `${completedCount} of ${subs.length} completed`;
      if (sectionRefs.count.textContent !== countTxt) sectionRefs.count.textContent = countTxt;

      // Rebuild rows ONLY when phase changes (not on every time tick).
      if (renderedPhaseId !== phase.id) {
        renderedPhaseId = phase.id;
        sectionRefs.rowsHost.innerHTML = '';
        renderedRows = subs.map((s) => {
          const el = document.createElement('div');
          el.className = 'vp-sec-row';
          el.dataset.seek = s.timestampSec ?? s.t;
          const dot = document.createElement('div');
          dot.className = 'vp-sec-dot';
          const titleEl = document.createElement('span');
          titleEl.className = 'vp-sec-row-title';
          titleEl.textContent = s.title;
          el.appendChild(dot);
          el.appendChild(titleEl);
          sectionRefs.rowsHost.appendChild(el);
          return { el, dot, titleEl, id: s.id };
        });
      }
      // Patch only state attrs on the existing rows
      subs.forEach((s, i) => {
        const r = renderedRows[i];
        if (!r) return;
        const state = s.completed ? 'completed' : s.current ? 'current' : 'upcoming';
        if (r.el.dataset.state !== state) r.el.dataset.state = state;
        if (r.dot.dataset.state !== state) r.dot.dataset.state = state;
        const cur01 = s.current ? '1' : '0';
        if (r.el.dataset.current !== cur01) r.el.dataset.current = cur01;
      });
    } else {
      sectionRefs.progress.hidden = true;
      sectionRefs.empty.hidden = false;
      renderedPhaseId = null;
      renderedRows = [];
      sectionRefs.rowsHost.innerHTML = '';
    }
  }

  // ─────────── SCIENCE TRIGGER (top-right, compact) ───────────
  function renderScience(t) {
    let active = null;
    for (const sc of sciences) for (const ts of sc.timestampsSec) if (t >= ts && t < ts + 5) { active = sc; break; }
    if (!active) {
      if (slotTR.dataset.activeSci) {
        slotTR.innerHTML = '';
        slotTR.dataset.activeSci = '';
        window.__vpHighlightedScience = null;
        renderScienceHighlight();
      }
      return;
    }
    if (slotTR.dataset.activeSci === active.id) return;
    slotTR.dataset.activeSci = active.id;
    window.__vpHighlightedScience = active.id;
    renderScienceHighlight();
    slotTR.innerHTML = `
      <div data-overlay-action="science" class="vp-anim-right" style="display:inline-flex; align-items:center; gap:8px; background:linear-gradient(135deg, rgba(249,115,22,.30), rgba(245,158,11,.30), rgba(234,179,8,.28)); border:1px solid rgba(253,186,116,.35); border-radius:999px; padding:5px 6px 5px 12px; backdrop-filter:blur(10px); box-shadow:0 10px 24px rgba(0,0,0,.30); color:#fff7ed; pointer-events:auto; cursor:pointer;">
        <span style="font-size:14px;line-height:1">🧪</span>
        <span style="font:600 12px system-ui; color:#fff; letter-spacing:.2px">Science:</span>
        <span style="font:500 12px system-ui; color:rgba(255,237,213,.85); max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${active.name}</span>
        <button style="background:linear-gradient(90deg, #ea580c, #d97706); color:#fff; border:0; border-radius:999px; padding:4px 11px; font:600 11.5px system-ui; cursor:pointer; flex-shrink:0; line-height:1.3; pointer-events:auto;">Open</button>
      </div>`;
    const openSci = (e) => { e.stopPropagation(); window.__vpSidebarTab?.('science'); };
    slotTR.querySelector('[data-overlay-action="science"]').onclick = openSci;
    slotTR.querySelector('button').onclick = openSci;
  }

  // ─────────── AUDIO STATE MACHINE ───────────
  // When the video crosses an audio's trigger time, pause the video and play the audio (mocked
  // with a tick timer for the POC). When the audio ends or is skipped, resume the video.
  // While audio is active, play/pause + spacebar control the audio, not the video.
  const videoEl = document.querySelector('hls-video');
  const audioCtrl = {
    state: 'idle', // idle | playing | paused
    active: null,
    audioTime: 0,
    videoResumeTime: 0,
    triggered: new Set(),
    _tickHandle: null,

    activate(a, videoT) {
      if (this.state !== 'idle') return;
      this.state = 'playing';
      this.active = a;
      this.audioTime = 0;
      this.videoResumeTime = videoT;
      this.triggered.add(a.id);
      try { videoEl.pause(); } catch {}
      this._speak(a);
      this._scheduleTick();
    },
    togglePlay() {
      if (this.state === 'idle') return;
      if (this.state === 'playing') {
        this.state = 'paused';
        try { speechSynthesis.pause(); } catch {}
      } else {
        this.state = 'playing';
        try { speechSynthesis.resume(); } catch {}
      }
      this._scheduleTick();
      this._render();
    },
    end({ resume = true } = {}) {
      this.state = 'idle';
      this.active = null;
      this.audioTime = 0;
      if (this._tickHandle) { clearTimeout(this._tickHandle); this._tickHandle = null; }
      try { speechSynthesis.cancel(); } catch {}
      slotLowerThird.innerHTML = '';
      slotLowerThird.dataset.kind = '';
      slotLowerThird.dataset.activeAudio = '';
      if (resume) { try { videoEl.currentTime = this.videoResumeTime; videoEl.play(); } catch {} }
    },
    skip() { this.end({ resume: true }); },
    seekRel(delta) {
      if (this.state === 'idle') return;
      this.audioTime = Math.max(0, Math.min(this.active.dur, this.audioTime + delta));
      this._render();
      // SpeechSynthesis can't seek mid-utterance — advance the visual only.
    },
    _speak(a) {
      try {
        if (!('speechSynthesis' in window)) return;
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(a.script || a.title);
        u.lang = 'de-DE';
        u.rate = 1.0;
        u.pitch = 1.0;
        u.onend = () => { if (this.state !== 'idle') this.end({ resume: true }); };
        speechSynthesis.speak(u);
      } catch {}
    },
    isActive() { return this.state !== 'idle'; },

    _scheduleTick() {
      if (this._tickHandle) clearTimeout(this._tickHandle);
      if (this.state !== 'playing') return;
      this._tickHandle = setTimeout(() => {
        this._tickHandle = null;
        if (this.state !== 'playing') return;
        this.audioTime = Math.min(this.active.dur, this.audioTime + 0.1);
        if (this.audioTime >= this.active.dur) { this.end({ resume: true }); return; }
        this._render();
        this._scheduleTick();
      }, 100);
    },

    _render() { renderAudio(); },
  };
  window.__audioCtrl = audioCtrl;

  // Intercept play/pause clicks on the reskin controls + spacebar when audio is active.
  // Capture phase so we run before the reskin's own handlers.
  document.addEventListener('click', (e) => {
    if (!audioCtrl.isActive()) return;
    const btn = e.target.closest && e.target.closest('[data-vp="playpause"]');
    if (btn) { e.preventDefault(); e.stopPropagation(); audioCtrl.togglePlay(); }
  }, true);
  document.addEventListener('keydown', (e) => {
    if (!audioCtrl.isActive()) return;
    const tag = (document.activeElement?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) return;
    if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); audioCtrl.togglePlay(); }
  }, true);

  // Trigger audio when video time crosses an audio's t (one-shot per audio per pass).
  function maybeTriggerAudio(t) {
    if (audioCtrl.isActive()) return;
    // Allow re-trigger if user scrubbed back past the trigger.
    for (const a of audios) if (t < a.t - 0.5) audioCtrl.triggered.delete(a.id);
    const due = audios.find(a => t >= a.t && t < a.t + 1.0 && !audioCtrl.triggered.has(a.id));
    if (due) audioCtrl.activate(due, t);
  }

  // ─────────── AUDIO OVERLAY (lower-third banner — driven by audioCtrl) ───────────
  function renderAudio() {
    if (!audioCtrl.isActive()) {
      if (slotLowerThird.dataset.kind === 'audio') { slotLowerThird.innerHTML = ''; slotLowerThird.dataset.kind = ''; slotLowerThird.dataset.activeAudio = ''; }
      return false;
    }
    const active = audioCtrl.active;
    const elapsed = audioCtrl.audioTime;
    const pct = Math.min(100, (elapsed / active.dur) * 100);
    const isPlaying = audioCtrl.state === 'playing';
    if (slotLowerThird.dataset.activeAudio === active.id) {
      const fill = slotLowerThird.querySelector('[data-fill]');
      const tEl  = slotLowerThird.querySelector('[data-elapsed]');
      const pp   = slotLowerThird.querySelector('[data-action="audio-playpause"]');
      if (fill) fill.style.width = pct + '%';
      if (tEl)  tEl.textContent = fmt(elapsed);
      if (pp)   pp.textContent = isPlaying ? '⏸' : '▶';
      return true;
    }
    slotLowerThird.dataset.kind = 'audio';
    slotLowerThird.dataset.activeAudio = active.id;
    slotLowerThird.innerHTML = `
      <div class="vp-anim-bottom" style="display:flex; align-items:center; gap:14px; background:linear-gradient(135deg, rgba(249,115,22,.22), rgba(245,158,11,.22), rgba(234,179,8,.22)); border:1px solid rgba(253,186,116,.30); border-radius:14px; padding:10px 14px; backdrop-filter:blur(10px); box-shadow:0 14px 32px rgba(0,0,0,.35); color:#fff7ed; pointer-events:auto;">
        <div style="position:relative;flex-shrink:0">
          <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#ea580c,#d97706);border:2px solid #fb923c;display:flex;align-items:center;justify-content:center;font:700 14px system-ui;color:#fff">FH</div>
          <div style="position:absolute;right:-3px;bottom:-3px;width:16px;height:16px;border-radius:50%;border:2px solid #fff;background:linear-gradient(135deg,#ea580c,#d97706);display:flex;align-items:center;justify-content:center;font-size:9px">🎙️</div>
        </div>
        <div style="flex:0 0 auto; min-width:0; max-width:35%;">
          <div style="font:700 13.5px system-ui;color:#fff; overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${active.title}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:1px">
            <span style="font:500 11px system-ui;color:rgba(255,237,213,.7); overflow:hidden;text-overflow:ellipsis;white-space:nowrap">by ${active.voice}</span>
            <span style="width:4px;height:4px;border-radius:50%;background:#fbbf24" class="vp-pulse"></span>
            <span style="font:500 10.5px system-ui;color:rgba(255,237,213,.55);text-transform:uppercase;letter-spacing:.4px">${isPlaying ? 'Playing' : 'Paused'}</span>
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
          <button data-action="audio-playpause" title="Play/Pause" style="background:linear-gradient(90deg,#ea580c,#d97706);color:#fff;border:0;border-radius:8px;padding:7px 12px;font:500 13px system-ui;cursor:pointer;min-width:36px">${isPlaying ? '⏸' : '▶'}</button>
          <button data-action="audio-fwd" title="+10s" style="background:rgba(255,255,255,.15);color:#fff;border:0;border-radius:8px;padding:7px 10px;font:500 12px system-ui;cursor:pointer">+10s</button>
          <button data-action="audio-skip" title="Skip" style="background:rgba(255,255,255,.15);color:#fff;border:0;border-radius:8px;padding:7px 10px;font:500 12px system-ui;cursor:pointer">⏭</button>
        </div>
      </div>`;
    // Wire button actions
    const stop = (e) => e.stopPropagation();
    slotLowerThird.querySelector('[data-action="audio-back"]').onclick = (e) => { stop(e); audioCtrl.seekRel(-10); };
    slotLowerThird.querySelector('[data-action="audio-fwd"]').onclick  = (e) => { stop(e); audioCtrl.seekRel(+10); };
    slotLowerThird.querySelector('[data-action="audio-playpause"]').onclick = (e) => { stop(e); audioCtrl.togglePlay(); };
    slotLowerThird.querySelector('[data-action="audio-skip"]').onclick = (e) => { stop(e); audioCtrl.skip(); };
    return true;
  }

  // ─────────── META STEP FLY-IN (bottom-right lower-third pill, dynamic width, violet) ───────────
  function renderMetaStep(t) {
    const active = metaSteps.find(m => t >= m.t && t < m.t + 5);
    if (!active) { if (slotBR.dataset.kind === 'meta') { slotBR.innerHTML = ''; slotBR.dataset.kind = ''; } return; }
    if (slotBR.dataset.activeMeta === active.id) return;
    slotBR.dataset.kind = 'meta';
    slotBR.dataset.activeMeta = active.id;
    slotBR.innerHTML = `
      <div data-overlay-action="meta" class="vp-anim-right" style="display:inline-flex; align-items:center; gap:10px; background:linear-gradient(135deg, rgba(139,92,246,.22), rgba(168,85,247,.22), rgba(217,70,239,.22)); border:1px solid rgba(196,181,253,.30); border-radius:999px; padding:5px 14px 5px 5px; backdrop-filter:blur(10px); box-shadow:0 12px 28px rgba(0,0,0,.30); color:#f5f3ff; pointer-events:auto; white-space:nowrap; cursor:pointer;" title="Open Meta Structure">
        <div style="width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg, #7c3aed, #9333ea); color:#fff; display:flex; align-items:center; justify-content:center; font:700 13px system-ui; flex-shrink:0">${active.n}</div>
        <span style="font:600 10.5px system-ui; letter-spacing:.5px; text-transform:uppercase; color:rgba(221,214,254,.75)">Step ${active.n} / 7</span>
        <span style="width:1px; height:14px; background:rgba(196,181,253,.35)"></span>
        <span style="font:600 13px system-ui; color:#fff; line-height:1">${active.title}</span>
      </div>`;
    slotBR.querySelector('[data-overlay-action="meta"]').onclick = (e) => { e.stopPropagation(); window.__vpSidebarTab?.('meta'); };
  }

  // ─────────── SIDEBAR (Coaching / Science / Meta Structure) ───────────
  const sidebar = document.createElement('aside');
  sidebar.id = 'vp-demo-sidebar';
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
  // Mount the sidebar.
  //
  // Two strategies, picked at runtime:
  //
  //   (A) Flex-sibling of <main> — used on the regular Student page where
  //       LearningSuite renders <main> alongside a 300px "Sektion / X LEKTIONEN"
  //       right column. We hide that column and slot ourselves in.
  //
  //   (B) Fixed right rail — used in the Editor "Vorschau" preview and any
  //       other page where (A) wouldn't actually land us on the right edge
  //       (no <main>, parent isn't a row-flex with horizontal siblings, or
  //       post-install verification shows the sidebar didn't end up to the
  //       right of <main>). Pinned to the viewport right edge so the sidebar
  //       is always visible regardless of host layout.
  function detectTopNavHeight() {
    // Find the bottom edge of the highest-z-index fixed/sticky bar pinned to
    // the top of the viewport, so our sidebar can dodge under it.
    let bottom = 0;
    const candidates = document.querySelectorAll(
      'header, nav, [role="banner"], [class*="AppBar"], [class*="Toolbar"], [class*="topbar"], [class*="TopBar"], [class*="navbar"]'
    );
    for (const el of candidates) {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
      const r = el.getBoundingClientRect();
      // Top-anchored, not full-height, plausibly a top nav.
      if (r.top > 6 || r.height > 200 || r.height < 24) continue;
      if (r.bottom > bottom) bottom = r.bottom;
    }
    return bottom;
  }

  const SIDEBAR_W = 340;
  const SIDEBAR_GAP = 16;
  const SIDEBAR_MIN_TOP = 24;

  function applyFixedRightRail() {
    const topClear = Math.max(SIDEBAR_MIN_TOP, Math.ceil(detectTopNavHeight() + 8));
    sidebar.style.position = 'fixed';
    sidebar.style.top = topClear + 'px';
    sidebar.style.right = SIDEBAR_GAP + 'px';
    sidebar.style.bottom = SIDEBAR_GAP + 'px';
    sidebar.style.maxHeight = `calc(100vh - ${topClear + SIDEBAR_GAP}px)`;
    sidebar.style.zIndex = '50';
    sidebar.style.width = SIDEBAR_W + 'px';
    sidebar.style.alignSelf = '';
    if (sidebar.parentElement !== document.body) document.body.appendChild(sidebar);

    // Reserve horizontal space so the sidebar never overlaps the centered
    // lesson content. Try a few common LS scroll containers; whichever sticks,
    // we cleanup on re-inject.
    const reservePx = SIDEBAR_W + SIDEBAR_GAP * 2;
    const targets = [
      document.querySelector('main'),
      document.querySelector('[class*="MainScroll"]'),
      document.querySelector('[class*="content-scroll"]'),
      document.body,
    ].filter(Boolean);
    for (const t of targets) {
      const prev = t.style.paddingRight;
      t.style.paddingRight = reservePx + 'px';
      window.__vpDemoCleanup.push(() => { t.style.paddingRight = prev; });
    }

    // If the topnav grows/shrinks (resize, expand-collapse), keep our top
    // edge in sync.
    const onResize = () => {
      const next = Math.max(SIDEBAR_MIN_TOP, Math.ceil(detectTopNavHeight() + 8));
      sidebar.style.top = next + 'px';
      sidebar.style.maxHeight = `calc(100vh - ${next + SIDEBAR_GAP}px)`;
    };
    window.addEventListener('resize', onResize);
    window.__vpDemoCleanup.push(() => window.removeEventListener('resize', onResize));
  }

  function tryFlexSibling() {
    const main = document.querySelector('main');
    if (!main) return false;
    const flexParent = main.parentElement;
    if (!flexParent) return false;
    // Snapshot current sibling display values so we can revert if the layout
    // doesn't actually leave us on the right.
    const prevDisplays = new Map();
    [...flexParent.children].forEach(child => {
      if (child !== main && child.id !== 'vp-demo-sidebar') {
        prevDisplays.set(child, child.style.display);
        child.style.display = 'none';
      }
    });
    const prevParentDisplay = flexParent.style.display;
    const prevParentGap = flexParent.style.gap;
    const prevMainFlex = main.style.flex;
    const prevMainMinWidth = main.style.minWidth;
    if (getComputedStyle(flexParent).display !== 'flex') flexParent.style.display = 'flex';
    flexParent.style.gap = '24px';
    main.style.flex = '1 1 0';
    main.style.minWidth = '0';
    flexParent.appendChild(sidebar);

    // Verify: did sidebar actually land to the right of <main>, in the viewport?
    const mainRect = main.getBoundingClientRect();
    const sbRect = sidebar.getBoundingClientRect();
    const fitsToRightOfMain = sbRect.left + 5 >= mainRect.right;
    const visibleInViewport = sbRect.right <= window.innerWidth + 1 && sbRect.width >= 200;

    if (fitsToRightOfMain && visibleInViewport) return true;

    // Roll back layout edits — host page may rely on these.
    prevDisplays.forEach((v, child) => { child.style.display = v; });
    flexParent.style.display = prevParentDisplay;
    flexParent.style.gap = prevParentGap;
    main.style.flex = prevMainFlex;
    main.style.minWidth = prevMainMinWidth;
    return false;
  }

  if (!tryFlexSibling()) applyFixedRightRail();

  function setTab(name) {
    sidebar.querySelectorAll('.vp-tab').forEach(b => {
      const active = b.dataset.tab === name;
      b.style.background = active ? T.card : 'transparent';
      b.style.color = active ? T.fg : T.mutedFg;
      b.style.fontWeight = active ? '600' : '500';
      b.style.boxShadow = active ? '0 1px 2px rgba(0,0,0,.06)' : 'none';
    });
    sidebar.querySelectorAll('[data-panel]').forEach(p => { p.style.display = (p.getAttribute('data-panel') === name) ? '' : 'none'; });
  }
  window.__vpSidebarTab = setTab;
  sidebar.querySelectorAll('.vp-tab').forEach(btn => { btn.onclick = () => setTab(btn.dataset.tab); });

  // Coaching panel — phase accordion
  const coachingPanel = sidebar.querySelector('[data-panel="coaching"]');
  function renderCoaching() {
    coachingPanel.innerHTML = phases.map((p, i) => {
      const open   = p.id === window.__vpExpandedPhase;
      const active = p.id === window.__vpActivePhase;
      const dur = Math.round((p.endTimeSec - p.startTimeSec) / 60) || 1;
      return `
        <div style="margin-bottom:10px;border:2px solid ${active ? T.primary : T.border};background:${T.card};border-radius:${T.radius};overflow:hidden;${active ? `box-shadow:0 0 0 4px ${T.primarySoft};` : ''}transition:all .2s">
          <button data-phase-toggle="${p.id}" style="width:100%;text-align:left;background:none;border:0;padding:12px;cursor:pointer;display:flex;gap:12px;align-items:flex-start">
            <div style="flex-shrink:0;width:36px;height:36px;border-radius:8px;background:${active ? T.primary : T.muted};color:${active ? '#fff' : T.mutedFg};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px">${i+1}</div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <h3 style="margin:0;font:600 14.5px system-ui;color:${active ? T.primary : T.fg}">${p.title}</h3>
                <span data-seek="${p.startTimeSec}" style="font:500 11px ui-monospace,monospace;background:${T.muted};color:${T.mutedFg};padding:2px 7px;border-radius:6px;border:1px solid ${T.border};cursor:pointer">${fmt(p.startTimeSec)}</span>
              </div>
              <p style="margin:6px 0 0;color:${T.mutedFg};font-size:13px;line-height:1.5;${open ? '' : 'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden'}">${p.description}</p>
              ${!open ? `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
                <span style="font:500 11px system-ui;background:${T.muted};color:${T.mutedFg};padding:2px 8px;border-radius:999px;border:1px solid ${T.border}">${p.interventions.length} interventions</span>
                <span style="font:500 11px ui-monospace,monospace;background:transparent;color:${T.mutedFg};padding:2px 8px;border-radius:999px;border:1px solid ${T.border}">⏱ ${dur}m</span>
              </div>` : ''}
            </div>
          </button>
          ${open ? `<div style="padding:0 12px 12px">
            <div style="border-top:1px solid ${T.border};padding-top:12px">
              <div style="font:600 11px system-ui;letter-spacing:.6px;text-transform:uppercase;color:${T.mutedFg};margin-bottom:8px">Interventions</div>
              <div style="display:grid;gap:6px">
                ${p.interventions.map(iv => {
                  const ivActive = iv.id === window.__vpActiveIntervention;
                  return `<div data-seek="${iv.t}" style="padding:9px 11px;border-radius:8px;background:${ivActive ? T.primarySoft : T.muted};border:1px solid ${ivActive ? T.primaryRing : T.border};cursor:pointer">
                    <div style="display:flex;gap:8px;align-items:baseline">
                      <span style="font:700 11.5px ui-monospace,monospace;color:${ivActive ? T.primary : T.mutedFg};min-width:28px">${iv.label}</span>
                      <strong style="flex:1;font:600 13px system-ui;color:${T.fg}">${iv.title}</strong>
                      <span style="font:500 11px ui-monospace,monospace;color:${T.mutedFg}">${fmt(iv.t)}</span>
                    </div>
                    <div style="margin:4px 0 0 36px;color:${T.mutedFg};font-size:12.5px">${iv.desc}</div>
                  </div>`;
                }).join('')}
              </div>
            </div>
          </div>` : ''}
        </div>`;
    }).join('');

    coachingPanel.querySelectorAll('[data-phase-toggle]').forEach(btn => {
      btn.onclick = (e) => {
        const seekEl = e.target.closest('[data-seek]');
        if (seekEl) { e.stopPropagation(); window.player.seek(+seekEl.dataset.seek + 0.1); return; }
        const id = btn.dataset.phaseToggle;
        window.__vpExpandedPhase = (window.__vpExpandedPhase === id) ? null : id;
        renderCoaching();
      };
    });
    coachingPanel.querySelectorAll('[data-seek]').forEach(el => { el.onclick = (e) => { e.stopPropagation(); window.player.seek(+el.dataset.seek + 0.1); }; });
  }
  window.__vpExpandedPhase = phases[0].id;
  renderCoaching();

  // Science panel
  const sciencePanel = sidebar.querySelector('[data-panel="science"]');
  function renderSciencePanel() {
    sciencePanel.innerHTML = `<div style="display:grid;gap:8px">
      ${sciences.map(s => {
        const hl = window.__vpHighlightedScience === s.id;
        return `<div data-sci-card="${s.id}" style="border:1px solid ${hl ? T.primary : T.border};border-radius:${T.radius};padding:12px;background:${T.card};${hl ? `box-shadow:0 0 0 4px ${T.primarySoft};` : ''}transition:all .2s">
          <div style="display:flex;align-items:baseline;gap:8px">
            <h3 style="margin:0;font:600 14px system-ui;color:${hl ? T.primary : T.fg};flex:1">${s.name}</h3>
            <span style="font:500 11px system-ui;background:${T.muted};color:${T.mutedFg};padding:2px 7px;border-radius:999px">${s.timestampsSec.length} mentions</span>
          </div>
          <p style="margin:6px 0 0;color:${T.mutedFg};font-size:13px;line-height:1.5">${s.description}</p>
          <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
            ${s.timestampsSec.map(t => `<span data-seek="${t}" style="font:500 11.5px ui-monospace,monospace;color:${T.primary};background:${T.primarySoft};padding:3px 8px;border-radius:6px;border:1px solid ${T.primaryRing};cursor:pointer">${fmt(t)}</span>`).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>`;
    sciencePanel.querySelectorAll('[data-seek]').forEach(el => { el.onclick = () => window.player.seek(+el.dataset.seek + 0.1); });
  }
  function renderScienceHighlight() {
    renderSciencePanel();
    const id = window.__vpHighlightedScience;
    if (!id) return;
    const card = sciencePanel.querySelector(`[data-sci-card="${id}"]`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  renderSciencePanel();

  // Meta Structure panel
  const metaPanel = sidebar.querySelector('[data-panel="meta"]');
  function renderMeta() {
    metaPanel.innerHTML = `<div style="font:600 11px system-ui;letter-spacing:.6px;text-transform:uppercase;color:${T.mutedFg};margin-bottom:10px">7 Master Steps</div>
      <ol style="list-style:none;padding:0;margin:0;display:grid;gap:6px">
        ${metaSteps.map(m => {
          const active = window.__vpActiveMeta === m.id;
          return `<li data-seek="${m.t}" style="padding:10px 11px;border-radius:${T.radius};background:${active ? T.primarySoft : T.card};border:1px solid ${active ? T.primaryRing : T.border};cursor:pointer;display:flex;gap:10px;align-items:flex-start">
            <div style="flex-shrink:0;width:28px;height:28px;border-radius:7px;background:${active ? T.primary : T.muted};color:${active ? '#fff' : T.mutedFg};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px">${m.n}</div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;gap:8px;align-items:baseline">
                <strong style="font:600 13.5px system-ui;color:${T.fg};flex:1">${m.title}</strong>
                <span style="font:500 11px ui-monospace,monospace;color:${T.mutedFg}">${fmt(m.t)}</span>
              </div>
            </div>
          </li>`;
        }).join('')}
      </ol>`;
    metaPanel.querySelectorAll('[data-seek]').forEach(el => { el.onclick = () => window.player.seek(+el.dataset.seek + 0.1); });
  }
  renderMeta();

  // ─────────── TIME SYNC: drives every overlay + sidebar highlight ───────────
  function recomputeActive(t) {
    const phase = phases.find(p => t >= p.startTimeSec && t < p.endTimeSec) || null;
    let intervention = null;
    if (phase) for (const iv of [...phase.interventions].sort((a,b) => a.t - b.t)) if (t >= iv.t) intervention = iv.id;
    let meta = null;
    for (const m of metaSteps) if (t >= m.t) meta = m.id;

    const phaseChanged = window.__vpActivePhase !== phase?.id;
    window.__vpActivePhase = phase?.id ?? null;
    window.__vpActiveIntervention = intervention;
    window.__vpActiveMeta = meta;
    if (phaseChanged && phase) window.__vpExpandedPhase = phase.id;

    renderCoaching();
    renderMeta();
    renderSection();

    // Audio is one-shot: triggered on time-cross, owns playback while active.
    maybeTriggerAudio(t);
    if (audioCtrl.isActive()) {
      renderAudio();
      // Hide meta-step pill while audio is active.
      if (slotBR.dataset.kind === 'meta') { slotBR.innerHTML = ''; slotBR.dataset.kind = ''; slotBR.dataset.activeMeta = ''; }
    } else {
      renderMetaStep(t);
    }

    renderScience(t);
  }

  // Replace any existing player.setOverlays usage — we drive overlays directly now
  window.player.setOverlays([]);
  const offBus = window.player.on('any', (e) => {
    if (e.type === 'time' || e.type === 'overlay-show' || e.type === 'overlay-hide' || e.type === 'play' || e.type === 'pause') {
      recomputeActive(e.time ?? window.player.current ?? 0);
    }
  });
  if (typeof offBus === 'function') window.__vpDemoCleanup.push(offBus);
  recomputeActive(window.player.current ?? 0);

  return 'demo (full overlays) configured';
})();
