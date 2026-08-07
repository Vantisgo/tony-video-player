// The default targets: what the canary tests when no target parameter is given,
// i.e. what the scheduled run exercises. Everything else (a course or lesson
// passed as a URL, id or name) is resolved at run time instead.
//
// These are lesson paths on a live platform, not secrets — they are committed on
// purpose, so changing what the schedule watches is a reviewable diff rather
// than an environment variable nobody can see.
//
// Nothing may import this module except the resolver (`resolve.setup.ts`). The
// spec reads `targets.json`, never the fixtures, so the default and parameterised
// modes travel exactly one code path.

export type LessonFixture = {
  // Human label, used in the resolved entry's title and therefore in test names.
  readonly name: string;
  // Path under E2E_LS_BASE_URL. Leading slash, no origin — so the same fixture
  // list stays valid if the tenant hostname changes.
  readonly path: string;
  // Which player DOM shape LearningSuite renders for this lesson. The shape is
  // LearningSuite's choice, not an authoring option, so a fixture's shape has to
  // be *found* by inspecting the lesson — never assumed. "unverified" is honest
  // bookkeeping for a lesson whose shape nobody has confirmed yet; it is not a
  // third shape.
  readonly domShape: "light-dom-slotted" | "shadow-dom" | "unverified";
  // Why this lesson is in the set — read this before deleting or replacing one.
  readonly why: string;
};

// EMPTY ON PURPOSE — see Step 5 of docs/e2e-canary.md.
//
// The tenant under test is `robbins.greator.com` (a white-labelled LearningSuite
// instance). The only lesson URL this repo had recorded lives on a *different*
// tenant (`vantisgo.learningsuite.io`, see
// docs/learningsuite-enrichment-research.md), so it was dropped rather than
// repointed — a path from another tenant would fail as "no player element",
// which reads like a runtime regression.
//
// A real lesson on this tenant, confirmed to hold an <hls-video> on 2026-08-07:
//   /student/course/robbins-greator-coaching-practitioner/k5GFQsnw/7JxvNDk2/vFcQCZsH
// It is NOT committed as a fixture because it carries no [data-vp-config], so
// the runtime deliberately does nothing there and every assertion would fail.
// See Step 5 of docs/e2e-canary.md.
//
// Until two orbit lessons are chosen, `bun run e2e` with no parameters fails
// with "No default lessons are configured" — an accurate statement about what we
// know, rather than a misleading red test. Parameterised runs
// (`--course=…` / `--lesson=…`) work regardless.
export const DEFAULT_LESSONS: readonly LessonFixture[] = [
  // {
  //   name: "…",
  //   path: "/student/course/<slug>/<module>/<lesson>/<topic>",
  //   domShape: "light-dom-slotted",
  //   why: "…",
  // },
];
