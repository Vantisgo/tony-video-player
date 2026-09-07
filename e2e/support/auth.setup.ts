// One LearningSuite login per run, persisted as storageState so no test ever
// touches the login form.
//
// Locators recorded with `playwright codegen` against robbins.greator.com on
// 2026-08-07 and confirmed by a live login. The structural `.or(...)` fallbacks
// are kept behind them on purpose: the accessible names are half German
// ("E-Mail") and half English ("Password", "Login"), so a tenant language switch
// would otherwise break the suite at its first step.
//
// The session is NOT a cookie — LearningSuite keeps a refresh token in
// localStorage (`auth_refresh_token_<tenantId>`). Playwright's storageState
// captures localStorage per origin, so this still works, but note that a
// storageState with zero cookies is normal here and not a sign of a failed login.
import { statSync } from "node:fs";

import { expect, test as setup } from "@playwright/test";

import { STORAGE_STATE } from "../../playwright.config";
import { e2eEnv } from "./env";

// Both phases of a run trigger `setup`. Re-logging in a few seconds apart on one
// shared SaaS account is exactly the pattern that gets a session invalidated, so
// a recent session is reused instead.
const SESSION_MAX_AGE_MS = 30 * 60 * 1000;

function sessionAgeMs(): number | null {
  try {
    return Date.now() - statSync(STORAGE_STATE).mtimeMs;
  } catch {
    return null;
  }
}

// The login page is the one place we must be able to recognise, because
// "bounced back to login" is how every auth failure presents itself.
function isLoginUrl(url: URL): boolean {
  return (
    url.pathname.startsWith(e2eEnv.E2E_LS_LOGIN_PATH) ||
    /\b(auth|login|signin|sign-in|anmelden)\b/i.test(url.pathname)
  );
}

setup("authenticate", async ({ page }) => {
  const age = sessionAgeMs();
  if (age !== null && age < SESSION_MAX_AGE_MS) {
    setup.skip(
      true,
      `Reusing the session saved ${Math.round(age / 1000)}s ago (${STORAGE_STATE}).`,
    );
    return;
  }

  const loginUrl = new URL(e2eEnv.E2E_LS_LOGIN_PATH, e2eEnv.E2E_LS_BASE_URL)
    .href;
  await page.goto(loginUrl, { waitUntil: "domcontentloaded" });

  // A consent overlay blocks the form for every test that follows, so it is
  // dismissed here, once. Absent is the normal case — never fail on it.
  const consent = page
    .getByRole("button", {
      name: /accept|akzeptieren|zustimmen|einverstanden/i,
    })
    .first();
  await consent.click({ timeout: 3_000 }).catch(() => {});

  const email = page
    .getByRole("textbox", { name: "E-Mail" })
    .or(page.locator('input[type="email"]'))
    .first();
  const password = page
    .getByRole("textbox", { name: "Password" })
    .or(page.locator('input[type="password"]'))
    .first();
  const submit = page
    .getByRole("button", { name: /^(log ?in|anmelden|einloggen)$/i })
    .or(page.locator('button[type="submit"]'))
    .first();

  await expect(
    email,
    `No email field found on ${loginUrl}. Either the login path is wrong ` +
      "(set E2E_LS_LOGIN_PATH) or the form changed — re-record it with " +
      "`bunx playwright codegen`.",
  ).toBeVisible();

  await email.fill(e2eEnv.E2E_LS_EMAIL);
  await password.fill(e2eEnv.E2E_LS_PASSWORD);
  await submit.click();

  // Leaving the login page is the signal, not a fixed post-login URL: which page
  // LearningSuite lands on depends on the account's course list.
  try {
    await page.waitForURL((url) => !isLoginUrl(url), { timeout: 30_000 });
  } catch (cause) {
    throw new Error(
      "LearningSuite login failed — still on the login page after submitting.\n" +
        `Account: ${e2eEnv.E2E_LS_EMAIL} (password not shown).\n` +
        "Check E2E_LS_EMAIL / E2E_LS_PASSWORD, whether the account is locked, " +
        "and whether MFA has been enforced (this suite cannot answer an MFA prompt).",
      { cause },
    );
  }

  // Proves the session is actually usable rather than merely that a redirect
  // happened: request an authenticated page and confirm it is not bounced back.
  const coursesUrl = new URL(e2eEnv.E2E_LS_COURSES_PATH, e2eEnv.E2E_LS_BASE_URL)
    .href;
  await page.goto(coursesUrl, { waitUntil: "domcontentloaded" });
  expect(
    isLoginUrl(new URL(page.url())),
    `Authenticated request to ${coursesUrl} was redirected back to the login page — ` +
      "the session did not stick (cookie blocked, or the login only appeared to succeed).",
  ).toBe(false);

  await page.context().storageState({ path: STORAGE_STATE });
});
