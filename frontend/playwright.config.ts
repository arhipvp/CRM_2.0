import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.FRONTEND_SERVICE_PORT ?? process.env.PORT ?? "3000";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [["list"], ["html", { outputFolder: "./playwright-report" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    reuseExistingServer: !process.env.CI,
    cwd: __dirname,
    port: Number(PORT),
    stdout: "pipe",
    stderr: "pipe",
  },
});
