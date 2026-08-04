import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: [
      "runtime-src/**/*.test.ts",
      "app/**/*.test.ts",
      "lib/**/*.test.ts",
    ],
  },
});
