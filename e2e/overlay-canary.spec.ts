// The canary: does the injected runtime still mount and work on the real
// LearningSuite page?
//
// The targets file is read at MODULE SCOPE, not in a hook. That is what makes
// one-test-per-video possible: Playwright fixes its test list while loading this
// file, so anything that creates tests has to exist before the module runs.
// Moving this call into `beforeAll` would collect zero tests and report a green
// run that asserted nothing — which is also why `bun run e2e` is a script that
// invokes Playwright twice, rather than a `dependencies: ["resolve"]` chain.
import { test } from "@playwright/test";

import {
  attachDiag,
  demoScriptRan,
  expectDemoMounted,
  expectNativeChromeHidden,
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

    test("native player chrome is hidden", async ({ page }) => {
      await expectNativeChromeHidden(page);
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
  });
}
