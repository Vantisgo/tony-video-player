// Launch button + dialog styling for the admin authoring UI.
export const ADMIN_CSS = `
    .vp-admin-launch {
      white-space:normal; box-sizing:border-box;
      display:block; width:max-content; text-align:left;
      margin:6px 0 0 2px; padding:2px 4px;
      background:transparent; border:0; border-radius:4px;
      font:500 12px system-ui, -apple-system, sans-serif;
      color:#64748b; cursor:pointer;
    }
    .vp-admin-launch:hover { color:#0f172a; text-decoration:underline; }
    .vp-admin-launch:focus-visible {
      outline:2px solid #ea580c; outline-offset:2px;
    }

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
