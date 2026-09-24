// Phase 1: parameters in, `e2e/.auth/targets.json` out.
//
// This project resolves and nothing else. It must never assert anything about
// the runtime — a failure here would otherwise read as "the overlay broke" when
// it actually means "we could not find the course".
//
// TODO(Task 1): the URL shapes and expansion heuristics below are derived from
// `docs/learningsuite-enrichment-research.md` (lesson URLs are
// `/student/course/<slug>/<module>/<lesson>/<topic>`), not from a codegen
// recording. Confirm them, and see `hasPlayer` for the one heuristic worth
// replacing with a real locator.
import { test as setup } from "@playwright/test";
import type { Page } from "@playwright/test";

import { DEFAULT_LESSONS } from "../fixtures/lessons";
import { e2eEnv } from "./env";
import { describeTarget, parseTargetSpec, targetSpecKey } from "./target";
import type { TargetSpec } from "./target";
import { writeTargetsFile } from "./targets-file";
import type { ResolvedVideo } from "./targets-file";

// Where a course lives under the tenant. Only needed to build a URL from a bare
// id/slug; every other path is read from the page's own links.
const COURSE_PATH_PREFIX = "/student/course";

// A lesson URL is deeper than its course URL. Using "deeper than the course
// path" rather than a fixed segment count means the enumeration survives
// LearningSuite adding or removing a level.
type Candidate = { readonly url: string; readonly title: string };

setup("resolve targets", async ({ page }, testInfo) => {
  const spec = parseTargetSpec(e2eEnv);
  const label = describeTarget(spec);

  const { courseLabel, candidates } = await collectCandidates(page, spec);

  const videos = await keepVideoLessons(page, candidates);

  // A committed fixture that no longer holds a player is a regression to report,
  // not a row to drop: silently testing one lesson instead of two is how a canary
  // goes quietly blind.
  if (spec.ref.kind === "default" && videos.length !== candidates.length) {
    const lost = candidates
      .filter((c) => !videos.some((v) => v.url === c.url))
      .map((c) => `  - ${c.title} → ${c.url}`)
      .join("\n");
    throw new Error(
      `${candidates.length - videos.length} of ${candidates.length} default fixture lesson(s) ` +
        `no longer contain a player element:\n${lost}\n` +
        "Either the lesson changed on LearningSuite or the fixture is stale — " +
        "fix e2e/fixtures/lessons.ts rather than letting the canary test fewer lessons.",
    );
  }

  if (videos.length === 0) {
    throw new Error(
      `Resolved ${label} but found no video lessons in it.\n` +
        `Checked ${candidates.length} lesson page(s) for a player element. ` +
        "A course with no videos is a result worth reporting, not an empty test run.",
    );
  }

  const numbered: ResolvedVideo[] = videos.map((video, i) => ({
    index: i + 1,
    total: videos.length,
    title: video.title,
    url: video.url,
  }));

  const selected = selectVideo(numbered, spec, label);

  writeTargetsFile({
    // Stamped for the human reading a stale file, never used to decide freshness
    // — `specKey` is what phase 2 validates.
    resolvedAt: new Date().toISOString(),
    specKey: targetSpecKey(spec),
    courseLabel,
    videos: selected,
  });

  console.log(
    `[resolve] ${courseLabel} → ${selected.length} video(s) of ${numbered.length}`,
  );
  await testInfo.attach("targets.json", {
    body: JSON.stringify({ courseLabel, videos: selected }, null, 2),
    contentType: "application/json",
  });
});

// --- resolution ------------------------------------------------------------

