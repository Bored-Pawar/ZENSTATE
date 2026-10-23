import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: process.env.BROWSER_BASE_URL || "http://127.0.0.1:5173",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath:
        process.env.BROWSER_BINARY ||
        (process.platform === "win32"
          ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
          : undefined),
    },
  },
  reporter: "list",
  outputDir: ".test-artifacts/browser",
});
