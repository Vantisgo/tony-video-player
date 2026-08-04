// Interactive quiz breaks for the demo-overlays runtime.
//
// Extracted from index.ts (unlike the other renderers, which stay nested) so the
// state machine is unit-testable without mounting the whole overlay set — the
// same reasoning that put language-pack.ts beside reskin-player/index.ts.
//
// Quiz state is deliberately SESSION-ONLY: nothing is written to storage and no
// API is called, so a reload — or a remount after the host strips our nodes —
// starts a fresh attempt.
import type {
  AnswerOption,
  MediaEl,
  QuizBreak,
  QuizConfig,
  QuizMode,
  QuizOutcome,
  QuizQuestion,
  QuizResult,
} from "../common/types";

export interface QuizControllerDeps {
  quiz: QuizConfig;
  mediaEl: MediaEl;
  playerHost: HTMLElement;
  slot: HTMLElement;
  // Voice-over audio outranks nothing but is outranked by a quiz: a quiz must
  // not open over a playing cue, so activation asks first.
  isAudioActive: () => boolean;
  onCleanup: (fn: () => void) => void;
}

export interface QuizController {
  readonly mode: QuizMode;
  isActive(): boolean;
  onTime(t: number): boolean;
  onPlay(): void;
  onEnded(): void;
  destroy(): void;
}

interface QuizWindow {
  __vpQuiz?: QuizController;
}

type ElProps = Record<string, string | number | boolean | null | undefined>;
type ElKid = string | Node | null | false | undefined;

// Minimal safe element builder: attributes go through setAttribute/className
// (never innerHTML), string children become text nodes — config-authored strings
// (prompt / option text / explanation / title) are never parsed as HTML. Do NOT
// add esc() here; it would double-escape into visible &amp;.
function qzEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: ElProps,
  kids?: ElKid | readonly ElKid[],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, val] of Object.entries(props ?? {})) {
    if (val == null || val === false) continue;
    if (key === "class") node.className = String(val);
    else if (key === "style") node.style.cssText = String(val);
    else node.setAttribute(key, val === true ? "" : String(val));
  }
  const list = Array.isArray(kids) ? kids : [kids];
  for (const kid of list) {
    if (kid == null || kid === false) continue;
    node.appendChild(
      typeof kid === "string" ? document.createTextNode(kid) : kid,
    );
  }
  return node;
}

const SUMMARY_ICONS: Record<QuizOutcome | "none", string> = {
  correct: "✓",
  wrong: "✕",
  timeout: "✕",
  skipped: "–",
  none: "–",
};

