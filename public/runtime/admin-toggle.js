// admin-toggle.js — Admin-only banner + dialog for activating Advanced Video Modus.
//
// Behaviour:
//   - Banner only mounts inside the LearningSuite admin editor's EDIT view
//     (URL contains `/admin/editor/` AND no `?view=preview`).
//   - In Vorschau / preview / student-facing pages, the banner is removed
//     so the video gets only the overlay + sidebar (rendered by the other
//     two scripts).
//   - Watches every <hls-video> on the page and inserts a small banner
//     directly above its container with a "Aktivieren / Bearbeiten" button.
//   - The button opens a modal dialog explaining the two-step setup:
//       1. add a "Code einbetten" block under the video
//       2. copy a ready-made LLM prompt (with the JSON schema baked in)
//          and paste the LLM's output into that block.
//
// Note: in LearningSuite, "Editor" ↔ "Vorschau" toggling is SPA-only —
// the URL flips between …/27ZqYKF1 and …/27ZqYKF1?view=preview without
// reloading the page. So this script can't decide once at load and bail;
// it has to re-evaluate on URL changes (popstate + a short URL poll for
// pushState which doesn't fire popstate). The banners get torn down when
// we leave edit view and re-mounted when we return.
//
// Idempotent: re-running the script removes any previous banner / dialog
// host before recreating them.

