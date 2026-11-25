import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_PORT || 4173);
const USE_PREVIEW = process.env.PLAYWRIGHT_PREVIEW === "1";

export default defineConfig({
  testDir: "tests",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  // 构建耗时与帧数断言对 CPU 敏感，不能两个浏览器同时跑
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    trace: "retain-on-failure",
  },
  webServer: {
    command: USE_PREVIEW
      ? `pnpm preview --port ${PORT} --strictPort`
      : `pnpm dev --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !USE_PREVIEW,
    timeout: 90_000,
    env: { NODE_ENV: USE_PREVIEW ? "production" : "development" },
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
