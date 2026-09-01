// admin-toggle — Admin-only launch button + dialog for activating Advanced Video
// Modus.
//
// Mounts only inside the LearningSuite admin editor's EDIT view (URL contains
// `/admin/editor/` and no `?view=preview`). Watches every <hls-video> and inserts
// a quiet text button BELOW its container, labelled from a one-shot
// config-presence check, that opens a dialog explaining the two-step setup (add a
// "Code einbetten" block, paste an LLM prompt's output). Idempotent +
// re-injectable.
import { pushCleanup, resetCleanup } from "../common/cleanup";
import { PROMPT_TEXT } from "./prompt";
import { ADMIN_CSS } from "./styles";

const CLEANUP_KEY = "__vpAdminCleanup";

type AdminHlsEl = HTMLElement & { __vpAdminAttached?: boolean };

function main(): string {
  // Idempotency: tear down everything from a previous run before setting up.
  resetCleanup(CLEANUP_KEY);
  document.getElementById("vp-admin-toggle-style")?.remove();
  // Sweep the legacy .vp-admin-banner too, so upgrading over an already-deployed
  // older script removes the banner it left behind.
  document
    .querySelectorAll(".vp-admin-launch, .vp-admin-banner")
    .forEach((el) => el.remove());
  document.getElementById("vp-admin-dialog-host")?.remove();
  document.querySelectorAll("hls-video").forEach((v) => {
    delete (v as AdminHlsEl).__vpAdminAttached;
  });

  const styleEl = document.createElement("style");
  styleEl.id = "vp-admin-toggle-style";
  styleEl.textContent = ADMIN_CSS;
  document.head.appendChild(styleEl);

  function hasVpConfigOnPage(): boolean {
    if (document.querySelector("[data-vp-config]:not(script)")) return true;
    if (document.querySelector("script[data-vp-config]")) return true;
    // Edit-mode DOM stores the raw saved code as a string in disabled inputs.
    return [...document.querySelectorAll('input[type="text"]')].some(
      (i) =>
        typeof (i as HTMLInputElement).value === "string" &&
        (i as HTMLInputElement).value.includes("data-vp-config"),
    );
  }

  function openDialog(onAfterClose?: () => void): void {
    document.getElementById("vp-admin-dialog-host")?.remove();
    const host = document.createElement("div");
    host.id = "vp-admin-dialog-host";
    host.className = "vp-admin-dialog-backdrop";
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
          <h3><span class="vp-step-num">2</span>Voice-Over-Dateien hochladen</h3>
          <p>Lade im <strong>"Code einbetten"</strong>-Editor die Audio-Dateien als <strong>Assets</strong> hoch und kopiere jeden Verweis (Form <code>{{asset:datei-name}}</code>) — du gibst sie im nächsten Schritt mit in den Prompt.</p>
          <p>Ohne Audio-Dateien einfach überspringen: die Einschübe werden dann per Text-to-Speech aus <code>script</code> vorgelesen.</p>
        </section>
        <section>
          <h3><span class="vp-step-num">3</span>Prompt an LLM, dann Antwort einfügen</h3>
          <p>Kopiere den folgenden Prompt und gib ihn an dein LLM (ChatGPT, Claude, …) — zusammen mit dem Lektions-Transkript / Drehbuch <em>und</em> den Asset-Verweisen aus Schritt 2. Die Antwort ist ein fertiger <code>&lt;pre data-vp-config&gt;</code>-Block mit bereits eingesetzten Verweisen — paste ihn 1:1 in das "Code einbetten"-Modal, klicke <strong>Speichern</strong>, dann oben auf <strong>Vorschau</strong> zum Testen.</p>
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
    (host.querySelector(".vp-prompt") as HTMLTextAreaElement).value =
      PROMPT_TEXT;
    function closeDialog(): void {
      host.remove();
      document.removeEventListener("keydown", onKey);
      if (typeof onAfterClose === "function") {
        try {
          onAfterClose();
        } catch {
          /* ignore */
        }
      }
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") closeDialog();
    }
    (host.querySelector(".vp-close") as HTMLElement).onclick = closeDialog;
    host.addEventListener("click", (e) => {
      if (e.target === host) closeDialog();
    });
    document.addEventListener("keydown", onKey);
    const copyBtn = host.querySelector(".vp-copy-btn") as HTMLButtonElement;
    copyBtn.onclick = async () => {
      const ta = host.querySelector(".vp-prompt") as HTMLTextAreaElement;
      ta.select();
      try {
        await navigator.clipboard.writeText(ta.value);
      } catch {
        try {
          document.execCommand("copy");
        } catch {
          /* ignore */
        }
      }
      copyBtn.textContent = "✓ Kopiert";
      copyBtn.dataset.copied = "1";
      setTimeout(() => {
        copyBtn.textContent = "Prompt kopieren";
        copyBtn.dataset.copied = "0";
      }, 1800);
    };
    document.body.appendChild(host);
  }

  function attach(hlsEl: AdminHlsEl): void {
    if (hlsEl.__vpAdminAttached) return;
    const playerHost = hlsEl.parentElement;
    if (!playerHost) return;
    const insertParent = playerHost.parentElement;
    if (!insertParent) return;
    if (playerHost.nextElementSibling?.classList?.contains("vp-admin-launch")) {
      hlsEl.__vpAdminAttached = true;
      return;
    }
    hlsEl.__vpAdminAttached = true;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "vp-admin-launch";

    // Read the config-presence signal EXACTLY twice per attach: once here, and
    // once when the dialog closes. It scans input values, which LearningSuite's
    // React app rewrites constantly — the 2s poll this replaces was pegging the
    // renderer. Never re-arm an interval or observer on it.
    function labelButton(): void {
      button.textContent = hasVpConfigOnPage()
        ? "edit Annotation"
        : "enable Annotation";
    }
    labelButton();

    button.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openDialog(labelButton);
    };
    insertParent.insertBefore(button, playerHost.nextSibling);
  }

  function isEditMode(): boolean {
    if (!location.pathname.includes("/admin/editor/")) return false;
    if (new URLSearchParams(location.search).get("view") === "preview")
      return false;
    return true;
  }

  function teardownLaunchButtons(): void {
    document
      .querySelectorAll(".vp-admin-launch, .vp-admin-banner")
      .forEach((el) => el.remove());
    document.getElementById("vp-admin-dialog-host")?.remove();
    document.querySelectorAll("hls-video").forEach((v) => {
      delete (v as AdminHlsEl).__vpAdminAttached;
    });
  }

  function scan(): void {
    document
      .querySelectorAll("hls-video")
      .forEach((el) => attach(el as AdminHlsEl));
  }

  function applyMode(): void {
    if (isEditMode()) scan();
    else teardownLaunchButtons();
  }

  applyMode();

  // Debounce scan so React's chatty re-renders don't burn CPU.
  let scanPending: ReturnType<typeof setTimeout> | 0 = 0;
  function scheduleApply(): void {
    if (scanPending) return;
    scanPending = setTimeout(() => {
      scanPending = 0;
      applyMode();
    }, 250);
  }
  const mo = new MutationObserver(scheduleApply);
  mo.observe(document.body, { subtree: true, childList: true });
  pushCleanup(CLEANUP_KEY, () => {
    mo.disconnect();
    if (scanPending) clearTimeout(scanPending);
  });

  // SPA navigation: popstate fires for back/forward but not pushState (which LS
  // uses for Editor / Vorschau), so also poll the URL on a short interval.
  let lastHref = location.href;
  const checkUrl = () => {
    if (location.href === lastHref) return;
    lastHref = location.href;
    applyMode();
  };
  window.addEventListener("popstate", checkUrl);
  pushCleanup(CLEANUP_KEY, () =>
    window.removeEventListener("popstate", checkUrl),
  );
  const urlPollId = setInterval(checkUrl, 600);
  pushCleanup(CLEANUP_KEY, () => clearInterval(urlPollId));

  return "admin-toggle armed";
}

(window as unknown as { __vpAdminStatus?: string }).__vpAdminStatus = main();