async function collectCandidates(
  page: Page,
  spec: TargetSpec,
): Promise<{ courseLabel: string; candidates: readonly Candidate[] }> {
  const ref = spec.ref;

  switch (ref.kind) {
    case "default": {
      if (DEFAULT_LESSONS.length === 0) {
        throw new Error(
          "No default lessons are configured (e2e/fixtures/lessons.ts is empty), " +
            "so there is nothing to test without a target. Pass --course/--lesson, " +
            "or fill in the fixtures — see Task 1 in docs/e2e-canary.md.",
        );
      }
      // No navigation: the fixtures are already lesson URLs.
      return {
        courseLabel: "default fixtures",
        candidates: DEFAULT_LESSONS.map((lesson) => ({
          url: new URL(lesson.path, e2eEnv.E2E_LS_BASE_URL).href,
          title: lesson.name,
        })),
      };
    }

    case "url": {
      await goto(page, ref.url);
      return afterNavigation(page, ref.url);
    }

    case "id": {
      const url = new URL(
        `${COURSE_PATH_PREFIX}/${ref.id}`,
        e2eEnv.E2E_LS_BASE_URL,
      ).href;
      await goto(page, url);
      return afterNavigation(page, url);
    }

    case "name": {
      const url = await findCourseByName(page, ref.name);
      await goto(page, url);
      return afterNavigation(page, url);
    }
  }
}

// A target URL is either a course (it links to lessons below itself) or a single
// lesson (it does not). Deciding from what the page actually contains beats
// pattern-matching a URL shape that LearningSuite can change.
async function afterNavigation(
  page: Page,
  url: string,
): Promise<{ courseLabel: string; candidates: readonly Candidate[] }> {
  await expandEverything(page);
  const links = await lessonLinksBelow(page, url);

  if (links.length > 0) {
    return { courseLabel: (await page.title()) || url, candidates: links };
  }

  // No deeper links: treat it as a single lesson.
  return {
    courseLabel: (await page.title()) || url,
    candidates: [{ url, title: (await page.title()) || url }],
  };
}

async function findCourseByName(page: Page, name: string): Promise<string> {
  const listUrl = new URL(e2eEnv.E2E_LS_COURSES_PATH, e2eEnv.E2E_LS_BASE_URL)
    .href;
  await goto(page, listUrl);
  await expandEverything(page);

  const wanted = name.trim().toLowerCase();
  const courses = await page.evaluate((prefix) => {
    const seen = new Map<string, string>();
    document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
      const href = a.href;
      let path: string;
      try {
        path = new URL(href, location.href).pathname;
      } catch {
        return;
      }
      if (!path.startsWith(prefix)) return;
      const title = (a.textContent || "").replace(/\s+/g, " ").trim();
      if (!title) return;
      if (!seen.has(href)) seen.set(href, title);
    });
    return [...seen].map(([url, title]) => ({ url, title }));
  }, COURSE_PATH_PREFIX);

  const matches = courses.filter((c) => c.title.toLowerCase() === wanted);

  const only = matches.length === 1 ? matches[0] : undefined;
  if (only) return only.url;

  // Never pick the first of several, and never guess at a near-miss: say what
  // was on the page and let the caller pass an id or URL instead.
  const found = courses.length
    ? courses.map((c) => `  - "${c.title}" → ${c.url}`).join("\n")
    : "  (no course links found on this page — is E2E_LS_COURSES_PATH right?)";
  throw new Error(
    `${matches.length === 0 ? "No course" : `${matches.length} courses`} on ${listUrl} ` +
      `match the name "${name}" exactly (trimmed, case-insensitive).\n` +
      `Courses found:\n${found}\n` +
      "Pass the course id or its URL for an unambiguous target.",
  );
}

// --- enumeration -----------------------------------------------------------

// Every same-origin link that sits *below* the course's own path, in document
// order. Document order is the parameter's meaning, so nothing here sorts,
// re-orders or filters beyond deduplication.
//
// KNOWN GAP (verified on robbins.greator.com, 2026-08-07): on that tenant the
// curriculum rows are NOT anchors. A course page's only links below its own path
// are `/info` and `/bookmarks`; lessons are reached by clicking React-router
// buttons (the "start" control carries `data-cy="continue-lesson"`), and modules
// are progress-gated ("Schließe zuerst das vorherige Modul ab"), so later ones
// are not reachable at all until earlier ones are completed. Enumerating a whole
// course therefore needs a click-driven walk, not this link scan — see Step 4 of
// docs/e2e-canary.md. Targets given as a lesson URL are unaffected and work today.
async function lessonLinksBelow(
  page: Page,
  courseUrl: string,
): Promise<readonly Candidate[]> {
  const coursePath = new URL(courseUrl).pathname.replace(/\/+$/, "");
  return page.evaluate((prefix) => {
    const seen = new Map<string, string>();
    document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
      let url: URL;
      try {
        url = new URL(a.href, location.href);
      } catch {
        return;
      }
      if (url.origin !== location.origin) return;
      const path = url.pathname.replace(/\/+$/, "");
      if (!path.startsWith(prefix + "/")) return;
      const title = (a.textContent || "").replace(/\s+/g, " ").trim();
      if (!seen.has(url.href)) seen.set(url.href, title || url.href);
    });
    return [...seen].map(([url, title]) => ({ url, title }));
  }, coursePath);
}

