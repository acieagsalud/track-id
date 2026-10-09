import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/** Smoke tests run against a production build in demo mode: no DB, Spotify or MixesDB needed. */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    env: { NEXT_PUBLIC_DEMO: "true" },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
