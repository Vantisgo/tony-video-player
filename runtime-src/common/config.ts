import type {
  AnswerOption,
  Audio,
  MetaStep,
  Phase,
  QuizBreak,
  QuizConfig,
  QuizQuestion,
  Science,
  VpConfig,
} from "./types";

// NOTE: no schema library here on purpose. This code is bundled verbatim into a
// script injected on a third-party page, so bundle size matters — pulling zod in
// added ~50KB. Strict schema validation belongs in the future content-service
// endpoint (server-side), not in the injected runtime. Here we stay tolerant of
// partially-filled configs (see parseVpConfig) and rely on escaping at render
// time for safety.

// ─── Loader: find the config on the page (three shapes, first hit wins) ───
export interface ConfigHit {
  source: "script" | "element" | "comment";
  data: unknown;
}

export function loadVpConfig(): ConfigHit | null {
  const script = document.querySelector(
    'script[type="application/json"][data-vp-config]',
  );
  if (script?.textContent?.trim()) {
    try {
      return { source: "script", data: JSON.parse(script.textContent.trim()) };
    } catch (e) {
      console.warn("[vp] config <script> parse failed", e);
    }
  }

  const el = document.querySelector("[data-vp-config]:not(script)");
  if (el?.textContent?.trim()) {
    try {
      return { source: "element", data: JSON.parse(el.textContent.trim()) };
    } catch (e) {
      console.warn("[vp] config element parse failed", e);
    }
  }

  const tw = document.createTreeWalker(
    document.body || document.documentElement,
    NodeFilter.SHOW_COMMENT,
  );
  let n: Node | null;
  while ((n = tw.nextNode())) {
    const v = n.nodeValue || "";
    const m = v.match(/VP_CONFIG\s*([\s\S]*?)\s*VP_CONFIG/);
    if (m) {
      try {
        return { source: "comment", data: JSON.parse(m[1]) };
      } catch (e) {
        console.warn("[vp] config <!--comment--> parse failed", e);
      }
    }
  }
  return null;
}

// ─── Parse: return typed sections, tolerant of partial configs ───
// A section is used when present as an array (even empty), exactly like the
// original per-section `Array.isArray(...)` guard; absent / non-array sections
// come back undefined so the caller falls back to defaults. A present-but-
// wrong-typed section is logged (it will fall back) — XSS is already handled by
// escaping at render time.
export function parseVpConfig(raw: unknown): Partial<VpConfig> {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const section = <T>(key: keyof VpConfig): T[] | undefined => {
    if (!(key in obj)) return undefined;
    if (Array.isArray(obj[key])) return obj[key] as T[];
    console.warn(`[vp] config.${key} is not an array; falling back to default`);
    return undefined;
  };

  return {
    phases: section<Phase>("phases"),
    sciences: section<Science>("sciences"),
    audios: section<Audio>("audios"),
    metaSteps: section<MetaStep>("metaSteps"),
    assets: normalizeAssets(obj.assets),
    demo: obj.demo === true,
    quiz: normalizeQuizConfig(obj.quiz),
  };
}

// ─── Asset table normalisation ───
// `assets` is the one section shaped as an object rather than an array, so it
// cannot go through `section<T>()`. Same tolerance as everywhere else: keep the
// usable entries, drop the rest, and say which — a typo'd value must not take
// the whole table (and every voice-over with it) down. Values stay unvalidated
// strings here; `resolveAssetUrl` in ./assets owns the https / placeholder
// checks, because only it knows the failure taxonomy the caller reports on.
function normalizeAssets(raw: unknown): Record<string, string> | undefined {
  if (raw === undefined) return undefined;
  const table = record(raw);
  if (!table) {
    console.warn("[vp] config.assets is not an object; ignoring it", raw);
    return undefined;
  }
  const assets: Record<string, string> = {};
  let dropped = false;
  for (const [key, value] of Object.entries(table)) {
    const url = text(value);
    if (!key.trim() || !url) {
      dropped = true;
      continue;
    }
    assets[key] = url;
  }
  if (dropped)
    console.warn(
      "[vp] dropped config.assets entries with an empty key or value",
    );
  return assets;
}