// A half-rendered curriculum silently renumbers every video, so the list is
// expanded before it is counted. Generic on purpose: `aria-expanded="false"` is
// a platform contract, not a LearningSuite class name.
async function expandEverything(page: Page): Promise<void> {
  for (let round = 0; round < 5; round++) {
    const collapsed = page.locator('[aria-expanded="false"]');
    const more = page.getByRole("button", {
      name: /load more|show more|mehr laden|mehr anzeigen|alle anzeigen/i,
    });

    const targets = [...(await collapsed.all()), ...(await more.all())];
    if (targets.length === 0) return;

    let clicked = 0;
    for (const target of targets) {
      // A control that vanished mid-round is not an error; the next round sees
      // whatever replaced it.
      const ok = await target
        .click({ timeout: 2_000 })
        .then(() => true)
        .catch(() => false);
      if (ok) clicked++;
    }
    if (clicked === 0) return;
    await page.waitForTimeout(500);
  }
  console.warn(
    "[resolve] still found collapsed sections after 5 expansion rounds — " +
      "the curriculum may be incompletely rendered, which would shift video indices.",
  );
}

// Which curriculum rows are *videos*.
//
// TODO(Task 1): if LearningSuite marks video lessons with an icon, badge or type
// attribute, replace this with that locator on the course page — it is one
// request instead of one page load per lesson. Until that fact is recorded,
// membership is decided by the only definition that cannot be wrong for this
// suite: the lesson contains a player element. The predicate mirrors the
// runtime's own discovery contract (runtime-src/common/player.ts) rather than
// inventing a second, separately-drifting definition of "player".
async function keepVideoLessons(
  page: Page,
  candidates: readonly Candidate[],
): Promise<readonly Candidate[]> {
  const kept: Candidate[] = [];
  for (const [i, candidate] of candidates.entries()) {
    await goto(page, candidate.url);
    const found = await hasPlayer(page);
    console.log(
      `[resolve] ${i + 1}/${candidates.length} ${found ? "video" : "skip "} — ${candidate.title}`,
    );
    if (found) {
      // The lesson page's own title beats the link text: a curriculum row can
      // render a truncated label.
      const title = (await page.title()).replace(/\s+/g, " ").trim();
      kept.push({ url: candidate.url, title: title || candidate.title });
    }
  }
  return kept;
}

async function hasPlayer(page: Page): Promise<boolean> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const found = await page.evaluate(() => {
      const isMedia = (el: unknown): boolean =>
        !!el &&
        typeof (el as { play?: unknown }).play === "function" &&
        "currentTime" in (el as object);
      const known = document.querySelector(
        "hls-video, mux-player, media-controller video, video",
      );
      if (known) return true;
      return [...document.querySelectorAll("*")].some(isMedia);
    });
    if (found) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

// --- selection -------------------------------------------------------------

function selectVideo(
  videos: readonly ResolvedVideo[],
  spec: TargetSpec,
  label: string,
): ResolvedVideo[] {
  if (spec.video === "all") return [...videos];

  const hit = videos.find((v) => v.index === spec.video);
  if (!hit) {
    throw new Error(
      `--video=${spec.video} is out of range for ${label}: it has ${videos.length} video(s), ` +
        `so the valid range is 1..${videos.length}.\n` +
        "Video indices are positions in today's curriculum, not stable ids — " +
        "a reordered or shortened course changes what N means.",
    );
  }
  // Renumbering to 1/1 would throw away the position the artifact should be
  // traceable to, so index/total are kept as resolved.
  return [hit];
}

async function goto(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded" });
}
