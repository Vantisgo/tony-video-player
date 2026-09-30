// Playwright config for the LearningSuite overlay canary. Deliberately separate
// from vitest: `bun test` stays hermetic (happy-dom, our own fixtures) and this
// suite is the only thing that touches the real, third-party, auth-gated
// platform. Specs are named `*.spec.ts` so the vitest `include`
// (`**/*.test.ts`) can never pick them up.
import { defineConfig } from "@playwright/test";

// Loads `.env.local` as a side effect and validates the result — a missing or
// malformed variable fails here, by name, before a browser is ever launched.
import { e2eEnv } from "./e2e/support/env";

export const STORAGE_STATE = "e2e/.auth/ls.json";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",

  // Real network, a third-party SPA and HLS startup. The default 30s fails on a
  // slow LearningSuite render long before it fails on a broken runtime.
  timeout: 90_000,
  expect: { timeout: 15_000 },

  // One shared LearningSuite account: parallel sessions on a single SaaS login
  // are how you get logged out mid-run.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  forbidOnly: !!process.env.CI,

  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: e2eEnv.E2E_LS_BASE_URL,
    // Bunny serves H.264/AAC HLS; Playwright's bundled Chromium may ship without
    // those proprietary codecs, which would fail the playback assertion for a
    // reason that has nothing to do with our runtime. Pinned on purpose — do not
    // downgrade to `chromium` to make a machine without Chrome pass.
    channel: "chrome",
    // First failure only, never the retries: a trace records every network body,
    // HLS segments included, so each failed attempt of a playing test adds
    // ~90MB. Keeping all three attempts made run 36717980370's report 2.5GB
    // (6 tests × 3 attempts); the retries fail the same way and add nothing a
    // reader of the first trace lacks.
    trace: "retain-on-first-failure",
    video: "retain-on-first-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      args: ["--mute-audio", "--autoplay-policy=no-user-gesture-required"],
    },
  },

  projects: [
    // Logs in once per run and persists the session.
    { name: "setup", testMatch: /auth\.setup\.ts$/ },

    // Turns the two parameters into e2e/.auth/targets.json.
    //
    // NOT chained to `canary` via `dependencies`. Playwright fixes its test list
    // while loading spec files, so a targets.json written by a project in the
    // same run arrives too late to create tests — the suite would report success
    // having asserted nothing. `scripts/e2e.ts` runs the two as separate
    // invocations instead. See Task 2/10 of the plan before "simplifying" this.
    {
      name: "resolve",
      testMatch: /resolve\.setup\.ts$/,
      dependencies: ["setup"],
      use: { storageState: STORAGE_STATE },
    },

    // The canary itself: one test group per resolved video.
    //
    // testIgnore: the top-level testMatch hands every *.spec.ts to every
    // project that does not narrow it, so without this the desktop project
    // would also run the phone spec at its own 1280×720 viewport.
    {
      name: "canary",
      testIgnore: /overlay-mobile\.spec\.ts$/,
      dependencies: ["setup"],
      use: { storageState: STORAGE_STATE },
    },

    // Phone geometry on the real host page. hasTouch — not isMobile — is what
    // flips (hover:hover) to false and (pointer:coarse) to true (verified,
    // Chrome 154), and the compact overlay CSS keys on both. Reads the same
    // targets.json that `resolve` wrote; see the note above for why it is not a
    // dependency.
    {
      name: "canary-mobile",
      testMatch: /overlay-mobile\.spec\.ts$/,
      dependencies: ["setup"],
      use: {
        storageState: STORAGE_STATE,
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
