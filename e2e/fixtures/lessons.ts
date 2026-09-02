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

// The fallback target: what runs when nothing else says otherwise.
//
// Precedence in CI is `workflow_dispatch` input → the `E2E_CANARY_TARGET`
// repository variable → this file. So while that variable is set, the schedule
// watches *it*, not these entries, and this list is what the canary reverts to
// when the variable is cleared. Keep it pointing at something real for that
// reason — it is the floor, not dead code.
//
// The tenant under test is `robbins.greator.com` (a white-labelled LearningSuite
// instance). Only lessons on *this* tenant belong here: a path from another
// tenant (`vantisgo.learningsuite.io`, see
// docs/learningsuite-enrichment-research.md) would fail as "no player element",
// which reads like a runtime regression rather than a bad fixture.
//
// A lesson only qualifies if it carries a `[data-vp-config]` element. Without
// one the runtime deliberately does nothing, so every assertion would fail and
// the canary would report a runtime outage that is really an authoring gap.
//
// Still missing: a `light-dom-slotted` lesson (a `<video>` slotted into
// `<slot name="media">`). No such lesson has been found on this tenant — the
// shape is LearningSuite's choice, not an authoring option, so it has to be
// *found*, never assumed. An absent fixture is visible; an invented one looks
// like a runtime failure. See Step 5 of docs/e2e-canary.md.
export const DEFAULT_LESSONS: readonly LessonFixture[] = [
  {
    name: "Test Video Player",
    path: "/student/course/test/bksCcNnT/yPClsb9h/pgWcT1Bk",
    // Verified live 2026-09-02: <hls-video> with a <video> in its shadowRoot,
    // readyState 4, duration 5937s, and a 5,628-char [data-vp-config].
    domShape: "shadow-dom",
    why:
      "The only video lesson on this tenant that carries a [data-vp-config], " +
      "and it lives in the throwaway `Test` course rather than a real learner " +
      "course — so the watch progress the canary accrues every morning lands " +
      "nowhere that matters. Replacing it means finding another configured " +
      "lesson first; deleting it leaves the schedule with nothing to test.",
  },
];
