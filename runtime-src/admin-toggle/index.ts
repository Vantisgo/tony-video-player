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
import { esc } from "../common/escape";
// Aliased to `tr` for consistency with the other entries, where `t` is the
// established name for the current playback time.
import { t as tr } from "../common/i18n/admin";
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
    // Headings, buttons and labels are plain text and keep their esc() wrapper.
    // The `*Html` bodies are the one deliberate exception in the whole runtime:
    // they carry first-party inline markup (<strong>, <em>, <code>) that esc()
    // would render as visible &lt; entities. They are compile-time constants
    // from common/i18n.ts, never config or host input — the boundary is enforced
    // by tests/common/no-bare-strings.test.ts, which fails if a non-Html key
    // ever gains a `<`.
    host.innerHTML = `
      <div class="vp-admin-dialog" role="dialog" aria-modal="true">
        <header>
          <span class="vp-icon" style="font-size:22px">⚡</span>
          <h2>${esc(tr("admin.dialog.title"))}</h2>
          <button class="vp-close" aria-label="${esc(tr("admin.dialog.close"))}">×</button>
        </header>
        <section>
          <h3><span class="vp-step-num">1</span>${esc(tr("admin.step1.heading"))}</h3>
          <p>${tr("admin.step1.bodyHtml")}</p>
          <p>${tr("admin.step1.noteHtml")}</p>
        </section>
        <section>
          <h3><span class="vp-step-num">2</span>${esc(tr("admin.step2.heading"))}</h3>
          <p>${tr("admin.step2.bodyHtml")}</p>
          <p>${tr("admin.step2.noteHtml")}</p>
        </section>
        <section>
          <h3><span class="vp-step-num">3</span>${esc(tr("admin.step3.heading"))}</h3>
          <p>${tr("admin.step3.bodyHtml")}</p>
          <div class="vp-prompt-wrap">
            <textarea class="vp-prompt" readonly></textarea>
            <button class="vp-copy-btn">${esc(tr("admin.copy.button"))}</button>
          </div>
        </section>
        <footer>
          <span class="vp-tip">${tr("admin.footer.tipHtml")}</span>
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
      copyBtn.textContent = tr("admin.copy.done");
      copyBtn.dataset.copied = "1";
      setTimeout(() => {
        copyBtn.textContent = tr("admin.copy.button");
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
        ? tr("admin.launch.edit")
        : tr("admin.launch.enable");
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
