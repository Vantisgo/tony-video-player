// The one control this runtime still owns.
//
// LearningSuite's player handles play/pause, seeking, time, volume, captions,
// speed and fullscreen, and it does all of them better than our replacement did.
// What it cannot do is the language pack: a dubbed audio track played from a
// separate element in sync with the video, and external VTT subtitles. So that
// is the only thing left here.
//
// It is anchored to the player host rather than injected into the host's own
// control bar. Injecting would look native, but their buttons carry no
// aria-label, data-testid or title — only hashed MUI classes — so anything keyed
// on them rots at their next restyle. It is also created ONLY when the video
// actually has a pack: on every other lesson the runtime adds no controls at all
// and the player is entirely LearningSuite's.
//
// Built with createElement/textContent, never innerHTML: pack labels are
// third-party strings. Do NOT add esc() here — it would double-escape. Same rule
// as demo-overlays/quiz.ts.
import { t as tr } from "../common/i18n/player";
import type { TrackOption } from "../common/types";

export interface LanguagePackControlDeps {
  playerHost: HTMLElement;
  // Read at render time rather than passed as data: selection state lives in the
  // reskin closure, so the control stays stateless and re-renders from source.
  audioOptions: () => TrackOption[] | null;
  subtitleOptions: () => TrackOption[] | null;
  onSelectAudio: (value: number | string) => void;
  onSelectSubtitle: (value: number | string) => void;
  onCleanup: (fn: () => void) => void;
}

export interface LanguagePackControl {
  refresh(): void;
  destroy(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderGroup(
  menu: HTMLElement,
  title: string,
  options: TrackOption[],
  onSelect: (value: number | string) => void,
  close: () => void,
  refresh: () => void,
): void {
  menu.appendChild(el("div", "vp-menu-title", title));
  for (const option of options) {
    const btn = el("button", "vp-menu-option");
    btn.type = "button";
    btn.setAttribute("role", "menuitemradio");
    btn.setAttribute("aria-checked", option.selected ? "true" : "false");
    btn.dataset.value = String(option.value);
    btn.appendChild(el("span", "vp-menu-label", option.label));
    if (option.selected)
      btn.appendChild(
        el("span", "vp-menu-current", tr("player.label.current")),
      );
    btn.onclick = (e) => {
      e.stopPropagation();
      onSelect(option.value);
      close();
      refresh();
    };
    menu.appendChild(btn);
  }
}

// Returns null when the pack offers nothing to choose between — a pack with a
// single native audio track and no subtitles is not worth a control.
export function createLanguagePackControl(
  deps: LanguagePackControlDeps,
): LanguagePackControl | null {
  if (!deps.audioOptions() && !deps.subtitleOptions()) return null;

  const root = el("div", "vp-langpack");
  const button = el("button", "vp-langpack-btn", tr("player.langpack.button"));
  button.type = "button";
  button.setAttribute("aria-haspopup", "menu");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", tr("player.langpack.aria"));
  const menu = el("div", "vp-menu");
  menu.setAttribute("role", "menu");
  menu.hidden = true;
  root.append(button, menu);

  const close = (): void => {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
  };

  const refresh = (): void => {
    menu.replaceChildren();
    const audio = deps.audioOptions();
    if (audio)
      renderGroup(
        menu,
        tr("player.tracks.audio"),
        audio,
        deps.onSelectAudio,
        close,
        refresh,
      );
    const subtitles = deps.subtitleOptions();
    if (subtitles)
      renderGroup(
        menu,
        tr("player.tracks.subtitles"),
        subtitles,
        deps.onSelectSubtitle,
        close,
        refresh,
      );
  };

  button.onclick = (e) => {
    e.stopPropagation();
    const willOpen = menu.hidden;
    if (willOpen) refresh();
    menu.hidden = !willOpen;
    button.setAttribute("aria-expanded", willOpen ? "true" : "false");
  };

  const onDocumentClick = (e: MouseEvent): void => {
    if (!root.contains(e.target as Node)) close();
  };
  const onDocumentKeydown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onDocumentKeydown);

  refresh();
  deps.playerHost.appendChild(root);

  const destroy = (): void => {
    document.removeEventListener("click", onDocumentClick);
    document.removeEventListener("keydown", onDocumentKeydown);
    root.remove();
  };
  deps.onCleanup(destroy);

  return { refresh, destroy };
}
