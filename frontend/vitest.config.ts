import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";

import { playwright } from "@vitest/browser-playwright";

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(dirname, "src"),
      "@tests": path.join(dirname, "tests"),
    },
  },
  test: {
    projects: [
      {
        // Unit + integration tests (jsdom). Run with `pnpm test`.
        extends: true,
        plugins: [react()],
        test: {
          name: "unit",
          environment: "jsdom",
          globals: true,
          // Integration specs mount the full provider tree and round-trip
          // through MSW; the 5s default is tight for the first spec in a file,
          // which also pays the module-loading cost.
          testTimeout: 15_000,
          setupFiles: ["./tests/setup/vitest.setup.ts"],
          include: [
            "tests/unit/**/*.test.{ts,tsx}",
            "tests/integration/**/*.test.{ts,tsx}",
            "src/**/*.test.{ts,tsx}",
          ],
          exclude: ["node_modules/**", ".next/**", "**/*.stories.*"],
        },
      },
      {
        // Storybook interaction/a11y tests (real browser via Playwright).
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({ configDir: path.join(dirname, ".storybook") }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
