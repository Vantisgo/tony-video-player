// The canary: does the injected runtime still mount and work on the real
// LearningSuite page?
//
// The targets file is read at MODULE SCOPE, not in a hook. That is what makes
// one-test-per-video possible: Playwright fixes its test list while loading this
// file, so anything that creates tests has to exist before the module runs.
// Moving this call into `beforeAll` would collect zero tests and report a green
// run that asserted nothing — which is also why `bun run e2e` is a script that
// invokes Playwright twice, rather than a `dependencies: ["resolve"]` chain.
import { expect, test } from "@playwright/test";

import {
  attachDiag,
  demoScriptRan,
  hostBox,
  expectDemoMounted,
  expectHostChromePresent,
  expectHostMuteWorks,
  expectPlaybackAdvances,
  expectReskinMounted,
  waitForReskinSettled,
} from "./support/assertions";
import { e2eEnv } from "./support/env";
import { useRuntimeSource } from "./support/runtime-source";
import { parseTargetSpec, targetSpecKey } from "./support/target";
import { readTargetsFile } from "./support/targets-file";

const { videos, courseLabel } = readTargetsFile(
  targetSpecKey(parseTargetSpec(e2eEnv)),
);

for (const video of videos) {
  // index/total in the title so an artifact found weeks later is traceable to a
  // position in the course, not only to a title LearningSuite may have renamed.
  test.describe(`${courseLabel} · ${video.index}/${video.total} · ${video.title}`, () => {
    test.beforeEach(async ({ page }, testInfo) => {
      const source = await useRuntimeSource(page);
      testInfo.annotations.push({
        type: "runtime",
        description:
          source.mode === "preview"
            ? `preview bundle: ${source.scriptUrl}`
            : "deployed bundle (LearningSuite's own script tag)",
      });
      await page.goto(video.url, { waitUntil: "domcontentloaded" });
      await waitForReskinSettled(page);
    });

    // Runs for passes and failures alike: on a red build weeks from now the
    // discovery strategy and readyState are the first things anyone wants, and
    // on a green one this is the record of what healthy looked like.
    test.afterEach(async ({ page }, testInfo) => {
      await attachDiag(page, testInfo);
    });

    test("reskin-player mounts on the live page", async ({
      page,
    }, testInfo) => {
      await expectReskinMounted(page, testInfo);
    });

    test("LearningSuite's own player chrome is present and usable", async ({
      page,
    }) => {
      await expectHostChromePresent(page);
    });

    test("LearningSuite's own mute works while the runtime is mounted", async ({
      page,
    }) => {
      await expectHostMuteWorks(page);
    });

    test("pressing play advances playback", async ({ page }, testInfo) => {
      await expectPlaybackAdvances(page, testInfo);
    });

    test("demo-overlays mounts", async ({ page }, testInfo) => {
      // Whether an arbitrary lesson carries demo config cannot be known in
      // advance, so the skip is decided here, at run time, from whether the
      // bundle ran at all. A skip is honest; a demo assertion that passes
      // because nothing was there to check is not.
      test.skip(
        !(await demoScriptRan(page)),
        "demo-overlays.js never ran on this lesson (no demo config, or its gate did not pass)",
      );
      await expectDemoMounted(page, testInfo);
    });

    // P6 (spec M15): LearningSuite inserts its lesson column next to <main>
    // when the window crosses 1536px (MUI xl) after load. Unhidden, it squeezed
    // the player from 553×312 to 317×179. Lesson-independent invariant:
    // widening the window never shrinks the player.
    test("widening past LearningSuite's xl breakpoint never shrinks the player", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForReskinSettled(page);
      test.skip(
        !(await demoScriptRan(page)),
        "demo-overlays.js never ran on this lesson",
      );
      await page.waitForFunction(
        () => !!document.getElementById("vp-slot-tl")?.parentElement,
        undefined,
        { timeout: 30_000 },
      );
      const flexSibling = await page.evaluate(() => {
        const sb = document.getElementById("vp-demo-sidebar");
        return (
          !!sb &&
          sb.parentElement === document.querySelector("main")?.parentElement
        );
      });
      test.skip(
        !flexSibling,
        "the sidebar is not a flex sibling of <main> on this lesson, so there is nothing to squeeze",
      );
      const before = await hostBox(page);

      await page.setViewportSize({ width: 1600, height: 900 });
      // setViewportSize resolves BEFORE the page's resize/media-query change and
      // React's commit (verified), so wait for the column itself.
      const inserted = await page
        .waitForFunction(
          () =>
            (document.querySelector("main")?.parentElement?.children.length ??
              0) >= 3,
          undefined,
          { timeout: 10_000 },
        )
        .then(() => true)
        .catch(() => false);
      test.skip(
        !inserted,
        "LearningSuite rendered no extra column next to <main> at 1600 on this lesson",
      );
      await page.evaluate(
        () =>
          new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          ),
      );

      const extraHidden = await page.evaluate(() => {
        const parent = document.querySelector("main")!.parentElement!;
        return [...parent.children]
          .filter((c) => c.tagName !== "MAIN" && c.id !== "vp-demo-sidebar")
          .every((c) => getComputedStyle(c).display === "none");
      });
      expect(
        extraHidden,
        "the column LearningSuite inserted next to <main> must be hidden",
      ).toBe(true);
      expect(
        (await hostBox(page)).w,
        "widening the window must never shrink the lesson player (spec M15)",
      ).toBeGreaterThanOrEqual(before.w - 1);
    });
  });
}
