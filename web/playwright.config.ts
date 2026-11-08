import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  // Software WebGL (SwiftShader) renders the scene and landing shader on the CPU, and tests run in
  // parallel; a few interaction tests need more than 30 s under that load.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 3,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        // Software WebGL so the 3D scene renders in headless runs.
        launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
      },
    },
  ],
  // Test the production build on its own port AND in its own build folder (.next-e2e), so a
  // running `npm run dev` (port 3000, folder .next) is not disturbed. Set via `env` rather than
  // in the command string so it also works on Windows.
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    env: { NEXT_DIST_DIR: ".next-e2e" },
    url: `http://localhost:${PORT}`,
    timeout: 240_000,
    reuseExistingServer: false,
  },
});