(() => {
  // Idempotency: tear down everything from a previous run BEFORE we set up
  // anew. Without this, re-injecting the script would stack MutationObservers
  // and pin the renderer at 100% CPU. Each setup call pushes its disconnect
  // into a global registry that this teardown drains.
  if (Array.isArray(window.__vpAdminCleanup)) {
    for (const fn of window.__vpAdminCleanup) { try { fn(); } catch {} }
  }
  window.__vpAdminCleanup = [];
  document.getElementById('vp-admin-toggle-style')?.remove();
  document.querySelectorAll('.vp-admin-banner').forEach(el => el.remove());
  document.getElementById('vp-admin-dialog-host')?.remove();
  // Also clear the per-element attached flag on existing <hls-video>s so
  // attach() reattaches cleanly.
  document.querySelectorAll('hls-video').forEach(v => { delete v.__vpAdminAttached; });

  const styleEl = document.createElement('style');
  styleEl.id = 'vp-admin-toggle-style';
  styleEl.textContent = `
    .vp-admin-banner, .vp-admin-banner * { white-space:normal; box-sizing:border-box; }
    .vp-admin-banner {
      display:flex; align-items:center; gap:12px;
      background:linear-gradient(135deg, #fff7ed, #ffedd5);
      border:1px solid #fdba74; border-radius:12px;
      padding:10px 14px; margin:0 0 12px 0;
      font:500 13px/1.4 system-ui, -apple-system, sans-serif;
      color:#7c2d12; pointer-events:auto;
    }
    .vp-admin-banner .vp-icon { font-size:18px; line-height:1; }
    .vp-admin-banner .vp-text { flex:1; min-width:0; }
    .vp-admin-banner .vp-title { font-weight:600; color:#9a3412; }
    .vp-admin-banner .vp-sub   { font-size:11px; color:#9a3412; opacity:.75; margin-top:2px; }
    .vp-admin-banner .vp-status {
      font:600 11px system-ui; padding:3px 9px; border-radius:999px;
      background:rgba(34,197,94,.18); color:#15803d; display:none; flex-shrink:0;
    }
    .vp-admin-banner .vp-status[data-active="1"] { display:inline-block; }
    .vp-admin-banner .vp-status[data-active="0"] { display:inline-block; background:rgba(100,116,139,.12); color:#475569; }
    .vp-admin-banner button.vp-cta {
      background:#ea580c; color:#fff; border:0; border-radius:8px;
      padding:8px 14px; font:600 13px system-ui; cursor:pointer;
      transition:background .15s ease; flex-shrink:0;
    }
    .vp-admin-banner button.vp-cta:hover { background:#c2410c; }

    .vp-admin-dialog-backdrop {
      position:fixed; inset:0; background:rgba(15,23,42,.55);
      z-index:9000; display:flex; align-items:center; justify-content:center;
      padding:24px;
    }
    .vp-admin-dialog, .vp-admin-dialog * { white-space:normal; box-sizing:border-box; }
    .vp-admin-dialog {
      background:#fff; border-radius:14px; max-width:780px; width:100%;
      max-height:calc(100vh - 48px); overflow:auto;
      box-shadow:0 20px 60px rgba(15,23,42,.35);
      font:14px/1.5 system-ui, -apple-system, sans-serif; color:#1e293b;
    }
    .vp-admin-dialog header {
      padding:18px 22px 14px; border-bottom:1px solid #e2e8f0;
      display:flex; align-items:center; gap:10px;
    }
    .vp-admin-dialog h2 { margin:0; font:700 17px system-ui; color:#0f172a; flex:1; }
    .vp-admin-dialog .vp-close {
      background:none; border:0; font-size:22px; line-height:1; color:#64748b;
      cursor:pointer; padding:4px 10px; border-radius:6px;
    }
    .vp-admin-dialog .vp-close:hover { background:#f1f5f9; color:#0f172a; }
    .vp-admin-dialog section { padding:18px 22px; }
    .vp-admin-dialog section + section { border-top:1px solid #e2e8f0; }
    .vp-admin-dialog h3 {
      margin:0 0 10px; font:600 14px system-ui; color:#0f172a;
      display:flex; align-items:center; gap:10px;
    }
    .vp-admin-dialog .vp-step-num {
      display:inline-flex; align-items:center; justify-content:center;
      width:24px; height:24px; border-radius:50%; flex-shrink:0;
      background:#ea580c; color:#fff; font:700 12px system-ui;
    }
    .vp-admin-dialog p { margin:0 0 10px; color:#475569; }
    .vp-admin-dialog code {
      background:#f1f5f9; padding:1px 6px; border-radius:4px;
      font:13px ui-monospace, Menlo, monospace; color:#0f172a;
    }
    .vp-admin-dialog .vp-prompt-wrap { position:relative; }
    .vp-admin-dialog textarea.vp-prompt {
      width:100%; height:280px; resize:vertical;
      font:12px/1.45 ui-monospace, Menlo, monospace;
      background:#0f172a; color:#e2e8f0;
      border:1px solid #1e293b; border-radius:8px; padding:12px;
    }
    .vp-admin-dialog .vp-copy-btn {
      position:absolute; top:8px; right:8px;
      background:#1e293b; color:#fff; border:0; border-radius:6px;
      padding:6px 12px; font:600 12px system-ui; cursor:pointer;
    }
    .vp-admin-dialog .vp-copy-btn:hover { background:#334155; }
    .vp-admin-dialog .vp-copy-btn[data-copied="1"] { background:#15803d; }
    .vp-admin-dialog footer {
      padding:14px 22px; background:#f8fafc; border-top:1px solid #e2e8f0;
      font-size:12px; color:#475569;
    }
    .vp-admin-dialog .vp-tip {
      color:#0c4a6e; background:#e0f2fe; padding:8px 12px; border-radius:8px;
    }
  `;
  document.head.appendChild(styleEl);

  // The prompt the admin will paste into their LLM. Edit this single string
  // to update the wording everywhere — it's the only source of truth.
  const PROMPT_TEXT = `Du erstellst eine JSON-Konfiguration für einen erweiterten Video-Player auf einer LearningSuite-Coaching-Lektion.

Anhand des unten gegebenen Lektions-Materials (Transkript, Drehbuch oder Inhaltsbeschreibung) erstellst du das JSON nach folgendem Schema. Verwende die Sprache des Materials (i.d.R. Deutsch).

═══ Schema-Übersicht ═══

{
  "phases":   [ Sektionen des Coaching-Bogens, jeweils mit interventions[] ],
  "sciences": [ Wissenschafts-Pop-Ups, kurze 5-Sekunden-Trigger ],
  "audios":   [ Voice-Over-Banner, pausieren das Video für einen Audio-Einschub ],
  "metaSteps":[ "Master-Schritt"-Pills für den globalen Bogen, ~5s sichtbar ],
  "quiz":     { optionale interaktive Wissensfragen an definierten Video-Unterbrechungen }
}

═══ Felder im Detail ═══

phases[]:
  id            — eindeutiger string, z.B. "p1"
  title         — Phasen-Titel
  description   — 1 Satz
  startTimeSec  — Phase startet ab Sekunde X
  endTimeSec    — Phase endet bei Sekunde Y
  interventions[]:
    id    — eindeutig, z.B. "i11"
    label — kurzer Label, z.B. "1.1"
    title — Titel der Intervention
    t     — Trigger-Zeitpunkt (Sekunde im Video)
    desc  — 1 Satz Beschreibung

sciences[]:  (Wissenschafts-Pop-Ups, je 5s sichtbar bei jedem Timestamp)
  id, name, description, timestampsSec[]

audios[]:    (Voice-Over-Einschübe; pausieren das Video)
  id, t (Trigger), dur (Dauer in Sek), title, voice (Sprecher-Name), script (gesprochener Text)

metaSteps[]: (große Phasen-Marker, "7 Master Steps"-Style)
  id, n (Nummer), title, t (Trigger Sek)

quiz: (OPTIONAL; vollständig weglassen, wenn keine Wissensfragen sinnvoll sind)
  feedbackDurationSec — Dauer der Antwort-Rückmeldung; Standard 3
  showScore            — true zeigt den laufenden Punktestand
  showSummary          — true zeigt am Videoende eine Auswertung
  passingPercent       — optionale Bestehensgrenze von 0 bis 100
  quizzes[]:
    id, title, t (Unterbrechungs-Zeitpunkt), resume ("auto" oder "manual")
    questions[]:
      id, prompt, explanation (optional), timeoutSec (optional, mindestens 5), showCountdown
      correctOptionId — id der einzigen richtigen Antwort
      options[]       — 1 bis 4 Objekte mit jeweils id und text

═══ Output-Format (NUR DIESES, keine Erklärung davor/danach) ═══

<pre data-vp-config style="display:none">
{
  "phases": [
    {
      "id":"p1", "title":"Einführung", "description":"...",
      "startTimeSec":0, "endTimeSec":60,
      "interventions":[
        { "id":"i11", "label":"1.1", "title":"...", "t":10, "desc":"..." }
      ]
    }
  ],
  "sciences": [
    { "id":"s1", "name":"...", "description":"...", "timestampsSec":[22] }
  ],
  "audios": [
    { "id":"a1", "t":30, "dur":8, "title":"Voice-Over: ...", "voice":"...", "script":"..." }
  ],
  "metaSteps": [
    { "id":"m1", "n":1, "title":"...", "t":4 }
  ],
  "quiz": {
    "feedbackDurationSec":3,
    "showScore":true,
    "showSummary":true,
    "passingPercent":70,
    "quizzes":[
      {
        "id":"q1", "title":"Kurz-Check", "t":45, "resume":"auto",
        "questions":[
          {
            "id":"q1-1", "prompt":"Welche Aussage trifft zu?", "explanation":"...",
            "timeoutSec":15, "showCountdown":true, "correctOptionId":"q1-1-b",
            "options":[
              { "id":"q1-1-a", "text":"..." },
              { "id":"q1-1-b", "text":"..." },
              { "id":"q1-1-c", "text":"..." }
            ]
          }
        ]
      }
    ]
  }
}
</pre>

═══ Anforderungen ═══

- ALLE id-Strings müssen eindeutig sein
- t-Werte (Zeitstempel) realistisch zum Video-Inhalt
- Jede Quizfrage braucht 1–4 Antworten; correctOptionId muss auf genau eine option.id verweisen
- timeoutSec nur verwenden, wenn Zeitdruck didaktisch sinnvoll ist; empfohlen sind mindestens 15 Sekunden
- Sprache des Materials beibehalten
- Antworte NUR mit dem <pre>-Block (keine Einleitung, keine Schluss-Erklärung)
- Der Block wird 1:1 in den LearningSuite "Code einbetten"-Block eingefügt

═══ Lektions-Material ═══

[FÜGE HIER DAS LEKTIONS-TRANSKRIPT, DREHBUCH ODER DIE INHALTSBESCHREIBUNG EIN]
`;

  function hasVpConfigOnPage() {
    if (document.querySelector('[data-vp-config]:not(script)')) return true;
    if (document.querySelector('script[data-vp-config]')) return true;
    // Edit-mode DOM stores the raw saved code as a string in disabled inputs.
    return [...document.querySelectorAll('input[type="text"]')].some(i =>
      typeof i.value === 'string' && i.value.includes('data-vp-config'));
  }

  function openDialog(onAfterClose) {
    document.getElementById('vp-admin-dialog-host')?.remove();
    const host = document.createElement('div');
    host.id = 'vp-admin-dialog-host';
    host.className = 'vp-admin-dialog-backdrop';
    host.innerHTML = `
      <div class="vp-admin-dialog" role="dialog" aria-modal="true">
        <header>
          <span class="vp-icon" style="font-size:22px">⚡</span>
          <h2>Advanced Video Modus aktivieren</h2>
          <button class="vp-close" aria-label="Schließen">×</button>
        </header>
        <section>
          <h3><span class="vp-step-num">1</span>Code-Block hinzufügen</h3>
          <p>Füge unter dem Video einen <strong>"Code einbetten"</strong>-Block hinzu — links in der Block-Sidebar unter <em>Code-Elemente → Code einbetten</em>.</p>
          <p>Stelle den Block auf <strong>"In Seite anzeigen"</strong> (Standard).</p>
        </section>
        <section>
          <h3><span class="vp-step-num">2</span>Prompt an LLM, dann Antwort einfügen</h3>
          <p>Kopiere den folgenden Prompt, gib ihn an dein LLM (ChatGPT, Claude, …) zusammen mit dem Lektions-Transkript / Drehbuch. Die Antwort des LLMs ist ein fertiger <code>&lt;pre data-vp-config&gt;</code>-Block — paste ihn 1:1 in das "Code einbetten"-Modal, klicke <strong>Speichern</strong>, dann oben auf <strong>Vorschau</strong> zum Testen.</p>
          <div class="vp-prompt-wrap">
            <textarea class="vp-prompt" readonly></textarea>
            <button class="vp-copy-btn">Prompt kopieren</button>
          </div>
        </section>
        <footer>
          <span class="vp-tip">💡 Im Editor zeigt LearningSuite den gespeicherten Code als Roh-String. Erst die <em>Vorschau</em> rendert ihn live — und genau dann erscheint der Advanced Video Editor (Re-Skin + Sidebar + Overlays).</span>
        </footer>
      </div>
    `;
    host.querySelector('.vp-prompt').value = PROMPT_TEXT;
    function closeDialog() {
      host.remove();
      document.removeEventListener('keydown', onKey);
      if (typeof onAfterClose === 'function') { try { onAfterClose(); } catch {} }
    }
    function onKey(e) { if (e.key === 'Escape') closeDialog(); }
    host.querySelector('.vp-close').onclick = closeDialog;
    host.addEventListener('click', (e) => { if (e.target === host) closeDialog(); });
    document.addEventListener('keydown', onKey);
    const copyBtn = host.querySelector('.vp-copy-btn');
    copyBtn.onclick = async () => {
      const ta = host.querySelector('.vp-prompt');
      ta.select();
      try { await navigator.clipboard.writeText(ta.value); }
      catch { try { document.execCommand('copy'); } catch {} }
      copyBtn.textContent = '✓ Kopiert';
      copyBtn.dataset.copied = '1';
      setTimeout(() => { copyBtn.textContent = 'Prompt kopieren'; copyBtn.dataset.copied = '0'; }, 1800);
    };
    document.body.appendChild(host);
  }

  function attach(hlsEl) {
    if (hlsEl.__vpAdminAttached) return;
    const playerHost = hlsEl.parentElement;
    if (!playerHost) return;
    const insertParent = playerHost.parentElement;
    if (!insertParent) return;
    if (playerHost.previousElementSibling?.classList?.contains('vp-admin-banner')) {
      hlsEl.__vpAdminAttached = true;
      return;
    }
    hlsEl.__vpAdminAttached = true;

    const banner = document.createElement('div');
    banner.className = 'vp-admin-banner';
    banner.innerHTML = `
      <span class="vp-icon">⚡</span>
      <div class="vp-text">
        <div class="vp-title">Advanced Video Modus</div>
        <div class="vp-sub">Re-Skin · Overlays · Coaching-Sidebar — gesteuert per JSON im Code-einbetten-Block</div>
      </div>
      <span class="vp-status" data-vp-status></span>
      <button class="vp-cta" type="button">Aktivieren / Bearbeiten</button>
    `;
    const status = banner.querySelector('[data-vp-status]');
    function refreshStatus() {
      const active = hasVpConfigOnPage();
      const next = active ? '1' : '0';
      const text = active ? '✓ Konfig vorhanden' : 'noch nicht aktiviert';
      // Skip DOM writes if nothing changed — avoids needless layout work.
      if (status.dataset.active !== next) status.dataset.active = next;
      if (status.textContent !== text)   status.textContent  = text;
    }
    refreshStatus();
    banner.querySelector('button.vp-cta').onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openDialog(refreshStatus);
    };
    insertParent.insertBefore(banner, playerHost);

    // Lightweight passive refresh: poll every 2s, skip if status unchanged.
    // The previous attribute-MutationObserver on body+subtree pinned the CPU
    // because LearningSuite's React app constantly mutates input `value`s.
    const pollId = setInterval(refreshStatus, 2000);
    window.__vpAdminCleanup.push(() => clearInterval(pollId));
  }

  function isEditMode() {
    if (!location.pathname.includes('/admin/editor/')) return false;
    if (new URLSearchParams(location.search).get('view') === 'preview') return false;
    return true;
  }

  function teardownBanners() {
    document.querySelectorAll('.vp-admin-banner').forEach(el => el.remove());
    document.getElementById('vp-admin-dialog-host')?.remove();
    // Re-arm attach() for any future return to edit mode.
    document.querySelectorAll('hls-video').forEach(v => { delete v.__vpAdminAttached; });
  }

  function scan() { document.querySelectorAll('hls-video').forEach(attach); }

  function applyMode() {
    if (isEditMode()) scan();
    else teardownBanners();
  }

  applyMode();

  // Debounce scan so React's chatty re-renders don't burn CPU.
  let scanPending = 0;
  function scheduleApply() {
    if (scanPending) return;
    scanPending = setTimeout(() => { scanPending = 0; applyMode(); }, 250);
  }
  const mo = new MutationObserver(scheduleApply);
  mo.observe(document.body, { subtree: true, childList: true });
  window.__vpAdminCleanup.push(() => { mo.disconnect(); if (scanPending) clearTimeout(scanPending); });

  // SPA navigation. popstate fires for back/forward but NOT for pushState
  // (which is what LS uses when you click Editor / Vorschau), so we also
  // poll the URL on a short interval. 600 ms is a fair balance between
  // responsiveness and idle cost.
  let lastHref = location.href;
  const checkUrl = () => {
    if (location.href === lastHref) return;
    lastHref = location.href;
    applyMode();
  };
  window.addEventListener('popstate', checkUrl);
  window.__vpAdminCleanup.push(() => window.removeEventListener('popstate', checkUrl));
  const urlPollId = setInterval(checkUrl, 600);
  window.__vpAdminCleanup.push(() => clearInterval(urlPollId));

  return 'admin-toggle armed';
})();