// ─── Quiz normalisation ───
// The `quiz` section is the only config area with cross-field invariants
// (correctOptionId must name a surviving option, option counts are bounded), so
// unlike the array sections it is normalised rather than passed through. Still no
// schema library — that would inline into the injected bundle (see the Standing
// Constraint); this stays a hand-rolled narrowing pass that DROPS anything
// invalid and says so, never silently.
const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(n, max)) : fallback;
};

function normalizeOptions(raw: readonly unknown[]): {
  options: AnswerOption[];
  dropped: boolean;
} {
  const seen = new Set<string>();
  let dropped = false;
  const options = raw.flatMap<AnswerOption>((entry) => {
    const option = record(entry);
    const id = text(option?.id);
    const label = text(option?.text);
    if (!option || !id || !label || seen.has(id)) {
      dropped = true;
      return [];
    }
    seen.add(id);
    return [{ id, text: label }];
  });
  return { options, dropped };
}

function normalizeTimeout(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 5 && n <= 300) return n;
  console.warn(
    "[vp] ignoring invalid quiz timeout; expected an integer from 5 to 300",
    raw,
  );
  return null;
}

function normalizeQuestions(
  raw: readonly unknown[],
  seenQuestionIds: Set<string>,
): QuizQuestion[] {
  return raw.flatMap<QuizQuestion>((entry) => {
    const question = record(entry);
    const id = text(question?.id);
    const prompt = text(question?.prompt);
    const correctOptionId = text(question?.correctOptionId);
    if (!question || !id || !prompt || !Array.isArray(question.options)) {
      console.warn("[vp] ignoring invalid quiz question", entry);
      return [];
    }
    if (seenQuestionIds.has(id)) {
      console.warn("[vp] ignoring duplicate quiz question id", id);
      return [];
    }
    if (question.options.length < 1 || question.options.length > 4) {
      console.warn(
        "[vp] ignoring quiz question with option count outside 1-4",
        entry,
      );
      return [];
    }

    const { options } = normalizeOptions(question.options);
    if (!options.length || !options.some((o) => o.id === correctOptionId)) {
      console.warn("[vp] ignoring quiz question with invalid options", entry);
      return [];
    }

    seenQuestionIds.add(id);
    return [
      {
        id,
        prompt,
        options,
        correctOptionId,
        explanation: text(question.explanation),
        timeoutSec: normalizeTimeout(question.timeoutSec),
        showCountdown: question.showCountdown !== false,
      },
    ];
  });
}

export function normalizeQuizConfig(raw: unknown): QuizConfig | null {
  const cfg = record(raw);
  if (!cfg || !Array.isArray(cfg.quizzes)) return null;

  const seenQuizIds = new Set<string>();
  const seenQuestionIds = new Set<string>();
  const quizzes = cfg.quizzes
    .flatMap<QuizBreak>((entry) => {
      const quiz = record(entry);
      const id = text(quiz?.id);
      const t = Number(quiz?.t);
      if (
        !quiz ||
        !id ||
        seenQuizIds.has(id) ||
        !Number.isFinite(t) ||
        t < 0 ||
        !Array.isArray(quiz.questions)
      ) {
        console.warn("[vp] ignoring invalid quiz break", entry);
        return [];
      }

      const questions = normalizeQuestions(quiz.questions, seenQuestionIds);
      if (!questions.length) {
        console.warn("[vp] ignoring quiz break without valid questions", entry);
        return [];
      }

      seenQuizIds.add(id);
      return [
        {
          id,
          t,
          title: text(quiz.title),
          resume: quiz.resume === "manual" ? "manual" : "auto",
          questions,
        },
      ];
    })
    .sort((a, b) => a.t - b.t);

  if (!quizzes.length) return null;

  return {
    feedbackDurationSec: clamp(cfg.feedbackDurationSec, 0.5, 10, 3),
    showScore: cfg.showScore === true,
    showSummary: cfg.showSummary === true,
    passingPercent:
      cfg.passingPercent == null || !Number.isFinite(Number(cfg.passingPercent))
        ? null
        : clamp(cfg.passingPercent, 0, 100, 0),
    quizzes,
  };
}
