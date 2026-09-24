import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: [
      "runtime-src/**/*.test.ts",
      "app/**/*.test.ts",
      "lib/**/*.test.ts",
      // The e2e harness's pure helpers only. The Playwright suite is `*.spec.ts`
      // and can never be matched here — that naming split is what keeps vitest
      // from trying to run browser specs in happy-dom.
      "e2e/**/*.test.ts",
    ],
  },
});