export function createQuizController(deps: QuizControllerDeps): QuizController {
  const { quiz, mediaEl, playerHost, slot, isAudioActive, onCleanup } = deps;
  const w = window as unknown as QuizWindow;

  let mode: QuizMode = "idle";
  let activeQuiz: QuizBreak | null = null;
  let questionIndex = 0;
  let remainingSec: number | null = null;
  let resumeWasPlaying = false;
  let videoEnded = false;
  let previousTime = -0.01;
  let optionFocusIndex = 0;
  let countdownHandle: ReturnType<typeof setInterval> | null = null;
  let feedbackHandle: ReturnType<typeof setTimeout> | null = null;
  const results = new Map<string, QuizResult>();
  const completedQuizIds = new Set<string>();
  let pendingQuizIds: string[] = [];

  // Quizzes must not ambush a learner who scrubs across a trigger. The media
  // element's own seeking lifecycle is authoritative — guessing from throttled
  // timeupdate deltas alone misses fast seeks.
  let seeking = false;
  const onSeeking = () => {
    seeking = true;
  };
  const onSeeked = () => {
    seeking = false;
    previousTime = Number(mediaEl.currentTime) || 0;
    videoEnded = false;
  };
  mediaEl.addEventListener("seeking", onSeeking);
  mediaEl.addEventListener("seeked", onSeeked);
  onCleanup(() => mediaEl.removeEventListener("seeking", onSeeking));
  onCleanup(() => mediaEl.removeEventListener("seeked", onSeeked));

  const isActive = () => mode !== "idle";
  const currentQuestion = (): QuizQuestion | null =>
    activeQuiz?.questions[questionIndex] ?? null;
  const resultKey = (q: QuizBreak, question: QuizQuestion) =>
    `${q.id}:${question.id}`;

  // ─── Rendering ───

  function buildCountdown(question: QuizQuestion): HTMLElement {
    const size = 30;
    const stroke = 3;
    const radius = (size - stroke) / 2;
    const circ = 2 * Math.PI * radius;
    const svgNS = "http://www.w3.org/2000/svg";

    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    svg.setAttribute("class", "vp-quiz-ring");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("data-vp-quiz-ring", "");
    svg.dataset.circ = String(circ);

    const circle = (cls: string) => {
      const c = document.createElementNS(svgNS, "circle");
      c.setAttribute("class", cls);
      c.setAttribute("cx", String(size / 2));
      c.setAttribute("cy", String(size / 2));
      c.setAttribute("r", String(radius));
      return c;
    };
    const track = circle("vp-quiz-ring-track");
    const fill = circle("vp-quiz-ring-fill");
    fill.setAttribute("stroke-dasharray", String(circ));
    fill.setAttribute("stroke-dashoffset", "0");
    fill.setAttribute("data-vp-quiz-ring-fill", "");
    svg.appendChild(track);
    svg.appendChild(fill);

    const remaining = Math.max(0, remainingSec ?? question.timeoutSec ?? 0);
    const wrap = qzEl("div", {
      class: "vp-quiz-countdown",
      role: "timer",
      "aria-live": "off",
      "data-vp-quiz-countdown": "",
    });
    wrap.appendChild(svg);
    wrap.appendChild(
      qzEl(
        "span",
        {
          class: "vp-quiz-countdown-num",
          "data-vp-quiz-countdown-num": "",
        },
        [String(Math.ceil(remaining))],
      ),
    );
    return wrap;
  }

  function buildOption(
    option: AnswerOption,
    idx: number,
    question: QuizQuestion,
    result: QuizResult | null,
  ): HTMLButtonElement {
    const answered = mode === "feedback" || mode === "awaiting-continue";
    const selectedId = result?.selectedOptionId ?? null;
    let state = "default";
    if (answered) {
      if (option.id === question.correctOptionId) state = "correct";
      else if (option.id === selectedId) state = "wrong";
    }

    const btn = qzEl(
      "button",
      {
        type: "button",
        class: "vp-quiz-option",
        role: "radio",
        "aria-checked":
          selectedId != null ? String(option.id === selectedId) : "false",
        "data-state": state,
        "data-option-id": option.id,
        "data-vp-quiz-option": "",
        tabindex: answered ? null : idx === optionFocusIndex ? "0" : "-1",
      },
      [
        qzEl("span", { class: "vp-quiz-option-badge", "aria-hidden": "true" }, [
          String.fromCharCode(65 + idx),
        ]),
        qzEl("span", { class: "vp-quiz-option-text" }, [option.text]),
      ],
    );
    if (answered) btn.disabled = true;
    else btn.addEventListener("click", () => answer(option.id));
    return btn;
  }

  // Arrow-key roving tabindex. Number-key selection is handled globally instead,
  // because it must work while focus is still on the prompt heading.
  function wireOptionNav(
    container: HTMLElement,
    buttons: readonly HTMLButtonElement[],
  ): void {
    container.addEventListener("keydown", (e) => {
      const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (idx === -1) return;
      let next: number | null = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown")
        next = (idx + 1) % buttons.length;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
        next = (idx - 1 + buttons.length) % buttons.length;
      if (next == null) return;
      e.preventDefault();
      e.stopPropagation();
      buttons[idx].tabIndex = -1;
      buttons[next].tabIndex = 0;
      buttons[next].focus();
      optionFocusIndex = next;
    });
  }

  function buildQuestion(card: HTMLElement, question: QuizQuestion): void {
    if (!activeQuiz) return;
    const answered = mode === "feedback" || mode === "awaiting-continue";
    const result = results.get(resultKey(activeQuiz, question)) ?? null;

    if (activeQuiz.title) {
      card.appendChild(
        qzEl("div", { class: "vp-quiz-eyebrow" }, [activeQuiz.title]),
      );
    }
    // No running score chip here on purpose: `showScore` drives the SUMMARY only
    // (the in-question chip was removed upstream when answer feedback was
    // simplified). Do not re-add it without a design decision.
    if (mode === "question" && question.timeoutSec && question.showCountdown) {
      card.appendChild(buildCountdown(question));
    }
    card.appendChild(
      qzEl(
        "p",
        { class: "vp-quiz-prompt", id: "vp-quiz-prompt", tabindex: "-1" },
        [question.prompt],
      ),
    );

    if (mode === "question") optionFocusIndex = 0;
    const optionsHost = qzEl("div", {
      class: "vp-quiz-options",
      role: "radiogroup",
      "aria-labelledby": "vp-quiz-prompt",
      "data-cols": question.options.length === 4 ? "2" : "1",
      "data-vp-quiz-options": "",
    });
    const buttons = question.options.map((option, i) => {
      const button = buildOption(option, i, question, result);
      const wrap = qzEl("div", { class: "vp-quiz-option-wrap" }, [button]);
      if (
        answered &&
        option.id === question.correctOptionId &&
        question.explanation
      ) {
        wrap.appendChild(
          qzEl(
            "p",
            {
              class: "vp-quiz-inline-explanation",
              "data-vp-quiz-explanation": "",
            },
            [question.explanation],
          ),
        );
      }
      optionsHost.appendChild(wrap);
      return button;
    });
    card.appendChild(optionsHost);
    if (mode === "question") wireOptionNav(optionsHost, buttons);

    if (mode === "question") {
      const skip = qzEl(
        "button",
        { type: "button", class: "vp-quiz-skip", "data-vp-quiz-skip": "" },
        ["Frage überspringen"],
      );
      skip.addEventListener("click", () => skipQuestion());
      card.appendChild(skip);
    }

    // A wrong answer shows corrective copy, so it waits for an explicit
    // Continue — auto-advancing would pull it away mid-read.
    if (mode === "feedback" && result?.outcome === "wrong") {
      card.appendChild(
        actionRow("vp-quiz-feedback-continue", "Continue", () =>
          continueFeedback(),
        ),
      );
    }
    if (mode === "awaiting-continue") {
      card.appendChild(
        actionRow("vp-quiz-continue", "Video fortsetzen", () =>
          continuePlayback(),
        ),
      );
    }
  }

  function actionRow(
    marker: string,
    label: string,
    onClick: () => void,
  ): HTMLElement {
    const btn = qzEl(
      "button",
      {
        type: "button",
        class: "vp-quiz-btn vp-quiz-btn-primary",
        [`data-${marker}`]: "",
      },
      [label],
    );
    btn.addEventListener("click", onClick);
    return qzEl("div", { class: "vp-quiz-actions" }, [btn]);
  }

  function buildSummary(card: HTMLElement): void {
    card.appendChild(
      qzEl(
        "h2",
        { id: "vp-quiz-heading", class: "vp-quiz-heading", tabindex: "-1" },
        ["Zusammenfassung"],
      ),
    );

    const rows = summaryRows();
    const total = rows.length;
    const correct = rows.filter((r) => r.result?.outcome === "correct").length;

    if (quiz.showScore) {
      const pct = total ? Math.round((correct / total) * 100) : 0;
      const wrap = qzEl("div", { class: "vp-quiz-summary-score" }, [
        qzEl("div", { class: "vp-quiz-score-big" }, [`${correct} / ${total}`]),
        qzEl("div", { class: "vp-quiz-score-sub" }, [
          `${pct}% richtig beantwortet`,
        ]),
      ]);
      if (quiz.passingPercent != null) {
        const passed = pct >= quiz.passingPercent;
        wrap.appendChild(
          qzEl(
            "div",
            { class: "vp-quiz-pass-badge", "data-pass": passed ? "1" : "0" },
            [passed ? "Bestanden" : "Nicht bestanden"],
          ),
        );
      }
      card.appendChild(wrap);
    }

    const rowsHost = qzEl("div", {
      class: "vp-quiz-summary-rows",
      "data-vp-quiz-summary-rows": "",
    });
    for (const row of rows) {
      const outcome = row.result?.outcome ?? "none";
      rowsHost.appendChild(
        qzEl("div", { class: "vp-quiz-summary-row", "data-outcome": outcome }, [
          qzEl(
            "span",
            { class: "vp-quiz-summary-row-icon", "aria-hidden": "true" },
            [SUMMARY_ICONS[outcome]],
          ),
          qzEl("span", { class: "vp-quiz-summary-row-text" }, [row.prompt]),
        ]),
      );
    }
    card.appendChild(rowsHost);

    const close = qzEl(
      "button",
      {
        type: "button",
        class: "vp-quiz-btn vp-quiz-btn-ghost",
        "data-vp-quiz-close": "",
      },
      ["Schließen"],
    );
    close.addEventListener("click", () => closeSummary());
    const again = qzEl(
      "button",
      {
        type: "button",
        class: "vp-quiz-btn vp-quiz-btn-primary",
        "data-vp-quiz-restart": "",
      },
      ["Nochmal ansehen"],
    );
    again.addEventListener("click", () => restart());
    card.appendChild(qzEl("div", { class: "vp-quiz-actions" }, [close, again]));
  }

  function render(): void {
    if (!isActive()) return;
    slot.innerHTML = "";
    slot.dataset.mode = mode;

    const scrim = qzEl("div", {
      class: "vp-quiz-scrim vp-quiz-anim-scrim",
      "data-vp-quiz-scrim": "",
    });
    const card = qzEl("div", {
      class: "vp-quiz-card vp-quiz-anim-card",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby":
        mode === "summary" ? "vp-quiz-heading" : "vp-quiz-prompt",
      tabindex: "-1",
      "data-vp-quiz-card": "",
      "data-vp-quiz-mode": mode,
    });
    scrim.appendChild(card);
    slot.appendChild(scrim);

    let focusTarget: HTMLElement | null = null;
    if (mode === "summary") {
      buildSummary(card);
      focusTarget = card.querySelector("#vp-quiz-heading");
    } else {
      const question = currentQuestion();
      if (!question) {
        clear();
        return;
      }
      buildQuestion(card, question);
      if (mode === "question")
        focusTarget = card.querySelector("#vp-quiz-prompt");
      else if (mode === "feedback")
        focusTarget = card.querySelector("[data-vp-quiz-feedback-continue]");
      else if (mode === "awaiting-continue")
        focusTarget = card.querySelector("[data-vp-quiz-continue]");
    }

    if (focusTarget) {
      const target = focusTarget;
      requestAnimationFrame(() => {
        try {
          target.focus();
        } catch {
          /* focus can throw on a detached node */
        }
      });
    }
  }

  function updateCountdown(): void {
    if (mode !== "question") return;
    const wrap = slot.querySelector<HTMLElement>("[data-vp-quiz-countdown]");
    if (!wrap) return;
    const question = currentQuestion();
    if (!question?.timeoutSec) return;
    const remaining = Math.max(0, remainingSec ?? 0);
    const pct = Math.max(0, Math.min(1, remaining / question.timeoutSec));
    const svg = wrap.querySelector<SVGElement>("[data-vp-quiz-ring]");
    const fill = wrap.querySelector<SVGElement>("[data-vp-quiz-ring-fill]");
    const num = wrap.querySelector<HTMLElement>("[data-vp-quiz-countdown-num]");
    if (svg && fill) {
      const circ = Number(svg.dataset.circ || 0);
      fill.setAttribute("stroke-dashoffset", String(circ * (1 - pct)));
    }
    wrap.dataset.warn = remaining <= 5 ? "1" : "0";
    if (num) num.textContent = String(Math.ceil(remaining));
  }

  function clear(): void {
    slot.innerHTML = "";
    slot.dataset.mode = "";
    if (!playerHost.hasAttribute("tabindex"))
      playerHost.setAttribute("tabindex", "-1");
    try {
      playerHost.focus();
    } catch {
      /* focus can throw on a detached host */
    }
  }

  // ─── Keyboard / pointer capture ───

  function focusableEls(card: HTMLElement): HTMLElement[] {
    return [...card.querySelectorAll<HTMLElement>("button, [tabindex]")].filter(
      (el) => !(el as HTMLButtonElement).disabled && el.tabIndex > -1,
    );
  }

  function trapTabKey(e: KeyboardEvent): void {
    const card = slot.querySelector<HTMLElement>("[data-vp-quiz-card]");
    if (!card) return;
    const list = focusableEls(card);
    if (!list.length) {
      e.preventDefault();
      card.focus();
      return;
    }
    const first = list[0];
    const last = list[list.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !card.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last || !card.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  }

  // Capture phase so this runs before the reskin's own Space/K play-pause
  // handler (bound on `window`, bubble phase) and before a quiz button's own
  // click handler.
  function onGlobalKeydown(e: KeyboardEvent): void {
    if (!isActive()) return;
    // Never steal keys from a LearningSuite note/comment field elsewhere on the
    // page — only intercept when focus is on a form field INSIDE our card.
    const active = document.activeElement as HTMLElement | null;
    const tag = (active?.tagName || "").toLowerCase();
    const isFormField =
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      active?.isContentEditable === true;
    if (isFormField) {
      const card = slot.querySelector<HTMLElement>("[data-vp-quiz-card]");
      if (!card || !card.contains(active)) return;
    }

    if (e.key === "Escape") {
      e.stopPropagation();
      if (mode === "summary") {
        e.preventDefault();
        closeSummary();
      }
      return;
    }
    if (e.key === "Tab") {
      trapTabKey(e);
      return;
    }
    if (
      mode === "question" &&
      /^[1-4]$/.test(e.key) &&
      !e.altKey &&
      !e.ctrlKey &&
      !e.metaKey
    ) {
      e.stopPropagation();
      const card = slot.querySelector<HTMLElement>("[data-vp-quiz-card]");
      const btn = card?.querySelectorAll<HTMLButtonElement>(
        "[data-vp-quiz-option]",
      )[Number(e.key) - 1];
      if (btn) {
        e.preventDefault();
        btn.click();
      }
      return;
    }
    // Space/Enter must activate a focused option ourselves: the Space
    // suppression below runs in capture phase and would otherwise swallow the
    // event before the button's native activation fires.
    if (e.key === " " || e.code === "Space" || e.key === "Enter") {
      if (mode === "question" && active?.matches?.("[data-vp-quiz-option]")) {
        e.preventDefault();
        e.stopPropagation();
        active.click();
        return;
      }
    }
    // General suppression: preventDefault too, so Space on the heading cannot
    // scroll the underlying LMS page in addition to being kept from the player.
    if (e.key === " " || e.code === "Space" || e.key === "k" || e.key === "K") {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  const inControls = (e: Event): boolean => {
    const target = e.target;
    return target instanceof Element && !!target.closest(".vp-controls");
  };

  function onGlobalClick(e: MouseEvent): void {
    if (!isActive() || !inControls(e)) return;
    e.preventDefault();
    e.stopPropagation();
  }

  // Range inputs (seek / volume) commit on pointer drag before any click fires,
  // so the click guard alone is too late for them.
  function onGlobalPointerDown(e: Event): void {
    if (!isActive() || !inControls(e)) return;
    e.preventDefault();
    e.stopPropagation();
  }

  document.addEventListener("keydown", onGlobalKeydown, true);
  document.addEventListener("click", onGlobalClick, true);
  document.addEventListener("pointerdown", onGlobalPointerDown, true);
  onCleanup(() =>
    document.removeEventListener("keydown", onGlobalKeydown, true),
  );
  onCleanup(() => document.removeEventListener("click", onGlobalClick, true));
  onCleanup(() =>
    document.removeEventListener("pointerdown", onGlobalPointerDown, true),
  );

  // ─── State machine ───

  function clearCountdown(): void {
    if (countdownHandle) clearInterval(countdownHandle);
    countdownHandle = null;
    remainingSec = null;
  }

  function startCountdown(): void {
    clearCountdown();
    const question = currentQuestion();
    if (!question?.timeoutSec) return;
    const timeout = question.timeoutSec;
    const deadline = performance.now() + timeout * 1000;
    remainingSec = timeout;
    countdownHandle = setInterval(() => {
      if (mode !== "question") {
        clearCountdown();
        return;
      }
      remainingSec = Math.max(0, (deadline - performance.now()) / 1000);
      updateCountdown();
      if (remainingSec <= 0) answer(null, "timeout");
    }, 100);
  }

  function activate(
    quizBreak: QuizBreak | null,
    { preserveResume = false } = {},
  ): boolean {
    if (!quizBreak || mode !== "idle" || isAudioActive()) return false;
    if (!preserveResume) resumeWasPlaying = !mediaEl.paused && !mediaEl.ended;
    activeQuiz = quizBreak;
    questionIndex = 0;
    mode = "question";
    remainingSec = null;
    try {
      mediaEl.pause();
    } catch {
      /* a custom element may not expose pause() */
    }
    startCountdown();
    render();
    return true;
  }

  function answer(
    optionId: string | null,
    forcedOutcome: QuizOutcome | null = null,
  ): void {
    if (mode !== "question" || !activeQuiz) return;
    const question = currentQuestion();
    if (!question) return;
    if (optionId !== null && !question.options.some((o) => o.id === optionId))
      return;

    clearCountdown();
    const outcome: QuizOutcome =
      forcedOutcome ??
      (optionId === question.correctOptionId ? "correct" : "wrong");
    results.set(resultKey(activeQuiz, question), {
      quizId: activeQuiz.id,
      questionId: question.id,
      prompt: question.prompt,
      selectedOptionId: optionId,
      correctOptionId: question.correctOptionId,
      outcome,
    });
    mode = "feedback";
    render();
    if (outcome === "wrong") return;
    feedbackHandle = setTimeout(() => {
      feedbackHandle = null;
      advance();
    }, quiz.feedbackDurationSec * 1000);
  }

  const skipQuestion = () => answer(null, "skipped");

  function continueFeedback(): void {
    if (mode !== "feedback") return;
    if (feedbackHandle) clearTimeout(feedbackHandle);
    feedbackHandle = null;
    advance();
  }

  function advance(): void {
    if (!activeQuiz || mode !== "feedback") return;
    if (questionIndex < activeQuiz.questions.length - 1) {
      questionIndex += 1;
      mode = "question";
      startCountdown();
      render();
      return;
    }
    completedQuizIds.add(activeQuiz.id);
    if (activeQuiz.resume === "manual" && !videoEnded) {
      mode = "awaiting-continue";
      render();
      return;
    }
    finishBreak();
  }

  function continuePlayback(): void {
    if (mode !== "awaiting-continue") return;
    finishBreak();
  }

  function finishBreak(): void {
    clearCountdown();
    if (feedbackHandle) clearTimeout(feedbackHandle);
    feedbackHandle = null;
    activeQuiz = null;
    questionIndex = 0;
    mode = "idle";
    clear();

    let nextQuiz: QuizBreak | null = null;
    while (pendingQuizIds.length && !nextQuiz) {
      const nextId = pendingQuizIds.shift();
      if (!nextId || completedQuizIds.has(nextId)) continue;
      nextQuiz = quiz.quizzes.find((item) => item.id === nextId) ?? null;
    }
    if (nextQuiz && activate(nextQuiz, { preserveResume: true })) return;
    if (videoEnded) {
      if (quiz.showSummary) showSummary();
      return;
    }
    if (resumeWasPlaying) {
      try {
        void mediaEl.play();
      } catch {
        /* autoplay policies can reject */
      }
    }
  }

  function showSummary(): void {
    if (!quiz.showSummary) return;
    mode = "summary";
    activeQuiz = null;
    try {
      mediaEl.pause();
    } catch {
      /* ignore */
    }
    render();
  }

  function closeSummary(): void {
    if (mode !== "summary") return;
    mode = "idle";
    clear();
  }

  function restart(): void {
    clearCountdown();
    if (feedbackHandle) clearTimeout(feedbackHandle);
    feedbackHandle = null;
    mode = "idle";
    activeQuiz = null;
    questionIndex = 0;
    results.clear();
    completedQuizIds.clear();
    pendingQuizIds = [];
    previousTime = -0.01;
    videoEnded = false;
    clear();
    try {
      mediaEl.currentTime = 0;
      void mediaEl.play();
    } catch {
      /* ignore */
    }
  }

  function summaryRows(): Array<{
    quizId: string;
    questionId: string;
    prompt: string;
    result: QuizResult | null;
  }> {
    return quiz.quizzes.flatMap((quizBreak) =>
      quizBreak.questions.map((question) => ({
        quizId: quizBreak.id,
        questionId: question.id,
        prompt: question.prompt,
        result: results.get(resultKey(quizBreak, question)) ?? null,
      })),
    );
  }

  const controller: QuizController = {
    get mode() {
      return mode;
    },
    isActive,

    onTime(t: number): boolean {
      if (isActive() || isAudioActive() || !Number.isFinite(t)) return false;
      const delta = t - previousTime;
      previousTime = t;
      if (seeking || delta < 0) return false;
      const due = quiz.quizzes.filter(
        (item) =>
          !completedQuizIds.has(item.id) && item.t > t - delta && item.t <= t,
      );
      if (!due.length) return false;
      pendingQuizIds.push(...due.slice(1).map((item) => item.id));
      return activate(due[0]);
    },

    onPlay(): void {
      videoEnded = false;
    },

    onEnded(): void {
      videoEnded = true;
      const duration = Number(mediaEl.duration);
      const threshold = Number.isFinite(duration)
        ? Math.max(0, duration - 0.5)
        : 0;
      const endQuizzes = quiz.quizzes.filter(
        (item) =>
          !completedQuizIds.has(item.id) &&
          item.id !== activeQuiz?.id &&
          !pendingQuizIds.includes(item.id) &&
          item.t >= threshold,
      );
      if (isActive()) {
        pendingQuizIds.push(...endQuizzes.map((item) => item.id));
        return;
      }
      if (endQuizzes.length) {
        pendingQuizIds.push(...endQuizzes.slice(1).map((item) => item.id));
        activate(endQuizzes[0]);
      } else if (quiz.showSummary) {
        showSummary();
      }
    },

    destroy(): void {
      clearCountdown();
      if (feedbackHandle) clearTimeout(feedbackHandle);
      feedbackHandle = null;
    },
  };

  w.__vpQuiz = controller;
  onCleanup(() => {
    controller.destroy();
    delete w.__vpQuiz;
  });

  return controller;
}
